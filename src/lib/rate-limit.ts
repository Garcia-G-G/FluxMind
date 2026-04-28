import { NextResponse } from "next/server";
import { getConnection } from "@/lib/queue";

/**
 * Redis-backed fixed-window rate limiter.
 *
 * Implementation: INCR + EXPIRE (first request sets the window). O(1) per
 * request, memory is one integer per (bucket, window). No Lua script — the
 * EXPIRE race on first request is tolerable (the counter just gets a fresh
 * TTL; the window shifts by ~1s worst case, not enough to abuse).
 *
 * Usage inside a route handler:
 *
 *   const limited = await checkRateLimit({ userId, bucket: "studio.slides", limit: 10, windowMs: 60_000 });
 *   if (limited) return limited;   // 429 response
 *
 * If Redis is unavailable, the limiter fails open (logs the error, returns
 * null) so an outage doesn't take the product down.
 */

export type RateLimitArgs = {
  /** Unique principal — usually the user id. Falls back to IP if unavailable. */
  userId: string;
  /** Namespace for the bucket (e.g. "chat", "studio.slides"). */
  bucket: string;
  /** Max requests allowed in the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const windowKey = (windowMs: number): number => {
  return Math.floor(Date.now() / windowMs);
};

export const consumeRateLimit = async ({
  userId,
  bucket,
  limit,
  windowMs,
}: RateLimitArgs): Promise<RateLimitResult> => {
  const key = `rl:${bucket}:${userId}:${windowKey(windowMs)}`;
  const ttlSec = Math.ceil(windowMs / 1000);

  try {
    const redis = getConnection();
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttlSec);
    }

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const resetAt = (windowKey(windowMs) + 1) * windowMs;

    return { allowed, remaining, resetAt };
  } catch (err) {
    console.warn(`Rate limiter failed open for ${bucket}:`, err);
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
  }
};

/**
 * Convenience wrapper that returns a 429 NextResponse when over the limit,
 * or `null` when the caller is allowed to proceed.
 */
export const checkRateLimit = async (
  args: RateLimitArgs,
): Promise<NextResponse | null> => {
  const result = await consumeRateLimit(args);
  if (result.allowed) return null;

  const retryAfterSec = Math.max(
    1,
    Math.ceil((result.resetAt - Date.now()) / 1000),
  );
  return NextResponse.json(
    {
      error: "Rate limit exceeded",
      retryAfter: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": String(args.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
      },
    },
  );
};

// ── Preset buckets ────────────────────────────────────────────────────
// Studio generators are expensive (AI + image/audio APIs). Chat is cheaper
// but streaming. Uploads are bandwidth. Tune per bucket.

export const RATE_LIMITS = {
  chat: { limit: 30, windowMs: 60_000 },
  ttsStream: { limit: 20, windowMs: 60_000 },
  studioGenerate: { limit: 10, windowMs: 60_000 },
  studioVideo: { limit: 3, windowMs: 5 * 60_000 },
  studioPodcast: { limit: 5, windowMs: 10 * 60_000 },
  deepResearch: { limit: 5, windowMs: 10 * 60_000 },
  uploadFile: { limit: 30, windowMs: 60_000 },
  searchSource: { limit: 10, windowMs: 60_000 },
  /** Narrate spends ElevenLabs credits per call. Tighter than chat. */
  studioNarrate: { limit: 8, windowMs: 60_000 },
  /** Interactive Q&A — one LLM + RAG call. Comparable to chat. */
  studioInteractive: { limit: 30, windowMs: 60_000 },
  /** Source discovery — LLM + 5-8 Serper calls. Limit aggressively. */
  discoverSources: { limit: 6, windowMs: 60_000 },
  /** URL scraping — up to 25 URLs per call. Tighter still. */
  scrapeSources: { limit: 10, windowMs: 60_000 },
  /** Progress writes (quiz / flashcard). Tight to prevent abuse. */
  progress: { limit: 60, windowMs: 60_000 },
} as const;
