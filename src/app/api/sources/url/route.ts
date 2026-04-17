import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { sources } from "@/db/schema/sources";
import { scrapeUrlContent } from "@/lib/processing/url-source";
import {
  parseYouTubeUrl,
  fetchYouTubeTranscript,
  getYouTubeMetadata,
} from "@/lib/processing/youtube-source";
import { chunkText, estimateTokenCount } from "@/lib/processing/chunker";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { sourceChunks } from "@/db/schema/sources";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url, notebookId } = await request.json();
    if (!url || !notebookId) {
      return NextResponse.json({ error: "url and notebookId required" }, { status: 400 });
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
    const youtubeVideoId = parseYouTubeUrl(url);
    const isYouTube = !!youtubeVideoId;

    // Create source record
    const now = new Date();
    const [source] = await db
      .insert(sources)
      .values({
        id: sourceId,
        notebookId,
        type: isYouTube ? "youtube" : "url",
        title: isYouTube
          ? `YouTube: ${youtubeVideoId}`
          : new URL(url).hostname,
        originalUrl: url,
        status: "processing",
        metadata: isYouTube
          ? getYouTubeMetadata(youtubeVideoId!)
          : {},
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Process inline (no queue needed for URL/YouTube — fast enough)
    try {
      let rawText: string;
      if (isYouTube) {
        rawText = await fetchYouTubeTranscript(youtubeVideoId!);
      } else {
        rawText = await scrapeUrlContent(url);
      }

      if (!rawText.trim()) {
        throw new Error("No content extracted");
      }

      const tokenCount = estimateTokenCount(rawText);

      await db
        .update(sources)
        .set({
          rawText,
          tokenCount,
          title: isYouTube
            ? `YouTube: ${youtubeVideoId}`
            : rawText.slice(0, 60).replace(/\s+/g, " ").trim() + "...",
          updatedAt: new Date(),
        })
        .where(eq(sources.id, sourceId));

      // Chunk and embed
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
            error: error instanceof Error ? error.message : "Processing failed",
          },
          updatedAt: new Date(),
        })
        .where(eq(sources.id, sourceId));

      return NextResponse.json(
        {
          ...source,
          status: "error",
          error: error instanceof Error ? error.message : "Processing failed",
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("URL source failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};
