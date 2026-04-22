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
  type SlideComposeOptions,
} from "@/lib/media/compose-slide";
import {
  getStyleInstructions,
  type VisualStyle,
} from "@/lib/media/styles";

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
      "Visual-only prompt (NO text, NO labels, NO numbers). Style: pen-and-ink technical illustration on cream-colored graph paper, vintage engineering sketchbook feel. Describe small illustrated vignettes positioned in specific zones of the canvas (top-left, center-right, bottom, etc.), scenes at different 'points' of a larger picture, with plenty of whitespace around each vignette for text overlay. 80-160 words. Think Leonardo's Codex and old physics textbook diagrams: confident thin ink lines, off-register hand-drawn feel, occasional muted orange or sepia watercolor wash on focal elements.",
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
      model: modelId = "gemini-2.5-flash",
      language: rawLanguage = "en",
      style: rawStyle = "auto",
      detailLevel: rawDetail = "standard",
      customPrompt: rawCustom = "",
      slideCount: rawSlideCount,
      accentColor: rawAccent,
      selectedSourceIds: rawSelectedSourceIds,
      extraSourceContent: rawExtraSourceContent,
    } = body as {
      notebookId: string;
      model?: string;
      language?: string;
      style?: string;
      detailLevel?: string;
      customPrompt?: string;
      slideCount?: number;
      accentColor?: string;
      selectedSourceIds?: string[];
      extraSourceContent?: string;
    };

    const selectedSourceIds: string[] = Array.isArray(rawSelectedSourceIds)
      ? rawSelectedSourceIds.filter((s): s is string => typeof s === "string")
      : [];
    const extraSourceContent: string =
      typeof rawExtraSourceContent === "string"
        ? rawExtraSourceContent.slice(0, 80_000)
        : "";

    // Coerce enums — unknowns fall back to defaults.
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
    const ALLOWED_ACCENTS = [
      "orange",
      "violet",
      "blue",
      "rose",
      "emerald",
      "amber",
    ] as const;
    const accentOverride: (typeof ALLOWED_ACCENTS)[number] | null =
      typeof rawAccent === "string" &&
      ALLOWED_ACCENTS.includes(rawAccent as (typeof ALLOWED_ACCENTS)[number])
        ? (rawAccent as (typeof ALLOWED_ACCENTS)[number])
        : null;

    const detailMap = {
      concise: { count: 4, points: "2-3 key points each" },
      standard: { count: 6, points: "3-5 key points each" },
      detailed: { count: 8, points: "4-5 key points with deep context" },
    } as const;
    const detailPick = detailMap[detailLevel] ?? detailMap.standard;
    const count =
      typeof rawSlideCount === "number" && rawSlideCount >= 4 && rawSlideCount <= 16
        ? rawSlideCount
        : detailPick.count;

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
${userInstr}
You are an expert teacher building a slide deck that TEACHES real, specific facts from the provided sources. Your #1 priority is content accuracy and factual density; visual polish is secondary.

═══════════════════════════════════════
STEP 1 — EXTRACT (do this first, silently)
═══════════════════════════════════════

Read the sources and pull out:
- Every specific number, percentage, date, duration, price, or measurable claim
- Every named tool, technology, framework, method, person, place, or product
- Every process, workflow, or ordered set of steps
- Every comparison, trade-off, or alternative mentioned
- Every cause-effect relationship ("X leads to Y because…")
- Every key definition or domain term
- Any notable quotes, expert opinions, or surprising insights

You will use these extractions — and ONLY these — as the content of the slides. Do NOT invent facts. Do NOT pad with generic filler.

═══════════════════════════════════════
STEP 2 — DESIGN (pick layouts that fit content)
═══════════════════════════════════════

Produce exactly ${count} slides (detail level: ${detailLevel} — ${detailPick.points}).

- Slide 1 MUST use layout "title": the deck title + a subtitle that previews WHAT the viewer will learn (e.g. "6 concrete techniques to cut page load time in half").
- Slides 2 … ${count - 1} are teaching slides. Pick the layout that fits the extracted content:
  → Dense conceptual explanation? → "content" (${detailPick.points})
  → A striking real number that anchors the idea? → "stat"
  → Named alternatives being compared? → "comparison"
  → An ordered procedure? → "flow"
  → A powerful line from the sources? → "quote"
- Slide ${count} MUST use layout "closing": a specific, memorable, actionable takeaway sentence — NOT motivational filler.

NEVER use the same layout on two consecutive slides. Vary to keep the deck dynamic.

═══════════════════════════════════════
STEP 3 — DENSITY (every field must teach)
═══════════════════════════════════════

Populate the fields for the chosen layout. All other layout-specific fields MUST be null.

