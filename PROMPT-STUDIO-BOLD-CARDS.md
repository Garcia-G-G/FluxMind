# FluxMind — Claude Code Max: STUDIO CARDS REDESIGN ("Bold Blocks")

> **Read `CLAUDE.md` first** for stack and code style rules.
> Every fix here is specific, with file paths and line numbers. No guessing.

---

## WHAT WE'RE CHANGING

The Studio page cards currently look generic — glass background, tiny tinted icon in a box, same accent color on every card, top gradient line. We're replacing them with **bold, saturated, full-color cards** where each output type has its own personality through color.

**The design:** Each card has a solid saturated background color. White text/icons on the colored surface. Some cards span 2 columns for visual hierarchy. No glass effects, no subtle tints — the color IS the card. Lucide SVG icons rendered directly (no box around them). A subtle decorative circle shape in the top-right corner for depth.

---

## CARD COLOR MAP

These are the exact background colors and text colors for each output type. DO NOT change these — they were hand-picked.

```typescript
const CARD_COLORS: Record<string, { bg: string; text: string; tag: string }> = {
  quiz:        { bg: "#8B5CF6", text: "#ffffff", tag: "Study" },
  flashcards:  { bg: "#3B82F6", text: "#ffffff", tag: "Study" },
  course:      { bg: "#A855F7", text: "#ffffff", tag: "Study" },
  slides:      { bg: "#FF7A45", text: "#ffffff", tag: "Visual" },
  infographic: { bg: "#F43F5E", text: "#ffffff", tag: "Visual" },
  datatable:   { bg: "#64748B", text: "#ffffff", tag: "Data" },
  mindmap:     { bg: "#10B981", text: "#ffffff", tag: "Visual" },
  video:       { bg: "#EC4899", text: "#ffffff", tag: "Media" },
  thread:      { bg: "#0EA5E9", text: "#ffffff", tag: "Social" },
  newsletter:  { bg: "#F59E0B", text: "#422006", tag: "Content" },
  reel:        { bg: "#EC4899", text: "#ffffff", tag: "Media" },
};
```

