import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, sql, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sources, sourceChunks } from "@/db/schema/sources";
import { notebooks } from "@/db/schema/notebooks";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notebookId = request.nextUrl.searchParams.get("notebookId");
    if (!notebookId) {
      return NextResponse.json(
        { error: "notebookId is required" },
        { status: 400 }
      );
    }

    // Verify notebook access
    const [notebook] = await db
      .select({ userId: notebooks.userId })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));

    if (!notebook || notebook.userId !== session.user.id) {
      return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
    }

    // One scan with LEFT JOIN + GROUP BY instead of a correlated subquery
    // per source row (50 sources = 50 DB round-trips under the old query).
    const notebookSources = await db
      .select({
        id: sources.id,
        type: sources.type,
        title: sources.title,
        tokenCount: sources.tokenCount,
        status: sources.status,
        createdAt: sources.createdAt,
        updatedAt: sources.updatedAt,
        chunkCount: sql<number>`COUNT(${sourceChunks.id})::int`.as("chunk_count"),
      })
      .from(sources)
      .leftJoin(sourceChunks, eq(sourceChunks.sourceId, sources.id))
      .where(eq(sources.notebookId, notebookId))
      .groupBy(sources.id)
      .orderBy(desc(sources.createdAt));

    return NextResponse.json(notebookSources);
  } catch (error) {
    console.error("Failed to fetch sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch sources" },
      { status: 500 }
    );
  }
};
