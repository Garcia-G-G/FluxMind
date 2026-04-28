# FluxMind — Claude Code Max: INFOGRAPHIC OVERHAUL

> **Read `CLAUDE.md` first** for stack and code style rules.
> Every fix here is specific, with file paths and line numbers. No guessing.

---

## GOAL

Three major changes:

1. **30+ layout variations** — Currently only 3 strategies with hardcoded pixel positions. No randomization. Same content = same layout every time.
2. **Multi-infographic (3+ sequential pages)** — Currently generates exactly 1 image. Change to generate a minimum of 3 connected infographics in sequence.
3. **More text content** — 6 `.slice()` calls truncate text aggressively.

---

## ROOT CAUSE ANALYSIS (verified by reading the actual code)

### Problem 1: Same layout every time

**File**: `src/lib/media/compose-infographic.ts` (877 lines)

- **Lines 123-136**: Only 3 strategies: `magazine`, `dashboard`, `story`
- **`pickLayoutStrategy()` is 100% deterministic** — selection is based purely on block types:
  - `statCount >= 3` → dashboard
  - `hasChart && hasFlow` → story
  - everything else → magazine (this is what fires most of the time)
- **Zero randomization anywhere** — no `Math.random()`, no seed-based variation, no shuffling
- **All pixel positions hardcoded**:
  - Stats: always 200px wide × 100-120px tall, centered in pairs
  - Callouts: always 2-up at `leftX=60`, `rightX = 60 + halfW + 20`, height 130px
  - Charts: always at `x: 80, width: W-160`
  - Flow/Timeline: always at `x: 80, width: W-80`
  - Title: always at y=110, centered
  - Footer: always at `H - 36`
- **Visual style only changes colors** (via `styles.ts` line ~97) — not layout, not spacing, not structure

### Problem 2: Only 1 infographic per generation

**File**: `src/app/api/studio/infographic/route.ts` (440 lines)

- Generates ONE `InfographicLayout` via `generateObject()` (line 257)
- Calls `composeInfographic()` ONCE (line 377)
- Saves ONE output with ONE `imageUrl` (lines 389-413)
- `InfographicContent` type (line 130) has `imageUrl: string` (singular)
- No concept of pages, series, or variants anywhere in the type

**File**: `src/components/studio/infographic-viewer.tsx`
- Displays a single image. No pagination. No page navigation.

**Reference**: The slides system ALREADY solves multi-generation correctly:
- `src/app/api/studio/slides/route.ts` — generates array of slides, composes each in parallel with `Promise.all()`
- `SlidesContent` has `slides: SlideDeckSlide[]` (array)
- `src/components/studio/slide-viewer.tsx` — has full pagination: `index` state, "1 / 6" counter, arrow keys, prev/next buttons

### Problem 3: Text truncation

**File**: `src/lib/media/compose-infographic.ts`

6 `.slice()` calls with their EXACT locations:

| Line | Function | What | Current | Problem |
|------|----------|------|---------|---------|
| 282 | `renderStatBox` | label lines | `.slice(0, 2)` | Only 2 lines for stat labels |
| 309 | `renderCalloutBox` | body lines | `.slice(0, 5)` | Only 5 lines for callout body |
| 409 | `renderComparison` | item labels | `.slice(0, 2)` | Only 2 lines for comparison labels |
| 440 | `renderFlow` | step detail | `.slice(0, 3)` | Only 3 lines for flow step details |
| 477 | `renderTimeline` | event labels | `.slice(0, 3)` | Only 3 lines for timeline events |
| 501 | `renderTakeaway` | body lines | `.slice(0, 3)` | Only 3 lines for key takeaway |

Bounding box heights that need to match the increased text:
- Stat box: referenced as `boxH = 100` (magazine, line 680) and `dashStatH = 120` (dashboard, line 549)
- Callout box: `cbh = 130` (lines 578, 712)
- Comparison row: `rowH = 90` (line 400)
- Flow section: `y += 80` (implied by spacing)
- Timeline: `y += 80` (line 484)
- Takeaway: `bh = 80` (line 492)

---

## EXECUTION ORDER

1. Expand layout system from 3 to 30+ templates
2. Increase text limits + box heights
3. Add multi-infographic generation (3+ sequential pages)
4. Update Generate Dialog with infographic count control
5. Update viewer for multi-page display
6. Verify

