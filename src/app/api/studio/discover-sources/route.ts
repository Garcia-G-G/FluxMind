import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { generateObject } from "ai";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { sources } from "@/db/schema/sources";
import { getModel } from "@/lib/ai/models";
import { searchWeb, type SearchResult } from "@/lib/research/web-search";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const maxDuration = 45;

export type DiscoveredSource = {
  url: string;
  title: string;
  snippet: string;
  domain: string;
  favicon: string;
};

const querySchema = z.object({
  queries: z
    .array(
      z.object({
        query: z.string(),
        intent: z.enum([
          "statistics",
          "howto",
          "comparison",
          "deepdive",
          "trends",
        ]),
      }),
    )
    .min(5)
    .max(8),
});

// Social/forum domains we exclude — exact host match OR any subdomain.
const BLOCKED_DOMAINS = [
  "twitter.com",
  "x.com",
  "facebook.com",
  "reddit.com",
  "pinterest.com",
  "tiktok.com",
  "instagram.com",
  "quora.com",
];

// YouTube goes through a different ingestion path, skip for discovery.
const YOUTUBE_DOMAINS = ["youtube.com", "youtu.be"];

const isBlockedHost = (host: string): boolean => {
  const h = host.toLowerCase();
  const all = [...BLOCKED_DOMAINS, ...YOUTUBE_DOMAINS];
  return all.some((d) => h === d || h.endsWith(`.${d}`));
};

const parseHostname = (url: string): string | null => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
};

export const POST = async (
  request: NextRequest,
): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const limited = await checkRateLimit({
      userId: session.user.id,
      bucket: "studio.discover",
      ...RATE_LIMITS.discoverSources,
    });
    if (limited) return limited;

    const body = await request.json();
    const notebookId =
      typeof body?.notebookId === "string" ? body.notebookId : "";
    const userQuery =
      typeof body?.query === "string" && body.query.trim().length > 0
        ? body.query.trim()
        : null;

    if (!notebookId) {
      return NextResponse.json(
        { error: "notebookId required", sources: [] },
        { status: 400 },
      );
    }

    // Load notebook and verify ownership.
    const [notebook] = await db
      .select({ userId: notebooks.userId, title: notebooks.title })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));

    if (!notebook || notebook.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Not found", sources: [] },
        { status: 404 },
      );
    }

    // Existing sources — titles + any original URLs for dedup.
    const existingSources = await db
      .select({
        title: sources.title,
        originalUrl: sources.originalUrl,
      })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));

    const existingTitles = existingSources
      .map((s) => s.title)
      .filter((t): t is string => !!t && t.trim().length > 0);
    const existingUrls = new Set(
      existingSources
        .map((s) => s.originalUrl)
        .filter((u): u is string => !!u && u.trim().length > 0)
        .map((u) => u.trim()),
    );

    // ── Step 1: generate diverse search queries via the LLM ──
    const titleSummary =
      existingTitles.length > 0
        ? existingTitles.slice(0, 20).join(", ")
        : "(none yet)";
    const topicSummary = `Topic: "${notebook.title}". Existing sources cover: ${titleSummary}.${
      userQuery ? ` User focus: ${userQuery}` : ""
    }`;

    let generatedQueries: z.infer<typeof querySchema>["queries"];
    try {
      const { object } = await generateObject({
        model: getModel("gemini-2.5-flash"),
        schema: querySchema,
        prompt: `You are a research assistant selecting web search queries to enrich a knowledge notebook.

${topicSummary}

Generate 5 to 8 DIVERSE web search queries that a researcher would run to broaden this notebook. Your queries MUST cover the 5 intents below — include at least one of each (unless the topic clearly doesn't admit it):

- statistics: numeric facts, percentages, survey results
- howto: practical step-by-step guidance, tutorials
- comparison: alternatives, trade-offs, "X vs Y"
- deepdive: authoritative long-form explainers or foundational references
- trends: recent developments, 2024-2026 updates, what's changing

Rules:
- Queries must be specific and likely to return high-quality first-page Google results.
- Avoid phrasing like "what is" — prefer concrete, keyword-rich queries.
- Each query should be distinct — do NOT reissue near-duplicates.
- If the user provided a "User focus", at least 2 queries must reflect it.
- Return 5 to 8 queries (no more, no less).`,
      });
      generatedQueries = object.queries;
    } catch (err) {
      console.error("discover-sources: query generation failed:", err);
      return NextResponse.json(
        {
          error: "Failed to generate search queries",
          sources: [] as DiscoveredSource[],
        },
        { status: 500 },
      );
    }

    // ── Step 2: fan out to searchWeb in parallel ──
    const searchResults: SearchResult[][] = await Promise.all(
      generatedQueries.map((q) => searchWeb(q.query, 5).catch(() => [])),
    );

    // Graceful empty if Serper missing — every array is [].
    const flat: SearchResult[] = searchResults.flat();

    // ── Step 3: dedupe, filter, cap per-domain, cap total ──
    const seenUrls = new Set<string>();
    const perDomain = new Map<string, number>();
    const accepted: DiscoveredSource[] = [];

    for (const r of flat) {
      if (!r.url || !r.title) continue;
      if (seenUrls.has(r.url)) continue;
      if (existingUrls.has(r.url)) continue;

      const host = parseHostname(r.url);
      if (!host) continue;
      if (isBlockedHost(host)) continue;

      // Snippet length guard: skip thin previews.
      if (!r.snippet || r.snippet.length < 60) continue;

      // Title-equality check against existing notebook source titles.
      if (
        existingTitles.some(
          (t) => t.trim().toLowerCase() === r.title.trim().toLowerCase(),
        )
      ) {
        continue;
      }

      // Per-domain cap of 2 for diversity.
      const used = perDomain.get(host) ?? 0;
      if (used >= 2) continue;
      perDomain.set(host, used + 1);

      seenUrls.add(r.url);
      accepted.push({
        url: r.url,
        title: r.title,
        snippet: r.snippet,
        domain: host,
        favicon: `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
      });

      if (accepted.length >= 25) break;
    }

    return NextResponse.json({ sources: accepted });
  } catch (error) {
    console.error("discover-sources failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "unexpected error",
        sources: [] as DiscoveredSource[],
      },
      { status: 500 },
    );
  }
};
