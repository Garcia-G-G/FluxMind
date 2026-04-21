import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { getStudioContext, isError } from "@/lib/studio/generate";
import {
  composeInfographic,
  type ComposeOptions,
  type InfographicLayout,
} from "@/lib/media/compose-infographic";
import {
  getStyleInstructions,
  type VisualStyle,
} from "@/lib/media/styles";

// ---------- Layout schema ----------

const layoutSchema = z.object({
  title: z.string().describe("Main title — max 8 words, punchy"),
  subtitle: z.string().describe("One-line subtitle — max 14 words"),
  language: z.enum(["en", "es"]).describe("Content language"),
  accentColor: z.enum([
    "#ff6b35",
    "#e11d48",
    "#7c3aed",
    "#2563eb",
    "#059669",
    "#d97706",
  ]),
  illustrationPrompt: z
    .string()
    .describe(
      "Visual-only prompt for AI image generation. NO text, NO labels, NO numbers, NO words anywhere. Style: pen-and-ink technical illustration on graph paper. Describe small illustrated vignettes positioned in specific zones of the canvas (e.g. top-left beach scene, center-right airplane, bottom-right pressure cooker), leaving whitespace around each for text overlay. 100-200 words. Think vintage engineering notebook: thin black line work with occasional muted orange or sepia watercolor wash on focal elements, scenes at different 'points' of a larger picture.",
    ),
  header: z.object({
    text: z.string(),
    subtext: z.string().nullable(),
  }),
  blocks: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("stat"),
          value: z.string(),
          label: z.string(),
          position: z.enum([
            "top-left",
            "top-center",
            "top-right",
            "mid-left",
            "mid-center",
            "mid-right",
          ]),
        }),
        z.object({
          type: z.literal("callout"),
          title: z.string(),
          body: z.string(),
          position: z.enum([
            "top-left",
            "top-right",
            "mid-left",
            "mid-right",
            "bottom-left",
            "bottom-right",
          ]),
          leaderTo: z.enum(["left", "right", "up", "down"]),
        }),
        z.object({
          type: z.literal("comparison"),
          items: z
            .array(z.object({ label: z.string(), value: z.string() }))
            .min(2)
            .max(4),
        }),
        z.object({
          type: z.literal("chart"),
          chartType: z.enum(["line", "bar", "area"]),
          xLabel: z.string(),
          yLabel: z.string(),
          dataPoints: z
            .array(
              z.object({
                x: z.string(),
                y: z.number(),
                annotation: z.string().nullable(),
              }),
            )
            .min(3)
            .max(8),
        }),
        z.object({
          type: z.literal("flow"),
          steps: z
            .array(z.object({ label: z.string(), detail: z.string() }))
            .min(3)
            .max(6),
        }),
        z.object({ type: z.literal("takeaway"), text: z.string() }),
        z.object({ type: z.literal("text"), text: z.string() }),
        z.object({
          type: z.literal("timeline"),
          events: z
            .array(z.object({ date: z.string(), label: z.string() }))
            .min(3)
            .max(6),
        }),
      ]),
    )
    .min(4)
    .max(10),
  footer: z.string(),
  sections: z
    .array(z.object({ heading: z.string(), summary: z.string() }))
    .min(3)
    .max(6),
  keyStats: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .min(2)
    .max(5),
});

type LayoutContent = z.infer<typeof layoutSchema>;

// Back-compat shape consumed by the existing viewer.
export type InfographicContent = {
  id?: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  imagePrompt: string;
  sections: Array<{ heading: string; summary: string }>;
  keyStats: Array<{ value: string; label: string }>;
  layout?: LayoutContent;
  error?: string;
};

