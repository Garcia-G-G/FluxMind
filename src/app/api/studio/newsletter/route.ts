import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { getStudioContext, isError } from "@/lib/studio/generate";

const newsletterSchema = z.object({
  title: z.string(),
  headline: z.string(),
  introduction: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
      pullQuote: z.string().nullable(),
    })
  ),
  keyTakeaways: z.array(z.string()),
  cta: z.object({
    text: z.string(),
    buttonLabel: z.string(),
  }),
  footer: z.string(),
});

export type NewsletterContent = z.infer<typeof newsletterSchema>;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body = await request.json();
    const { notebookId, model: modelId = "gemini-2.5-flash" } = body;

    const ctx = await getStudioContext(notebookId);
    if (isError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId, notebookId, userId: ctx.userId, type: "newsletter",
      title: `Newsletter: ${ctx.notebookTitle}`, status: "generating",
      createdAt: new Date(), updatedAt: new Date(),
    });

    try {
      const { object: newsletter } = await generateObject({
        model: getModel(modelId),
        schema: newsletterSchema,
        prompt: `Create a professional newsletter from the following source material.

Structure:
- Compelling headline
- Engaging introduction (2-3 sentences)
- 3-4 content sections, each with a title and body (2-3 paragraphs)
- Include pull quotes from the sources where impactful
- Key takeaways (3-5 bullet points)
- Call to action with button text
- Brief footer text

Write in a conversational but authoritative tone, like the best Substack newsletters.

Sources:
${ctx.sourceContext}`,
      });

      await db.update(outputs).set({ content: newsletter as unknown as Record<string, unknown>, status: "ready", updatedAt: new Date() }).where(eq(outputs.id, outputId));
      return NextResponse.json({ id: outputId, ...newsletter }, { status: 201 });
    } catch (genError) {
      await db.update(outputs).set({ status: "error", content: { error: genError instanceof Error ? genError.message : "Failed" }, updatedAt: new Date() }).where(eq(outputs.id, outputId));
      throw genError;
    }
  } catch (error) {
    console.error("Newsletter generation failed:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
};
