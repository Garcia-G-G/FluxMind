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

You are an expert educator designing a visual presentation. Your #1 job is to TEACH — every slide must contain specific, factual, actionable information extracted from the sources.

═══════════════════════════════════════
CONTENT EXTRACTION (do this FIRST)
═══════════════════════════════════════

Before designing slides, analyze the sources and extract:
- Every specific fact, number, percentage, date, or statistic
- Every named tool, technology, framework, method, or concept
- Every process, workflow, or step-by-step procedure
- Every comparison, trade-off, or alternative
- Every cause-effect relationship
- Every definition or key term
- Any notable quotes or expert opinions

Organize these extractions into teachable chunks. Each chunk becomes one slide.

═══════════════════════════════════════
SLIDE DESIGN RULES
═══════════════════════════════════════

Create ${count} slides (default 6). Structure:
- Slide 1: layout "title" → topic title + subtitle that tells the user WHAT they will learn (e.g. "5 key steps from blank page to live deployment")
- Slides 2 through N-1: teaching slides using "content", "stat", "comparison", "flow", or "quote" layouts. Pick the layout that BEST matches the information type:
  → Explaining concepts with multiple facets? → "content" (3-5 dense bullets)
  → A striking number that anchors the topic? → "stat" (real number + context)
  → Comparing tools/methods/approaches? → "comparison" (2-4 items with specifics)
  → A step-by-step process? → "flow" (3-6 actionable steps)
  → A powerful statement from the source? → "quote" (with attribution)
- Last slide: layout "closing" → a specific, actionable takeaway (NOT "this is important", but a concrete conclusion like "Start with semantic HTML, add CSS Grid for layout, and deploy to Vercel in under 5 minutes")

NEVER repeat the same layout consecutively. Vary the layouts to keep the presentation dynamic.

═══════════════════════════════════════
CONTENT DENSITY REQUIREMENTS (CRITICAL)
═══════════════════════════════════════

Each layout type has structured fields. You MUST populate ALL relevant fields with SUBSTANTIVE content:

● "content" layout:
  - title: 3-8 words naming the specific concept (e.g. "HTML5 Semantic Structure" not "The Basics")
  - bullets: EXACTLY 3-5 bullets. Each bullet is 40-75 characters containing ONE specific fact, technique, or tool name.
  - GOOD bullets: "Use <header>, <nav>, <main>, <footer> for accessibility + SEO", "Flexbox handles 1D layouts; CSS Grid handles 2D layouts"
  - BAD bullets: "It's important to use good practices", "Design matters a lot"

● "stat" layout:
  - stat.value: A REAL number from the sources (or a well-known domain statistic). Format: "53%", "4.9B", "3s", "$12K"
  - stat.label: 15-40 words explaining WHY this number matters and providing context
  - title: 3-6 word eyebrow that categorizes the stat
  - GOOD: value="53%", label="of mobile users abandon sites loading over 3 seconds — speed directly impacts your conversion rate and revenue"
  - BAD: value="Many", label="things to think about"

● "comparison" layout:
  - comparisonItems: 2-4 items, each with a specific NAMED entity and a differentiating value
  - GOOD: [{label:"React", value:"Component-based, 40% market share"}, {label:"Vue", value:"Progressive framework, gentle learning curve"}, {label:"Svelte", value:"No virtual DOM, smallest bundle size"}]
  - BAD: [{label:"Option A", value:"Good"}, {label:"Option B", value:"Also good"}]

● "flow" layout:
  - flowSteps: 3-6 steps. Each step has a label (2-4 words) and a detail (one concrete action sentence).
  - GOOD: {label:"Wireframe Layout", detail:"Sketch page structure in Figma — define header, content zones, sidebar, and footer grid"}
  - BAD: {label:"Plan", detail:"Think about what you want to do"}

● "quote" layout:
  - quote.text: An actual statement from the sources, or a synthesis of a key insight phrased as a memorable quote
  - quote.attribution: The source document title, author, or "— Source analysis"

● "closing" layout:
  - title: A specific, memorable takeaway sentence derived from the content (NOT generic motivation)
  - subtitle: A short eyebrow like "KEY TAKEAWAY" or "RESUMEN" (will be uppercased)

