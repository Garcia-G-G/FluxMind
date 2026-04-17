import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { getStudioContext, isError } from "@/lib/studio/generate";

const reelSchema = z.object({
  title: z.string(),
  durationEstimate: z.number(),
  sections: z.array(
    z.object({
      type: z.enum(["hook", "content", "cta"]),
      text: z.string(),
      visualSuggestion: z.string(),
      duration: z.number(),
    })
  ),
  caption: z.string(),
  musicSuggestion: z.string(),
});

export type ReelContent = z.infer<typeof reelSchema>;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body = await request.json();
    const { notebookId, model: modelId = "gemini-2.5-flash" } = body;

    const ctx = await getStudioContext(notebookId);
    if (isError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId, notebookId, userId: ctx.userId, type: "video",
      title: `Reel: ${ctx.notebookTitle}`, status: "generating",
      createdAt: new Date(), updatedAt: new Date(),
    });

    try {
      const { object: reel } = await generateObject({
        model: getModel(modelId),
        schema: reelSchema,
        prompt: `Create a 30-60 second short-form video script (for TikTok/Reels/Shorts).

Structure:
- HOOK (0-3 seconds): A single sentence that stops the scroll. Type: "hook".
- CONTENT (3-50 seconds): The value, broken into 3-5 short sections. Type: "content".
- CTA (last 5-10 seconds): Tell them what to do. Type: "cta".

Each section needs: text (what to say), visualSuggestion (what to show), duration (seconds).
Include a caption with relevant hashtags and a music suggestion.
Total duration should be 30-60 seconds.

Sources:
${ctx.sourceContext}`,
      });

      await db.update(outputs).set({ content: reel as unknown as Record<string, unknown>, status: "ready", updatedAt: new Date() }).where(eq(outputs.id, outputId));
      return NextResponse.json({ id: outputId, ...reel }, { status: 201 });
    } catch (genError) {
      await db.update(outputs).set({ status: "error", content: { error: genError instanceof Error ? genError.message : "Failed" }, updatedAt: new Date() }).where(eq(outputs.id, outputId));
      throw genError;
    }
  } catch (error) {
    console.error("Reel generation failed:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
};
