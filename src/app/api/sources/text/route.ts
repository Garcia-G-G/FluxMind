import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { sources, sourceChunks } from "@/db/schema/sources";
import { chunkText, estimateTokenCount } from "@/lib/processing/chunker";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { cacheDel, statsCacheKey, dashboardCacheKey } from "@/lib/cache/redis";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text, title, notebookId } = await request.json();
    if (!text?.trim() || !notebookId) {
      return NextResponse.json(
        { error: "text and notebookId required" },
        { status: 400 }
      );
    }

    // Verify notebook ownership
    const [notebook] = await db
      .select({ userId: notebooks.userId })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));

    if (!notebook || notebook.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const sourceId = createId();
    const rawText = text.trim();
    const tokenCount = estimateTokenCount(rawText);
    const autoTitle =
      title?.trim() ||
      rawText.slice(0, 60).replace(/\s+/g, " ").trim() +
        (rawText.length > 60 ? "..." : "");

    const now = new Date();
    const [source] = await db
      .insert(sources)
      .values({
        id: sourceId,
        notebookId,
        type: "txt",
        title: autoTitle,
        rawText,
        tokenCount,
        status: "processing",
        metadata: { origin: "context-paste" },
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    try {
      await cacheDel(statsCacheKey(session.user.id));
      await cacheDel(dashboardCacheKey(session.user.id));
    } catch {
      /* no-op */
    }

    // Chunk and embed
    try {
      const chunks = chunkText(rawText);
      if (chunks.length > 0) {
        const embeddings = await generateEmbeddings(
          chunks.map((c) => c.content)
        );
        const chunkRecords = chunks.map((chunk, i) => ({
          id: createId(),
          sourceId,
          content: chunk.content,
          embedding: embeddings[i],
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber,
          metadata: chunk.metadata,
          createdAt: new Date(),
        }));

        for (let i = 0; i < chunkRecords.length; i += 50) {
          await db.insert(sourceChunks).values(chunkRecords.slice(i, i + 50));
        }
      }

      await db
        .update(sources)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(sources.id, sourceId));

      return NextResponse.json(
        { ...source, status: "ready", tokenCount },
        { status: 201 }
      );
    } catch (error) {
      await db
        .update(sources)
        .set({
          status: "error",
          metadata: {
            error:
              error instanceof Error ? error.message : "Processing failed",
          },
          updatedAt: new Date(),
        })
        .where(eq(sources.id, sourceId));

      return NextResponse.json(
        {
          ...source,
          status: "error",
          error:
            error instanceof Error ? error.message : "Processing failed",
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("Text source failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};
