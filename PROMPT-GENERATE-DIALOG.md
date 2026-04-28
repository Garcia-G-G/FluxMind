# FluxMind — Claude Code Max: GENERATE DIALOG REDESIGN

> **Read `CLAUDE.md` first** for stack and code style rules.
> Every fix here is specific, with file paths and line numbers. No guessing.

---

## GOAL

Redesign `src/components/studio/generate-dialog.tsx` (946 lines) from a plain form-style dialog into **Design 2 "Visual Options"** — where style choices are large illustrated tiles, orientation is shown as mini infographic silhouettes, and the dialog adapts its sections based on the output type.

Reference design: `/generate-dialog-v3.html` (open in browser to see the 3 variants).

---

## WHAT'S ALREADY IN PLACE (DO NOT BREAK)

- `GenerateConfig` type (line 32-44): language, orientation, style, detailLevel, customPrompt, slideCount, accentColor, selectedSourceIds, extraSourceContent
- `VisualStyle` type imported from `@/lib/media/styles`: "auto" | "sketch" | "kawaii" | "professional" | "scientific" | "minimalist"
- `STYLE_OPTIONS`, `ORIENTATION_OPTIONS`, `DETAIL_OPTIONS`, `LANGUAGE_OPTIONS`, `ACCENT_OPTIONS` constants (lines 160-206)
- `SLIDE_COUNTS` constant (line 208)
- Sources section: `findSources()` function, discovered sources with favicon/domain/snippet display, scraping on submit
- `submit()` function (line 427) that scrapes discovered URLs and calls `onGenerate`
- All state variables (lines 285-312)
- `showOrientation`, `showStyle`, `showSlideCount`, `showAccent` conditional flags (lines 361-368)

---

## EXECUTION ORDER

1. Replace STYLE_ICONS with large illustrated SVG preview components
2. Redesign the dialog layout to match Design 2
3. Add the slide count stepper (replace pill buttons)
4. Style everything with CSS variables (theme-aware)
5. Verify

---

## TASK 1: REPLACE STYLE_ICONS WITH ILLUSTRATED SVG PREVIEWS

**File**: `src/components/studio/generate-dialog.tsx`

### 1A. Replace `STYLE_ICONS` (lines 57-157) with `STYLE_PREVIEWS`

Delete the entire `STYLE_ICONS` record and replace with large (64x64) illustrated SVG previews. Each preview should visually represent what that style produces:

```typescript
/** Large illustrated SVG previews — one per style. These go inside colored
 *  tile backgrounds so they use semi-transparent fills, not theme vars. */
const STYLE_PREVIEWS: Record<VisualStyle, React.ReactNode> = {
  auto: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* Sparkle/wand shape suggesting AI auto-pick */}
      <path d="M32 8L35 20L44 16L38 26L50 28L38 32L44 42L35 38L32 50L29 38L20 42L26 32L14 28L26 26L20 16L29 20Z" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.6)" strokeWidth="1"/>
      <circle cx="32" cy="28" r="4" fill="rgba(255,255,255,0.5)"/>
      <circle cx="18" cy="12" r="2" fill="rgba(255,255,255,0.3)"/>
      <circle cx="50" cy="46" r="1.5" fill="rgba(255,255,255,0.2)"/>
      <circle cx="12" cy="44" r="1" fill="rgba(255,255,255,0.15)"/>
    </svg>
  ),
  sketch: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* Hand-drawn: wobbly rectangle, sketchy lines, pencil */}
      <rect x="12" y="14" width="40" height="28" rx="2" fill="none" stroke="rgba(100,70,30,0.4)" strokeWidth="1.5" strokeDasharray="3 2"/>
      <path d="M18 22C20 21 23 23 26 22C29 21 32 23 36 22" stroke="rgba(100,70,30,0.35)" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M18 28C21 27 24 29 28 28C31 27 34 29 38 28" stroke="rgba(100,70,30,0.25)" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M18 34C22 33 25 35 30 34" stroke="rgba(100,70,30,0.2)" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M42 44L48 38L52 42L46 48Z" fill="rgba(100,70,30,0.3)"/>
      <path d="M41 45L42 44L46 48L45 49L40 50Z" fill="rgba(100,70,30,0.5)"/>
    </svg>
  ),
  kawaii: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* Cute face with anime eyes, blush cheeks, stars, heart */}
      <circle cx="32" cy="28" r="16" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
      <circle cx="26" cy="26" r="2.5" fill="rgba(80,40,100,0.6)"/>
      <circle cx="38" cy="26" r="2.5" fill="rgba(80,40,100,0.6)"/>
      <circle cx="27" cy="25" r="0.8" fill="rgba(255,255,255,0.8)"/>
      <circle cx="39" cy="25" r="0.8" fill="rgba(255,255,255,0.8)"/>
      <path d="M27 32C29 35 35 35 37 32" stroke="rgba(80,40,100,0.5)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <ellipse cx="22" cy="31" rx="3" ry="2" fill="rgba(244,63,94,0.2)"/>
      <ellipse cx="42" cy="31" rx="3" ry="2" fill="rgba(244,63,94,0.2)"/>
      <path d="M12 14L13.5 17L17 17.5L14.5 20L15 23.5L12 22L9 23.5L9.5 20L7 17.5L10.5 17Z" fill="rgba(255,255,255,0.4)"/>
      <path d="M50 10L51 12L53 12.3L51.5 14L52 16L50 15L48 16L48.5 14L47 12.3L49 12Z" fill="rgba(255,255,255,0.3)"/>
      <path d="M48 42C48 40 50 39 51 40.5C52 39 54 40 54 42C54 44 51 46 51 46C51 46 48 44 48 42Z" fill="rgba(255,255,255,0.35)"/>
    </svg>
  ),
  professional: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* Dashboard: top bar, left panel, right bar chart */}
      <rect x="8" y="10" width="48" height="6" rx="2" fill="rgba(255,255,255,0.08)"/>
      <rect x="11" y="12" width="12" height="2" rx="1" fill="rgba(255,255,255,0.2)"/>
      <rect x="8" y="20" width="20" height="34" rx="2" fill="rgba(255,255,255,0.05)"/>
      <rect x="12" y="24" width="12" height="2" rx="1" fill="rgba(255,255,255,0.15)"/>
      <rect x="12" y="29" width="10" height="1.5" rx="0.75" fill="rgba(255,255,255,0.08)"/>
      <rect x="12" y="33" width="8" height="1.5" rx="0.75" fill="rgba(255,255,255,0.06)"/>
      <rect x="32" y="20" width="24" height="34" rx="2" fill="rgba(255,255,255,0.04)"/>
      <rect x="36" y="36" width="4" height="14" rx="1" fill="rgba(100,180,255,0.3)"/>
      <rect x="42" y="30" width="4" height="20" rx="1" fill="rgba(100,180,255,0.4)"/>
      <rect x="48" y="26" width="4" height="24" rx="1" fill="rgba(100,180,255,0.5)"/>
    </svg>
  ),
  scientific: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* Molecule structure + data line */}
      <circle cx="24" cy="20" r="5" fill="rgba(27,94,32,0.15)" stroke="rgba(27,94,32,0.4)" strokeWidth="1.5"/>
      <circle cx="38" cy="14" r="3.5" fill="rgba(27,94,32,0.1)" stroke="rgba(27,94,32,0.3)" strokeWidth="1.2"/>
      <circle cx="16" cy="32" r="3.5" fill="rgba(27,94,32,0.1)" stroke="rgba(27,94,32,0.3)" strokeWidth="1.2"/>
      <circle cx="36" cy="28" r="3" fill="rgba(27,94,32,0.08)" stroke="rgba(27,94,32,0.25)" strokeWidth="1"/>
      <line x1="28" y1="17" x2="35" y2="15" stroke="rgba(27,94,32,0.3)" strokeWidth="1.2"/>
      <line x1="21" y1="24" x2="17" y2="29" stroke="rgba(27,94,32,0.3)" strokeWidth="1.2"/>
      <line x1="27" y1="24" x2="34" y2="26" stroke="rgba(27,94,32,0.25)" strokeWidth="1"/>
      <path d="M10 50L18 46L26 48L34 40L42 42L50 36L56 38" stroke="rgba(27,94,32,0.4)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <circle cx="18" cy="46" r="1.5" fill="rgba(27,94,32,0.5)"/>
      <circle cx="34" cy="40" r="1.5" fill="rgba(27,94,32,0.5)"/>
      <circle cx="50" cy="36" r="1.5" fill="rgba(27,94,32,0.5)"/>
    </svg>
  ),
  minimalist: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* Clean typography layout, maximum whitespace */}
      <rect x="14" y="16" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.3)"/>
      <rect x="14" y="24" width="36" height="1" rx="0.5" fill="rgba(255,255,255,0.08)"/>
      <rect x="14" y="30" width="32" height="1" rx="0.5" fill="rgba(255,255,255,0.06)"/>
      <rect x="14" y="36" width="28" height="1" rx="0.5" fill="rgba(255,255,255,0.04)"/>
      <rect x="14" y="44" width="16" height="2" rx="1" fill="rgba(255,255,255,0.15)"/>
    </svg>
  ),
};
```

