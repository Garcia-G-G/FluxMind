import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sources } from "@/db/schema/sources";
import { notebooks } from "@/db/schema/notebooks";

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
      .where(eq(sources.id, id));

    if (!source) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...source,
      // Don't send localBuffer metadata to client
      metadata: source.metadata && typeof source.metadata === "object"
        ? Object.fromEntries(
            Object.entries(source.metadata as Record<string, unknown>).filter(
              ([k]) => k !== "localBuffer"
            )
          )
        : source.metadata,
      // Truncate rawText for preview
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

    const [source] = await db
      .select({
        id: sources.id,
        notebookId: sources.notebookId,
        fileUrl: sources.fileUrl,
      })
      .from(sources)
      .innerJoin(notebooks, eq(sources.notebookId, notebooks.id))
      .where(eq(sources.id, id));

    if (!source) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete from R2 if applicable
    if (source.fileUrl && !source.fileUrl.startsWith("local://")) {
      try {
        const { deleteFile } = await import("@/lib/storage/r2");
        const key = source.fileUrl.split("/").slice(-4).join("/");
        await deleteFile(key);
      } catch {
        // Best effort — file may already be gone
      }
    }

    // Cascade delete handles chunks
    await db.delete(sources).where(eq(sources.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete source:", error);
    return NextResponse.json(
      { error: "Failed to delete source" },
      { status: 500 }
    );
  }
};
