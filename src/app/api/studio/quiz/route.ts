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

const quizSchema = z.object({
  title: z.string(),
  questions: z.array(
    z.discriminatedUnion("type", [
      z.object({
        id: z.string(),
        type: z.literal("multiple_choice"),
        question: z.string(),
        options: z.array(z.string()).length(4),
        correctAnswer: z.enum(["A", "B", "C", "D"]),
        explanation: z.string(),
        difficulty: z.enum(["easy", "medium", "hard"]),
        sourceReference: z.string(),
      }),
      z.object({
        id: z.string(),
        type: z.literal("true_false"),
        question: z.string(),
        correctAnswer: z.boolean(),
        explanation: z.string(),
        difficulty: z.enum(["easy", "medium", "hard"]),
        sourceReference: z.string(),
      }),
      z.object({
        id: z.string(),
        type: z.literal("free_response"),
        question: z.string(),
        sampleAnswer: z.string(),
        keyPoints: z.array(z.string()),
        difficulty: z.enum(["easy", "medium", "hard"]),
        sourceReference: z.string(),
      }),
    ])
  ),
});

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await checkRateLimit({
      userId: session.user.id,
      bucket: "studio.quiz",
      ...RATE_LIMITS.studioGenerate,
    });
    if (limited) return limited;

    const body = await request.json();
    const {
      notebookId,
      count = 15,
      model: modelId = "gemini-2.5-flash",
      language: rawLanguage = "en",
    } = body;
    const language: "en" | "es" = rawLanguage === "es" ? "es" : "en";
    const LANG_NAME = language === "es" ? "Spanish" : "English";
    const langInstr = `IMPORTANT: Generate ALL content in ${LANG_NAME}. Titles, body text, labels, prompts, everything must be in ${LANG_NAME}. Do not mix languages.`;

    if (!notebookId) {
      return NextResponse.json({ error: "notebookId required" }, { status: 400 });
    }

    // Shared studio context: auth, ownership check, and DB-sliced source
    // text (LEFT() + LIMIT) in a single parallelized call.
    const ctx = await getStudioContext(notebookId);
    if (isError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }
    const { notebookTitle, sourceContext } = ctx;

    // Create output record first
    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId,
      notebookId,
      userId: session.user.id,
      type: "quiz",
      title: `Quiz: ${notebookTitle}`,
      status: "generating",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // Stats cache invalidation — fire-and-forget, never fails the request.
    try {
      await cacheDel(statsCacheKey(session.user.id));
    } catch {
      /* no-op */
    }

    try {
      const { object: quiz } = await generateObject({
        model: getModel(modelId),
        schema: quizSchema,
        prompt: `${langInstr}

Generate a comprehensive quiz based on the following source material. Create exactly ${count} questions.

Mix question types:
- 60% Multiple Choice (4 options labeled A) B) C) D), exactly 1 correct)
- 20% True/False
- 20% Free Response (short answer)

Rules:
- Questions must be answerable ONLY from the source material
- Include explanations with source citations for every question
- Vary difficulty: 30% easy, 50% medium, 20% hard
- Make questions test understanding, not just memorization
- Avoid trick questions — be fair and clear
- Use sequential IDs: q1, q2, q3, etc.

Sources:
${sourceContext}`,
      });

      await db
        .update(outputs)
        .set({
          content: quiz as unknown as Record<string, unknown>,
          status: "ready",
          updatedAt: new Date(),
        })
        .where(eq(outputs.id, outputId));

      return NextResponse.json({ id: outputId, ...quiz }, { status: 201 });
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
    console.error("Quiz generation failed:", error);
    return NextResponse.json(
      { error: "Quiz generation failed" },
      { status: 500 }
    );
  }
};
