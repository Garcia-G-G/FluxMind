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
  type InfographicLayout,
} from "@/lib/media/compose-infographic";

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
    } = body as {
      notebookId: string;
      model?: string;
      language?: string;
    };
    const language: "en" | "es" = rawLanguage === "es" ? "es" : "en";
    const LANG_NAME = language === "es" ? "Spanish" : "English";
    const langInstr = `IMPORTANT: Generate ALL content in ${LANG_NAME}. Titles, body, callouts, chart labels, flow step labels, takeaway text, timeline events, sections, keyStats, AND the descriptive wording of illustrationPrompt must all be in ${LANG_NAME}. However, the illustrationPrompt itself MUST contain NO text/letters/words/numbers INSIDE the image — it only describes visual elements (objects, scenes, icons, metaphors) in ${LANG_NAME} prose. Never mix languages.`;

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

You are a world-class data visualization designer building a hybrid infographic. An AI model will render an ILLUSTRATION background, and a deterministic code layer will render ALL TEXT, CHARTS, CALLOUTS, AND STATS on top. Therefore:

1. illustrationPrompt — describe the visual scene ONLY. Think "what would I draw if I could only communicate with pictures?" Icons, metaphoric objects, scenes, diagrams without labels. 100-200 words. NO text, NO letters, NO numbers, NO words, NO typography INSIDE the image. Style: pen-and-ink technical illustration on cream-colored graph paper, vintage engineering sketchbook, Leonardo da Vinci's Codex meets old physics textbook. Describe small illustrated vignettes positioned in specific zones of the canvas (top-left beach scene, center-right airplane, bottom-right pressure cooker, etc.), scenes at different "points" of a larger picture, leaving whitespace around each for text overlay. Example good prompt: "a cross-section cutaway of a rice cooker with thin ink lines in the center-left, steam curling upward in a soft sepia watercolor wash toward the upper edge, a small thermometer vignette in the lower-left, a minimalist radial heat-distribution pattern in the upper-right, all rendered on cream graph paper with confident off-register hand-drawn lines and plenty of open space between vignettes for overlaid text."

2. blocks — the interactive text/chart layer. Pick 4 to 10 blocks from these types:
   - stat: a single big number with a short label, placed at a semantic position (e.g. top-left)
   - callout: 2-4 line note with a leader line to an area of the illustration (pick leaderTo: left|right|up|down)
   - comparison: 2-4 side-by-side value+label cards
   - chart: line, bar, or area chart with 3-8 data points. y values are any scale (we normalize). x is a short string label per point. Optional annotation per point.
   - flow: 3-6 numbered steps forming a process
   - takeaway: a single standout insight in a highlighted banner
   - text: a short paragraph (fills a ~3-line slot)
   - timeline: 3-6 dated events

3. Mix block types — a great infographic usually has 1 chart, 2-3 stats, 1-2 callouts, and 1 takeaway.

4. title: max 8 words. subtitle: max 14 words. footer: short attribution or source note.

5. sections (3-6) and keyStats (2-5) are backwards-compatible fields for the text-only fallback view — make them faithful to the source.

6. accentColor: pick ONE from the allowed palette that matches the topic's mood.

EXAMPLE (for reference, a rice-thermodynamics topic):
- illustrationPrompt: vintage engineering sketchbook page on cream graph paper — a pen-and-ink cross-section of a rice grain in the upper-left vignette, concentric heat-wave rings sketched faintly in the center, a small spoon and a simmering pot with steam curling up in the lower-right rendered in thin confident ink lines, a tiny thermometer vignette in the top-right, soft sepia-orange watercolor wash on steam and grain focal points, slightly off-register hand-drawn lines, plenty of open whitespace between vignettes in the upper-center and lower-left for text overlay
- blocks: a chart (line, x="minutes", y="temperature", 5 points with an annotation on point 3 "gelatinization begins"); 2 stats at top-left and top-right showing "60%" water ratio and "18m" cook time; a callout at mid-right pointing up at the steam area with a note about latent heat; a takeaway summarizing the optimal cooking window
- sections: 3 accessibility-oriented heading+summary pairs
- keyStats: 3 cards repeating the most critical numbers

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
      const composed = await composeInfographic(
        content as InfographicLayout,
        {
          notebookId,
          outputId,
          width: 1280,
          height: 1600,
        },
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