---

## TASK 1: EXPAND TO 30+ LAYOUT TEMPLATES

**File**: `src/lib/media/compose-infographic.ts`

### 1A. Replace the strategy system

Delete `LayoutStrategy` type and `pickLayoutStrategy` function (lines 123-136).

Replace with a **template-based system**. Each template is a function that receives all block renderers and positions them differently on the canvas.

```typescript
type LayoutTemplateFn = (ctx: {
  /** All parsed blocks by type */
  stats: Extract<LayoutBlock, { type: "stat" }>[];
  callouts: Extract<LayoutBlock, { type: "callout" }>[];
  charts: Extract<LayoutBlock, { type: "chart" }>[];
  flows: Extract<LayoutBlock, { type: "flow" }>[];
  timelines: Extract<LayoutBlock, { type: "timeline" }>[];
  comparisons: Extract<LayoutBlock, { type: "comparison" }>[];
  takeaways: Extract<LayoutBlock, { type: "takeaway" }>[];
  texts: Extract<LayoutBlock, { type: "text" }>[];
  /** Canvas dimensions */
  W: number; H: number;
  /** Current accent color */
  accent: string;
  /** Color set from style */
  colors: ColorSet;
  /** SVG parts accumulator (push strings here) */
  parts: string[];
  /** Y position tracker — read and mutate .v */
  y: { v: number };
  /** Renderers — call these to emit SVG for each block */
  renderStat: typeof renderStatBox;
  renderCallout: typeof renderCalloutBox;
  renderChart: (block: Extract<LayoutBlock, { type: "chart" }>, x: number, w: number) => void;
  renderFlow: (block: Extract<LayoutBlock, { type: "flow" }>, startX: number, endX: number) => void;
  renderTimeline: (block: Extract<LayoutBlock, { type: "timeline" }>, startX: number, endX: number) => void;
  renderComparison: (block: Extract<LayoutBlock, { type: "comparison" }>, startX: number, w: number) => void;
  renderTakeaway: (block: Extract<LayoutBlock, { type: "takeaway" }>, startX: number, w: number) => void;
  renderText: (block: Extract<LayoutBlock, { type: "text" }>, startX: number) => void;
}) => void;

type LayoutTemplate = {
  id: number;
  name: string;
  render: LayoutTemplateFn;
};
```

### 1B. Implement 30 layout templates

Create a `LAYOUT_TEMPLATES: LayoutTemplate[]` array with 30 entries. Group them into families:

**IMPORTANT**: Each template should be a REAL, distinct layout — not just a cosmetic tweak. The templates should differ in:
- Where stats go (top banner row vs sidebar vs scattered vs giant hero)
- How callouts are arranged (2-col vs stacked vs staggered vs sidebar)
- Whether chart is full-width or side-by-side with text
- Whether content flows left-aligned, centered, right-heavy, zigzag, etc.
- Spacing/margin variation (tight vs spacious vs asymmetric)

**Group A — Data-forward (5 templates):**
1. `stat-banner`: Full-width KPI bar across the top, all other content stacked below
2. `stat-sidebar`: Stats in a 25% left column, content in 75% right area
3. `stat-hero`: First stat is HUGE (full-width, 48px font), rest small below
4. `stat-cards-3col`: Stats in a 3-column card grid with accent strip tops
5. `stat-scattered`: Stats at their declared positions (use the `position` field), content fills around them

**Group B — Narrative (5 templates):**
6. `story-zigzag`: Content alternates left/right alignment per block
7. `story-centered`: Everything centered, 60% canvas width, generous vertical spacing
8. `story-chapters`: Blocks separated by numbered section dividers
9. `story-timeline-spine`: Vertical line on left at 20%, blocks branch to the right
10. `story-cards`: Each block is a rounded-corner card with drop shadow, stacked vertically

**Group C — Grid (5 templates):**
11. `grid-2col`: Two equal columns, blocks fill left-to-right top-to-bottom
12. `grid-3col`: Three equal columns (stats+callouts fill first, charts span 2-3 cols)
13. `grid-masonry`: Two columns, blocks vary in height (pack tightly)
14. `grid-hero`: First block spans full width, rest in 2-col grid below
15. `grid-sidebar-main`: 30% sidebar (stats + takeaway), 70% main area

