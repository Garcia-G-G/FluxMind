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
      "Visual-only prompt for AI image generation. NO text, NO labels, NO numbers, NO words anywhere. Describe small illustrated vignettes positioned in specific zones of the canvas, leaving whitespace for text overlay. 100-200 words. The style is defined by the system — focus only on the subject matter and spatial composition.",
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

const multiLayoutSchema = z.object({
  pages: z.array(layoutSchema).min(3).max(10),
});

export type InfographicPage = {
  index: number;
  title: string;
  subtitle: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
};

// Back-compat shape consumed by the existing viewer. Older single-image
// outputs read `imageUrl` directly; multi-page outputs also populate
// `pages` so the viewer can paginate.
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
  /** Multi-page infographic series — first entry mirrors imageUrl. */
  pages?: InfographicPage[];
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
      infographicCount: rawInfographicCount = 3,
      selectedSourceIds: rawSelectedSourceIds,
      extraSourceContent: rawExtraSourceContent,
    } = body as {
      notebookId: string;
      model?: string;
      language?: string;
      style?: string;
      detailLevel?: string;
      customPrompt?: string;
      orientation?: string;
      infographicCount?: number;
      selectedSourceIds?: string[];
      extraSourceContent?: string;
    };
    const infographicCount = Math.max(
      3,
      Math.min(Math.floor(Number(rawInfographicCount) || 3), 10),
    );

    const selectedSourceIds: string[] = Array.isArray(rawSelectedSourceIds)
      ? rawSelectedSourceIds.filter((s): s is string => typeof s === "string")
      : [];
    const extraSourceContent: string =
      typeof rawExtraSourceContent === "string"
        ? rawExtraSourceContent.slice(0, 80_000)
        : "";

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

    const ctx = await getStudioContext(
      notebookId,
      selectedSourceIds,
      "studioGenerate",
    );
    if (isError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const finalContext = extraSourceContent
      ? `${ctx.sourceContext}\n\n--- Additional sources ---\n${extraSourceContent}`
      : ctx.sourceContext;

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
    let pagesContent: LayoutContent[];
    try {
      const { object } = await generateObject({
        model: getModel(modelId),
        schema: multiLayoutSchema,
        prompt: `${langInstr}
${userInstr}
You are an expert teacher building a SERIES of exactly ${infographicCount} connected infographics about this topic. Each page is one infographic in a visual series; they flow as a single narrative.

SERIES STRUCTURE:
- Page 1: "Data Dashboard" — hook with the most surprising numbers, overview the topic
- Page 2: "Chart Analysis" — visual data deep dive with charts and annotations
- Page 3: "Process & Context" — how things work or evolved, with comparisons
- Pages 4+: Rotate through different emphases (versus, trends, concepts, summary)
- Last page: Always end with a strong "takeaway" block

CRITICAL VARIETY RULES:
- Every page MUST have a unique title AND unique subtitle.
- Every page MUST have its own illustrationPrompt describing different visual vignettes.
- accentColor CAN vary between pages — pick what fits each page's mood.
- Each page's blocks follow the density/quality rules below.

Per-page rules below apply to EACH page inside the "pages" array.

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
STEP 2 — STRUCTURE (EACH PAGE MUST HAVE A DIFFERENT BLOCK MIX)
═══════════════════════════════════════

The infographic series must feel visually varied. Each page uses a DIFFERENT combination of block types. Follow these compositions strictly:

PAGE 1 — "Data Dashboard" (overview with numbers):
  • 3-4 "stat" blocks (the biggest, most surprising numbers from the sources)
  • 1 "text" block (2-3 sentences framing the topic)
  • 1 "takeaway" block (the single most important insight)
  • NO chart, NO flow, NO comparison on this page

PAGE 2 — "Chart Analysis" (visual data story):
  • 1 "chart" block — this is the hero (line, bar, or area chart with 4-8 real data points, annotations on 1-2)
  • 2-3 "callout" blocks explaining what the chart reveals, with specific numbers
  • NO stat blocks on this page

PAGE 3 — "Process & Context" (narrative flow):
  • 1 "flow" OR "timeline" block — the main visual element (pick whichever fits)
  • 1 "comparison" block (2-4 named alternatives with quantifiable differences)
  • 1 "callout" block for extra context
  • NO stat blocks, NO chart on this page

FOR PAGES 4+ (if ${infographicCount} > 3), rotate through these patterns in order:
  • "Versus Page":  2 "comparison" blocks + 2 "stat" blocks (head-to-head analysis)
  • "Deep Analysis": 1 "chart" + 1 "timeline" + 1 "takeaway" (trends over time)
  • "Key Concepts": 3 "callout" blocks + 1 "stat" (definitions and explanations)
  • "Summary Dashboard": 4 "stat" blocks + 1 "takeaway" (numbers recap)

STRICT RULE: No two consecutive pages may share the same dominant block type. If page 2 has a chart, page 3 must NOT have a chart. If page 3 has a timeline, page 4 must NOT have a timeline.

Each page has 4-8 blocks total (density target: ${detailPick}).

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
${finalContext}`,
      });
      pagesContent = object.pages;
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

    // ---- Phase 2: compose every page in parallel ----
    // Each page uses its own pageIndex so selectTemplate rolls across the
    // template pool — the same outputId + pageIndex is deterministic, so
    // a retry renders identical pages. FAL failures fall back to the cream
    // background per-page; we only flag the whole output as error when no
    // page succeeded.
    const composedPages = await Promise.all(
      pagesContent.map(async (pageContent, i) => {
        const pageId = i === 0 ? outputId! : `${outputId}-p${i + 1}`;
        try {
          const composeOpts: ComposeOptions = {
            notebookId,
            outputId: pageId,
            width: canvasSize.width,
            height: canvasSize.height,
            style,
            pageIndex: i,
          };
          const composed = await composeInfographic(
            pageContent as InfographicLayout,
            composeOpts,
          );
          return {
            imageUrl: composed.imageUrl,
            thumbnailUrl: composed.thumbnailUrl,
            error: null as string | null,
          };
        } catch (err) {
          console.error(`Infographic page ${i + 1} composition failed:`, err);
          return {
            imageUrl: "",
            thumbnailUrl: null as string | null,
            error: err instanceof Error ? err.message : "composition failed",
          };
        }
      }),
    );

    const pages: InfographicPage[] = composedPages.map((composed, i) => ({
      index: i + 1,
      title: pagesContent[i].title,
      subtitle: pagesContent[i].subtitle,
      imageUrl: composed.imageUrl,
      thumbnailUrl: composed.thumbnailUrl,
    }));

    const allFailed = composedPages.every((p) => !p.imageUrl);
    const composeError = allFailed
      ? (composedPages[0]?.error ?? "composition failed")
      : null;
    const firstPage = pagesContent[0];

    const saved: InfographicContent = {
      id: outputId,
      title: firstPage.title,
      subtitle: firstPage.subtitle,
      imageUrl: pages[0]?.imageUrl ?? "",
      thumbnailUrl: pages[0]?.thumbnailUrl ?? null,
      imagePrompt: firstPage.illustrationPrompt,
      sections: firstPage.sections,
      keyStats: firstPage.keyStats,
      pages,
      ...(composeError ? { error: composeError } : {}),
    };

    await db
      .update(outputs)
      .set({
        content: {
          ...(saved as unknown as Record<string, unknown>),
          layout: firstPage,
          allLayouts: pagesContent,
        },
        fileUrl: pages[0]?.imageUrl || null,
        thumbnailUrl: pages[0]?.thumbnailUrl ?? undefined,
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