**Special cases:**
- Newsletter has DARK text (`#422006`) on amber background
- Slides and Newsletter are **wide cards** (`grid-column: span 2`)
- Deep Research keeps its current inline styling (don't touch it)

---

## TASK 1: ADD CARD_COLORS CONSTANT

**File**: `/src/app/(app)/notebook/[id]/studio/page.tsx`

Add this constant at module scope, AFTER `TYPE_ICON` (after line 239):

```typescript
/** Bold Blocks — each card owns a saturated identity color. */
const CARD_COLORS: Record<string, { bg: string; text: string; tag: string }> = {
  quiz:        { bg: "#8B5CF6", text: "#ffffff", tag: "Study" },
  flashcards:  { bg: "#3B82F6", text: "#ffffff", tag: "Study" },
  course:      { bg: "#A855F7", text: "#ffffff", tag: "Study" },
  slides:      { bg: "#FF7A45", text: "#ffffff", tag: "Visual" },
  infographic: { bg: "#F43F5E", text: "#ffffff", tag: "Visual" },
  datatable:   { bg: "#64748B", text: "#ffffff", tag: "Data" },
  mindmap:     { bg: "#10B981", text: "#ffffff", tag: "Visual" },
  video:       { bg: "#EC4899", text: "#ffffff", tag: "Media" },
  thread:      { bg: "#0EA5E9", text: "#ffffff", tag: "Social" },
  newsletter:  { bg: "#F59E0B", text: "#422006", tag: "Content" },
  reel:        { bg: "#EC4899", text: "#ffffff", tag: "Media" },
};
const DEFAULT_CARD_COLOR = { bg: "#64748B", text: "#ffffff", tag: "Other" };
```

---

## TASK 2: UPDATE StudioCardProps

**File**: `/src/app/(app)/notebook/[id]/studio/page.tsx`

Replace the `StudioCardProps` type (lines 261-272) with:

```typescript
type StudioCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  onGenerate: () => void;
  isPending: boolean;
  error: Error | null;
  hasData: boolean;
  /** Bold Blocks color — { bg, text, tag } from CARD_COLORS */
  colors: { bg: string; text: string; tag: string };
  wide?: boolean;
  onHover?: () => void;
  onView?: () => void;
};
```

**Remove** the `accent` prop entirely. It's replaced by `colors`.

---

## TASK 3: REWRITE StudioCard COMPONENT

**File**: `/src/app/(app)/notebook/[id]/studio/page.tsx`

Replace the entire StudioCard component (lines 274-362) with this:

```typescript
const StudioCard = memo(({
  icon: Icon,
  title,
  description,
  onGenerate,
  isPending,
  error,
  hasData,
  colors,
  wide,
  onHover,
  onView,
}: StudioCardProps): React.ReactNode => (
  <div
    onMouseEnter={onHover}
    onFocus={onHover}
    className={`group relative overflow-hidden rounded-xl p-5 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[3px] hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] ${wide ? "sm:col-span-2" : ""}`}
    style={{
      background: colors.bg,
      color: colors.text,
      minHeight: 160,
    }}
  >
    {/* Decorative circle — top right, subtle */}
    <div
      className="absolute -top-8 -right-8 w-[120px] h-[120px] rounded-full pointer-events-none"
      style={{ background: colors.text, opacity: 0.08 }}
    />

    {/* Icon — NO box around it */}
    <Icon
      style={{ width: 40, height: 40, color: colors.text }}
      strokeWidth={1.6}
    />

    {/* Title — bold, large */}
    <h3
      className="mt-4 font-bold text-lg leading-tight tracking-tight"
      style={{ color: colors.text, fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif" }}
    >
      {title}
    </h3>

    {/* Description — only show on wide cards */}
    {wide && (
      <p
        className="text-sm mt-1 leading-relaxed"
        style={{ color: colors.text, opacity: 0.7 }}
      >
        {description}
      </p>
    )}

    {/* Bottom row — tag + actions */}
    <div className="flex items-center gap-2 mt-4">
      <span
        className="text-xs font-semibold px-2.5 py-1 rounded-md"
        style={{
          background: `color-mix(in srgb, ${colors.text} 20%, transparent)`,
          color: colors.text,
        }}
      >
        {colors.tag}
      </span>
      <div className="flex-1" />
      {hasData && onView && (
        <button
          onClick={(e) => { e.stopPropagation(); onView(); }}
          className="flex items-center h-7 px-3 text-xs font-medium rounded-md transition-opacity"
          style={{
            background: `color-mix(in srgb, ${colors.text} 15%, transparent)`,
            color: colors.text,
          }}
        >
          <Eye className="h-3 w-3 mr-1.5" />
          View
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onGenerate(); }}
        disabled={isPending}
        className="flex items-center gap-1.5 h-7 px-3.5 text-xs font-semibold rounded-md transition-opacity disabled:opacity-50"
        style={{
          background: `color-mix(in srgb, ${colors.text} 25%, transparent)`,
          color: colors.text,
        }}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Wand2 className="h-3.5 w-3.5" />
        )}
        Generate
      </button>
    </div>

    {error && (
      <p
        className="text-xs mt-3 px-2 py-1.5 rounded-md"
        style={{
          color: colors.text,
          background: `color-mix(in srgb, ${colors.text} 12%, transparent)`,
        }}
      >
        {error.message}
      </p>
    )}
  </div>
));
StudioCard.displayName = "StudioCard";
```

**Key differences from the old card:**
- NO `accent` — uses `colors.bg` as full card background
- NO glass bg, glass border, or top gradient line
- NO icon box (just the naked icon at 40px)
- `wide` prop controls `sm:col-span-2`
- Tag badge shows the category (Study, Visual, Content, etc.)
- Description only shown on wide cards (narrow cards just show icon + title)
- Buttons use `color-mix` on `colors.text` for semi-transparent appearance
- Border-radius is `rounded-xl` (12px), not `rounded-2xl` (16px)
- Uses Plus Jakarta Sans for the title

