# FluxMind — Claude Code Max Prompt: Full Studio Upgrade

> **Read `CLAUDE.md` first** for stack and code style rules. Everything there applies here.
> **Read `PROMPT-STUDIO-MEDIA-ENGINE.md`** for the hybrid composition architecture (Sharp + SVG + fal.ai). The composition pipeline works — what's broken is content quality, user customization, and overall polish.

---

## THE PROBLEMS (5 of them)

### 1. Content is decorative, not educational
Slides/infographics are visually beautiful but teach nothing. A slide about "Creating a Website" shows a pretty title with Da Vinci illustrations but zero bullets, stats, or process diagrams. The AI prompts inside `generateObject()` spend 80% of tokens on illustration instructions and 20% on content. **Flip this ratio.**

### 2. No customization UI
Clicking "Generate" fires immediately with zero user input. No way to choose visual style, detail level, orientation, or describe what you want. NotebookLM (March 2026) has a full customization dialog with: language, orientation (landscape/portrait/square), visual style (10 presets: Sketch, Kawaii, Professional, Scientific, Anime, Clay, Editorial, Instructional, Bento Grid, Bricks), detail level (Concise/Standard/Detailed), and a custom text prompt. FluxMind needs something similar.

### 3. Only one visual style
Everything uses the same Da Vinci engineering sketchbook style. Users should choose from multiple styles (sketch, kawaii, professional, scientific, minimalist, etc.). The illustration prompt and SVG overlay colors must adapt per style.

### 4. Mind maps are ugly and unreadable
The current mind map uses Dagre layout with `nodesep: 80` and `ranksep: 120` inside a `h-[500px]` container. With 4-7 subtopics each having 2-4 children, nodes compress and overlap. Lines cross chaotically. Text is too small to read. NotebookLM has interactive mind maps where you can expand/collapse branches, click nodes to ask questions, and zoom into specific areas.

### 5. Video pipeline is incomplete
"Video Overview" just shows text chapters, not a real video. TTS + composition (phases 3-5) are not implemented.

### 6. No intelligent source discovery
Currently, the user manually adds sources one by one (paste URL, upload file, paste text). But for high-quality generation, more sources = better content. The system should **automatically discover 10-25 relevant web sources** based on the notebook topic, show them to the user, and let them select which ones to include. This gives the AI much richer material to extract facts, stats, and comparisons from.

The infrastructure for this ALREADY EXISTS in the codebase:
- **Serper API** for web search (`/src/lib/research/pipeline.ts` → `searchWeb()` uses `SERPER_API_KEY`)
- **Cheerio scraping** (`/src/app/api/sources/url/route.ts` → `scrapeUrlContent()` extracts main content from URLs)
- **Source processing pipeline** (chunking, embedding, storage in DB)
- **`getStudioContext()`** concatenates all ready sources for generation

What's missing: a UI to show discovered sources and let the user pick which ones to use, and an API endpoint that searches + scrapes + returns results before the user commits to generating.

---

## EXECUTION ORDER

1. **Task 1**: Fix the AI model (dependency for all generation)
2. **Task 2**: Create the customization dialog component (including source discovery UI)
3. **Task 3**: Create source discovery API endpoint
4. **Task 4**: Wire dialog → hooks → API routes
5. **Task 5**: Rewrite generation prompts (slides + infographic + video)
6. **Task 6**: Add multiple visual styles
7. **Task 7**: Fix mind map layout and interactivity
8. **Task 8**: Complete the video pipeline
9. **Task 9**: Fix video player (remove GlassCard)
10. **Task 10**: Verification (build, lint, test)

---

## TASK 1: FIX THE AI MODEL

**File**: `/src/lib/ai/models.ts`

Currently only supports OpenAI. `getModel("gemini-2.5-flash")` falls to `openai("gpt-4o-mini")` — the weakest model. This directly causes shallow content.

Add Google Gemini support. The project lists `@ai-sdk/google` in CLAUDE.md dependencies.

```typescript
import { google } from "@ai-sdk/google";

// Add to models[] array:
{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google", description: "Fast and smart", tier: "free" },
{ id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google", description: "Maximum reasoning", tier: "pro" },

// Add to getModel() switch:
case "gemini-2.5-flash": return google("gemini-2.5-flash");
case "gemini-2.5-pro": return google("gemini-2.5-pro");
```

Update `ModelConfig.provider` type to `"openai" | "google"`. Verify `@ai-sdk/google` is installed.

---

## TASK 2: CREATE THE CUSTOMIZATION DIALOG

