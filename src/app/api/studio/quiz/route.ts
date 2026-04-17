import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { sources } from "@/db/schema/sources";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";

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

    const body = await request.json();
    const { notebookId, count = 15, model: modelId = "gemini-2.5-flash" } = body;

    if (!notebookId) {
      return NextResponse.json({ error: "notebookId required" }, { status: 400 });
    }

    // Verify access
    const [notebook] = await db
      .select({ userId: notebooks.userId, title: notebooks.title })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));

    if (!notebook || notebook.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get source texts
    const notebookSources = await db
      .select({ title: sources.title, rawText: sources.rawText })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));

    const sourceContext = notebookSources
      .filter((s) => s.rawText)
      .map((s) => `[${s.title}]\n${s.rawText!.slice(0, 5000)}`)
      .join("\n\n---\n\n");

    if (!sourceContext.trim()) {
      return NextResponse.json(
        { error: "No processed sources available" },
        { status: 400 }
      );
    }

    // Create output record first
    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId,
      notebookId,
      userId: session.user.id,
      type: "quiz",
      title: `Quiz: ${notebook.title}`,
      status: "generating",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      const { object: quiz } = await generateObject({
        model: getModel(modelId),
        schema: quizSchema,
        prompt: `Generate a comprehensive quiz based on the following source material. Create exactly ${count} questions.

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
