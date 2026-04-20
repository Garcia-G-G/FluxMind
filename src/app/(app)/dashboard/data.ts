import "server-only";
import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { sources } from "@/db/schema/sources";
import { conversations } from "@/db/schema/conversations";
import { outputs } from "@/db/schema/outputs";
import type { Notebook } from "@/db/schema/notebooks";

export type NotebookWithCount = Notebook & { sourceCount: number };

export type DashboardStats = {
  notebooks: number;
  sources: number;
  conversations: number;
  outputs: number;
};

/**
 * Fetch a user's notebooks with source counts in a single query.
 * Matches the shape returned by GET /api/notebooks (default sort).
 * Runs on the server so the dashboard renders HTML with data populated
 * on first paint — no client-side round-trip needed.
 */
export const getUserNotebooks = async (
  userId: string,
): Promise<NotebookWithCount[]> => {
  const rows = await db
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
    .leftJoin(sources, eq(sources.notebookId, notebooks.id))
    .where(
      sql`${notebooks.userId} = ${userId} OR EXISTS (
        SELECT 1 FROM notebook_collaborators
        WHERE notebook_collaborators.notebook_id = ${notebooks.id}
        AND notebook_collaborators.user_id = ${userId}
      )`,
    )
    .groupBy(notebooks.id)
    .orderBy(desc(notebooks.updatedAt));

  return rows as NotebookWithCount[];
};

/**
 * Fetch dashboard stats in four parallel queries.
 * Matches the shape returned by GET /api/stats.
 */
export const getUserStats = async (userId: string): Promise<DashboardStats> => {
  const [nbRes, srcRes, convRes, outRes] = await Promise.all([
    db.select({ value: count() }).from(notebooks).where(eq(notebooks.userId, userId)),
    db
      .select({ value: count() })
      .from(sources)
      .innerJoin(notebooks, eq(sources.notebookId, notebooks.id))
      .where(eq(notebooks.userId, userId)),
    db.select({ value: count() }).from(conversations).where(eq(conversations.userId, userId)),
    db.select({ value: count() }).from(outputs).where(eq(outputs.userId, userId)),
  ]);

  return {
    notebooks: nbRes[0]?.value ?? 0,
    sources: srcRes[0]?.value ?? 0,
    conversations: convRes[0]?.value ?? 0,
    outputs: outRes[0]?.value ?? 0,
  };
};
