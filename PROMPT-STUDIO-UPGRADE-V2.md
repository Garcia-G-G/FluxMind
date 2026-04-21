# FluxMind — Claude Code Max Prompt: Studio Upgrade V2

> **This is a CONTINUATION prompt.** The previous prompt (`PROMPT-CONTENT-INTELLIGENCE.md`) was already implemented. That prompt covered: rewriting the slides/infographic generation prompts for better content density, fixing the AI model (Gemini support), and basic content quality improvements.
>
> **Read `CLAUDE.md` first** for stack and code style rules.
> **Read `PROMPT-STUDIO-MEDIA-ENGINE.md`** for the hybrid composition architecture.
> **Do NOT re-implement anything from the previous prompt.** This prompt covers NEW features only.

---

## WHAT WAS ALREADY DONE (do NOT redo)

- ✅ Rewrote `generateObject()` prompts in slides and infographic routes for content density
- ✅ Fixed AI model (added Gemini 2.5 Flash/Pro to `models.ts`)
- ✅ Content-first approach with GOOD/BAD examples in prompts
- ✅ The hybrid composition pipeline (Sharp + SVG + fal.ai) works

---

## WHAT'S NEW IN THIS PROMPT (4 major features)

### Feature 1: Customization Dialog
A UI dialog that opens BEFORE generation, letting users customize: language, orientation, visual style, detail level, accent color, slide count, and a custom text prompt.

### Feature 2: Multiple Visual Styles
6 visual styles (Auto, Sketch, Kawaii, Professional, Scientific, Minimalist) that change both the fal.ai illustration prompt AND the SVG overlay aesthetics.

### Feature 3: Intelligent Source Discovery
When the dialog opens, the system automatically searches the web for 10-25 relevant sources, shows them to the user, and lets them select which ones to include in generation. More sources = richer, more informative content.

### Feature 4: Mind Map Overhaul
Fix the messy, unreadable mind map: better spacing, left-to-right layout, expand/collapse branches, smoother edges, draggable nodes, cleaner styling.

### Feature 5: Video Pipeline Completion
Implement TTS + composition (phases 3-5) so "Video Overview" produces a real video, not just text chapters. Also fix the broken GlassCard import in video-player.tsx.

---

## EXECUTION ORDER

1. **Task 1**: Customization dialog component
2. **Task 2**: Multiple visual styles module
3. **Task 3**: Intelligent source discovery (API + UI)
4. **Task 4**: Wire dialog → hooks → API routes
5. **Task 5**: Mind map overhaul
6. **Task 6**: Video pipeline completion + fix video player
7. **Task 7**: Verification

---

## TASK 1: CUSTOMIZATION DIALOG

**New file**: `/src/components/studio/generate-dialog.tsx`

A reusable dialog that opens BEFORE generation. Must look premium, matching FluxMind's dark UI with `var(--fm-*)` custom properties.

### Config type:
```typescript
export type GenerateConfig = {
  language: "en" | "es";
  orientation: "horizontal" | "vertical" | "square";  // infographics
  style: "auto" | "sketch" | "kawaii" | "professional" | "scientific" | "minimalist";
  detailLevel: "concise" | "standard" | "detailed";
  customPrompt: string;
  slideCount?: number;       // slides only, 4-10
  accentColor?: "orange" | "violet" | "blue" | "rose" | "emerald" | "amber";
  selectedSourceIds?: string[];       // existing notebook sources
  extraSourceContent?: string;        // scraped content from discovered sources
};
```

### Dialog props:
```typescript
export type GenerateDialogProps = {
  type: "slides" | "infographic" | "video" | "mindmap";
  notebookId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (config: GenerateConfig) => void;
  isGenerating: boolean;
};
```

### Dialog layout:

```
┌──────────────────────────────────────────────────┐
│  Customize Slide Deck                         ✕  │
├──────────────────────────────────────────────────┤
│                                                  │
│  Language             Orientation (infographic)  │
│  [English ▼]          ○ Horizontal ○ Vertical   │
│                       ○ Square                   │
│                                                  │
│  Visual style                                    │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌────┐│
│  │ ✏️  │ │ 🌸  │ │ 💼  │ │ 🔬  │ │ ◻️  │ │ 🔄 ││
│  │Sketc│ │Kawai│ │Prof │ │Scien│ │Minim│ │Auto││
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └────┘│
│                                                  │
│  Detail level                                    │
│  [ Concise ] [ Standard ✓ ] [ Detailed ]        │
│                                                  │
│  Slides: [──────●──────] 6   (slides only)      │
│                                                  │
│  Accent color                                    │
│  ● ● ● ● ● ●  (6 color circles)                │
│                                                  │
│  ── Sources ─────────────────────────────────── │
│  ✅ como hacer una pagina web (your source)      │
│                                                  │
│  ── Discovered Sources ──────────── [🔍 Find]  │
│  [Loading spinner while searching...]            │
│  ✅ HTML Semantic Elements - MDN Web Docs        │
│     developer.mozilla.org                        │
│  ✅ CSS Grid Layout Guide - CSS-Tricks           │
│     css-tricks.com                               │
│  ☐  10 Best Web Hosting 2026 - Forbes            │
│     forbes.com                                   │
│  ✅ Web Performance Stats - Google               │
│     web.dev                                      │
│  ... (scrollable, 10-25 results)                 │
│  Selected: 8 of 12 · [Select All] [Deselect]   │
│                                                  │
│  Describe what to focus on (optional)            │
│  ┌──────────────────────────────────────────────┐│
│  │ "Highlight the 3 key statistics..."          ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│                                  [ Generate ▶ ] │
└──────────────────────────────────────────────────┘
```

### Styling:
- Use the existing dialog system from `/src/components/ui/dialog.tsx`
- Background: `var(--fm-surface)`, borders: `var(--fm-surface-border)`
- Text: `var(--fm-text)`, `var(--fm-text-secondary)`, `var(--fm-text-tertiary)`
- Selected states: accent color bg at 12% opacity
- NO glassmorphism, NO blur, NO GlassCard
- Style tiles: simple icons or unicode emoji + label text. Selected = accent border
- Color circles: small filled circles with the actual accent color, selected = ring outline
- Make the dialog scrollable (max-height ~80vh) since it has many sections
- Source list: max-height ~200px with overflow-y-auto

### Default values:
- language: from `useLanguage()` hook
- orientation: "horizontal" for slides/video, "vertical" for infographics
- style: "auto"
- detailLevel: "standard"
- customPrompt: ""
- slideCount: 6
- accentColor: "orange"

---

## TASK 2: MULTIPLE VISUAL STYLES

**New file**: `/src/lib/media/styles.ts`

```typescript
export type VisualStyle = "auto" | "sketch" | "kawaii" | "professional" | "scientific" | "minimalist";

export type StyleConfig = {
  name: string;
  illustrationPrefix: string;  // Prepended to fal.ai illustration prompt
  overlayBg: { r: number; g: number; b: number; alpha: number };  // cream sheet color
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

### Update `generate-image.ts`:

Replace the hardcoded `STYLE_PREFIX` with a function:

```typescript
import { STYLE_CONFIGS, type VisualStyle } from "@/lib/media/styles";

export const getStylePrefix = (style: VisualStyle = "auto"): string => {
  const config = STYLE_CONFIGS[style];
  return config.illustrationPrefix + " ABSOLUTE RULE: NO TEXT, NO LETTERS, NO NUMBERS, NO WORDS, NO LABELS, NO TYPOGRAPHY anywhere in the image. Visual elements only. Leave breathing room for text overlay. ";
};
```

Update `generateInfographicImage` to accept an optional `style` param and use `getStylePrefix(style)` instead of `STYLE_PREFIX`.

### Update compose-slide.ts and compose-infographic.ts:

Accept an optional `StyleConfig` in compose options to customize the cream sheet overlay color. Default to current values (backward compat).

### Update the generation prompts:

The slides and infographic prompts (already rewritten in previous prompt) need to use the style parameter. Add these variables before the prompt string:

```typescript
// Build style instruction from user selection
const styleInstr = getStyleInstructions(style ?? "auto");

