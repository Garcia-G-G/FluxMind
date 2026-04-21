import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Request-scoped memoized session lookup.
 *
 * `cache()` from React 19 dedupes calls with identical (no) arguments
 * within a single server render/request. Calling this helper multiple
 * times inside the same request — layout, nested server components,
 * server actions fanned out from the same request — only hits Better
 * Auth (and its DB round-trip) once.
 *
 * Across requests there's no sharing: each new request gets a fresh
 * cache. Use this in server components; API routes should continue to
 * call `auth.api.getSession` directly since they already have a single
 * entry point.
 */
export const getCachedSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
