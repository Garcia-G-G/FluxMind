import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, sql, desc, and } from "drizzle-orm";
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

    // Single query: INNER JOIN on notebooks restricted to the caller's
    // userId implicitly enforces ownership (no rows for unauthorized
    // notebooks), LEFT JOIN on source_chunks + GROUP BY collapses the
    // chunk count into one round-trip.
    //
    // Empty result can mean either "notebook doesn't exist / not yours"
    // OR "notebook has no sources". We disambiguate with a cheap existence
    // check only if the first query comes back empty — the common case
    // (notebook exists and has sources) stays single-query.
    const notebookSources = await db
      .select({
        id: sources.id,
        type: sources.type,
        title: sources.title,
        originalUrl: sources.originalUrl,
        tokenCount: sources.tokenCount,
        status: sources.status,
        metadata: sources.metadata,
        createdAt: sources.createdAt,
        updatedAt: sources.updatedAt,
        chunkCount: sql<number>`COALESCE(COUNT(${sourceChunks.id}), 0)::int`.as(
          "chunk_count",
        ),
      })
      .from(sources)
      .innerJoin(
        notebooks,
        and(
          eq(sources.notebookId, notebooks.id),
          eq(notebooks.userId, session.user.id),
        ),
      )
      .leftJoin(sourceChunks, eq(sourceChunks.sourceId, sources.id))
      .where(eq(sources.notebookId, notebookId))
      .groupBy(sources.id)
      .orderBy(desc(sources.createdAt));

    if (notebookSources.length === 0) {
      // Did the notebook actually exist for this user? If no, 404. If yes,
      // it just has zero sources — return an empty array.
      const [owned] = await db
        .select({ id: notebooks.id })
        .from(notebooks)
        .where(
          and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)),
        );
      if (!owned) {
        return NextResponse.json(
          { error: "Notebook not found" },
          { status: 404 },
        );
      }
    }

    return NextResponse.json(notebookSources);
  } catch (error) {
    console.error("Failed to fetch sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch sources" },
      { status: 500 }
    );
  }
};
