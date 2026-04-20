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
  composeSlide,
  type SlideSpec,
  type SlideLayout,
} from "@/lib/media/compose-slide";

// ---------- Zod deck schema ----------

const slideSchema = z.object({
  id: z.string().describe("Short id s1, s2..."),
  layout: z
    .enum([
      "title",
      "content",
      "stat",
      "comparison",
      "quote",
      "flow",
      "closing",
    ])
    .describe("Which visual layout fits this slide's content best"),
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  bullets: z.array(z.string().max(80)).min(2).max(5).nullable(),
  stat: z
    .object({ value: z.string(), label: z.string() })
    .nullable(),
  comparisonItems: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .min(2)
    .max(4)
    .nullable(),
  quote: z
    .object({
      text: z.string(),
      attribution: z.string().nullable(),
    })
    .nullable(),
  flowSteps: z
    .array(z.object({ label: z.string(), detail: z.string() }))
    .min(3)
    .max(6)
    .nullable(),
  illustrationPrompt: z
    .string()
    .describe(
      "Visual-only prompt (NO text, NO labels, NO numbers). Describe scenes, objects, icons, metaphors that represent the slide's content. 80-160 words. The AI illustration will be placed BEHIND a text overlay so leave breathing room.",
    ),
  narrationHint: z.string(),
});

const deckSchema = z.object({
  deckTitle: z.string().describe("Overall deck title, 2-6 words"),
  deckSubtitle: z.string().describe("One-line subtitle"),
  accent: z.enum(["orange", "violet", "blue", "rose", "emerald", "amber"]),
  slides: z.array(slideSchema).min(4).max(8),
});

// ---------- Viewer contract (must stay stable) ----------

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
  /** Full richer deck description (per-layout fields) preserved for later regeneration. */
  fullDeck?: z.infer<typeof deckSchema>;
};

// ---------- Accent -> hex ----------

const ACCENT_HEX: Record<
  "orange" | "violet" | "blue" | "rose" | "emerald" | "amber",
  string
> = {
  orange: "#ff6b35",
  violet: "#7c3aed",
  blue: "#2563eb",
  rose: "#e11d48",
  emerald: "#059669",
  amber: "#d97706",
};