### 1B. Add gradient backgrounds for each style tile

Add a constant mapping each style to its gradient background:

```typescript
const STYLE_GRADIENTS: Record<VisualStyle, string> = {
  auto: "linear-gradient(135deg, #667eea, #764ba2)",
  sketch: "linear-gradient(135deg, #f5ebe0, #ddb892)",
  kawaii: "linear-gradient(135deg, #fbc2eb, #a18cd1)",
  professional: "linear-gradient(135deg, #141e30, #243b55)",
  scientific: "linear-gradient(135deg, #d4f1d4, #81c784)",
  minimalist: "linear-gradient(135deg, #2a2a2a, #111)",
};

/** Styles where label text should be dark (light backgrounds). */
const STYLE_DARK_LABEL: Partial<Record<VisualStyle, string>> = {
  sketch: "#5a3e1a",
  scientific: "#1e4d1e",
};
```

---

## TASK 2: REDESIGN THE DIALOG LAYOUT

### 2A. Replace the orientation buttons (lines 502-528) with visual layout cards

Replace the current text-only buttons with SVG illustration cards showing what each layout looks like. Use a 3-column grid with visible mini-infographic silhouettes:

```tsx
{showOrientation && (
  <div className="flex flex-col gap-2">
    <span className="text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: "var(--fm-text-tertiary)" }}>
      Layout
    </span>
    <div className="grid grid-cols-3 gap-2.5">
      {ORIENTATION_OPTIONS.map((opt) => {
        const selected = orientation === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setOrientation(opt.value)}
            className="flex flex-col items-center gap-2 rounded-xl border p-3 transition-all"
            style={{
              borderColor: selected ? "var(--fm-accent-rose)" : "var(--fm-surface-border)",
              background: selected
                ? "color-mix(in srgb, var(--fm-accent-rose) 6%, transparent)"
                : "var(--fm-surface-elevated)",
            }}
            aria-pressed={selected}
          >
            {ORIENTATION_PREVIEWS[opt.value]}
            <span className="text-[11px] font-medium"
              style={{ color: selected ? "var(--fm-text)" : "var(--fm-text-tertiary)" }}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  </div>
)}
```

### 2B. Add `ORIENTATION_PREVIEWS` constant before the component

Create SVG previews for each orientation showing a mini-infographic silhouette:

