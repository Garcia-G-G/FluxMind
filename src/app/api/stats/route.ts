import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { count, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { sources } from "@/db/schema/sources";
import { conversations } from "@/db/schema/conversations";
import { outputs } from "@/db/schema/outputs";
import { cacheGet, cacheSet, statsCacheKey } from "@/lib/cache/redis";

type StatsPayload = {
  notebooks: number;
  sources: number;
  conversations: number;
  outputs: number;
};

// 60s TTL. Stats are a dashboard-level aggregate that changes only on
// user-initiated mutations (new notebook, new source, etc.). The mutation
// routes invalidate the key synchronously, so this TTL is a safety net for
// the case where cacheDel couldn't reach Redis.
const STATS_TTL_SECONDS = 60;

export const GET = async (): Promise<NextResponse> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const cacheKey = statsCacheKey(userId);

  const cached = await cacheGet<StatsPayload>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const [nbRes, srcRes, convRes, outRes] = await Promise.all([
    db
      .select({ value: count() })
      .from(notebooks)
      .where(eq(notebooks.userId, userId)),
    db
      .select({ value: count() })
      .from(sources)
      .innerJoin(notebooks, eq(sources.notebookId, notebooks.id))
      .where(eq(notebooks.userId, userId)),
    db
      .select({ value: count() })
      .from(conversations)
      .where(eq(conversations.userId, userId)),
    db
      .select({ value: count() })
      .from(outputs)
      .where(eq(outputs.userId, userId)),
  ]);

  const payload: StatsPayload = {
    notebooks: nbRes[0]?.value ?? 0,
    sources: srcRes[0]?.value ?? 0,
    conversations: convRes[0]?.value ?? 0,
    outputs: outRes[0]?.value ?? 0,
  };

  await cacheSet(cacheKey, payload, STATS_TTL_SECONDS);

  return NextResponse.json(payload);
};
