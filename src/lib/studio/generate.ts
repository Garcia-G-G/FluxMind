import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { sources } from "@/db/schema/sources";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export type StudioContext = {
  userId: string;
  notebookId: string;
  notebookTitle: string;
  sourceContext: string;
};

type StudioRateBucket = keyof typeof RATE_LIMITS;

/**
 * Shared pre-flight for every studio generator:
 *  1. Verify session.
 *  2. Optional per-bucket rate limit (e.g. "studioGenerate", "studioVideo").
 *  3. Verify the user owns the notebook (no id-guessing).
 *  4. Pull processed source text for the prompt.
 *
 * Returns a studio context or a `{ error, status }` the route can pass
 * straight to NextResponse.json.
 */
export const getStudioContext = async (
  notebookId: string,
  rateLimitBucket?: StudioRateBucket,
): Promise<
  | StudioContext
  | { error: string; status: number; retryAfter?: number }
> => {
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

  const [notebook] = await db
    .select({ userId: notebooks.userId, title: notebooks.title })
    .from(notebooks)
    .where(eq(notebooks.id, notebookId));

  if (!notebook || notebook.userId !== session.user.id) {
    return { error: "Not found", status: 404 };
  }

  const notebookSources = await db
    .select({ title: sources.title, rawText: sources.rawText })
    .from(sources)
    .where(eq(sources.notebookId, notebookId));

  const sourceContext = notebookSources
    .filter((s) => s.rawText)
    .map((s) => `[${s.title}]\n${s.rawText!.slice(0, 5000)}`)
    .join("\n\n---\n\n");

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