// Build detail level instruction
const detailMap: Record<string, string> = {
  concise: "4 slides, 2-3 key points each — short and punchy",
  standard: "6 slides, 3-5 key points each — balanced depth",
  detailed: "8 slides, 4-5 key points with deep context — comprehensive",
};
const detailInstr = detailMap[detailLevel] ?? detailMap.standard;

// Build user custom prompt instruction
const userInstr = customPrompt
  ? `\nUSER REQUEST: "${customPrompt}". Incorporate this into the design.\n`
  : "";
```

Then inject `${styleInstr}`, `${detailInstr}`, and `${userInstr}` into the prompt at the right places (style instructions in the illustration section, detail instructions at the top, user request right after langInstr).

---

## TASK 3: INTELLIGENT SOURCE DISCOVERY

### 3A. Create discovery endpoint

**New file**: `/src/app/api/studio/discover-sources/route.ts`

```typescript
// POST /api/studio/discover-sources
// Body: { notebookId: string, query?: string }
// Returns: { sources: DiscoveredSource[] }

export type DiscoveredSource = {
  url: string;
  title: string;
  snippet: string;
  domain: string;
  favicon: string;
};
```

**Implementation:**

1. Fetch notebook title + existing source titles to understand the topic
2. Use AI (`generateObject()` with Gemini or GPT-4o) to generate 5-8 diverse search queries covering different angles of the topic:
   - Factual/statistics (e.g. "web development statistics 2026")
   - How-to/process (e.g. "how to deploy website step by step")
   - Comparison (e.g. "React vs Vue vs Angular comparison")
   - Deep-dive (e.g. "HTML5 semantic elements best practices")
   - Current trends (e.g. "web development trends 2026")
3. For each query, call `searchWeb()` from `/src/lib/research/pipeline.ts` (uses Serper API, already exists)
4. Deduplicate by domain (max 2 per domain for diversity)
5. Filter out: social media, forums, very short pages
6. Return 10-25 results

**Fallback if SERPER_API_KEY is not set**: Return an empty array with a message. The dialog shows "Configure SERPER_API_KEY for automatic source discovery" but still allows generation with existing sources.

**Schema for the AI query generation:**
```typescript
const querySchema = z.object({
  queries: z.array(z.object({
    query: z.string(),
    intent: z.enum(["statistics", "howto", "comparison", "deepdive", "trends"]),
  })).min(5).max(8),
});
```

### 3B. Create scraping endpoint

**New file**: `/src/app/api/studio/scrape-sources/route.ts`

```typescript
// POST /api/studio/scrape-sources
// Body: { urls: string[] }
// Returns: { results: { url: string, title: string, content: string, error?: string }[] }
```

Reuse the existing `scrapeUrlContent()` function from the URL source ingestion route. Scrape each URL, extract main text content with Cheerio, truncate to 5000 chars each. Return the results.

These are NOT permanently saved as notebook sources — they're temporary, used only for this generation's context. (Optional improvement: save them with `metadata.origin: "auto-discovered"` flag so they persist.)

### 3C. Source discovery UI in the dialog

Add a "Sources" section to the `GenerateDialog`:

1. **Existing sources**: Fetch from `/api/outputs?notebookId=X` (or query sources table). Show as pre-selected checkboxes.
2. **"Find more sources" button**: Calls `/api/studio/discover-sources`. Shows spinner while loading.
3. **Results list**: Scrollable, each result = checkbox + title + domain. Max-height ~200px.
4. **Controls**: "Select All" / "Deselect All" buttons. Counter "Selected: X of Y".

### 3D. Wire into generation flow

When user clicks "Generate":

1. Collect selected discovered source URLs
2. Call `/api/studio/scrape-sources` with those URLs
3. Concatenate scraped content into `extraSourceContent`
4. Pass to the generation API endpoint alongside other config
5. In the route, append to source context:
```typescript
const allSources = body.extraSourceContent
  ? `${ctx.sourceContext}\n\n---\n\n${body.extraSourceContent}`
  : ctx.sourceContext;
