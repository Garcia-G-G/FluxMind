import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { desc, sql } from "drizzle-orm";
import { getCachedSession } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { sources } from "@/db/schema/sources";
import { conversations } from "@/db/schema/conversations";
import { outputs } from "@/db/schema/outputs";
import { count, eq } from "drizzle-orm";
import type { Notebook } from "@/db/schema/notebooks";
import type { Stats } from "@/hooks/use-stats";
import { cacheGet, cacheSet, dashboardCacheKey } from "@/lib/cache/redis";
import { DashboardClient } from "./dashboard-client";

const DASHBOARD_TTL_SECONDS = 60;

type NotebookWithCount = Notebook & { sourceCount: number };

const getGreeting = (hour: number): string => {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

type DashboardData = { notebooks: NotebookWithCount[]; stats: Stats };

const loadDashboardData = async (
  userId: string,
): Promise<DashboardData> => {
  // ── Redis cache: 60s TTL, graceful-fail ──
  const cached = await cacheGet<DashboardData>(dashboardCacheKey(userId));
  if (cached) return cached;

  // Single LEFT JOIN + GROUP BY — mirrors /api/notebooks. Paginated hard at
  // 100 so the dashboard paints fast even for power users.
  const notebooksPromise = db
    .select({
      id: notebooks.id,
      userId: notebooks.userId,
      title: notebooks.title,
      description: notebooks.description,
      icon: notebooks.icon,
      color: notebooks.color,
      coverImage: notebooks.coverImage,
      isPublic: notebooks.isPublic,
      settings: notebooks.settings,
      createdAt: notebooks.createdAt,
      updatedAt: notebooks.updatedAt,
      sourceCount: sql<number>`COUNT(${sources.id})::int`.as("source_count"),
    })
    .from(notebooks)
    .leftJoin(sources, sql`${sources.notebookId} = ${notebooks.id}`)
    .where(
      sql`${notebooks.userId} = ${userId} OR EXISTS (
        SELECT 1 FROM notebook_collaborators
        WHERE notebook_collaborators.notebook_id = ${notebooks.id}
        AND notebook_collaborators.user_id = ${userId}
      )`,
    )
    .groupBy(notebooks.id)
    .orderBy(desc(notebooks.updatedAt))
    .limit(100);

  const statsPromise = Promise.all([
    db.select({ value: count() }).from(notebooks).where(eq(notebooks.userId, userId)),
    db
      .select({ value: count() })
      .from(sources)
      .innerJoin(notebooks, eq(sources.notebookId, notebooks.id))
      .where(eq(notebooks.userId, userId)),
    db
      .select({ value: count() })
      .from(conversations)
      .where(eq(conversations.userId, userId)),
    db.select({ value: count() }).from(outputs).where(eq(outputs.userId, userId)),
  ]);

  const [userNotebooks, [nbRes, srcRes, convRes, outRes]] = await Promise.all([
    notebooksPromise,
    statsPromise,
  ]);

  const stats: Stats = {
    notebooks: nbRes[0]?.value ?? 0,
    sources: srcRes[0]?.value ?? 0,
    conversations: convRes[0]?.value ?? 0,
    outputs: outRes[0]?.value ?? 0,
  };

  const result: DashboardData = {
    notebooks: userNotebooks as NotebookWithCount[],
    stats,
  };
  await cacheSet(dashboardCacheKey(userId), result, DASHBOARD_TTL_SECONDS);
  return result;
};

const DashboardPage = async (): Promise<ReactNode> => {
  const session = await getCachedSession();
  if (!session?.user) {
    redirect("/login");
  }

  const { notebooks: initialNotebooks, stats: initialStats } =
    await loadDashboardData(session.user.id);

  const now = new Date();
  const greeting = getGreeting(now.getHours());
  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const userLastName = session.user.name?.split(" ").pop() ?? "there";

  return (
    <Suspense fallback={<div />}>
      <DashboardClient
        userLastName={userLastName}
        greeting={greeting}
        today={today}
        initialNotebooks={initialNotebooks}
        initialStats={initialStats}
      />
    </Suspense>
  );
};

export default DashboardPage;
