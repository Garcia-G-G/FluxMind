import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { getStudioContext, isError } from "@/lib/studio/generate";
import { generateInfographicImage } from "@/lib/media/generate-image";

const contentSchema = z.object({
  title: z
    .string()
    .describe("Short, punchy title — max 8 words"),
  subtitle: z
    .string()
    .describe("One-line subtitle providing context — max 14 words"),
  imagePrompt: z
    .string()
    .describe(
      [
        "A DETAILED prompt for FLUX image generation of an educational infographic.",
        "Describe specific visual elements (charts, diagrams, icons, arrows, callout boxes), spatial layout (top-left, center, bottom-right), and exact text/numbers to render on the image — always in quotation marks around the short labels.",
        "Describe a clear focal illustration at the center. Include specific numbers from the source material.",
        "Style: hand-drawn ink illustration, professional, annotated, white background, selective accent color.",
        "Keep on-image text to short phrases (2-5 words) for each label. Length: 200-400 words.",
      ].join(" "),
    ),
  sections: z
    .array(
      z.object({
        heading: z.string().describe("Section heading — max 6 words"),
        summary: z
          .string()
          .describe("One concise sentence summarizing the section"),
      }),
    )
    .min(3)
    .max(6),
  keyStats: z
    .array(
      z.object({
        value: z
          .string()
          .describe("Short stat: 85%, 2.4M, $12B, 3x etc."),
        label: z.string().describe("Short label — max 4 words"),
      }),
    )
    .min(2)
    .max(5),
});

export type InfographicContent = {
  title: string;
  subtitle: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  imagePrompt: string;
  sections: Array<{ heading: string; summary: string }>;
  keyStats: Array<{ value: string; label: string }>;
  error?: string;
};

type FallbackContent = {
  title: string;
  subtitle: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  imagePrompt: string;
  sections: Array<{ heading: string; summary: string }>;
  keyStats: Array<{ value: string; label: string }>;
  error: string;
};

