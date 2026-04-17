import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { getStudioContext, isError } from "@/lib/studio/generate";

const slideSchema = z.object({
  title: z.string(),
  slides: z.array(
    z.object({
      id: z.string(),
      layout: z.enum(["title", "content", "two_column", "quote", "stat", "closing"]),
      title: z.string().optional(),
      subtitle: z.string().optional(),
      bullets: z.array(z.string()).optional(),
      leftColumn: z.object({ heading: z.string(), points: z.array(z.string()) }).optional(),
      rightColumn: z.object({ heading: z.string(), points: z.array(z.string()) }).optional(),
      quote: z.string().optional(),
      attribution: z.string().optional(),
      stat: z.string().optional(),
      description: z.string().optional(),
      notes: z.string().optional(),
    })
  ),
});

export type SlidesContent = z.infer<typeof slideSchema>;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body = await request.json();
    const { notebookId, count = 12, model: modelId = "gemini-2.5-flash" } = body;

    const ctx = await getStudioContext(notebookId);
    if (isError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId, notebookId, userId: ctx.userId, type: "slides",
      title: `Slides: ${ctx.notebookTitle}`, status: "generating",
      createdAt: new Date(), updatedAt: new Date(),
    });

    try {
      const { object: slides } = await generateObject({
        model: getModel(modelId),
        schema: slideSchema,
        prompt: `Create a presentation with exactly ${count} slides. Start with "title" layout, end with "closing". Use "content" for bullets, "two_column" for comparisons, "quote" for important quotes, "stat" for statistics. Include speaker notes. Use IDs s1, s2, etc.\n\nSources:\n${ctx.sourceContext}`,
      });

      await db.update(outputs).set({ content: slides as unknown as Record<string, unknown>, status: "ready", updatedAt: new Date() }).where(eq(outputs.id, outputId));
      return NextResponse.json({ id: outputId, ...slides }, { status: 201 });
    } catch (genError) {
      await db.update(outputs).set({ status: "error", content: { error: genError instanceof Error ? genError.message : "Failed" }, updatedAt: new Date() }).where(eq(outputs.id, outputId));
      throw genError;
    }
  } catch (error) {
    console.error("Slides generation failed:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
};
