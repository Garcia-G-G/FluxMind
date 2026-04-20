import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateText } from "ai";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { sources, sourceChunks } from "@/db/schema/sources";
import { chunkText, estimateTokenCount } from "@/lib/processing/chunker";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { getModel } from "@/lib/ai/models";

export const maxDuration = 60;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { query, notebookId } = await request.json();
    if (!query?.trim() || !notebookId) {
      return NextResponse.json(
        { error: "query and notebookId required" },
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
    const now = new Date();

    // Create source in "processing" state
    const [source] = await db
      .insert(sources)
      .values({
        id: sourceId,
        notebookId,
        type: "txt",
        title: query.trim(),
        rawText: "",
        tokenCount: 0,
        status: "processing",
        metadata: { origin: "ai-research", query: query.trim() },
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Use AI to research the topic and generate comprehensive content
    try {
      const { text: researchContent } = await generateText({
        model: getModel("gpt-4o"),
        system: `You are a research assistant. The user will give you a topic or question.
Produce a comprehensive, well-structured research document about it.
Include key facts, explanations, examples, and relevant details.
Write in clear, informative prose. Use headings (##) to organize sections.
Aim for 800-1500 words of high-quality, factual content.
Do NOT include disclaimers about being an AI. Just provide the information directly.`,
        prompt: query.trim(),
      });

      const rawText = researchContent.trim();
      const tokenCount = estimateTokenCount(rawText);

      // Update source with generated content
      await db
        .update(sources)
        .set({
          rawText,
          tokenCount,
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
        { ...source, status: "ready", tokenCount, title: query.trim() },
        { status: 201 }
      );
    } catch (error) {
      await db
        .update(sources)
        .set({
          status: "error",
          metadata: {
            error:
              error instanceof Error ? error.message : "Research failed",
          },
          updatedAt: new Date(),
        })
        .where(eq(sources.id, sourceId));

      return NextResponse.json(
        {
          ...source,
          status: "error",
          error: error instanceof Error ? error.message : "Research failed",
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("Search source failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};
