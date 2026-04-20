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

const slideSchema = z.object({
  id: z.string().describe("Short id like s1, s2..."),
  title: z.string().describe("Slide title, max 8 words"),
  subtitle: z.string().nullable().describe("Optional subtitle"),
  layout: z
    .enum([
      "title",
      "graph",
      "comparison_table",
      "diagram",
      "equation",
      "flow",
      "timeline",
      "closing",
    ])
    .describe("Choose the visual layout best suited to this slide's content"),
  keyPoints: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("2-5 short bullet points summarizing what's on the slide"),
  imagePrompt: z
    .string()
    .describe(
      "DETAILED prompt (150-250 words) for the FLUX image. MUST describe: (1) the exact layout matching the chosen layout type, (2) specific visual elements (e.g. 'a graph with Altitude on X-axis, Boiling Point on Y-axis'), (3) callout boxes with the exact text to render (include real numbers and labels from the source), (4) small illustrated elements (e.g. 'palm tree at sea-level point', 'mountain at high-altitude point'), (5) spatial arrangement (top, center, bottom-right, etc.). Style inherits hand-drawn ink illustration from server prefix — do NOT describe style again. Include the slide title to render inside the image. Use Spanish if sources are Spanish.",
    ),
  narrationHint: z
    .string()
    .describe(
      "1-2 sentences the narrator should say about this slide — used for deck-level narration script",
    ),
});

const deckSchema = z.object({
  deckTitle: z.string().describe("Overall deck title, 2-6 words"),
  deckSubtitle: z.string().describe("One-line subtitle for the deck"),
  accent: z
    .enum(["orange", "violet", "blue", "rose", "emerald", "amber"])
    .describe("Accent color theme"),
  slides: z
    .array(slideSchema)
    .min(4)
    .max(8)
    .describe(
      "4-8 slides total: start with a 'title' layout, end with 'closing', mix layouts in between. NEVER repeat the same layout twice in a row.",
    ),
});

export type SlideDeckSlide = {
  id: string;
  title: string;
  subtitle: string | null;
  layout: string;
  keyPoints: string[];
  imagePrompt: string;
  imageUrl: string;
  narrationHint: string;
};