**New file**: `/src/components/studio/generate-dialog.tsx`

A reusable dialog that opens BEFORE generation starts. Must look premium and match FluxMind's dark UI with `var(--fm-*)` custom properties.

### Config type:
```typescript
export type GenerateConfig = {
  language: "en" | "es";
  orientation: "horizontal" | "vertical" | "square";
  style: "auto" | "sketch" | "kawaii" | "professional" | "scientific" | "minimalist";
  detailLevel: "concise" | "standard" | "detailed";
  customPrompt: string;
  slideCount?: number;       // slides only, 4-10
  accentColor?: "orange" | "violet" | "blue" | "rose" | "emerald" | "amber";
};
```

### Dialog layout (adapt based on output type):

**Header**: "Customize [Slide Deck / Infographic / Video / Mind Map]" + close button

**Body** (scrollable if needed):

1. **Language selector** — dropdown, default from `useLanguage()`
2. **Orientation** (infographic only) — 3 toggle buttons: Horizontal / Vertical / Square
3. **Visual style picker** — 6 tiles in a horizontal row, each with a small icon/emoji and label. Selected tile gets accent border. Styles: Auto (default), Sketch, Kawaii, Professional, Scientific, Minimalist
4. **Detail level** — 3 toggle buttons: Concise / Standard (default) / Detailed
5. **Slide count** (slides only) — a simple number input or range slider, 4-10, default 6
6. **Accent color** (slides/infographic) — 6 color circles (orange, violet, blue, rose, emerald, amber), clickable
7. **Custom description** (optional) — textarea, placeholder: "Describe what to focus on: 'Highlight the 3 key statistics' or 'Use a dark theme with neon accents'"

**Footer**: "Generate" button (accent color, disabled while generating, shows spinner)

### Style tiles should use simple SVG icons or unicode:
- Auto: 🔄 or a refresh icon
- Sketch: ✏️ or a pencil icon
- Kawaii: 🌸 or a cute face
- Professional: 💼 or a briefcase
- Scientific: 🔬 or a microscope
- Minimalist: ◻️ or a minimal square

### Styling:
- Background: `var(--fm-surface)`
- Borders: `var(--fm-surface-border)`
- Text: `var(--fm-text)`, `var(--fm-text-secondary)`, `var(--fm-text-tertiary)`
- Selected states: accent color bg at 12% opacity
- NO glassmorphism, NO blur, NO GlassCard
- Use the existing dialog system from `/src/components/ui/dialog.tsx`

---

## TASK 3: INTELLIGENT SOURCE DISCOVERY

This is a major feature that dramatically improves content quality by giving the AI 10-25x more material to work with.

### How it works (user flow):

1. User clicks "Generate" on a Studio card → customization dialog opens
2. Dialog shows **existing notebook sources** (already added by user) as pre-selected
3. Below that, a **"Find more sources" button** or **automatic discovery** based on the notebook title/topic
4. System uses Serper API to search for 10-25 relevant web pages
5. Results appear as selectable cards with: title, URL, snippet preview, favicon
6. User checks/unchecks which sources they want to include
7. When user clicks "Generate", the system:
   a. Scrapes the selected NEW sources (the ones not yet in the notebook)
   b. Adds them as temporary sources or passes their content directly to the generation prompt
   c. Combines existing notebook sources + new selected sources into the generation context

### 3A. Create source discovery API endpoint

**New file**: `/src/app/api/studio/discover-sources/route.ts`

```typescript
// POST /api/studio/discover-sources
// Body: { notebookId: string, query?: string }
// Returns: { sources: DiscoveredSource[] }

type DiscoveredSource = {
  url: string;
  title: string;
  snippet: string;    // 1-2 sentence preview
  domain: string;     // e.g. "developer.mozilla.org"
  favicon?: string;   // favicon URL for visual polish
  relevanceScore: number; // 0-1, how relevant to the topic
};
```

**Implementation:**

1. Fetch the notebook title and existing source titles to understand the topic
2. Use AI (`generateObject()` with Gemini) to generate 5-8 diverse, intelligent search queries based on the topic. The queries should cover different angles:
   - Factual/statistical queries (e.g. "web development statistics 2026")
   - How-to/process queries (e.g. "how to deploy a website step by step")
   - Comparison queries (e.g. "React vs Vue vs Angular comparison")
   - Deep-dive queries (e.g. "HTML5 semantic elements best practices")
   - Current/trending queries (e.g. "latest web development trends")