```

---

## TASK 4: WIRE DIALOG → HOOKS → API ROUTES

### 4A. Update hooks (`/src/hooks/use-studio-outputs.ts`)

The `useGenerate` factory needs to accept `GenerateConfig` fields:

```typescript
export const useGenerateSlides = () =>
  useGenerate<{ notebookId: string } & Partial<GenerateConfig>>("/api/studio/slides");
export const useGenerateInfographic = () =>
  useGenerate<{ notebookId: string } & Partial<GenerateConfig>>("/api/studio/infographic");
// Same for video, mindmap
```

### 4B. Update Studio page (`/src/app/(app)/notebook/[id]/studio/page.tsx`)

For "Slide Deck", "Infographic", "Video Overview", and "Mind Map" cards:

1. On click → open the dialog (NOT generate immediately)
2. Add state: `const [dialogOpen, setDialogOpen] = useState(false);`
3. Add state: `const [dialogType, setDialogType] = useState<"slides" | "infographic" | "video" | "mindmap">("slides");`
4. When user clicks "Generate" inside dialog → call the existing `generate()` helper with config
5. The `generate()` helper needs to accept config:

```typescript
const generate = async <T,>(
  type: StudioTab,
  mutateAsync: (args: { notebookId: string } & Partial<GenerateConfig>) => Promise<T>,
  setter: (data: T) => void,
  config?: Partial<GenerateConfig>
): Promise<void> => {
  try {
    const result = await mutateAsync({ notebookId, ...config });
    setter(result);
    setActiveTab(type);
  } catch {}
};
```

### 4C. Update API routes to accept config

**Slides route** (`/src/app/api/studio/slides/route.ts`): Extract from body: `style`, `detailLevel`, `customPrompt`, `accentColor`, `extraSourceContent`
**Infographic route** (`/src/app/api/studio/infographic/route.ts`): Extract: `style`, `detailLevel`, `customPrompt`, `orientation`, `extraSourceContent`
**Mind map route** (`/src/app/api/studio/mindmap/route.ts`): Extract: `detailLevel`, `customPrompt`, `extraSourceContent`
**Video route**: Extract: `style`, `detailLevel`, `customPrompt`, `extraSourceContent`

Use these params to build the prompt dynamically (inject `${styleInstr}`, `${detailInstr}`, `${userInstr}`, append `extraSourceContent` to source context).

---

## TASK 5: MIND MAP OVERHAUL

The current mind map is nearly unreadable — nodes overlap, lines cross chaotically, text is tiny.

### Root causes (investigated):
- `nodesep: 80` too tight for 200px-wide nodes
- `ranksep: 120` not enough vertical space
- Canvas capped at `h-[500px]` forces compression
- 4-7 subtopics × 2-4 children = too many nodes
- Default edge type creates crossing straight lines
- Nodes not draggable
- No expand/collapse

### Fix the layout (`/src/components/mind-map/mind-map-canvas.tsx`):

**A. Increase spacing:**
```typescript
nodesep: 140,  // was 80
ranksep: 180,  // was 120
```

**B. Left-to-right layout:**
```typescript
rankdir: "LR",  // was "TB" — LR reads more naturally for mind maps
```

**C. Expand canvas:**
```typescript
className="h-[700px] ..."  // was h-[500px]
```

**D. Make nodes draggable:**
Ensure `nodesDraggable={true}` (ReactFlow default). Don't re-run dagre on every render — only on initial data load.

**E. Add expand/collapse:**
- Start with only Level 0 + Level 1 visible
- Level 1 nodes show a small +/− icon
- Clicking expands/collapses their Level 2 children
- Implementation: `useState<Set<string>>` tracking expanded node IDs. Filter visible nodes/edges based on expansion state. Re-run dagre when expansion changes.

**F. Smoother edges:**
```typescript
type: "smoothstep"  // instead of default, creates curved non-crossing paths
```

**G. Reduce node count in generation** (`/src/app/api/studio/mindmap/route.ts`):
- 3-5 subtopics (not 4-7)
- 2-3 details per subtopic (not 2-4)
- Total: ~15-18 nodes max instead of ~30+

**H. Improve generation prompt** (same route):
Apply content density rules — each node label should be specific and informative, each description should contain a real fact or insight, not generic text.

### Fix node styling (`/src/components/mind-map/mind-map-node.tsx`):

- Increase font sizes: Level 0: 18px, Level 1: 15px, Level 2: 13px
- Increase min-widths: Level 0: 260px, Level 1: 210px, Level 2: 170px
- More padding: Level 0: 18px, Level 1: 14px, Level 2: 12px
- Cleaner, less saturated colors
- Remove the "breathing dot" animation (visual noise)
- Add expand/collapse icon (+ / −) on Level 1 nodes

---

## TASK 6: VIDEO PIPELINE + FIX PLAYER

### 6A. Complete video pipeline (`/src/lib/video/generate-video.ts`)

**Phase 3: TTS with ElevenLabs**
- For each chapter, generate TTS from `narration` using ElevenLabs API
- Use `eleven_multilingual_v2` model (same as podcast)
- Single narrator voice: `ELEVENLABS_VOICE_VIDEO` env var or `VOICE_ALEX` from podcast
- Reuse ElevenLabs call pattern from `/src/lib/podcast/generate-podcast.ts`

**Phase 4: Composition**
- Install `fluent-ffmpeg` + `@ffmpeg-installer/ffmpeg`
- Per chapter: combine static image + TTS audio into video segment
- Image displays for full audio duration
- Crossfade transitions (~0.5s)
- Output: single MP4 (H.264 + AAC)
- Fallback if FFmpeg unavailable: "slideshow" mode where viewer auto-advances images with synced audio (no real MP4 but better than text-only)

**Phase 5: Upload**
- Upload MP4 to R2 via `uploadFile()`
- Update DB: `fileUrl`, `status: "ready"`, `duration`
- Include chapter timestamps in `content` JSON

### 6B. Update video script prompt

The current prompt (lines 63-70) is too generic. Apply content density rules:
- Each chapter narration must contain REAL, specific information
- imagePrompts must use the selected visual style
- Narration must be educational, not descriptive

### 6C. Fix video player (`/src/components/video/video-player.tsx`)

Replace `GlassCard` import (removed from codebase) with plain div:
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

## TASK 7: VERIFICATION

1. `pnpm build` — zero TypeScript errors
2. `pnpm lint` — zero lint errors
3. `pnpm test` — existing tests pass
4. Manual checks:
   - Dialog opens before generating slides/infographic/video/mindmap
   - 6 visual styles selectable, affect illustration output
   - Source discovery returns 10-25 results (if SERPER_API_KEY set)
   - User can select/deselect sources
   - Discovered source content feeds into generation
   - Mind map is clean, readable, LR layout, expand/collapse works
   - Video player renders without GlassCard error
   - Generated content has educational density

---

## ABSOLUTE CONSTRAINTS

**DO NOT touch:**
- Zod schemas (slideSchema, deckSchema, layoutSchema) — already correct
- svg-helpers.ts
- Route structure, error handling, DB operations (unless adding new routes)
- Existing type exports
- The generation prompts you already rewrote (unless injecting new variables like `styleInstr`)

**DO NOT use:**
- GlassCard (removed), glassmorphism, backdrop-blur
- Infinite CSS animations

**YES, you can:**
- Create new files: generate-dialog.tsx, styles.ts, discover-sources/route.ts, scrape-sources/route.ts
- Add packages: `fluent-ffmpeg`, `@ffmpeg-installer/ffmpeg`
- Modify compose-slide.ts / compose-infographic.ts for style config colors
- Modify generate-image.ts for style parameter
- Modify mind-map-canvas.tsx and mind-map-node.tsx for layout + interactivity
- Modify mindmap route for better generation prompt
- Modify studio page.tsx for dialog integration
- Modify use-studio-outputs.ts hooks for config params

**Code style:**
- TypeScript strict, named exports, `type` imports for type-only
- `const Component = (): React.ReactNode => { ... }`
- Inline styles with `var(--fm-*)` CSS custom properties
- File naming: kebab-case