export type SlidesContent = {
  deckTitle: string;
  deckSubtitle: string;
  accent: "orange" | "violet" | "blue" | "rose" | "emerald" | "amber";
  slides: SlideDeckSlide[];
  audioUrl?: string | null;
  audioScript?: string | null;
  audioDuration?: number | null;
  error?: string | null;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  let outputId: string | null = null;

  try {
    const body = await request.json();
    const {
      notebookId,
      count = 6,
      model: modelId = "gemini-2.5-flash",
      language: rawLanguage = "en",
    } = body as {
      notebookId: string;
      count?: number;
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
      type: "slides",
      title: `Slides: ${ctx.notebookTitle}`,
      status: "generating",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Phase 1 — Generate deck structure with per-slide imagePrompts
    let deck: z.infer<typeof deckSchema>;
    try {
      const { object } = await generateObject({
        model: getModel(modelId),
        schema: deckSchema,
        prompt: `${langInstr}

You are designing a visual presentation deck that teaches the user about the topic in the sources.

Create ${count} slides (default 6) that each use a DIFFERENT visual layout to best present its content.

LAYOUTS AVAILABLE and when to use each:
- title: the opening cover slide. ALWAYS first.
- graph: when showing relationships between two quantitative variables (use axes, annotations, callout boxes at key points).
- comparison_table: when comparing 3+ options across 2-4 properties (use grid of cells).
- diagram: when showing anatomy, taxonomy, structural breakdown (labeled parts with leader lines).
- equation: when the concept has a key formula (center the formula, annotate each term with what it represents).
- flow: when the content is a process (numbered circles with arrows).
- timeline: when events matter chronologically.
- closing: the final takeaway slide. ALWAYS last.

Rules:
- Every slide MUST use a layout that genuinely fits its content. DO NOT use 'title' in the middle.
- NEVER use the same layout twice in a row.
- Each imagePrompt MUST be 150-250 words and describe a SPECIFIC, ANNOTATED illustration with real numbers and labels pulled from the sources. Include the slide title text to render IN the image.
- narrationHint: 1-2 sentences in the same language as the sources — what the narrator will say about this slide.
- Match language of the sources (English sources → English slides; Spanish sources → Spanish slides).

EXAMPLE imagePrompt for a 'graph' layout:
"A hand-drawn ink illustration on white graph paper titled 'Termodinámica: La Ley de la Presión Atmosférica' rendered at the top in bold serif font. The center features a large XY graph with 'Altitud' labeled on the X-axis (horizontal, bottom-right with arrow) and 'Punto de Ebullición' on the Y-axis (vertical, top-left with arrow). A thin black curve descends from top-right to bottom-left across the graph. Four callout boxes with leader lines to the curve: (1) at sea level, a small palm tree + sun sketch labeled 'Nivel del Mar: El agua hierve a 100°C. Tiempo estándar de arroz: 15-20 min.', (2) mid-altitude, a small airplane sketch labeled 'Avión Comercial (Cabina a 2400m): El agua hierve a 90°C. Altera la extracción de sabores.', (3) upper-right, a small mountain sketch labeled 'La Paz, Bolivia (3600m): El agua hierve a 88°C. Un arroz graneado toma hasta 40 minutos.', (4) bottom-right, a sketch of a pressure cooker with steam labeled 'Olla de Presión (Efecto Inverso): Atrapa el vapor, elevando la temperatura de ebullición a 120°C.'. Monochrome ink with thin line weight. Footer: 'NotebookLM' style attribution."

Every slide should follow a similar level of specificity, detail, and annotation density — picking the visual structure best suited to its content.

Sources:
${ctx.sourceContext}`,
      });
      deck = object;
    } catch (err) {
      console.error("Slides deck generation failed:", err);
      const msg = err instanceof Error ? err.message : "deck generation failed";
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

    // If no FAL key — save text content with error status but return 201
    if (!process.env.FAL_KEY) {
      const fallback: SlidesContent = {
        deckTitle: deck.deckTitle,
        deckSubtitle: deck.deckSubtitle,
        accent: deck.accent,
        slides: deck.slides.map((s) => ({
          id: s.id,
          title: s.title,
          subtitle: s.subtitle,
          layout: s.layout,
          keyPoints: s.keyPoints,
          imagePrompt: s.imagePrompt,
          imageUrl: "",
          narrationHint: s.narrationHint,
        })),
        error: "FAL_KEY not configured",
      };
      await db
        .update(outputs)
        .set({
          status: "error",
          content: fallback as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(outputs.id, outputId));
      return NextResponse.json(
        { id: outputId, ...fallback },
        { status: 201 },
      );
    }

    // Phase 2 — Generate all slide images in parallel
    const results = await Promise.all(
      deck.slides.map(async (slide) => {
        try {
          const result = await generateInfographicImage(slide.imagePrompt, {
            size: { width: 1280, height: 1600 },
            persistTo: {
              key: `slides/${notebookId}/${outputId}/${slide.id}.png`,
            },
          });
          return { slide, imageUrl: result.url, error: null as string | null };
        } catch (err) {
          console.error(
            `Slide image generation failed for ${slide.id}:`,
            err,
          );
          const msg =
            err instanceof Error ? err.message : "image generation failed";
          return { slide, imageUrl: "", error: msg };
        }
      }),
    );

    const generatedSlides: SlideDeckSlide[] = results.map(
      ({ slide, imageUrl }) => ({
        id: slide.id,
        title: slide.title,
        subtitle: slide.subtitle,
        layout: slide.layout,
        keyPoints: slide.keyPoints,
        imagePrompt: slide.imagePrompt,
        imageUrl,
        narrationHint: slide.narrationHint,
      }),
    );

    const allImagesFailed = generatedSlides.every((s) => !s.imageUrl);
    const firstErr = results.find((r) => r.error)?.error ?? null;

    const saved: SlidesContent = {
      deckTitle: deck.deckTitle,
      deckSubtitle: deck.deckSubtitle,
      accent: deck.accent,
      slides: generatedSlides,
      error: allImagesFailed
        ? firstErr ?? "All slide images failed to generate"
        : null,
    };

    const firstImageUrl = generatedSlides.find((s) => s.imageUrl)?.imageUrl;

    await db
      .update(outputs)
      .set({
        content: saved as unknown as Record<string, unknown>,
        fileUrl: firstImageUrl ?? undefined,
        status: allImagesFailed ? "error" : "ready",
        updatedAt: new Date(),
      })
      .where(eq(outputs.id, outputId));

    return NextResponse.json({ id: outputId, ...saved }, { status: 201 });
  } catch (error) {
    console.error("Slides generation failed:", error);
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
        // swallow — already in error path
      }
    }
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
};