● "content":
  - title: 3-8 words naming the specific concept (e.g. "HTML5 Semantic Structure", not "The Basics")
  - bullets: ${detailPick.points}. Each bullet is 40-75 chars and delivers ONE concrete fact, technique, tool name, or metric.
  - GOOD: "Use <header>, <nav>, <main>, <footer> for accessibility + SEO"
  - BAD:  "It's important to use good practices"

● "stat":
  - stat.value: a REAL number from the sources or a well-known domain statistic ("53%", "4.9B", "3s", "$12K")
  - stat.label: 15-40 words explaining WHY that number matters and what it implies
  - title: a 3-6 word eyebrow categorizing the stat

● "comparison":
  - comparisonItems: 2-4 items — each has a specific NAMED entity and a differentiating value
  - GOOD: [{label:"React", value:"Component-based, ~22M weekly npm installs"}, {label:"Svelte", value:"No virtual DOM, smallest bundles"}]

● "flow":
  - flowSteps: 3-6 steps. Each step has a 2-4 word label and a ONE concrete-action sentence detail.
  - GOOD: {label:"Wireframe Layout", detail:"Sketch page structure in Figma — header, content zones, sidebar, footer"}

● "quote":
  - quote.text: an actual line from the sources, or a faithful synthesis phrased as a memorable quote
  - quote.attribution: the source document title, author, or "— Source analysis"

● "closing":
  - title: a specific, memorable takeaway sentence derived directly from the content (NOT generic)
  - subtitle: a short eyebrow like "KEY TAKEAWAY" or "RESUMEN"

Write a narrationHint (2-3 natural spoken ${LANG_NAME} sentences) for every slide. Add context BEYOND what's on the slide — an example, an analogy, a "why this matters" insight. This powers the TTS narration.

═══════════════════════════════════════
STEP 4 — ILLUSTRATION (visual-only, never text)
═══════════════════════════════════════

${styleInstr}

Write illustrationPrompt as 80-160 words describing small vignettes positioned in specific zones (top-left, center-right, bottom-center, etc.) with plenty of whitespace around each for the text overlay. The illustration should visually RELATE to the slide's content (indexing → filing cabinet + index cards + magnifying glass; network latency → stopwatch + globe + data packets — NEVER random decorative shapes).

═══════════════════════════════════════
FULL WORKED EXAMPLE — 6-slide deck on "How to Create a Website"
═══════════════════════════════════════

Sources mention: HTML5, CSS (Grid/Flexbox), JavaScript/DOM, wireframes, responsive design, SEO, hosting, WordPress vs custom, 53% mobile abandonment stat.

Slide 1 (title): title="Building Your First Website", subtitle="From blank page to live site — the 6 essential concepts every web creator needs"
Slide 2 (content): title="HTML5 Semantic Structure", bullets=["Every page opens with <!DOCTYPE html> to trigger modern standards","Semantic tags <header>, <nav>, <main>, <article>, <footer> boost accessibility + SEO","The <head> holds metadata, CSS links, and <title> for SEO","Forms rely on <input>, <select>, <textarea> for interactivity","Images need alt text for accessibility, SEO, and broken-image fallback"]
Slide 3 (stat): title="PERFORMANCE IMPACT", stat={value:"53%", label:"of mobile visitors leave a page that takes over 3 seconds to load — every extra second costs 7% in conversions per Google research"}
Slide 4 (comparison): title="Choose Your Platform", comparisonItems=[{label:"WordPress", value:"~43% of all websites, 60K+ plugins"},{label:"Custom Code", value:"Full control, zero bloat, highest upkeep"},{label:"Shopify", value:"Hosted e-commerce, starts at $29/mo"},{label:"Next.js", value:"React framework with SSR + SSG + ISR"}]
Slide 5 (flow): title="Idea to Live Website", flowSteps=[{label:"Plan & Wireframe", detail:"Define pages, navigation, and content zones in Figma"},{label:"Write HTML", detail:"Build semantic structure with sections, headings, forms, links"},{label:"Style with CSS", detail:"Apply Grid/Flexbox layout, typography, responsive breakpoints"},{label:"Add JavaScript", detail:"Layer in form validation, menus, API calls, dynamic content"},{label:"Test & Deploy", detail:"Cross-browser test, then push to Vercel, Netlify, or GitHub Pages"}]
Slide 6 (closing): title="Start with semantic HTML, layer CSS for layout, add JS for interactivity — deploy in minutes on modern hosting", subtitle="KEY TAKEAWAY"

All text must be in ${LANG_NAME}. The illustrationPrompt must contain NO text of ANY kind.

Sources:
${finalContext}`,
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

    // Caller may override the LLM's accent pick.
    if (accentOverride) {
      deck.accent = accentOverride;
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
          // Style drives the composer's readability sheet tint via
          // STYLE_CONFIGS[style].overlayBg.
          const composeOpts: SlideComposeOptions = {
            notebookId: ctx.notebookId,
            outputId: outputId!,
            deckAccent: hex,
            style,
          };
          const r = await composeSlide(spec, composeOpts);
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