3. For each query, call `searchWeb()` (Serper API) — this already exists in `/src/lib/research/pipeline.ts`
4. Deduplicate results by domain (max 2 per domain to ensure diversity)
5. Filter out: social media, forums, paywalled sites, very short pages
6. Return 10-25 results sorted by relevance

**Fallback if SERPER_API_KEY is not configured:**
- Use the AI to generate a list of well-known authoritative URLs for the topic
- Or skip discovery and just show existing notebook sources

### 3B. Create source scraping endpoint (for selected discovered sources)

**New file**: `/src/app/api/studio/scrape-sources/route.ts`

```typescript
// POST /api/studio/scrape-sources
// Body: { urls: string[], notebookId: string }
// Returns: { sources: { url: string, title: string, content: string, error?: string }[] }
```

**Implementation:**

1. For each URL, scrape the page content using the existing `scrapeUrlContent()` function from the URL source route
2. Extract the main text content (strip navigation, ads, footers — Cheerio already does this)
3. Truncate each source to 5000 characters (same as `getStudioContext()` limit)
4. Return the scraped content

**Important**: Do NOT permanently add these as notebook sources unless the user explicitly wants to. These are "temporary sources" used only for this generation. This keeps the notebook clean.

Alternatively, you CAN add them as real sources with a `metadata.origin: "auto-discovered"` flag so they're visible in the source panel. The user can then delete them later if they don't want them. This is probably the better UX because then the sources persist for future generations.

### 3C. Add source discovery UI to the customization dialog

Add a new section to the `GenerateDialog` (Task 2):

```
┌─────────────────────────────────────────────┐
│  Sources                                     │
│                                              │
│  ✅ como hacer una pagina web (your source)  │
│                                              │
│  ── Discovered Sources ──────────────────── │
│  [🔍 Finding relevant sources...]           │
│                                              │
│  ✅ HTML5 Semantic Elements - MDN Web Docs  │
│     developer.mozilla.org · Complete guide   │
│  ✅ CSS Grid Layout Guide - CSS-Tricks      │
│     css-tricks.com · Comprehensive tutorial  │
│  ☐ 10 Best Web Hosting 2026 - Forbes        │
│     forbes.com · Comparison & pricing        │
│  ✅ Web Performance Stats - Google           │
│     web.dev · Core Web Vitals data           │
│  ☐ React vs Vue vs Angular - LogRocket       │
│     blog.logrocket.com · Framework comparison│
│  ... (scrollable, 10-25 results)             │
│                                              │
│  Selected: 8 of 12 sources                   │
│  [Select All] [Deselect All]                 │
└─────────────────────────────────────────────┘
```

**UX details:**
- Existing notebook sources are shown first, pre-selected, with a "your source" badge
- Discovery runs automatically when the dialog opens (or when user clicks "Find sources")
- Show a loading spinner while searching ("Finding relevant sources...")
- Each discovered source shows: checkbox, title, domain, 1-line snippet
- "Select All" / "Deselect All" buttons for convenience
- Counter: "Selected: 8 of 12 sources"
- Scrollable container if many results (max-height with overflow-y-auto)

### 3D. Update the generation flow

When the user clicks "Generate" in the dialog:

1. Collect the list of selected source URLs (both existing + newly discovered)
2. For newly discovered sources that haven't been scraped yet, call `/api/studio/scrape-sources`
3. Pass the combined source content to the generation endpoint as an additional `extraSources` field:

```typescript
// In the API route body:
const {
  notebookId,
  // ... other config
  extraSourceContent?: string  // scraped content from discovered sources, pre-concatenated
} = body;
```

4. In the generation prompt, append `extraSourceContent` to `ctx.sourceContext`:
```typescript
const allSources = extraSourceContent
  ? `${ctx.sourceContext}\n\n---\n\n${extraSourceContent}`
  : ctx.sourceContext;
```

