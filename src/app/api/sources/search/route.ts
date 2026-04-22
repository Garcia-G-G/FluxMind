import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { sources, sourceChunks } from "@/db/schema/sources";
import { chunkText, estimateTokenCount } from "@/lib/processing/chunker";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { searchWeb, type SearchResult } from "@/lib/research/web-search";
import { scrapePage } from "@/lib/research/web-scrape";

export const maxDuration = 60;

const SEARCH_LIMIT = 10;
const SCRAPE_LIMIT = 8;
const MAX_COMBINED_CHARS = 80_000;

type FoundUrl = {
  url: string;
  title: string;
  domain: string;
  favicon: string;
};

const faviconFor = (hostname: string): string =>
  `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await checkRateLimit({
      userId: session.user.id,
      bucket: "sources.search",
      ...RATE_LIMITS.searchSource,
    });
    if (limited) return limited;

    const { query, notebookId } = await request.json();
    if (!query?.trim() || !notebookId) {
      return NextResponse.json(
        { error: "query and notebookId required" },
        { status: 400 },
      );
    }

    // Verify notebook ownership
    const [notebook] = await db
      .select({ userId: notebooks.userId })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));

    if (!notebook || notebook.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const trimmedQuery = query.trim();
    const sourceId = createId();
    const now = new Date();

    // ── Step 1: Real web search (Serper) ──
    let searchResults: SearchResult[] = [];
    try {
      searchResults = await searchWeb(trimmedQuery, SEARCH_LIMIT);
    } catch (err) {
      console.error("searchWeb failed:", err);
      // Fall through with empty results — we still create an error source
      // so the user sees *something* and can retry.
    }

    // ── Step 2: Scrape top results in parallel ──
    type ScrapedItem = FoundUrl & { content: string };
    const scrapedItems: ScrapedItem[] = [];

    const scrapeResults = await Promise.allSettled(
      searchResults.slice(0, SCRAPE_LIMIT).map(
        async (result): Promise<ScrapedItem | null> => {
          const page = await scrapePage(result.url);
          if (!page || page.content.length < 100) return null;
          const hostname = hostnameOf(result.url);
          return {
            url: result.url,
            title: page.title || result.title || hostname,
            domain: hostname,
            favicon: faviconFor(hostname),
            content: page.content,
          };
        },
      ),
    );
    for (const r of scrapeResults) {
      if (r.status === "fulfilled" && r.value) scrapedItems.push(r.value);
    }

    // ── Step 3: Combine scraped content (capped) ──
    let combined = "";
    for (const s of scrapedItems) {
      const section = `\n\n## ${s.title}\nSource: ${s.url}\n\n${s.content}`;
      if (combined.length + section.length > MAX_COMBINED_CHARS) break;
      combined += section;
    }
    const rawText = combined.trim();

    // ── Step 4: Build foundUrls (scraped first, then remaining search hits) ──
    const foundUrls: FoundUrl[] = scrapedItems.map(
      ({ url, title, domain, favicon }) => ({ url, title, domain, favicon }),
    );
    for (const sr of searchResults) {
      if (foundUrls.some((f) => f.url === sr.url)) continue;
      const hostname = hostnameOf(sr.url);
      foundUrls.push({
        url: sr.url,
        title: sr.title || hostname,
        domain: hostname,
        favicon: faviconFor(hostname),
      });
    }

    const tokenCount = estimateTokenCount(rawText || trimmedQuery);
    const hasContent = rawText.length > 0;
    const status: "ready" | "error" = hasContent ? "ready" : "error";
    const errorMessage = !hasContent
      ? searchResults.length === 0
        ? "No web results — is SERPER_API_KEY configured?"
        : "Found results but all scrapes failed"
      : undefined;

    // ── Step 5: Insert source (single write, no "processing" round-trip — the
    //    search+scrape already happened synchronously above, so by the time
    //    we INSERT we already know the final state). ──
    const [source] = await db
      .insert(sources)
      .values({
        id: sourceId,
        notebookId,
        type: "txt",
        title: trimmedQuery,
        rawText: rawText || `Search: ${trimmedQuery}`,
        tokenCount,
        status,
        metadata: {
          origin: "web-search",
          query: trimmedQuery,
          foundUrls,
          searchResultCount: searchResults.length,
          scrapedCount: scrapedItems.length,
          ...(errorMessage ? { error: errorMessage } : {}),
        },
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // ── Step 6: Chunk + embed (only when we actually have content) ──
    if (hasContent) {
      try {
        const chunks = chunkText(rawText);
        if (chunks.length > 0) {
          const embeddings = await generateEmbeddings(
            chunks.map((c) => c.content),
          );
          const chunkRecords = chunks.map((chunk, i) => ({
            id: createId(),
            sourceId,
            content: chunk.content,
            embedding: embeddings[i],
            chunkIndex: chunk.chunkIndex,
            pageNumber: chunk.pageNumber,
            metadata: chunk.metadata,
            createdAt: new Date(),
          }));
          for (let i = 0; i < chunkRecords.length; i += 50) {
            await db
              .insert(sourceChunks)
              .values(chunkRecords.slice(i, i + 50));
          }
        }
      } catch (err) {
        // Embedding failure shouldn't void the whole source — the user still
        // has the foundUrls + content; RAG just won't retrieve from it until
        // retry.
        console.error("Embedding chunks failed for search source:", err);
      }
    }

    return NextResponse.json(
      {
        ...source,
        foundUrls,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
    console.error("Search source failed:", error);
    return NextResponse.json(
      { error: message || "Research failed" },
      { status: 500 },
    );
  }
};