**Group D — Visual (5 templates):**
16. `magazine-spread`: Content in 2 columns, large chart spanning both at center
17. `poster-title`: Title/subtitle take 30% of height, content compressed below
18. `diagonal-flow`: Each block shifted 20-30px right from previous, creating a diagonal
19. `offset-blocks`: Alternating blocks have different left margins (60px / 120px)
20. `accent-band`: Full-width colored accent band at 1/3 height, stats inside it

**Group E — Content-driven (5 templates):**
21. `chart-hero`: Chart takes 40% of canvas height as hero, rest below
22. `comparison-focus`: Comparison block gets full width + extra height, other blocks compact
23. `flow-hero`: Flow/timeline takes center stage, stats as small badges around it
24. `mixed-wide-narrow`: Alternating full-width and half-width blocks
25. `takeaway-hero`: Takeaway block at the TOP (not bottom), acts as hook

**Group F — Minimal/Modern (5 templates):**
26. `minimal-left`: All content left-aligned at x=60, right 40% is whitespace
27. `minimal-centered`: Content at 50% canvas width, maximum whitespace
28. `type-only`: No background boxes on any block, just typography (text + value)
29. `dark-accent-bar`: Stats rendered on a dark accent-colored bar, rest on light
30. `split-half`: Left half has accent background with stats+takeaway, right half has detail

### 1C. Layout selection with deterministic randomness

Replace `pickLayoutStrategy` with a selection function that uses the `outputId` as a seed for deterministic but varied selection:

```typescript
const selectTemplate = (
  blocks: LayoutBlock[],
  style: VisualStyle,
  seed: string,
  pageIndex: number = 0,
): LayoutTemplate => {
  // Simple hash from seed + pageIndex
  let hash = pageIndex * 31;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }

  // Style-preference weighting (optional, soft bias)
  const preferred: Record<VisualStyle, string[]> = {
    professional: ["stat-", "grid-", "chart-"],
    scientific: ["chart-", "grid-", "stat-"],
    kawaii: ["story-", "diagonal-", "offset-"],
    sketch: ["story-", "magazine-", "poster-"],
    minimalist: ["minimal-", "type-", "split-"],
    auto: [], // no bias — full pool
  };

  const biased = LAYOUT_TEMPLATES.filter((t) =>
    preferred[style].some((p) => t.name.startsWith(p)),
  );
  const pool = biased.length >= 5 ? biased : LAYOUT_TEMPLATES;
  return pool[Math.abs(hash) % pool.length];
};
```

### 1D. Update `buildSvgOverlay` signature

Add `outputId` and `pageIndex` parameters:

```typescript
const buildSvgOverlay = (
  layout: InfographicLayout,
  W: number,
  H: number,
  style: VisualStyle = "auto",
  outputId: string = "",
  pageIndex: number = 0,
): string => {
```

Replace the entire strategy switch (lines 546-769) with:

```typescript
const template = selectTemplate(layout.blocks, style, outputId, pageIndex);
// ... build context and call template.render(ctx) ...
```

### 1E. Update `composeInfographic` signature and passthrough

Add `pageIndex` to `ComposeOptions`:

```typescript
export type ComposeOptions = {
  width?: number;
  height?: number;
  notebookId: string;
  outputId: string;
  style?: VisualStyle;
  pageIndex?: number;  // ← NEW
};
```

In `composeInfographic` (line 830), pass it through:

```typescript
const svg = buildSvgOverlay(
  layout, W, H,
  options.style ?? "auto",
  options.outputId,
  options.pageIndex ?? 0,
);
```

---

## TASK 2: INCREASE TEXT LIMITS + BOX HEIGHTS

**File**: `src/lib/media/compose-infographic.ts`

Make these 6 changes (find the EXACT `.slice()` call and replace):

### 2A. renderStatBox (around line 282)
- Change: `.slice(0, 2)` → `.slice(0, 3)`
- Increase `boxH` from 100 → 115 (magazine, line 680) and `dashStatH` from 120 → 135 (dashboard, line 549)