---

## TASK 4: UPDATE CARD INSTANCES IN JSX

**File**: `/src/app/(app)/notebook/[id]/studio/page.tsx`

Replace ALL StudioCard instances (lines 661-725) to use `colors` instead of `accent`, and add `wide` to the featured cards.

### Study section (lines 660-676):

Change grid to 4 columns:
```tsx
<div className="grid gap-3.5 grid-cols-2 lg:grid-cols-4 mb-6">
```

Update cards:
```tsx
<StudioCard icon={HelpCircle} title="Quiz" onView={() => setActiveTab("quiz")}
  colors={CARD_COLORS.quiz ?? DEFAULT_CARD_COLOR}
  description="MC, T/F, and free response questions."
  onGenerate={() => openDialog("quiz")}
  onHover={importQuizView}
  isPending={generateQuiz.isPending} error={generateQuiz.error} hasData={!!quizData} />
<StudioCard icon={Layers} title="Flashcards" onView={() => setActiveTab("flashcards")}
  colors={CARD_COLORS.flashcards ?? DEFAULT_CARD_COLOR}
  description="Spaced repetition flashcards."
  onGenerate={() => openDialog("flashcards")}
  onHover={importFlashcardView}
  isPending={generateFlashcards.isPending} error={generateFlashcards.error} hasData={!!flashcardData} />
<StudioCard icon={GraduationCap} title="Mini-Course" onView={() => setActiveTab("course")}
  colors={CARD_COLORS.course ?? DEFAULT_CARD_COLOR}
  description="Structured lessons with quizzes."
  onGenerate={() => openDialog("course")}
  onHover={importCourseView}
  isPending={generateCourse.isPending} error={generateCourse.error} hasData={!!courseData} />
```

### Visual section (lines 680-706):

Change grid to 4 columns:
```tsx
<div className="grid gap-3.5 grid-cols-2 lg:grid-cols-4 mb-6">
```

Update cards — Slide Deck is **wide**:
```tsx
<StudioCard icon={Presentation} title="Slide Deck" onView={() => setActiveTab("slides")}
  colors={CARD_COLORS.slides ?? DEFAULT_CARD_COLOR} wide
  description="Presentation with multiple layouts and illustrated backgrounds."
  onGenerate={() => openDialog("slides")}
  onHover={importSlideViewer}
  isPending={generateSlides.isPending} error={generateSlides.error} hasData={!!slidesData} />
<StudioCard icon={Image} title="Infographic" onView={() => setActiveTab("infographic")}
  colors={CARD_COLORS.infographic ?? DEFAULT_CARD_COLOR}
  description="Stats, timelines, and comparisons."
  onGenerate={() => openDialog("infographic")}
  onHover={importInfographicViewer}
  isPending={generateInfographic.isPending} error={generateInfographic.error} hasData={!!infographicData} />
<StudioCard icon={Table} title="Data Tables" onView={() => setActiveTab("datatable")}
  colors={CARD_COLORS.datatable ?? DEFAULT_CARD_COLOR}
  description="Extract tabular data from sources."
  onGenerate={() => openDialog("datatable")}
  onHover={importDataTableView}
  isPending={generateDataTable.isPending} error={generateDataTable.error} hasData={!!dataTableData} />
<StudioCard icon={Network} title="Mind Map" onView={() => setActiveTab("mindmap")}
  colors={CARD_COLORS.mindmap ?? DEFAULT_CARD_COLOR}
  description="Explorable knowledge graph from sources."
  onGenerate={() => openDialog("mindmap")}
  onHover={importMindMapCanvas}
  isPending={generateMindMap.isPending} error={generateMindMap.error} hasData={!!mindMapData} />
<StudioCard icon={Film} title="Video Overview" onView={() => setActiveTab("video")}
  colors={CARD_COLORS.video ?? DEFAULT_CARD_COLOR}
  description="AI-narrated video with generated visuals."
  onGenerate={() => openDialog("video")}
  onHover={importVideoPlayer}
  isPending={generateVideoOverview.isPending} error={generateVideoOverview.error} hasData={!!videoData} />
```