All text must be in ${LANG_NAME}. For each slide, populate ONLY the fields its layout uses and set the others to null.

═══════════════════════════════════════
narrationHint (for every slide)
═══════════════════════════════════════

Write 2-3 sentences a teacher would SAY to explain this slide. Add context BEYOND what's written on screen — an example, an analogy, a "why this matters" insight. This powers the TTS narration. Keep it in ${LANG_NAME}.

═══════════════════════════════════════
ILLUSTRATION PROMPT (secondary priority)
═══════════════════════════════════════

The illustrationPrompt creates the visual background. It must describe ONLY visual elements — NO text, NO letters, NO numbers, NO labels, NO words, NO typography of any kind. 80-160 words.

Style: pen-and-ink technical illustration on cream-colored graph paper, vintage engineering sketchbook (Leonardo's Codex, old physics textbooks). Describe small illustrated vignettes positioned in specific zones of the canvas (top-left, center-right, bottom, etc.), with plenty of whitespace around each for the text overlay. Confident thin ink lines, slightly off-register hand-drawn feel, occasional muted orange or sepia watercolor wash on focal elements.

The illustration should visually RELATE to the slide's content — if the slide is about database indexing, draw a filing cabinet with index cards and a magnifying glass, not random decorative shapes.

EXAMPLE illustrationPrompt (for a slide about HTML structure):
"A vintage engineering sketchbook page on cream graph paper. In the upper-right, a pen-and-ink tree diagram branching downward with thin confident lines, representing nested structure. In the lower-left, a small browser window frame with a miniature page layout sketched inside — header bar, sidebar, content area. In the center, a detailed magnifying glass hovering over a code bracket symbol. Soft sepia watercolor wash on the tree's root node and the magnifying glass lens. Plenty of open whitespace in the left half and bottom-center for text overlay."

═══════════════════════════════════════
FULL WORKED EXAMPLE
═══════════════════════════════════════

Topic: "How to Create a Website"
Sources mention: HTML, CSS, JavaScript, planning, wireframes, responsive design, SEO, hosting, WordPress vs custom code, performance stats.

Slide 1 (title): title="Building Your First Website", subtitle="From blank page to live site — the 6 essential concepts every web creator needs"
Slide 2 (content): title="The Foundation: HTML5 Structure", bullets=["Every page starts with <!DOCTYPE html> — tells browsers to use modern standards", "Semantic tags: <header>, <nav>, <main>, <article>, <footer>", "The <head> holds metadata, CSS links, and <title> for SEO", "Forms use <input>, <select>, <textarea> — the web's interactive building blocks", "Images need alt text: accessibility + SEO + fallback when images fail"]
Slide 3 (stat): title="PERFORMANCE IMPACT", stat={value:"53%", label:"of mobile visitors leave a page that takes over 3 seconds to load — Google research shows every extra second costs 7% in conversions"}
Slide 4 (comparison): title="Choosing Your Platform", comparisonItems=[{label:"WordPress", value:"60% of CMS market, 55K+ plugins"}, {label:"Custom Code", value:"Full control, zero bloat"}, {label:"Shopify", value:"Built-in payments, $29/mo"}, {label:"Next.js", value:"React framework, SSR + SSG"}]
Slide 5 (flow): title="From Idea to Live Website", flowSteps=[{label:"Plan & Wireframe", detail:"Define pages, navigation, and content layout in Figma or on paper"}, {label:"Write HTML", detail:"Build semantic structure — sections, headings, forms, links"}, {label:"Style with CSS", detail:"Add layout (Grid/Flexbox), colors, typography, responsive breakpoints"}, {label:"Add JavaScript", detail:"Interactivity: form validation, menus, API calls, dynamic content"}, {label:"Test & Deploy", detail:"Cross-browser testing, then push to Vercel/Netlify/GitHub Pages"}]
Slide 6 (closing): title="Start with semantic HTML, layer CSS for layout, add JS for interactivity — deploy in minutes with modern hosting", subtitle="KEY TAKEAWAY"

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