```typescript
const ORIENTATION_PREVIEWS: Record<GenerateConfig["orientation"], React.ReactNode> = {
  horizontal: (
    <svg width="88" height="48" viewBox="0 0 88 48" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="86" height="46" rx="4" fill="var(--fm-surface)" stroke="var(--fm-surface-border)" strokeWidth="1"/>
      <rect x="6" y="6" width="28" height="4" rx="1.5" fill="var(--fm-accent-rose)" fillOpacity="0.4"/>
      <rect x="6" y="13" width="18" height="2" rx="1" fill="var(--fm-text-tertiary)" fillOpacity="0.3"/>
      <rect x="6" y="20" width="22" height="20" rx="3" fill="var(--fm-accent-rose)" fillOpacity="0.12"/>
      <rect x="32" y="20" width="22" height="20" rx="3" fill="var(--fm-accent-rose)" fillOpacity="0.09"/>
      <rect x="58" y="20" width="22" height="20" rx="3" fill="var(--fm-accent-rose)" fillOpacity="0.06"/>
    </svg>
  ),
  vertical: (
    <svg width="36" height="60" viewBox="0 0 36 60" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="34" height="58" rx="4" fill="var(--fm-surface)" stroke="var(--fm-surface-border)" strokeWidth="1"/>
      <rect x="5" y="5" width="16" height="3" rx="1.5" fill="var(--fm-text-tertiary)" fillOpacity="0.3"/>
      <rect x="5" y="12" width="26" height="10" rx="2" fill="var(--fm-text-tertiary)" fillOpacity="0.08"/>
      <rect x="5" y="25" width="26" height="10" rx="2" fill="var(--fm-text-tertiary)" fillOpacity="0.06"/>
      <rect x="5" y="38" width="26" height="10" rx="2" fill="var(--fm-text-tertiary)" fillOpacity="0.04"/>
    </svg>
  ),
  square: (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="50" height="50" rx="4" fill="var(--fm-surface)" stroke="var(--fm-surface-border)" strokeWidth="1"/>
      <rect x="6" y="6" width="18" height="3" rx="1.5" fill="var(--fm-text-tertiary)" fillOpacity="0.3"/>
      <rect x="6" y="14" width="18" height="14" rx="2" fill="var(--fm-text-tertiary)" fillOpacity="0.08"/>
      <rect x="28" y="14" width="18" height="14" rx="2" fill="var(--fm-text-tertiary)" fillOpacity="0.06"/>
      <rect x="6" y="32" width="18" height="14" rx="2" fill="var(--fm-text-tertiary)" fillOpacity="0.05"/>
      <rect x="28" y="32" width="18" height="14" rx="2" fill="var(--fm-text-tertiary)" fillOpacity="0.04"/>
    </svg>
  ),
};
```

### 2C. Replace style tile buttons (lines 531-574) with colored gradient tiles

Replace the current small icon+label buttons with large aspect-ratio-square tiles that have gradient backgrounds and the new illustrated SVG previews:

```tsx
{showStyle && (
  <div className="flex flex-col gap-2">
    <span className="text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: "var(--fm-text-tertiary)" }}>
      Visual style
    </span>
    <div className="grid grid-cols-3 gap-2.5">
      {STYLE_OPTIONS.map((opt) => {
        const selected = style === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStyle(opt.value)}
            className="relative flex flex-col items-center justify-end rounded-xl border-2 transition-all overflow-hidden"
            style={{
              aspectRatio: "1",
              background: STYLE_GRADIENTS[opt.value],
              borderColor: selected ? "#fff" : "transparent",
              boxShadow: selected ? "0 0 0 1px rgba(255,255,255,0.3)" : "none",
            }}
            aria-pressed={selected}
          >
            <div className="flex-1 flex items-center justify-center p-3">
              {STYLE_PREVIEWS[opt.value]}
            </div>
            <span className="pb-2.5 text-[11px] font-semibold relative z-[1]"
              style={{
                color: STYLE_DARK_LABEL[opt.value] ?? "#fff",
                textShadow: STYLE_DARK_LABEL[opt.value] ? "none" : "0 1px 4px rgba(0,0,0,0.4)",
              }}>
              {opt.label}
            </span>
            {selected && (
              <span className="absolute top-1.5 right-1.5 w-[18px] h-[18px] rounded-full bg-white flex items-center justify-center z-[2]">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1e1c1a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  </div>
)}
```

### 2D. Replace detail level buttons (lines 577-599) with a segmented bar

Replace the 3 separate buttons with a connected segmented bar with sub-descriptions:

```tsx
<div className="flex flex-col gap-2">
  <span className="text-[10px] font-semibold uppercase tracking-wider"
    style={{ color: "var(--fm-text-tertiary)" }}>
    Content depth
  </span>
  <div className="flex rounded-xl overflow-hidden border"
    style={{ borderColor: "var(--fm-surface-border)", height: 48 }}>
    {DETAIL_OPTIONS.map((opt, i) => {
      const selected = detailLevel === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => setDetailLevel(opt.value)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
          style={{
            background: selected
              ? "color-mix(in srgb, var(--fm-accent-rose) 10%, transparent)"
              : "var(--fm-surface-elevated)",
            borderRight: i < DETAIL_OPTIONS.length - 1
              ? "1px solid var(--fm-surface-border)"
              : "none",
          }}
          aria-pressed={selected}
        >
          <span className="text-xs font-semibold"
            style={{ color: selected ? "var(--fm-text)" : "var(--fm-text-tertiary)" }}>
            {opt.label}
          </span>
          <span className="text-[9px]"
            style={{ color: selected ? "var(--fm-text-secondary)" : "var(--fm-text-tertiary)" }}>
            {DETAIL_DESCRIPTIONS[opt.value]}
          </span>
        </button>
      );
    })}
  </div>
</div>
```

Add this constant near the other option constants:

```typescript
const DETAIL_DESCRIPTIONS: Record<GenerateConfig["detailLevel"], string> = {
  concise: "Key points only",
  standard: "Balanced",
  detailed: "Deep dive",
};
```

---

## TASK 3: SLIDE COUNT STEPPER

### 3A. Replace slide count pills (lines 602-639) with a stepper

Replace the current 5 fixed-value pill buttons with a +/- stepper:

```tsx
{showSlideCount && (
  <div className="flex flex-col gap-2">
    <span className="text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: "var(--fm-text-tertiary)" }}>
      Number of slides
    </span>
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setSlideCount(Math.max(4, slideCount - 2))}
        disabled={slideCount <= 4}
        className="w-8 h-8 rounded-lg border flex items-center justify-center text-base transition-colors disabled:opacity-30"
        style={{
          background: "var(--fm-surface-elevated)",
          borderColor: "var(--fm-surface-border)",
          color: "var(--fm-text-secondary)",
        }}
      >
        −
      </button>
      <span className="text-xl font-bold min-w-[32px] text-center"
        style={{ color: "var(--fm-text)" }}>
        {slideCount}
      </span>
      <button
        type="button"
        onClick={() => setSlideCount(Math.min(20, slideCount + 2))}
        disabled={slideCount >= 20}
        className="w-8 h-8 rounded-lg border flex items-center justify-center text-base transition-colors disabled:opacity-30"
        style={{
          background: "var(--fm-surface-elevated)",
          borderColor: "var(--fm-surface-border)",
          color: "var(--fm-text-secondary)",
        }}
      >
        +
      </button>
      <span className="text-[11px]" style={{ color: "var(--fm-text-tertiary)" }}>
        slides
      </span>
    </div>
  </div>
)}
```

### 3B. Remove `SLIDE_COUNTS` constant (line 208)

It's no longer needed. Delete: `const SLIDE_COUNTS: readonly number[] = [4, 6, 8, 10, 12] as const;`

---

## TASK 4: POLISH AND SECTION LABELS

### 4A. Change section labels to uppercase tracking style

Replace `sectionLabelClass` (line 252) and `sectionLabelStyle` (line 253):

```typescript
const sectionLabelClass = "text-[10px] font-semibold uppercase tracking-wider";
const sectionLabelStyle = { color: "var(--fm-text-tertiary)" } as const;
```

### 4B. Wrap sources section in a collapsible (optional — only if time)

The sources section at lines 700-896 is already functional. The main improvement is to **wrap it behind a collapsible header** like in the mockup. Add a `sourcesExpanded` state:

```typescript
const [sourcesExpanded, setSourcesExpanded] = useState<boolean>(false);
```

Then wrap the sources `<div>` with a toggle header showing the count.

### 4C. Language pills instead of full buttons

Replace the current 2-column grid language buttons (lines 680-696) with compact pills in a row:

```tsx
<div className="flex flex-col gap-2">
  <span className={sectionLabelClass} style={sectionLabelStyle}>Language</span>
  <div className="flex gap-1.5">
    {LANGUAGE_OPTIONS.map((opt) => {
      const selected = language === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => setLanguage(opt.value)}
          className="h-7 px-3.5 rounded-full text-xs font-medium border transition-colors"
          style={{
            background: selected ? "var(--fm-text)" : "transparent",
            color: selected ? "var(--fm-bg)" : "var(--fm-text-tertiary)",
            borderColor: selected ? "var(--fm-text)" : "var(--fm-surface-border)",
          }}
        >
          {opt.value.toUpperCase()}
        </button>
      );
    })}
  </div>
</div>
```

### 4D. Put accent + language on the same row

If both accent and language are shown, render them side by side:

```tsx
<div className="flex gap-5">
  {showAccent && (
    <div className="flex-1 flex flex-col gap-2">
      <span className={sectionLabelClass} style={sectionLabelStyle}>Accent</span>
      <div className="flex gap-1.5">
        {ACCENT_OPTIONS.map((opt) => { /* ... existing dots ... */ })}
      </div>
    </div>
  )}
  <div className="flex flex-col gap-2">
    <span className={sectionLabelClass} style={sectionLabelStyle}>Language</span>
    {/* ... pills from 4C ... */}
  </div>
</div>
```

### 4E. Generate button — colored by output type

Replace the generic Button at the bottom (lines 927-939) with a styled button whose background matches the output type color. Add a constant:

```typescript
const OUTPUT_ACCENT: Record<OutputType, string> = {
  slides: "#FF7A45",
  infographic: "#F43F5E",
  video: "#EC4899",
  mindmap: "#10B981",
  flashcards: "#3B82F6",
  quiz: "#8B5CF6",
  thread: "#0EA5E9",
  newsletter: "#F59E0B",
  reel: "#EC4899",
  course: "#A855F7",
  datatable: "#64748B",
};
```

Use it for the Generate button background and the type dot in the header.

### 4F. Summary bar above the Generate button

Add a summary line between the form and the button showing current selections at a glance:

```tsx
<div className="mt-3 flex items-center justify-between border-t pt-3"
  style={{ borderColor: "var(--fm-surface-border)" }}>
  <span className="text-[11px]" style={{ color: "var(--fm-text-tertiary)" }}>
    {[
      showOrientation && orientation.charAt(0).toUpperCase() + orientation.slice(1),
      showStyle && style.charAt(0).toUpperCase() + style.slice(1),
      showSlideCount && `${slideCount} slides`,
      detailLevel.charAt(0).toUpperCase() + detailLevel.slice(1),
      `${existingSources.filter(s => selectedSourceIds.has(s.id)).length + selectedDiscoveredUrls.size} sources`,
    ].filter(Boolean).join(" · ")}
  </span>
  {/* Generate button here */}
</div>
```

---

## TASK 5: VERIFY

1. **`pnpm build`** — zero errors
2. **`pnpm lint`** — zero errors
3. **`pnpm test`** — existing tests pass
4. **Check visual:**
   - Open the dialog for `infographic` → should show Layout + Style + Depth + Accent/Language + Sources
   - Open for `slides` → should show Style + Slide count stepper + Depth + Accent/Language + Sources
   - Open for `quiz` → should show only Depth + Language + Sources (no style, no orientation, no accent)
   - Style tiles show gradient backgrounds with illustrated SVG previews
   - Orientation cards show mini-infographic silhouettes
   - Detail bar is a connected segmented control
   - Generate button is colored by output type

---

## GUIDELINES

You have full freedom to modify types, props, logic, or anything else needed. If `GenerateConfig` needs a new field, add it. If `submit()` needs adjustment, adjust it. The instructions above are a detailed starting point — not restrictions.

**Key goals:**
- Style tiles must use gradient backgrounds with illustrated SVG previews (not plain text buttons)
- Orientation must show visual silhouettes (not text labels)
- Detail must be a segmented bar (not 3 separate buttons)
- Slide count must be a +/- stepper (not fixed pills)
- The dialog must adapt sections based on output type
- Reference design: `/generate-dialog-v3.html`
- `pnpm build && pnpm lint && pnpm test` must all pass
