# Prompt 04 — Studio Page Premium Upgrade

> For Claude Code Max. Run in `/Users/go/Documents/FluxMind`. Read CLAUDE.md first.

## Problem

The Studio page at `src/app/(app)/notebook/[id]/studio/page.tsx` uses generic shadcn classes (`border border-border bg-card`) that don't match the FluxMind dark glass design system. The cards look like default components, not premium UI.

## Research Context

**Surface elevation in dark themes**: Cards should step up in luminance from the background. FluxMind's background is `#08080c` (very dark), so cards at `var(--fm-glass-bg)` = `rgba(12,12,18,0.85)` provide the right subtle lift. The key is using tonal elevation (lighter surfaces = higher) not shadow elevation.

**Linear's card design**: Cards in Linear use minimal borders (1px, very low opacity), subtle background differentiation, and hover states that slightly lift (translateY) or brighten. No heavy shadows. The content inside uses clear typographic hierarchy.

**Section grouping pattern**: Linear and Notion both use small, muted section headers (11-12px, uppercase, tracking-wider) with subtle visual separators. NOT heavy headers — they should recede and let the cards be the focus.

## What to Do

### Step 1: Rewrite StudioCard

The internal `StudioCard` component currently uses `className="rounded-lg border border-border bg-card p-4"`. Rewrite it to use the FluxMind token system:

Container:
- `background: var(--fm-glass-bg)`
- `border: 1px solid var(--fm-glass-border)`
- `box-shadow: var(--fm-card-shadow)`
- `border-radius: 16px` (rounded-2xl)
- `padding: 20px`
- Hover: `transform: translateY(-2px)` with transition

Top accent line (2px height at the very top of the card):
- `background: linear-gradient(90deg, ${accent}, transparent)`
- This creates a colored signature per card

Icon tile (40px):
- `background: color-mix(in srgb, ${accent} 15%, transparent)` — or `${accent}26` as hex alpha
- `border-radius: 12px`
- Icon inside at `h-5 w-5` colored with the accent

Add an `accent` prop (string, CSS color) to each StudioCard.

Generate button:
- `background: ${accent}` (solid, no gradient)
- `color: white`, `border-radius: 8px`, `font-size: 12px`
- Hover: `brightness(1.1) translateY(-1px)`

View button:
- `background: var(--fm-surface)`
- `border: 1px solid var(--fm-surface-border)`
- `color: var(--fm-text-secondary)`

### Step 2: Assign accent colors

Each output type gets its own accent from the FluxMind palette:

Study section:
- Quiz → `var(--fm-accent-violet)` (#7c3aed)
- Flashcards → `var(--fm-accent-blue)` (#2563eb)
- Mini-Course → `var(--fm-accent-rose)` (#e11d48)

Visual section:
- Slide Deck → `var(--fm-accent-orange)` (#ff6b35)
- Infographic → `var(--fm-accent-rose)` (#e11d48)
- Data Tables → `var(--fm-accent-blue)` (#2563eb)
- Mind Map → `var(--fm-accent-violet)` (#7c3aed)
- Video Overview → `var(--fm-accent-orange)` (#ff6b35)

Content section:
- X Thread → `var(--fm-accent-blue)` (#2563eb)
- Newsletter → `var(--fm-accent-violet)` (#7c3aed)
- Reel Script → `var(--fm-accent-rose)` (#e11d48)

### Step 3: Restyle section headers

Replace:
```tsx
<h3 className="text-sm font-medium text-muted-foreground mb-2">Study</h3>
```

With:
```tsx
<div className="flex items-center gap-2 mb-4 mt-2">
  <div style={{ width: 20, height: 1, background: sectionAccent }} />
  <span className="text-[11px] font-medium uppercase tracking-widest"
    style={{ color: "var(--fm-text-tertiary)" }}>
    Study
  </span>
</div>
```

Section accents: Study = violet, Visual = orange, Content = blue.

### Step 4: Restyle page header

Replace:
```tsx
<h2 className="text-xl font-semibold mb-1">Studio</h2>
<p className="text-sm text-muted-foreground mb-6">...</p>
```

With:
```tsx
<h2 className="font-display text-3xl font-normal tracking-tight"
  style={{ color: "var(--fm-text)" }}>
  Studio
</h2>
<p className="text-sm mt-2 mb-8" style={{ color: "var(--fm-text-tertiary)" }}>
  Generate study materials, presentations, and content from your sources.
</p>
```

### Step 5: Restyle Deep Research card

The standalone Deep Research card at the bottom uses `className="rounded-lg border border-border bg-card p-4"`. Apply the same glass treatment:

```tsx
<div className="rounded-2xl p-5 mt-2"
  style={{
    background: "var(--fm-glass-bg)",
    border: "1px solid var(--fm-glass-border)",
    boxShadow: "var(--fm-card-shadow)",
  }}>
```

## Rules
- Do NOT change any generation/mutation logic — only visual
- No backdrop-filter
- Use var(--fm-*) tokens
- Run `pnpm build` at the end
