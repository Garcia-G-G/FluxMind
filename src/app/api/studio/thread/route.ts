import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { getStudioContext, isError } from "@/lib/studio/generate";

const threadSchema = z.object({
  title: z.string(),
  tweets: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      isHook: z.boolean().nullable(),
      isCTA: z.boolean().nullable(),
    })
  ),
});

export type ThreadContent = z.infer<typeof threadSchema>;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body = await request.json();
    const { notebookId, model: modelId = "gemini-2.5-flash" } = body;

    const ctx = await getStudioContext(notebookId);
    if (isError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId, notebookId, userId: ctx.userId, type: "thread",
      title: `Thread: ${ctx.notebookTitle}`, status: "generating",
      createdAt: new Date(), updatedAt: new Date(),
    });

    try {
      const { object: thread } = await generateObject({
        model: getModel(modelId),
        schema: threadSchema,
        prompt: `Create a viral X/Twitter thread from the following source material.

Rules:
- First tweet is the HOOK — grab attention with a bold claim, surprising stat, or provocative question. Mark isHook: true.
- Each subsequent tweet adds value: insights, data, examples, frameworks.
- Last tweet is the CTA: summary + call to action. Mark isCTA: true.
- Each tweet MUST be under 280 characters.
- Use line breaks for readability within tweets.
- Include 1-2 tweets with bullet lists using •
- Total: 8-15 tweets.
- No hashtags. Maximum 1-2 emojis total.
- Use sequential IDs: t1, t2, etc.

Sources:
${ctx.sourceContext}`,
      });

      await db.update(outputs).set({ content: thread as unknown as Record<string, unknown>, status: "ready", updatedAt: new Date() }).where(eq(outputs.id, outputId));
      return NextResponse.json({ id: outputId, ...thread }, { status: 201 });
    } catch (genError) {
      await db.update(outputs).set({ status: "error", content: { error: genError instanceof Error ? genError.message : "Failed" }, updatedAt: new Date() }).where(eq(outputs.id, outputId));
      throw genError;
    }
  } catch (error) {
    console.error("Thread generation failed:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
};
