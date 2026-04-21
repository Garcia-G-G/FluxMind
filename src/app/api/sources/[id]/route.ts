import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sources } from "@/db/schema/sources";
import { notebooks } from "@/db/schema/notebooks";
import { cacheDel, statsCacheKey } from "@/lib/cache/redis";

export const GET = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Join with notebooks and verify ownership in the query
    const [source] = await db
      .select({
        id: sources.id,
        notebookId: sources.notebookId,
        type: sources.type,
        title: sources.title,
        fileUrl: sources.fileUrl,
        rawText: sources.rawText,
        metadata: sources.metadata,
        tokenCount: sources.tokenCount,
        status: sources.status,
        createdAt: sources.createdAt,
        updatedAt: sources.updatedAt,
        chunkCount: sql<number>`(SELECT COUNT(*) FROM source_chunks WHERE source_chunks.source_id = ${sources.id})`,
      })
      .from(sources)
      .innerJoin(notebooks, eq(sources.notebookId, notebooks.id))
      .where(
        and(eq(sources.id, id), eq(notebooks.userId, session.user.id))
      );

    if (!source) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Strip internal metadata before sending to client
    const cleanMetadata =
      source.metadata && typeof source.metadata === "object"
        ? Object.fromEntries(
            Object.entries(source.metadata as Record<string, unknown>).filter(
              ([k]) => k !== "localBuffer"
            )
          )
        : source.metadata;

    return NextResponse.json({
      ...source,
      metadata: cleanMetadata,
      rawTextPreview: source.rawText?.slice(0, 500) ?? null,
      rawText: undefined,
    });
  } catch (error) {
    console.error("Failed to fetch source:", error);
    return NextResponse.json(
      { error: "Failed to fetch source" },
      { status: 500 }
    );
  }
};

export const DELETE = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership and get file info in one query
    const [source] = await db
      .select({
        id: sources.id,
        fileUrl: sources.fileUrl,
      })
      .from(sources)
      .innerJoin(notebooks, eq(sources.notebookId, notebooks.id))
      .where(
        and(eq(sources.id, id), eq(notebooks.userId, session.user.id))
      );

    if (!source) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete from R2 (best effort)
    if (source.fileUrl && !source.fileUrl.startsWith("local://")) {
      try {
        const { deleteFile } = await import("@/lib/storage/r2");
        const key = source.fileUrl.split("/").slice(-4).join("/");
        await deleteFile(key);
      } catch {
        // File may already be gone
      }
    }

    // Cascade delete handles chunks
    await db.delete(sources).where(eq(sources.id, id));

    try {
      await cacheDel(statsCacheKey(session.user.id));
    } catch {
      /* no-op */
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete source:", error);
    return NextResponse.json(
      { error: "Failed to delete source" },
      { status: 500 }
    );
  }
};