// ---------- Route ----------

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
    const langInstr = `IMPORTANT: Generate ALL textual content (titles, subtitles, bullets, stats, quotes, flow steps, narrationHint) in ${LANG_NAME}. Do NOT mix languages. HOWEVER, the illustrationPrompt must contain NO text of ANY kind, in any language — describe visuals only (objects, scenes, metaphors).`;

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

    // Phase 1 — generate the full deck structure
    let deck: z.infer<typeof deckSchema>;
    try {
      const { object } = await generateObject({
        model: getModel(modelId),
        schema: deckSchema,
        prompt: `${langInstr}

You are designing a visual presentation deck that teaches the user about the topic in the sources.

Create ${count} slides (default 6). Each slide uses ONE of 7 hybrid layouts. The AI will draw a pure-visual illustration as the background; all text is rendered by code on top. Therefore:

CRITICAL: The illustrationPrompt must describe ONLY visual elements — scenes, objects, icons, people, metaphors. Absolutely NO text, NO letters, NO numbers, NO labels, NO words, NO typography of any kind. Write 80-160 words. Leave breathing room in the composition because text will be overlaid.

LAYOUTS AVAILABLE and when to use each:
- title: the opening cover slide. ALWAYS first. Use: title + subtitle only. No bullets/stat/etc.
- content: a bulleted explanation of a concept. Use: title + 2-5 short bullets (max ~70 chars each). Optional subtitle.
- stat: a single striking number. Use: title (as eyebrow) + stat { value, label }. No bullets.
- comparison: compare 2-4 things side by side. Use: title + comparisonItems[] each with { label, value }. Short values (numbers, 1-2 words).
- quote: a pull quote from the sources. Use: quote { text, attribution }. No bullets. title optional.
- flow: a 3-6 step process. Use: title + flowSteps[] each with { label (2-4 words), detail (short sentence) }.
- closing: the final takeaway slide. ALWAYS last. Use: title as the single summary sentence. Optional subtitle as eyebrow.

Rules:
- Slide order: first layout is 'title', last is 'closing'. In between, mix layouts. NEVER repeat the same layout twice in a row.
- For each slide, populate ONLY the fields that its layout uses and set the others to null.
- Write all text in ${LANG_NAME}. The illustrationPrompt must have NO text in any language.
- narrationHint: 1-2 sentences the narrator will say about this slide (in ${LANG_NAME}).

EXAMPLE of a good illustrationPrompt (for a 'content' slide about rice thermodynamics):
"A hand-drawn ink sketch showing a steaming pot of rice on the left, grains of rice arranged in a spiral pattern on the right. Thin black ink lines on cream paper with subtle orange watercolor touches at the steam and the grains. Include a small thermometer icon, a tiny mountain silhouette in the background, and a stylized water droplet. Compose with lots of empty space on the left half so text can be overlaid. No labels, no numbers, no letters — purely illustrative metaphoric objects arranged in a loose circular flow around empty center-left space."

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

    const hex = ACCENT_HEX[deck.accent];

    // Phase 2 — compose every slide in parallel.
    // Each composeSlide() internally falls back to a cream background if fal fails.
    const composed = await Promise.all(
      deck.slides.map(async (s) => {
        const spec: SlideSpec = {
          id: s.id,
          layout: s.layout as SlideLayout,
          title: s.title,
          subtitle: s.subtitle,
          bullets: s.bullets,
          stat: s.stat,
          comparisonItems: s.comparisonItems,
          quote: s.quote,
          flowSteps: s.flowSteps,
          illustrationPrompt: s.illustrationPrompt,
          narrationHint: s.narrationHint,
        };
        try {
          const r = await composeSlide(spec, {
            notebookId: ctx.notebookId,
            outputId: outputId!,
            deckAccent: hex,
          });
          return {
            slide: s,
            imageUrl: r.imageUrl,
            error: null as string | null,
          };
        } catch (e) {
          console.error(`Slide compose failed for ${s.id}:`, e);
          return {
            slide: s,
            imageUrl: "",
            error: e instanceof Error ? e.message : "compose failed",
          };
        }
      }),
    );

    // Map the richer schema back to the viewer's flat shape
    const generatedSlides: SlideDeckSlide[] = composed.map((c) => ({
      id: c.slide.id,
      title: c.slide.title ?? "",
      subtitle: c.slide.subtitle,
      layout: c.slide.layout,
      keyPoints:
        c.slide.bullets ??
        c.slide.comparisonItems?.map((i) => `${i.label}: ${i.value}`) ??
        c.slide.flowSteps?.map((s) => `${s.label}: ${s.detail}`) ??
        (c.slide.stat ? [`${c.slide.stat.value} — ${c.slide.stat.label}`] : []),
      imagePrompt: c.slide.illustrationPrompt,
      imageUrl: c.imageUrl,
      narrationHint: c.slide.narrationHint,
    }));

    const allSlidesFailed = generatedSlides.every((s) => !s.imageUrl);
    const firstErr = composed.find((r) => r.error)?.error ?? null;

    const saved: SlidesContent = {
      deckTitle: deck.deckTitle,
      deckSubtitle: deck.deckSubtitle,
      accent: deck.accent,
      slides: generatedSlides,
      error: allSlidesFailed
        ? firstErr ?? "All slides failed to compose"
        : null,
      fullDeck: deck,
    };

    const firstImageUrl = generatedSlides.find((s) => s.imageUrl)?.imageUrl;

    await db
      .update(outputs)
      .set({
        content: saved as unknown as Record<string, unknown>,
        fileUrl: firstImageUrl ?? undefined,
        status: allSlidesFailed ? "error" : "ready",
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