export const POST = async (
  request: NextRequest,
): Promise<NextResponse> => {
  let outputId: string | null = null;

  try {
    const body = await request.json();
    const {
      notebookId,
      model: modelId = "gemini-2.5-flash",
      language: rawLanguage = "en",
    } = body as {
      notebookId: string;
      model?: string;
      language?: string;
    };
    const language: "en" | "es" = rawLanguage === "es" ? "es" : "en";
    const LANG_NAME = language === "es" ? "Spanish" : "English";
    const langInstr = `IMPORTANT: Generate ALL content in ${LANG_NAME}. Titles, body text, labels, prompts, everything must be in ${LANG_NAME}. Do not mix languages. For any text rendered IN the image (callout boxes, labels, quoted short phrases inside the imagePrompt), write that text in ${LANG_NAME} as well.`;

    const ctx = await getStudioContext(notebookId);
    if (isError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    outputId = createId();
    await db.insert(outputs).values({
      id: outputId,
      notebookId,
      userId: ctx.userId,
      type: "infographic",
      title: `Infographic: ${ctx.notebookTitle}`,
      status: "generating",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Phase 1 — generate structured content + image prompt
    let content: z.infer<typeof contentSchema>;
    try {
      const { object } = await generateObject({
        model: getModel(modelId),
        schema: contentSchema,
        prompt: `${langInstr}

You are a world-class data visualization designer creating content for an AI-generated educational infographic (NotebookLM quality).

Return:
- title: a short, punchy headline (max 8 words)
- subtitle: one contextual line
- imagePrompt: a richly descriptive FLUX prompt (200-400 words) describing visual elements, their spatial layout, specific short text labels in quotes, arrows, callout boxes, and a central focal illustration. Include specific numbers from the sources. Hand-drawn ink illustration style, white background, annotated, selective accent colors.
- sections: 3-6 text sections for accessibility fallback (heading + one-sentence summary)
- keyStats: 2-5 crisp stat cards (short value + short label)

Guidelines for imagePrompt:
- Describe the exact composition (top area, center illustration, bottom stats row)
- Name the icons/diagrams to draw (e.g., "bar chart with 3 bars", "brain diagram with arrows")
- Put short on-image text in quotation marks: e.g. A callout box that says "85% retention"
- Include 4-6 short quoted labels, no long sentences on the image
- Style: hand-drawn ink, thin black strokes, accent color, white background, professional, clean

Sources:
${ctx.sourceContext}`,
      });
      content = object;
    } catch (err) {
      console.error("Infographic content generation failed:", err);
      const msg = err instanceof Error ? err.message : "content generation failed";
      await db
        .update(outputs)
        .set({
          status: "error",
          content: { error: msg },
          updatedAt: new Date(),
        })
        .where(eq(outputs.id, outputId));
      return NextResponse.json(
        { error: "Generation failed", detail: msg },
        { status: 500 },
      );
    }

    // If no FAL key — save text content with error status, return gracefully
    if (!process.env.FAL_KEY) {
      const fallback: FallbackContent = {
        title: content.title,
        subtitle: content.subtitle,
        imageUrl: "",
        thumbnailUrl: null,
        imagePrompt: content.imagePrompt,
        sections: content.sections,
        keyStats: content.keyStats,
        error: "FAL_KEY not configured",
      };
      await db
        .update(outputs)
        .set({
          status: "error",
          content: fallback,
          updatedAt: new Date(),
        })
        .where(eq(outputs.id, outputId));
      return NextResponse.json(
        { id: outputId, ...fallback },
        { status: 201 },
      );
    }

    // Phase 2 — main image
    let imageUrl: string;
    try {
      const main = await generateInfographicImage(content.imagePrompt, {
        size: { width: 1280, height: 1600 },
        model: "fal-ai/flux/dev",
        persistTo: { key: `infographics/${notebookId}/${outputId}.png` },
      });
      imageUrl = main.url;
    } catch (err) {
      console.error("Infographic image generation failed:", err);
      const msg =
        err instanceof Error ? err.message : "image generation failed";
      const fallback: FallbackContent = {
        title: content.title,
        subtitle: content.subtitle,
        imageUrl: "",
        thumbnailUrl: null,
        imagePrompt: content.imagePrompt,
        sections: content.sections,
        keyStats: content.keyStats,
        error: msg,
      };
      await db
        .update(outputs)
        .set({
          status: "error",
          content: fallback,
          updatedAt: new Date(),
        })
        .where(eq(outputs.id, outputId));
      return NextResponse.json(
        { id: outputId, ...fallback },
        { status: 201 },
      );
    }

    // Phase 3 — thumbnail (optional, best effort)
    let thumbnailUrl: string | null = null;
    try {
      const thumb = await generateInfographicImage(content.imagePrompt, {
        size: { width: 400, height: 300 },
        model: "fal-ai/flux/schnell",
        persistTo: {
          key: `infographics/${notebookId}/${outputId}-thumb.png`,
        },
      });
      thumbnailUrl = thumb.url;
    } catch (err) {
      console.warn("Thumbnail generation failed (non-fatal):", err);
      thumbnailUrl = null;
    }

    const saved: InfographicContent = {
      title: content.title,
      subtitle: content.subtitle,
      imageUrl,
      thumbnailUrl,
      imagePrompt: content.imagePrompt,
      sections: content.sections,
      keyStats: content.keyStats,
    };

    await db
      .update(outputs)
      .set({
        content: saved as unknown as Record<string, unknown>,
        fileUrl: imageUrl,
        thumbnailUrl: thumbnailUrl ?? undefined,
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(outputs.id, outputId));

    return NextResponse.json({ id: outputId, ...saved }, { status: 201 });
  } catch (error) {
    console.error("Infographic generation failed:", error);
    if (outputId) {
      try {
        await db
          .update(outputs)
          .set({
            status: "error",
            content: {
              error:
                error instanceof Error ? error.message : "unexpected error",
            },
            updatedAt: new Date(),
          })
          .where(eq(outputs.id, outputId));
      } catch {
        // swallow — we're already in an error path
      }
    }
    return NextResponse.json(
      { error: "Generation failed" },
      { status: 500 },
    );
  }
};