### Content section (lines 710-726):

Change grid to 4 columns:
```tsx
<div className="grid gap-3.5 grid-cols-2 lg:grid-cols-4 mb-6">
```

Update cards — Newsletter is **wide**:
```tsx
<StudioCard icon={MessageCircle} title="X Thread" onView={() => setActiveTab("thread")}
  colors={CARD_COLORS.thread ?? DEFAULT_CARD_COLOR}
  description="Viral thread with hook and CTA."
  onGenerate={() => openDialog("thread")}
  onHover={importThreadPreview}
  isPending={generateThread.isPending} error={generateThread.error} hasData={!!threadData} />
<StudioCard icon={Mail} title="Newsletter" onView={() => setActiveTab("newsletter")}
  colors={CARD_COLORS.newsletter ?? DEFAULT_CARD_COLOR} wide
  description="Professional email newsletter with sections and pull quotes."
  onGenerate={() => openDialog("newsletter")}
  onHover={importNewsletterPreview}
  isPending={generateNewsletter.isPending} error={generateNewsletter.error} hasData={!!newsletterData} />
<StudioCard icon={Video} title="Reel Script" onView={() => setActiveTab("reel")}
  colors={CARD_COLORS.reel ?? DEFAULT_CARD_COLOR}
  description="30-60s short-form video script."
  onGenerate={() => openDialog("reel")}
  onHover={importReelScriptView}
  isPending={generateReel.isPending} error={generateReel.error} hasData={!!reelData} />
```

---

## TASK 5: ADD PLUS JAKARTA SANS FONT

**File**: `/src/app/layout.tsx` (or wherever the root `<head>` is)

If Plus Jakarta Sans is NOT already loaded, add it via `next/font/google`:

```typescript
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});
```

Add the variable to the `<html>` or `<body>` className. The StudioCard title uses it inline via `fontFamily`, so the font just needs to be loaded — no Tailwind config change needed.

If the project already has a similar display font loaded, skip this and use that font instead.

---

## TASK 6: CLEAN UP DEAD CODE

**File**: `/src/app/(app)/notebook/[id]/studio/page.tsx`

- **Remove** `RESEARCH_CARD_STYLE` constant (line 243-247) if it's no longer used. The Deep Research card might still use it — check before deleting. If it does, keep it.
- **Remove** `OUTPUT_CARD_STYLE` constant (lines 249-252) if unused.
- **Remove** the `accent` prop from the `StudioCard` component — already done in Task 3, but double-check no other references exist.
- **Remove** the `.fm-hover-tint` className from StudioCard — it's no longer needed since cards have their own bg color. Keep it on Deep Research if it still uses it.

---

## TASK 7: VERIFY

1. `pnpm build` — zero errors
2. `pnpm lint` — zero errors  
3. `pnpm test` — existing tests pass
4. Visual check:
   - Each card has its own bold, saturated color
   - Slides and Newsletter span 2 columns
   - Icons are clean SVG (no box around them)
   - Text is white (except Newsletter which is dark brown)
   - Hover lifts card with shadow, NOT scale
   - Tag badges are visible and readable
   - Works in both dark and light mode (the cards are self-contained — they don't depend on theme variables for their own background/text)

---

## ABSOLUTE CONSTRAINTS

**DO NOT:**
- Change the GenerateDialog component
- Change API routes
- Change the Deep Research card (leave it as-is)
- Change the saved outputs list at the bottom
- Add any new dependencies (Plus Jakarta Sans via next/font is OK)
- Use `backdrop-blur`, `glass`, or any transparency on the card backgrounds
- Add border to the cards — the color alone defines them
- Use unicode characters for icons — use Lucide React components

**Code style:**
- TypeScript strict, named exports
- `memo` on StudioCard (already there, keep it)
- Module-scope constants (CARD_COLORS, etc.)
- Use `color-mix(in srgb, ...)` for semi-transparent text/bg on buttons