This way, the AI has access to ALL selected content (user's original sources + newly discovered web sources) when generating slides/infographics/etc.

### 3E. Handle the case where `getStudioContext()` ignores source selection

Currently, `getStudioContext()` fetches ALL ready sources for the notebook — it doesn't filter by what the user selected. Fix this by either:

**Option A** (simpler): Pass selected source IDs from the dialog to the API route, and update `getStudioContext()` to accept an optional `sourceIds` filter:
```typescript
export const getStudioContext = async (
  notebookId: string,
  selectedSourceIds?: string[]  // if provided, only use these sources
) => { ... }
```

**Option B** (keep current behavior): Don't change `getStudioContext()`, but append `extraSourceContent` as described above. Existing sources always included, discovered sources added on top.

Choose whichever approach is cleaner. Option A is more correct (respects user selection), Option B is faster to implement.

---

## TASK 4: WIRE DIALOG → HOOKS → API ROUTES

(Renumbered — this was Task 3 before adding source discovery)

### 3A. Update hooks (`/src/hooks/use-studio-outputs.ts`)

The `useGenerate` factory and specific hooks need to accept `GenerateConfig` fields:

```typescript
export const useGenerateSlides = () =>
  useGenerate<{ notebookId: string } & Partial<GenerateConfig>>("/api/studio/slides");
export const useGenerateInfographic = () =>
  useGenerate<{ notebookId: string } & Partial<GenerateConfig>>("/api/studio/infographic");
// Same for video, mindmap
```

### 3B. Update Studio page (`/src/app/(app)/notebook/[id]/studio/page.tsx`)

For "Slide Deck", "Infographic", "Video Overview", and "Mind Map" cards:
1. On click → open the dialog (not generate immediately)
2. User configures → clicks "Generate" inside dialog
3. Dialog calls the `generate()` helper with config
4. Add `useState<boolean>` for dialog open + `useState<StudioTab>` for which type is configuring

The `generate()` helper (line 217) needs to accept config:
```typescript
const generate = async <T,>(
  type: StudioTab,
  mutateAsync: (args: { notebookId: string } & Partial<GenerateConfig>) => Promise<T>,
  setter: (data: T) => void,
  config?: Partial<GenerateConfig>
): Promise<void> => { ... };
```

### 3C. Update API routes

**Slides route** (`/src/app/api/studio/slides/route.ts`): Extract from body: `style`, `detailLevel`, `customPrompt`, `accentColor`
**Infographic route** (`/src/app/api/studio/infographic/route.ts`): Extract: `style`, `detailLevel`, `customPrompt`, `orientation`
**Mind map route** (`/src/app/api/studio/mindmap/route.ts`): Extract: `detailLevel`, `customPrompt`
**Video route**: Extract: `style`, `detailLevel`, `customPrompt`

Pass these into the generation prompts (Task 4).

---

## TASK 4: REWRITE GENERATION PROMPTS

The most critical task. All AI prompts must prioritize CONTENT over decoration.

### 4A. Slides prompt (`/src/app/api/studio/slides/route.ts`)

Replace the prompt string inside `generateObject()` (~line 153). Keep `${langInstr}` at top, `Sources:\n${ctx.sourceContext}` at bottom.

Build the prompt dynamically using the config params:

```javascript
const detailMap = { concise: "4 slides, 2-3 key points each", standard: "6 slides, 3-5 key points each", detailed: "8 slides, 4-5 key points with deep context" };
const detailInstr = detailMap[detailLevel] || detailMap.standard;
const styleInstr = getStyleInstructions(style); // from styles.ts (Task 5)
const userInstr = customPrompt ? `\nUSER REQUEST: "${customPrompt}". Incorporate this into the deck.\n` : "";
```

**The new prompt structure** (content-first, illustration-second):

```
${langInstr}
${userInstr}

You are an expert educator. Your #1 job is to TEACH with specific, factual, actionable information from the sources. Every slide must contain dense, real content — not vague motivational text.

DETAIL LEVEL: ${detailInstr}

══════ STEP 1: EXTRACT CONTENT ══════

Before designing any slide, deeply analyze the sources and extract:
- Every specific fact, number, percentage, date, statistic
- Every named tool, technology, framework, method, concept
- Every process, workflow, step-by-step procedure
- Every comparison, trade-off, alternative
- Every cause-effect relationship, definition, key term
- Any notable quotes or expert opinions

Group extractions into teachable concepts. Each concept = one slide.

══════ STEP 2: DESIGN SLIDES ══════

Create ${count} slides:
- Slide 1 (title): topic title + subtitle stating WHAT the user will learn
- Slides 2 to N-1: teaching slides — pick the layout that BEST fits each concept:
  → Multiple facets of one concept → "content" (3-5 dense bullets)
  → A striking number → "stat" (real number + why it matters)
  → Comparing alternatives → "comparison" (2-4 named items with specifics)
  → Step-by-step process → "flow" (3-6 concrete steps)
  → Powerful source quote → "quote" (with attribution)
- Last slide (closing): specific, actionable takeaway (NOT generic motivation)

NEVER repeat the same layout consecutively.

══════ STEP 3: CONTENT DENSITY (CRITICAL) ══════

● "content": title=3-8 specific words. bullets=3-5, each 40-75 chars with ONE real fact/tool/technique.
  GOOD: "Flexbox for 1D; CSS Grid for 2D — both eliminate float hacks"
  BAD: "Good design is important for users"

● "stat": value=REAL number ("53%","4.9B","3s"). label=15-40 words explaining WHY it matters.
  GOOD: value="53%", label="of mobile users abandon sites loading over 3 seconds — each extra second costs 7% conversions"
  BAD: value="Many", label="things to consider"

● "comparison": 2-4 items with NAMED entities and concrete differentiators.
  GOOD: [{label:"React",value:"Virtual DOM, 40% market share"},{label:"Svelte",value:"No VDOM, smallest bundles"}]
  BAD: [{label:"Option A",value:"Good"}]

● "flow": 3-6 steps, label=2-4 words, detail=concrete action sentence.
  GOOD: {label:"Deploy to Vercel", detail:"Push to GitHub, connect repo, auto-deploy on every commit"}
  BAD: {label:"Deploy", detail:"Put it online"}

● "quote": actual statement from sources with attribution.

● "closing": title=concrete conclusion sentence. NOT "This is important."
  GOOD: "Start with semantic HTML, layer CSS Grid, deploy to Vercel in minutes"

● narrationHint (ALL slides): 2-3 sentences a teacher would SAY, adding context beyond what's on screen.

══════ STEP 4: ILLUSTRATION ══════

${styleInstr}

Illustration must visually RELATE to the slide content. NO text/letters/numbers/labels/typography. 80-160 words.

══════ FULL EXAMPLE ══════

Slide 1 (title): title="Building Your First Website", subtitle="From blank page to live site — 5 essential skills every web creator needs"
Slide 2 (content): title="HTML5 Semantic Structure", bullets=["<!DOCTYPE html> tells browsers to use HTML5 standards mode","Semantic tags: <header>, <nav>, <main>, <article>, <footer>","<head> holds metadata, CSS links, and <title> for SEO","Forms: <input>, <select>, <textarea> — the web's interactive layer","Always add alt text: accessibility + SEO + graceful fallback"]
Slide 3 (stat): title="WHY SPEED MATTERS", stat={value:"53%",label:"of mobile visitors leave if a page takes over 3 seconds — every extra second costs 7% in conversions (Google)"}
Slide 4 (comparison): title="Choosing Your Platform", comparisonItems=[{label:"WordPress",value:"60% CMS market, 55K+ plugins"},{label:"Custom Code",value:"Full control, zero bloat"},{label:"Next.js",value:"React SSR+SSG, Vercel deploy"}]
Slide 5 (flow): title="From Idea to Live Website", flowSteps=[{label:"Plan & Wireframe",detail:"Define pages, navigation, layout in Figma or paper"},{label:"Write HTML",detail:"Semantic structure — sections, headings, forms, links"},{label:"Style with CSS",detail:"Grid/Flexbox layout, colors, typography, breakpoints"},{label:"Add JavaScript",detail:"Validation, menus, API calls, dynamic content"},{label:"Deploy",detail:"Push to Vercel/Netlify — live URL in under 2 minutes"}]
Slide 6 (closing): title="Start with semantic HTML, layer CSS Grid for layout, add JS for interactivity — deploy in minutes", subtitle="KEY TAKEAWAY"

Sources:
${ctx.sourceContext}
```

### 4B. Infographic prompt (`/src/app/api/studio/infographic/route.ts`)

Same philosophy — content first. Build dynamically with `detailLevel`, `customPrompt`, `styleInstr`:

```
${langInstr}
${userInstr}

You are a world-class data visualization designer and educator. Create an infographic that TEACHES through dense, specific data. Every block must contain REAL information from the sources.

DETAIL LEVEL: ${detailInstr}

══════ STEP 1: EXTRACT DATA ══════
Analyze sources deeply. Extract every: number, percentage, statistic, date, process, comparison, timeline, cause-effect chain, definition, expert insight.

══════ STEP 2: STRUCTURE THE STORY ══════
Opening (hook): 1-2 "stat" blocks with surprising numbers
Body (teach): 1 "chart" if quantitative data exists + 1-2 "callout" blocks + 1 "flow" or "timeline" + 1 "comparison" if alternatives discussed
Closing: 1 "takeaway" with specific, memorable conclusion
Mix 5-8 blocks total. Never 2+ of same type.

══════ STEP 3: CONTENT DENSITY (CRITICAL) ══════
● stat: value=REAL number, label=10-25 words explaining significance
● callout: title=3-6 words, body=2-4 sentences with specific tools/techniques/details
● chart: 3-8 data points with REAL data, specific x labels, annotations on key points
● flow: 3-6 steps with concrete actionable detail
● timeline: 3-6 entries with real dates and specific events
● comparison: 2-4 named entities with quantifiable differences
● takeaway: specific insight (NOT "this is important")
● text: 2-3 sentences essential context (use sparingly)

[Same GOOD/BAD examples as before]

══════ STEP 4: METADATA ══════
title (max 8 words), subtitle (max 14 words), header, footer, accentColor.
sections (3-6): comprehensive heading+summary for text fallback.
keyStats (2-5): most impactful numbers as {value, label}.

══════ STEP 5: ILLUSTRATION ══════
${styleInstr}
Relate visually to topic. NO text/letters/numbers. 100-200 words.

Sources:
${ctx.sourceContext}
```

### 4C. Video script prompt (`/src/lib/video/generate-video.ts`)

The current prompt (lines 63-70) is too generic. Replace with:

```
${langInstr}
${userInstr}

Write an educational video narration script with 5-7 chapters. This is a TEACHING video — every chapter must contain specific, factual information from the sources.

For each chapter:
- title: Short, specific (e.g. "HTML5 Semantic Elements" not "Getting Started")
- narration: 60-90 words of REAL educational content. Include specific tool names, numbers, techniques, step-by-step explanations. Write in natural spoken language as if teaching a class.
- imagePrompt: ${styleInstr} Visual scene that relates to the chapter content. NO text, NO letters, NO words in the image. 40-80 words.

CONTENT RULES:
- Chapter 1: introduce the topic and WHY it matters (with a hook stat or surprising fact)
- Chapters 2-5: each teaches ONE specific concept with concrete details
- Last chapter: actionable summary — what should the viewer do next?
- Every narration must contain at least 2 specific facts, tool names, or numbers
- BAD: "Web development is an exciting field with many opportunities"
- GOOD: "HTML5 introduced semantic elements like header, nav, main, and footer — these tell browsers and screen readers exactly what each section does, improving both SEO rankings and accessibility scores"

Sources:\n${sourceContext}
```

---

## TASK 5: ADD MULTIPLE VISUAL STYLES

### 5A. Create style config module

**New file**: `/src/lib/media/styles.ts`

```typescript
export type VisualStyle = "auto" | "sketch" | "kawaii" | "professional" | "scientific" | "minimalist";

export type StyleConfig = {
  name: string;
  illustrationPrefix: string;
  overlayBg: { r: number; g: number; b: number; alpha: number };
  textColor: string;
  mutedColor: string;
};

export const STYLE_CONFIGS: Record<VisualStyle, StyleConfig> = {
  auto: {
    name: "Auto",
    illustrationPrefix: "Vintage engineering sketchbook illustration on cream-colored graph paper. Loose pen-and-ink style, confident thin black line work, small illustrated vignettes, occasional subtle watercolor wash in muted orange or sepia. Slightly off-register hand-drawn feel. Leonardo da Vinci's Codex meets old physics textbook.",
    overlayBg: { r: 253, g: 250, b: 243, alpha: 0.6 },
    textColor: "#1a1a1a",
    mutedColor: "#4a4a4a",
  },
  sketch: {
    name: "Sketch",
    illustrationPrefix: "Hand-drawn pencil sketch on textured white paper. Loose gestural lines, cross-hatching for shadows, occasional bold strokes. Architectural sketch or product design concept. Warm graphite tones with occasional soft blue or red pencil accents.",
    overlayBg: { r: 255, g: 255, b: 255, alpha: 0.65 },
    textColor: "#1a1a1a",
    mutedColor: "#555555",
  },
  kawaii: {
    name: "Kawaii",
    illustrationPrefix: "Cute kawaii illustration with soft pastel colors. Rounded friendly objects with simple faces. Soft gradient backgrounds in pastel pink, mint, lavender. Clean vector-like art with smooth lines and gentle shadows. Cheerful and approachable.",
    overlayBg: { r: 255, g: 250, b: 252, alpha: 0.7 },
    textColor: "#2d2d2d",
    mutedColor: "#666666",
  },
  professional: {
    name: "Professional",
    illustrationPrefix: "Clean corporate illustration with flat design elements. Muted professional palette (navy, teal, slate gray, white). Geometric shapes, subtle gradients, modern iconography. Tech company annual report or consulting deck style. Polished and minimal.",
    overlayBg: { r: 248, g: 250, b: 252, alpha: 0.75 },
    textColor: "#0f172a",
    mutedColor: "#475569",
  },
  scientific: {
    name: "Scientific",
    illustrationPrefix: "Scientific diagram on white paper. Precise technical drawings with clean thin lines, cross-sections, molecular structures, circuit diagrams. Muted blue and gray palette with occasional red/orange highlights. Textbook figure or research paper illustration style.",
    overlayBg: { r: 250, g: 251, b: 254, alpha: 0.7 },
    textColor: "#1e293b",
    mutedColor: "#64748b",
  },
  minimalist: {
    name: "Minimalist",
    illustrationPrefix: "Ultra-minimal abstract illustration. Large white space with one or two simple geometric shapes or a single elegant line drawing. Monochrome with one accent color. Muji branding or Japanese minimalist design. Clean, serene, breathing room.",
    overlayBg: { r: 255, g: 255, b: 255, alpha: 0.8 },
    textColor: "#111111",
    mutedColor: "#888888",
  },
};

export const getStyleInstructions = (style: VisualStyle): string => {
  const config = STYLE_CONFIGS[style];
  return `ILLUSTRATION STYLE: "${config.name}"
${config.illustrationPrefix}
Describe illustrated vignettes in specific zones of the canvas, with whitespace for text overlay.
ABSOLUTE RULE: NO TEXT, NO LETTERS, NO NUMBERS, NO LABELS, NO TYPOGRAPHY in the image. Visual elements ONLY.`;
};
```

### 5B. Update `generate-image.ts`

Replace the hardcoded `STYLE_PREFIX` with a function that accepts a `VisualStyle` parameter:

```typescript
import { STYLE_CONFIGS, type VisualStyle } from "@/lib/media/styles";

export const getStylePrefix = (style: VisualStyle = "auto"): string => {
  const config = STYLE_CONFIGS[style];
  return config.illustrationPrefix + " ABSOLUTE RULE: NO TEXT, NO LETTERS, NO NUMBERS, NO WORDS, NO LABELS, NO TYPOGRAPHY anywhere in the image. Visual elements only. Leave breathing room for text overlay. ";
};
```

Update `generateInfographicImage` to accept an optional `style` param and use `getStylePrefix(style)` instead of hardcoded `STYLE_PREFIX`.

### 5C. Update compose-slide.ts and compose-infographic.ts

Accept an optional `StyleConfig` in the compose options to customize the cream sheet overlay color. Default to the current values (backward compatible).

---

## TASK 6: FIX MIND MAP LAYOUT AND INTERACTIVITY

This is a major quality-of-life fix. The current mind map is nearly unreadable.

### Root causes (from investigation):
- `nodesep: 80` is too tight for 200px-wide nodes
- `ranksep: 120` doesn't leave enough vertical breathing room
- Canvas capped at `h-[500px]` forces extreme compression
- 4-7 subtopics × 2-4 children = too many nodes crammed together
- Colored lines cross chaotically with no edge routing
- Nodes are not draggable (no manual adjustment)
- No expand/collapse functionality

### Fix the layout (`/src/components/mind-map/mind-map-canvas.tsx`):

**A. Increase spacing significantly:**
```typescript
// Change from:
nodesep: 80, ranksep: 120
// To:
nodesep: 140, ranksep: 180
```

**B. Use Left-to-Right layout instead of Top-to-Bottom:**
```typescript
// Change from:
rankdir: "TB"
// To:
rankdir: "LR"  // Left-to-right reads more naturally for mind maps
```

**C. Expand the canvas height:**
```typescript
// Change from:
className="h-[500px] ..."
// To:
className="h-[700px] ..."
// Or better: make it responsive based on node count
```

**D. Make nodes draggable:**
Enable node dragging in ReactFlow so users can manually adjust overlapping nodes. ReactFlow supports this natively — just ensure `nodesDraggable={true}` (default) and that the layout doesn't re-run on every render.

**E. Add expand/collapse functionality:**
This is the biggest improvement. Like NotebookLM, users should be able to:
- Click a node to expand its children
- Click again to collapse
- Start with only Level 0 + Level 1 visible
- Level 2 nodes appear when their parent is clicked

Implementation approach:
- Add an `expanded: boolean` state per Level 1 node
- Filter visible nodes/edges based on expansion state
- Re-run dagre layout when expansion changes
- Add a small expand/collapse icon (+ / −) on Level 1 nodes

**F. Use smoother edges:**
```typescript
// Change edge type from default to:
type: "smoothstep"
// This creates curved, non-overlapping paths
```

**G. Reduce node count in generation:**
In `/src/app/api/studio/mindmap/route.ts`, update the prompt to generate:
- 3-5 subtopics (not 4-7)
- 2-3 details per subtopic (not 2-4)
- This reduces total nodes from ~30+ to ~18 max

### Fix the generation prompt (`/src/app/api/studio/mindmap/route.ts`):

The mind map generation prompt should also apply content density rules:
- Each node label should be specific and informative (not generic)
- Each node description should contain a real fact or insight
- The hierarchy should represent meaningful conceptual relationships, not just a flat list

### Fix node styling (`/src/components/mind-map/mind-map-node.tsx`):

- Increase font sizes slightly (Level 1: 15px, Level 2: 13px)
- Increase minimum widths (Level 1: 200px, Level 2: 160px)
- Add more padding (Level 1: 14px, Level 2: 12px)
- Use cleaner, less saturated colors
- Remove the "breathing dot" animation (unnecessary visual noise)
- Add expand/collapse indicator icon on Level 1 nodes

---

## TASK 7: COMPLETE THE VIDEO PIPELINE

**File**: `/src/lib/video/generate-video.ts`

### What works:
- Phase 1: Script generation (5-7 chapters)
- Phase 2: Image generation with fal.ai

### Implement phases 3-5:

**Phase 3: TTS with ElevenLabs**
- For each chapter, generate TTS from `narration` using ElevenLabs API
- Use `eleven_multilingual_v2` model (same as podcast pipeline)
- Single narrator voice: `ELEVENLABS_VOICE_VIDEO` env var or fall back to `VOICE_ALEX` from podcast
- Reuse the ElevenLabs call pattern from `/src/lib/podcast/generate-podcast.ts`

**Phase 4: Video composition**
- Install `fluent-ffmpeg` + `@ffmpeg-installer/ffmpeg`
- Per chapter: combine static image + TTS audio into video segment
- Image displays for full audio duration
- Crossfade transitions (~0.5s) between chapters
- Output: single MP4 (H.264 + AAC)
- Fallback if FFmpeg unavailable: generate a "slideshow" mode where the viewer auto-advances through images with synced audio playback (no real MP4, but a better UX than text-only)

**Phase 5: Upload**
- Upload MP4 to R2 via `uploadFile()`
- Update DB: `fileUrl`, `status: "ready"`, `duration`
- Include chapter timestamps in `content` JSON

---

## TASK 8: FIX VIDEO PLAYER

**File**: `/src/components/video/video-player.tsx`

Replace `GlassCard` import (removed from codebase) with a plain `div`:
```typescript
style={{
  background: "var(--fm-surface)",
  border: "1px solid var(--fm-surface-border)",
  borderRadius: "1rem",
  padding: "1.25rem",
}}
```

Keep all three player modes (loading, script-only, full video).

---

## TASK 10: VERIFICATION

1. `pnpm build` — zero TypeScript errors
2. `pnpm lint` — zero lint errors
3. `pnpm test` — existing tests pass
4. Manual verification:
   - `getModel("gemini-2.5-flash")` returns Google model
   - Dialog opens before generating slides/infographic/video/mindmap
   - Source discovery works (shows 10-25 results if SERPER_API_KEY is set)
   - User can select/deselect sources before generating
   - Generated content has dense educational bullets/stats/comparisons
   - Mind map is clean, readable, with expand/collapse
   - Multiple visual styles work
   - Video player renders without GlassCard error

---

## ABSOLUTE CONSTRAINTS

**DO NOT touch:**
- Zod schemas (slideSchema, deckSchema, layoutSchema)
- svg-helpers.ts
- Route structure, error handling, DB operations
- Existing type exports

**DO NOT use:**
- GlassCard (removed)
- Glassmorphism or backdrop-blur
- Infinite CSS animations

**YES, you can:**
- Create new files (generate-dialog.tsx, styles.ts, discover-sources/route.ts, scrape-sources/route.ts)
- Add `@ai-sdk/google`, `fluent-ffmpeg`, `@ffmpeg-installer/ffmpeg`
- Modify compose-slide.ts / compose-infographic.ts ONLY for style config colors
- Modify generate-image.ts for style parameter
- Modify mind-map-canvas.tsx and mind-map-node.tsx for layout fixes
- Modify mindmap route for better generation prompt

**Code style:**
- TypeScript strict, named exports, `type` imports
- `const Component = (): React.ReactNode => { ... }`
- Inline styles with `var(--fm-*)` CSS custom properties
- File naming: kebab-case
