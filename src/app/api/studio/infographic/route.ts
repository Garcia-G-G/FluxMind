import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { getStudioContext, isError } from "@/lib/studio/generate";

const infographicSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  sections: z.array(
    z.discriminatedUnion("type", [
      z.object({ type: z.literal("header"), text: z.string() }),
      z.object({ type: z.literal("stat"), value: z.string(), label: z.string() }),
      z.object({ type: z.literal("text"), text: z.string() }),
      z.object({
        type: z.literal("comparison"),
        items: z.array(z.object({ label: z.string(), value: z.string() })),
      }),
      z.object({
        type: z.literal("timeline"),
        events: z.array(z.object({ date: z.string(), title: z.string(), description: z.string() })),
      }),
      z.object({
        type: z.literal("list"),
        title: z.string(),
        items: z.array(z.string()),
      }),
    ])
  ),
  footer: z.string(),
});

export type InfographicContent = z.infer<typeof infographicSchema>;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body = await request.json();
    const { notebookId, model: modelId = "gemini-2.5-flash" } = body;

    const ctx = await getStudioContext(notebookId);
    if (isError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId, notebookId, userId: ctx.userId, type: "infographic",
      title: `Infographic: ${ctx.notebookTitle}`, status: "generating",
      createdAt: new Date(), updatedAt: new Date(),
    });

    try {
      const { object: infographic } = await generateObject({
        model: getModel(modelId),
        schema: infographicSchema,
        prompt: `Analyze the following sources and extract key information for a visually compelling infographic. Include a mix of section types: header, stat, text, comparison, timeline, list. Aim for 6-10 sections. Include a footer citing the sources.\n\nSources:\n${ctx.sourceContext}`,
      });

      await db.update(outputs).set({ content: infographic as unknown as Record<string, unknown>, status: "ready", updatedAt: new Date() }).where(eq(outputs.id, outputId));
      return NextResponse.json({ id: outputId, ...infographic }, { status: 201 });
    } catch (genError) {
      await db.update(outputs).set({ status: "error", content: { error: genError instanceof Error ? genError.message : "Failed" }, updatedAt: new Date() }).where(eq(outputs.id, outputId));
      throw genError;
    }
  } catch (error) {
    console.error("Infographic generation failed:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
};