// ---------- Route ----------

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  let outputId: string | null = null;

  try {
    const body = await request.json();
    const {
      notebookId,
      model: modelId = "gpt-4o",
      language: rawLanguage = "en",
      style: rawStyle = "auto",
      detailLevel: rawDetail = "standard",
      customPrompt: rawCustom = "",
      orientation: rawOrientation = "vertical",
    } = body as {
      notebookId: string;
      model?: string;
      language?: string;
      style?: string;
      detailLevel?: string;
      customPrompt?: string;
      orientation?: string;
    };

    const language: "en" | "es" = rawLanguage === "es" ? "es" : "en";
    const ALLOWED_STYLES: VisualStyle[] = [
      "auto",
      "sketch",
      "kawaii",
      "professional",
      "scientific",
      "minimalist",
    ];
    const style: VisualStyle = ALLOWED_STYLES.includes(rawStyle as VisualStyle)
      ? (rawStyle as VisualStyle)
      : "auto";
    const ALLOWED_DETAIL = ["concise", "standard", "detailed"] as const;
    const detailLevel: (typeof ALLOWED_DETAIL)[number] =
      ALLOWED_DETAIL.includes(rawDetail as (typeof ALLOWED_DETAIL)[number])
        ? (rawDetail as (typeof ALLOWED_DETAIL)[number])
        : "standard";
    const customPrompt = typeof rawCustom === "string" ? rawCustom : "";
    const ALLOWED_ORIENT = ["horizontal", "vertical", "square"] as const;
    const orientation: (typeof ALLOWED_ORIENT)[number] =
      ALLOWED_ORIENT.includes(rawOrientation as (typeof ALLOWED_ORIENT)[number])
        ? (rawOrientation as (typeof ALLOWED_ORIENT)[number])
        : "vertical";

    const detailMap = {
      concise: "5 blocks, tight summaries",
      standard: "6-8 blocks, comprehensive coverage",
      detailed: "8-10 blocks, deeply detailed with multiple data viz",
    } as const;
    const detailPick = detailMap[detailLevel];

    // Orientation → canvas size
    const sizeForOrientation: Record<
      (typeof ALLOWED_ORIENT)[number],
      { width: number; height: number }
    > = {
      horizontal: { width: 1600, height: 1000 },
      vertical: { width: 1280, height: 1600 },
      square: { width: 1280, height: 1280 },
    };
    const canvasSize = sizeForOrientation[orientation];

    const LANG_NAME = language === "es" ? "Spanish" : "English";
    const langInstr = `IMPORTANT: Generate ALL content in ${LANG_NAME}. Titles, labels, all user-facing text. The illustrationPrompt must still contain NO text inside the image.`;
    const userInstr = customPrompt.trim()
      ? `\nUSER REQUEST: "${customPrompt.trim()}". Incorporate this into the output.\n`
      : "";
    const styleInstr = getStyleInstructions(style);

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

    // ---- Phase 1: structured layout ----
    let content: LayoutContent;
    try {
      const { object } = await generateObject({
        model: getModel(modelId),
        schema: layoutSchema,
        prompt: `${langInstr}
${userInstr}
You are an expert teacher building an infographic that TEACHES real, specific facts from the provided sources. Content density and factual accuracy come first; the visual is secondary.

═══════════════════════════════════════
STEP 1 — EXTRACT (do this first, silently)
═══════════════════════════════════════

Read the sources and pull out:
- Every number, percentage, statistic, date, or measurable claim
- Every ordered process or workflow
- Every comparison or trade-off between alternatives
- Every timeline or historical progression
- Every cause-effect chain
- Every definition of a key concept
- Every expert insight or notable finding

All block content must come from these extractions. Do NOT invent facts.

═══════════════════════════════════════
STEP 2 — STRUCTURE (target: ${detailPick})
═══════════════════════════════════════

An infographic tells a visual story. Compose:

Opening (hook):
→ 1-2 "stat" blocks with surprising numbers to anchor attention

Body (teach):
→ 1 "chart" block if the sources contain quantitative data (trends, distributions)
→ 1-2 "callout" blocks for concepts that need deeper explanation
→ 1 "flow" or "timeline" block if there's a process or chronology
→ 1 "comparison" block if named alternatives are discussed
→ 0-1 "text" blocks ONLY when essential context can't be conveyed visually

Closing (seal):
→ 1 "takeaway" block with a specific, memorable, actionable conclusion

Never use more than 2 of the same block type. Vary layouts.

═══════════════════════════════════════
STEP 3 — DENSITY (every block must teach)
═══════════════════════════════════════

● "stat": value = a REAL number ("68%", "$4.2T", "3.2s"); label = 10-25 words explaining WHY it matters; position = semantic zone.
● "callout": title = 3-6 words; body = 2-4 sentences of REAL explanation with specifics (tool names, techniques, concrete details); position near a related illustration zone; leaderTo points toward it.
● "chart": chartType = "line" (trends), "bar" (comparisons), or "area" (volume); dataPoints = 3-8 real/realistic points; annotation = highlight key inflection points on 1-2 points.
  GOOD: {chartType:"bar", xLabel:"Framework", yLabel:"npm downloads/week (M)", dataPoints:[{x:"React",y:22.5,annotation:"Market leader"},{x:"Vue",y:4.2,annotation:null},{x:"Svelte",y:0.8,annotation:"Fastest growing"}]}
● "flow": 3-6 steps, each with a 2-4 word label and a ONE concrete-action sentence.
● "timeline": 3-6 entries with real dates and specific event descriptions — no vague "long ago" / "recently".
● "comparison": 2-4 items with NAMED entities and quantifiable differences.
● "takeaway": a specific, memorable insight — NOT "this topic is important".
● "text": 2-3 sentences of essential context (use sparingly).

Every field in every block must come from the extraction pass. Generic filler is a failure.

═══════════════════════════════════════
STEP 4 — METADATA + FALLBACKS
═══════════════════════════════════════

- title: max 8 words, punchy and topic-specific
- subtitle: max 14 words framing what the reader will learn
- header.text: the hero heading at the top; header.subtext: optional one-liner
- footer: short attribution or source note
- accentColor: pick by mood (orange=energy, blue=tech, emerald=growth/nature, violet=creative, rose=health/people, amber=finance/caution)
- sections (3-6): heading + 2-3 sentence summary of each major topic area — this is the text-only fallback. Be comprehensive.
- keyStats (2-5): the highest-impact numbers repeated as {value, label} pairs.

═══════════════════════════════════════
STEP 5 — ILLUSTRATION (visual-only, never text)
═══════════════════════════════════════

${styleInstr}

Write illustrationPrompt as 100-200 words describing small vignettes positioned in specific canvas zones (top-left, center-right, bottom-center, etc.) with whitespace between each for the text/chart overlay. The illustration must visually RELATE to the topic — cooking topic → utensils and ingredients; web dev → browsers, brackets, server racks; biology → cells, organs, microscopes. Never random decorative shapes.

All text must be in ${LANG_NAME}. The illustrationPrompt itself may be prose in ${LANG_NAME} but must contain NO text/words/letters/numbers INSIDE the image.

Sources:
${ctx.sourceContext}`,
      });
      content = object;
    } catch (err) {
      console.error("Infographic content generation failed:", err);
      const msg =
        err instanceof Error ? err.message : "content generation failed";
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

    // ---- Phase 2: compose via hybrid pipeline ----
    // If FAL_KEY is missing, composeInfographic internally falls back to a
    // plain cream background — the text still renders. But we also expose an
    // explicit "error" path so the viewer can surface a soft warning.
    let imageUrl = "";
    let thumbnailUrl: string | null = null;
    let composeError: string | null = null;
    try {
      // The composer accepts a `style` pass-through so future compose
      // implementations can forward it to generateInfographicImage. Until the
      // composer reads it, style selection is preserved as metadata.
      const composeOpts: ComposeOptions & { style?: VisualStyle } = {
        notebookId,
        outputId,
        width: canvasSize.width,
        height: canvasSize.height,
        style,
      };
      const composed = await composeInfographic(
        content as InfographicLayout,
        composeOpts,
      );
      imageUrl = composed.imageUrl;
      thumbnailUrl = composed.thumbnailUrl;
    } catch (err) {
      console.error("Infographic composition failed:", err);
      composeError =
        err instanceof Error ? err.message : "composition failed";
    }

    const saved: InfographicContent = {
      id: outputId,
      title: content.title,
      subtitle: content.subtitle,
      imageUrl,
      thumbnailUrl,
      imagePrompt: content.illustrationPrompt,
      sections: content.sections,
      keyStats: content.keyStats,
      ...(composeError ? { error: composeError } : {}),
    };

    await db
      .update(outputs)
      .set({
        content: {
          ...(saved as unknown as Record<string, unknown>),
          layout: content,
        },
        fileUrl: imageUrl || null,
        thumbnailUrl: thumbnailUrl ?? undefined,
        status: composeError ? "error" : "ready",
        updatedAt: new Date(),
      })
      .where(eq(outputs.id, outputId));

    return NextResponse.json(saved, { status: 201 });
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
        // swallow — already in an error path
      }
    }
    return NextResponse.json(
      { error: "Generation failed" },
      { status: 500 },
    );
  }
};
