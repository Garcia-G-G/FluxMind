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

You are a world-class data visualization designer and expert educator. Your job is to create an infographic that TEACHES complex information through dense, specific, visual data. Every block must contain REAL data extracted from the sources.

═══════════════════════════════════════
CONTENT EXTRACTION (do this FIRST)
═══════════════════════════════════════

Deeply analyze the sources. Extract:
- Every number, percentage, statistic, date, or measurable fact
- Every process or workflow (ordered steps)
- Every comparison or trade-off between alternatives
- Every timeline or historical progression
- Every cause-effect chain
- Every definition of a key concept
- Every expert insight or notable finding

You will structure these extractions into 4-10 visual blocks.

═══════════════════════════════════════
BLOCK SELECTION STRATEGY
═══════════════════════════════════════

A great infographic tells a visual STORY. Structure it:

Opening (hook the reader):
→ 1-2 "stat" blocks with surprising numbers to grab attention

Body (teach the details):
→ 1 "chart" block if there's quantitative data (trends, growth, distributions)
→ 1-2 "callout" blocks for concepts that need deeper explanation
→ 1 "flow" or "timeline" block if there's a process or chronology
→ 1 "comparison" block if alternatives are discussed
→ 0-1 "text" blocks for essential context

Closing (seal the insight):
→ 1 "takeaway" block with a specific, memorable conclusion

Mix 5-8 block types total. Never use more than 2 of the same type.

═══════════════════════════════════════
BLOCK CONTENT DENSITY (CRITICAL)
═══════════════════════════════════════

● "stat" block:
  value = a REAL number ("68%", "$4.2T", "3.2s", "1.8B")
  label = 10-25 words explaining significance
  position = place semantically (important stats at top)
  GOOD: {value:"68%", label:"of all online experiences begin with a search engine — SEO is the #1 organic traffic source", position:"top-left"}
  BAD: {value:"Lots", label:"of people use the internet", position:"top-left"}

● "callout" block:
  title = 3-6 words naming the concept
  body = 2-4 sentences of REAL explanation with specifics — tool names, techniques, concrete details
  position = place near related illustration area
  leaderTo = direction pointing toward related visual element
  GOOD: {title:"The DOM Tree", body:"When a browser loads HTML, it builds a Document Object Model — a tree structure where every element becomes a node. JavaScript's querySelector() finds nodes; addEventListener() makes them respond to clicks, hovers, and keyboard input. Understanding the DOM is the key to dynamic web pages.", position:"mid-right", leaderTo:"left"}
  BAD: {title:"Important Concept", body:"This is something you should know about because it matters.", position:"mid-right", leaderTo:"left"}

● "chart" block:
  chartType = "line" for trends, "bar" for comparisons, "area" for volume/cumulative
  dataPoints = 3-8 points with REAL or realistic data. x = specific label (year, category, stage name). y = numeric value. annotation = highlight key inflection points.
  GOOD: {chartType:"bar", xLabel:"Framework", yLabel:"npm Downloads/week (M)", dataPoints:[{x:"React",y:22.5,annotation:"Market leader"},{x:"Vue",y:4.2,annotation:null},{x:"Angular",y:3.1,annotation:null},{x:"Svelte",y:0.8,annotation:"Fastest growing"}]}
  BAD: {chartType:"bar", xLabel:"Things", yLabel:"Amount", dataPoints:[{x:"A",y:10,annotation:null},{x:"B",y:20,annotation:null}]}

● "flow" block:
  steps = 3-6, each with label (2-4 words) and detail (concrete action sentence)
  Same quality bar as slides — every step is specific and actionable

● "timeline" block:
  events = 3-6 entries with real dates/periods and specific event descriptions
  GOOD: [{date:"1991", label:"Tim Berners-Lee publishes the first website at CERN"}, {date:"1995", label:"JavaScript created in 10 days by Brendan Eich at Netscape"}, ...]
  BAD: [{date:"Long ago", label:"The web started"}, {date:"Recently", label:"Things changed"}]

● "comparison" block:
  items = 2-4 with named entities and quantifiable differences (same bar as slides)

● "takeaway" block:
  text = A specific, memorable insight (not "this topic is important")
  GOOD: "Every second of load time costs 7% in conversions — optimize images, minify CSS, and use a CDN to keep your site under the 3-second threshold"
  BAD: "Web development is an important field with many opportunities"

● "text" block:
  text = 2-3 sentences of essential context (use sparingly — prefer visual blocks)

═══════════════════════════════════════
METADATA FIELDS
═══════════════════════════════════════

- title: max 8 words, punchy, specific to the topic (not "Important Information")
- subtitle: max 14 words framing what the reader will learn
- header.text: the big heading at the top of the infographic
- header.subtext: optional one-liner beneath it
- footer: short attribution or source note
- accentColor: pick one that matches the topic's mood (orange=energy, blue=tech, emerald=nature/growth, violet=creative, rose=health/people, amber=finance/caution)

═══════════════════════════════════════
SECTIONS and KEYSTATS (fallback view)
═══════════════════════════════════════

These power the text-only fallback when images can't render:
- sections (3-6): each has a heading + a 2-3 sentence summary of a major topic area from the sources. Be comprehensive — this is the user's backup way to consume the information.
- keyStats (2-5): the most impactful numbers repeated as {value, label} pairs.

═══════════════════════════════════════
ILLUSTRATION PROMPT (secondary priority)
═══════════════════════════════════════

illustrationPrompt creates the visual background (1280×1600 portrait). Describe ONLY visual elements — NO text, NO letters, NO numbers, NO labels, NO words, NO typography.

100-200 words. Style: pen-and-ink technical illustration on cream-colored graph paper, vintage engineering sketchbook (Leonardo's Codex, old physics textbooks). Describe small illustrated vignettes positioned in specific zones of the canvas (top-left, center-right, bottom, etc.), leaving whitespace between each for the text/chart overlay. Thin ink lines, off-register hand-drawn feel, occasional muted orange/sepia watercolor wash on focal elements.

The illustration should visually RELATE to the infographic's topic. If the topic is cooking, draw utensils and ingredients. If it's web development, draw browsers and code brackets and server racks.

All textual content must be in ${LANG_NAME}. The illustrationPrompt itself may be in ${LANG_NAME} prose but must contain NO text/words INSIDE the image.

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