### 2B. renderCalloutBox (around line 309)
- Change: `.slice(0, 5)` → `.slice(0, 8)`
- Increase `cbh` from 130 → 180 everywhere it appears (lines 578, 636, 712)

### 2C. renderComparison (around line 409)
- Change: `.slice(0, 2)` → `.slice(0, 3)`
- Increase `rowH` from 90 → 110 (line 400)

### 2D. renderFlow (around line 440)
- Change: `.slice(0, 3)` → `.slice(0, 5)`
- After the flow block, find `y += 80` or similar and change to `y += 120`

### 2E. renderTimeline (around line 477)
- Change: `.slice(0, 3)` → `.slice(0, 4)`
- After the timeline block, find `y += 80` (line 484) and change to `y += 100`

### 2F. renderTakeaway (around line 501)
- Change: `.slice(0, 3)` → `.slice(0, 5)`
- Change `bh` from 80 → 115 (line 492)

---

## TASK 3: MULTI-INFOGRAPHIC GENERATION (3+ PAGES)

### 3A. Update the route to generate a series

**File**: `src/app/api/studio/infographic/route.ts`

**Read the request body** — add `infographicCount`:

At line 149-170, add to the destructured body:

```typescript
const {
  // ... existing fields ...
  infographicCount: rawInfographicCount = 3,
} = body as {
  // ... existing types ...
  infographicCount?: number;
};
const infographicCount = Math.max(3, Math.min(Number(rawInfographicCount) || 3, 10));
```

**Create a multi-page schema** — wrap the existing `layoutSchema` in an array:

```typescript
const multiLayoutSchema = z.object({
  pages: z.array(layoutSchema).min(3).max(10),
});
```

**Update the `generateObject` call** (line 257) to use `multiLayoutSchema`:

```typescript
const { object: multiContent } = await generateObject({
  model: getModel(modelId),
  schema: multiLayoutSchema,
  prompt: `${langInstr}
${userInstr}
You are an expert teacher building a SERIES of exactly ${infographicCount} connected infographics about this topic. Each infographic is one page in a visual series — they should flow logically together.

SERIES STRUCTURE:
- Page 1: Overview & Hook — start with the most surprising stats and a broad introduction
- Pages 2 to ${infographicCount - 1}: Deep Dives — each page explores a different subtopic or angle
- Page ${infographicCount}: Conclusion & Takeaways — wrap up with actionable insights

CRITICAL VARIETY RULES:
- Each page MUST have a unique title and subtitle
- Each page MUST use a different mix of block types:
  - If page 1 leads with stats → page 2 should lead with a chart or flow
  - If page 2 is callout-heavy → page 3 should be data-heavy (charts, comparisons)
  - Never repeat the exact same block type pattern across pages
- Each page MUST have its own illustrationPrompt describing different visual vignettes
- accentColor CAN vary between pages (pick what fits each subtopic)
- Each page should use 4-10 blocks (following detail level: ${detailPick})

${/* rest of the existing prompt about block types, density, etc. */}

Sources:
${finalContext}`,
});
```

### 3B. Compose all pages in parallel

Replace the single compose call (lines 367-387) with parallel composition:

```typescript
// ---- Phase 2: compose ALL pages in parallel ----
const composePromises = multiContent.pages.map(async (pageContent, i) => {
  const pageId = i === 0 ? outputId : `${outputId}-p${i + 1}`;
  const composeOpts: ComposeOptions = {
    notebookId,
    outputId: pageId,
    width: canvasSize.width,
    height: canvasSize.height,
    style,
    pageIndex: i,  // ← ensures different layout template per page
  };
  try {
    return await composeInfographic(pageContent as InfographicLayout, composeOpts);
  } catch (err) {
    console.error(`Infographic page ${i + 1} composition failed:`, err);
    return {
      imageUrl: "",
      thumbnailUrl: null,
      error: err instanceof Error ? err.message : "composition failed",
    };
  }
});

const composedPages = await Promise.all(composePromises);
```

### 3C. Update `InfographicContent` type (line 130-141)

Add a `pages` array for multi-infographic:

```typescript
export type InfographicPage = {
  index: number;
  title: string;
  subtitle: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
};

export type InfographicContent = {
  id?: string;
  title: string;          // first page title (backward compat)
  subtitle: string;       // first page subtitle
  imageUrl: string;       // first page image (backward compat)
  thumbnailUrl?: string | null;
  imagePrompt: string;
  sections: Array<{ heading: string; summary: string }>;
  keyStats: Array<{ value: string; label: string }>;
  layout?: LayoutContent;
  error?: string;
  /** Multi-page infographic series */
  pages?: InfographicPage[];
};
```

### 3D. Save all pages in the output

Replace lines 389-413 with:

```typescript
const pages: InfographicPage[] = composedPages.map((composed, i) => ({
  index: i + 1,
  title: multiContent.pages[i].title,
  subtitle: multiContent.pages[i].subtitle,
  imageUrl: "imageUrl" in composed ? (composed as ComposedInfographic).imageUrl : "",
  thumbnailUrl: "thumbnailUrl" in composed ? (composed as ComposedInfographic).thumbnailUrl : null,
}));

const firstPage = multiContent.pages[0];
const composeError = composedPages.some(
  (p) => "error" in p && (p as { error?: string }).error,
)
  ? "Some pages failed to compose"
  : null;

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

await db.update(outputs).set({
  content: {
    ...(saved as unknown as Record<string, unknown>),
    layout: multiContent.pages[0],
    allLayouts: multiContent.pages, // store all page layouts for potential re-rendering
  },
  fileUrl: pages[0]?.imageUrl || null,
  thumbnailUrl: pages[0]?.thumbnailUrl ?? undefined,
  status: composeError ? "error" : "ready",
  updatedAt: new Date(),
}).where(eq(outputs.id, outputId));
```

---

## TASK 4: ADD INFOGRAPHIC COUNT TO GENERATE DIALOG

**File**: `src/components/studio/generate-dialog.tsx`

### 4A. Add to `GenerateConfig` type (line 32)

```typescript
export type GenerateConfig = {
  // ... existing fields ...
  infographicCount?: number;
};
```

### 4B. Add state (after line 294)

```typescript
const [infographicCount, setInfographicCount] = useState<number>(3);
```

### 4C. Add visibility flag (after line 368)

```typescript
const showInfographicCount = outputType === "infographic";
```

### 4D. Add stepper UI (after the orientation section, around line 528)

Use the same stepper pattern as the slide count:

```tsx
{showInfographicCount && (
  <div className="flex flex-col gap-2">
    <span className={sectionLabelClass} style={sectionLabelStyle}>
      Pages
    </span>
    <div className="flex items-center gap-3">
      <button type="button"
        onClick={() => setInfographicCount(Math.max(3, infographicCount - 1))}
        disabled={infographicCount <= 3}
        className="w-8 h-8 rounded-lg border flex items-center justify-center text-base transition-colors disabled:opacity-30"
        style={{ background: "var(--fm-surface-elevated)", borderColor: "var(--fm-surface-border)", color: "var(--fm-text-secondary)" }}
      >−</button>
      <span className="text-lg font-bold min-w-[28px] text-center" style={{ color: "var(--fm-text)" }}>
        {infographicCount}
      </span>
      <button type="button"
        onClick={() => setInfographicCount(Math.min(10, infographicCount + 1))}
        disabled={infographicCount >= 10}
        className="w-8 h-8 rounded-lg border flex items-center justify-center text-base transition-colors disabled:opacity-30"
        style={{ background: "var(--fm-surface-elevated)", borderColor: "var(--fm-surface-border)", color: "var(--fm-text-secondary)" }}
      >+</button>
      <span className="text-[11px]" style={{ color: "var(--fm-text-tertiary)" }}>
        infographics in sequence
      </span>
    </div>
  </div>
)}
```

### 4E. Pass in submit() (around line 435)

```typescript
if (showInfographicCount) config.infographicCount = infographicCount;
```

### 4F. Reset on dialog open (around line 322)

```typescript
setInfographicCount(3);
```

---

## TASK 5: UPDATE VIEWER FOR MULTI-PAGE

**File**: `src/components/studio/infographic-viewer.tsx`

### 5A. Add pagination state and page derivation

Copy the pattern from `slide-viewer.tsx` (which already has pagination at lines 32-69):

