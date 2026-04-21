import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { getStudioContext, isError } from "@/lib/studio/generate";

const courseSchema = z.object({
  title: z.string(),
  description: z.string(),
  lessons: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      objective: z.string(),
      content: z.string(),
      keyConcepts: z.array(z.string()),
      quiz: z.array(
        z.object({
          question: z.string(),
          options: z.array(z.string()).length(4),
          correct: z.enum(["A", "B", "C", "D"]),
          explanation: z.string(),
        })
      ),
      flashcards: z.array(
        z.object({
          front: z.string(),
          back: z.string(),
        })
      ),
    })
  ),
  prerequisites: z.array(z.string()),
  estimatedDuration: z.string(),
});

export type CourseContent = z.infer<typeof courseSchema>;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body = await request.json();
    const {
      notebookId,
      model: modelId = "gemini-2.5-flash",
      language: rawLanguage = "en",
    } = body;
    const language: "en" | "es" = rawLanguage === "es" ? "es" : "en";
    const LANG_NAME = language === "es" ? "Spanish" : "English";
    const langInstr = `IMPORTANT: Generate ALL content in ${LANG_NAME}. Titles, body text, labels, prompts, everything must be in ${LANG_NAME}. Do not mix languages.`;

    const ctx = await getStudioContext(notebookId, "studioGenerate");
    if (isError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId, notebookId, userId: ctx.userId, type: "course",
      title: `Course: ${ctx.notebookTitle}`, status: "generating",
      createdAt: new Date(), updatedAt: new Date(),
    });

    try {
      const { object: course } = await generateObject({
        model: getModel(modelId),
        schema: courseSchema,
        prompt: `${langInstr}

Structure the following source material into a mini-course with 5-8 lessons.

Each lesson needs:
- A clear title and learning objective
- Content in Markdown (2-4 paragraphs)
- 2-4 key concepts
- 2-3 quiz questions (MC with 4 options A/B/C/D)
- 2-3 flashcards (front/back)
- Sequential IDs: l1, l2, etc.

Include prerequisites and estimated duration.
Build a logical progression from fundamentals to advanced topics.

Sources:
${ctx.sourceContext}`,
      });

      await db.update(outputs).set({ content: course as unknown as Record<string, unknown>, status: "ready", updatedAt: new Date() }).where(eq(outputs.id, outputId));
      return NextResponse.json({ id: outputId, ...course }, { status: 201 });
    } catch (genError) {
      await db.update(outputs).set({ status: "error", content: { error: genError instanceof Error ? genError.message : "Failed" }, updatedAt: new Date() }).where(eq(outputs.id, outputId));
      throw genError;
    }
  } catch (error) {
    console.error("Course generation failed:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
};
