import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getStudioContext, isError } from "@/lib/studio/generate";
import { cacheDel, statsCacheKey } from "@/lib/cache/redis";

const flashcardsSchema = z.object({
  title: z.string(),
  cards: z.array(
    z.object({
      id: z.string(),
      front: z.string(),
      back: z.string(),
      hint: z.string().nullable(),
      difficulty: z.enum(["easy", "medium", "hard"]),
      sourceReference: z.string(),
      tags: z.array(z.string()),
    })
  ),
});

export type FlashcardContent = z.infer<typeof flashcardsSchema>;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await checkRateLimit({
      userId: session.user.id,
      bucket: "studio.flashcards",
      ...RATE_LIMITS.studioGenerate,
    });
    if (limited) return limited;

    const body = await request.json();
    const {
      notebookId,
      count = 20,
      model: modelId = "gemini-2.5-flash",
      language: rawLanguage = "en",
    } = body;
    const language: "en" | "es" = rawLanguage === "es" ? "es" : "en";
    const LANG_NAME = language === "es" ? "Spanish" : "English";
    const langInstr = `IMPORTANT: Generate ALL content in ${LANG_NAME}. Titles, body text, labels, prompts, everything must be in ${LANG_NAME}. Do not mix languages.`;

    if (!notebookId) {
      return NextResponse.json({ error: "notebookId required" }, { status: 400 });
    }

    // Shared studio context: auth + ownership check + DB-sliced source text.
    const ctx = await getStudioContext(notebookId);
    if (isError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }
    const { notebookTitle, sourceContext } = ctx;

    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId,
      notebookId,
      userId: session.user.id,
      type: "flashcards",
      title: `Flashcards: ${notebookTitle}`,
      status: "generating",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    try {
      await cacheDel(statsCacheKey(session.user.id));
    } catch {
      /* no-op */
    }

    try {
      const { object: flashcards } = await generateObject({
        model: getModel(modelId),
        schema: flashcardsSchema,
        prompt: `${langInstr}

Generate ${count} flashcards from the following source material.

Each flashcard should have:
- A clear, concise term/question on the front
- A comprehensive but concise answer on the back (1-3 sentences max)
- A difficulty level
- Tags for grouping related cards

Rules:
- Cover ALL major concepts from the sources
- Front should be a single concept, term, or focused question
- Include mix of definitions, concepts, comparisons, and application questions
- Group related cards with tags
- Use sequential IDs: f1, f2, f3, etc.

Sources:
${sourceContext}`,
      });

      await db
        .update(outputs)
        .set({
          content: flashcards as unknown as Record<string, unknown>,
          status: "ready",
          updatedAt: new Date(),
        })
        .where(eq(outputs.id, outputId));

      return NextResponse.json({ id: outputId, ...flashcards }, { status: 201 });
    } catch (genError) {
      await db
        .update(outputs)
        .set({
          status: "error",
          content: {
            error:
              genError instanceof Error
                ? genError.message
                : "Generation failed",
          },
          updatedAt: new Date(),
        })
        .where(eq(outputs.id, outputId));
      throw genError;
    }
  } catch (error) {
    console.error("Flashcard generation failed:", error);
    return NextResponse.json(
      { error: "Flashcard generation failed" },
      { status: 500 }
    );
  }
};
