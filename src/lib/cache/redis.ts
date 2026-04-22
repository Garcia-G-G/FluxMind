import { getConnection } from "@/lib/queue";

/**
 * Redis-backed JSON cache. Thin wrapper around the shared ioredis singleton
 * from @/lib/queue so we don't open a second connection.
 *
 * Every helper is defensive: if Redis is unreachable (no REDIS_URL, transient
 * socket drop, anything), the helpers return `null` / no-op instead of
 * throwing. The caller is expected to fall through to the database path on
 * `null`, so a Redis outage degrades to "cache miss everywhere" rather than
 * a 500.
 */

/**
 * Read a JSON-encoded value. Returns null on miss, parse error, or Redis
 * failure. Generic type is unchecked — callers should treat `T` as a hint
 * only and validate shape themselves when it matters.
 */
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    const redis = getConnection();
    const raw = await redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  } catch (err) {
    console.warn(`[cache] get failed for ${key}:`, err);
    return null;
  }
};

/**
 * Write a JSON-encoded value with a TTL in seconds. Silently no-ops if
 * Redis is down — caching is best-effort.
 */
export const cacheSet = async (
  key: string,
  value: unknown,
  ttlSec: number,
): Promise<void> => {
  try {
    const redis = getConnection();
    await redis.set(key, JSON.stringify(value), "EX", ttlSec);
  } catch (err) {
    console.warn(`[cache] set failed for ${key}:`, err);
  }
};

/**
 * Invalidate a single key. Safe to call from mutation handlers —
 * never throws. Use `cacheDelSafe` from a try/catch if you want a
 * zero-cost guarantee, but this helper already swallows errors.
 */
export const cacheDel = async (key: string): Promise<void> => {
  try {
    const redis = getConnection();
    await redis.del(key);
  } catch (err) {
    console.warn(`[cache] del failed for ${key}:`, err);
  }
};

/**
 * Convenience builder for the stats cache key. Centralizing this keeps the
 * mutation-route invalidation in sync with the read route if we ever change
 * the key format.
 */
export const statsCacheKey = (userId: string): string => `stats:${userId}`;

/**
 * Dashboard-level cache key — the entire { notebooks, stats } payload the
 * Server Component builds on load. 60s TTL, invalidated by every mutation
 * route that changes notebooks / sources / outputs / conversations.
 */
export const dashboardCacheKey = (userId: string): string =>
  `dashboard:${userId}`;
