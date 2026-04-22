import { headers } from "next/headers";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { sources } from "@/db/schema/sources";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Hard caps on how much source material a studio generator sees.
 *   - At most STUDIO_MAX_SOURCES sources per generation (by most-recently-updated).
 *   - Each source's rawText is truncated to STUDIO_MAX_CHARS_PER_SOURCE AT THE DB
 *     level (SUBSTRING) so we don't transfer a 1MB PDF's full text for a
 *     generator that will slice it in JS anyway.
 *   - Combined context capped at STUDIO_MAX_TOTAL_CHARS as a safety rail.
 */
const STUDIO_MAX_SOURCES = 8;
const STUDIO_MAX_CHARS_PER_SOURCE = 6000;
const STUDIO_MAX_TOTAL_CHARS = 32_000;

export type StudioContext = {
  userId: string;
  notebookId: string;
  notebookTitle: string;
  sourceContext: string;
};

export type StudioError = {
  error: string;
  status: number;
  retryAfter?: number;
};

type StudioRateBucket = keyof typeof RATE_LIMITS;

/**
 * Shared pre-flight for every studio generator:
 *  1. Verify session.
 *  2. Optional per-bucket rate limit (e.g. "studioGenerate", "studioVideo").
 *  3. Verify the user owns the notebook (no id-guessing).
 *  4. Pull processed source text for the prompt, optionally filtered by a
 *     subset of source IDs the caller selected in the generate-dialog.
 *
 * Returns a studio context or a `{ error, status }` the route can pass
 * straight to NextResponse.json.
 */
export const getStudioContext = async (
  notebookId: string,
  selectedSourceIds?: string[],
  rateLimitBucket?: StudioRateBucket,
): Promise<StudioContext | StudioError> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { error: "Unauthorized", status: 401 };
  }

  if (rateLimitBucket) {
    const limit = RATE_LIMITS[rateLimitBucket];
    const result = await consumeRateLimit({
      userId: session.user.id,
      bucket: rateLimitBucket,
      ...limit,
    });
    if (!result.allowed) {
      const retryAfter = Math.max(
        1,
        Math.ceil((result.resetAt - Date.now()) / 1000),
      );
      return { error: "Rate limit exceeded", status: 429, retryAfter };
    }
  }

  // When the caller passed a non-empty selection, restrict the sources
  // query to just those IDs. An empty array or undefined = include all.
  const hasSelection =
    Array.isArray(selectedSourceIds) && selectedSourceIds.length > 0;
  const sourceWhere = hasSelection
    ? and(
        eq(sources.notebookId, notebookId),
        inArray(sources.id, selectedSourceIds as string[]),
      )
    : eq(sources.notebookId, notebookId);

  // Ownership check and source fetch are independent — fire both in
  // parallel. If the notebook is missing or owned by someone else, we
  // throw the same 404 sentinel as before; the sources query result is
  // discarded in that path.
  //
  // Truncate raw text at the DB level so the Postgres->app hop only
  // carries what we'll actually feed the model. Ready-only, most-recent
  // first (desc updatedAt).
  const [notebookRows, notebookSources] = await Promise.all([
    db
      .select({ userId: notebooks.userId, title: notebooks.title })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId)),
    db
      .select({
        title: sources.title,
        rawText: sql<string>`LEFT(${sources.rawText}, ${STUDIO_MAX_CHARS_PER_SOURCE})`.as(
          "raw_text",
        ),
      })
      .from(sources)
      .where(sourceWhere)
      .orderBy(desc(sources.updatedAt))
      .limit(STUDIO_MAX_SOURCES),
  ]);

  const notebook = notebookRows[0];
  if (!notebook || notebook.userId !== session.user.id) {
    return { error: "Not found", status: 404 };
  }

  let total = 0;
  const parts: string[] = [];
  for (const s of notebookSources) {
    if (!s.rawText) continue;
    const block = `[${s.title}]\n${s.rawText}`;
    if (total + block.length > STUDIO_MAX_TOTAL_CHARS) break;
    parts.push(block);
    total += block.length + 6; // +6 for the `\n\n---\n\n` separator
  }
  const sourceContext = parts.join("\n\n---\n\n");

  if (!sourceContext.trim()) {
    return { error: "No processed sources available", status: 400 };
  }

  return {
    userId: session.user.id,
    notebookId,
    notebookTitle: notebook.title,
    sourceContext,
  };
};

export const isError = (
  ctx: StudioContext | { error: string; status: number }
): ctx is { error: string; status: number } => {
  return "error" in ctx;
};