```typescript
export const InfographicViewer = ({ infographic }: Props): React.ReactNode => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Backward compat: if no pages array, wrap single image as page 1
  const pages = infographic.pages ?? [
    {
      index: 1,
      title: infographic.title,
      subtitle: infographic.subtitle,
      imageUrl: infographic.imageUrl,
      thumbnailUrl: infographic.thumbnailUrl ?? null,
    },
  ];

  const totalPages = pages.length;
  const activePage = pages[currentPage];
```

### 5B. Add keyboard navigation (copy from slide-viewer.tsx lines 55-69)

```typescript
useEffect(() => {
  const handleKey = (e: KeyboardEvent): void => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setCurrentPage((i) => (i + 1 < totalPages ? i + 1 : i));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setCurrentPage((i) => (i - 1 >= 0 ? i - 1 : i));
    } else if (e.key === "Escape") {
      setIsFullscreen(false);
    }
  };
  window.addEventListener("keydown", handleKey);
  return () => window.removeEventListener("keydown", handleKey);
}, [totalPages]);
```

### 5C. Add page navigation UI

Below the main image, add pagination controls:

```tsx
{totalPages > 1 && (
  <div className="flex items-center justify-center gap-3 mt-3">
    <button
      onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
      disabled={currentPage === 0}
      className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-30"
      style={{ borderColor: "var(--fm-surface-border)", color: "var(--fm-text-secondary)" }}
    >
      <ChevronLeft className="h-4 w-4" />
    </button>
    <span className="text-sm font-medium tabular-nums" style={{ color: "var(--fm-text-secondary)" }}>
      {currentPage + 1} / {totalPages}
    </span>
    <button
      onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
      disabled={currentPage === totalPages - 1}
      className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-30"
      style={{ borderColor: "var(--fm-surface-border)", color: "var(--fm-text-secondary)" }}
    >
      <ChevronRight className="h-4 w-4" />
    </button>
  </div>
)}
```

Import `ChevronLeft`, `ChevronRight` from lucide-react.

### 5D. Add thumbnail strip for quick navigation

```tsx
{totalPages > 1 && (
  <div className="flex gap-2 mt-3 overflow-x-auto pb-2 px-1">
    {pages.map((page, i) => (
      <button
        key={page.index}
        onClick={() => setCurrentPage(i)}
        className="shrink-0 rounded-lg overflow-hidden border-2 transition-all"
        style={{
          borderColor: i === currentPage ? "var(--fm-accent-orange)" : "var(--fm-surface-border)",
          opacity: i === currentPage ? 1 : 0.5,
        }}
      >
        {page.thumbnailUrl ? (
          <Image src={page.thumbnailUrl} alt={`Page ${page.index}`} width={80} height={100} className="object-cover" />
        ) : (
          <div className="w-20 h-[100px] flex items-center justify-center text-xs"
            style={{ background: "var(--fm-surface-elevated)", color: "var(--fm-text-tertiary)" }}>
            {page.index}
          </div>
        )}
      </button>
    ))}
  </div>
)}
```

### 5E. Show active page's image

The main image display should use `activePage.imageUrl` instead of `infographic.imageUrl`. Update the Image src and download filename accordingly.

---

## TASK 6: VERIFY

1. **`pnpm build`** — zero errors
2. **`pnpm lint`** — zero errors
3. **`pnpm test`** — existing tests pass
4. **Check:**
   - Generate infographic → should produce 3 pages by default
   - Each page has a DIFFERENT layout (verify visually — stats in different positions, different column arrangements)
   - Page navigation works (arrows + keyboard + thumbnail strip)
   - "1 / 3" counter shows correctly
   - Download downloads the current page
   - Old infographics (single image, no `pages` field) still render correctly
   - Setting count to 5 in the dialog generates 5 connected infographics
   - Text content is denser (more lines in callouts, takeaways, stats)

---

## GUIDELINES

You have full freedom to modify types, schemas, pipelines, block types, or anything else needed to achieve the best result. The instructions above are a detailed starting point — not a cage. If you find a better approach while implementing, go for it.

**Key goals to keep in mind:**
- Existing single-image infographics should still render (backward compat via the `pages` fallback in the viewer)
- Infographic count must be configurable (not hardcoded to 3)
- The 30 layout templates should be genuinely different arrangements, not cosmetic tweaks
- `pnpm build && pnpm lint && pnpm test` must all pass
