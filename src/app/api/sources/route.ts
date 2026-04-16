import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, sql, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sources } from "@/db/schema/sources";
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

    const notebookSources = await db
      .select({
        id: sources.id,
        type: sources.type,
        title: sources.title,
        tokenCount: sources.tokenCount,
        status: sources.status,
        createdAt: sources.createdAt,
        updatedAt: sources.updatedAt,
        chunkCount: sql<number>`(SELECT COUNT(*) FROM source_chunks WHERE source_chunks.source_id = ${sources.id})`,
      })
      .from(sources)
      .where(eq(sources.notebookId, notebookId))
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
