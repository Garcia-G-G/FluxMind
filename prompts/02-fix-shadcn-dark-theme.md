# Prompt 02 — Fix shadcn Components for Dark Theme

> For Claude Code Max. Run in `/Users/go/Documents/FluxMind`. Read CLAUDE.md first.

## Problem

The shadcn/ui components (Dialog, Input, Button, Label) render with default white/light backgrounds that clash with FluxMind's dark glass theme. When the "Create Notebook" dialog opens, it looks like it belongs to a completely different app.

## Research Context

**Material Design 3 dark theme** uses `#121212` as the base surface, with elevated surfaces getting progressively lighter (not darker). Each elevation step adds ~5-8% luminance. Modals/overlays are the highest elevation level — they should be the lightest surface, not the darkest.

**Dark mode surface elevation standard** (from design systems research):
- Base background: L:10-12% (~`#141416` to `#1a1a2e`)
- Elevated surfaces (cards, sidebars): L:14-16%
- Overlay surfaces (modals, dialogs): L:22-26%
- The scrim behind modals: `rgba(0,0,0,0.5)` to `rgba(0,0,0,0.7)`

**FluxMind's existing tokens map to these levels:**
- `--fm-bg`: `#08080c` (base, L:~4% — very dark)
- `--fm-bg-secondary`: `#0f0f15` (L:~8%)
- `--fm-bg-tertiary`: `#16161f` (L:~12%)
- `--fm-surface`: `#1a1a2e` (cards, L:~16%)
- `--fm-surface-hover`: `#22223a` (hover, L:~21%)
- `--fm-glass-bg`: `rgba(12,12,18,0.85)` (semi-transparent surface)

Dialogs should use `--fm-surface` or `--fm-bg-tertiary` — NOT `--fm-glass-bg` (which is semi-transparent and would show content bleeding through).

## What to Do

### Step 1: Fix Dialog component

Read `src/components/ui/dialog.tsx`. Find the `DialogContent` component and override its default styling:

```tsx
// Add these style overrides to DialogContent's className or style prop:
// background: var(--fm-bg-secondary)
// border: 1px solid var(--fm-surface-border)
// color: var(--fm-text)
// border-radius: 16px
// box-shadow: 0 25px 60px rgba(0,0,0,0.5)
```

Also fix:
- `DialogTitle` → color: `var(--fm-text)`
- `DialogDescription` → color: `var(--fm-text-tertiary)`
- `DialogOverlay` / scrim → background: `rgba(0,0,0,0.6)`

### Step 2: Fix Input component

Read `src/components/ui/input.tsx`. The input should be theme-aware:

```css
background: var(--fm-input-bg);       /* rgba(255,255,255,0.04) in dark */
border: 1px solid var(--fm-input-border); /* rgba(255,255,255,0.08) in dark */
color: var(--fm-text);
border-radius: 10px;
/* Focus state: */
border-color: var(--fm-input-focus-border); /* #7c3aed */
```

Make sure placeholder text uses `var(--fm-text-tertiary)`.

### Step 3: Fix Button component

Read `src/components/ui/button.tsx`. Check the variants:
- `default` variant: should use `var(--fm-accent-orange)` background with white text
- `outline` variant: should use `transparent` background, `1px solid var(--fm-surface-border)`, color `var(--fm-text-secondary)`
- `destructive` variant: should use `var(--fm-error)` background
- `ghost` variant: should be transparent with `var(--fm-text-secondary)` color, hover `var(--fm-surface-hover)` background

### Step 4: Fix Label component

Read `src/components/ui/label.tsx`. Color should be `var(--fm-text-secondary)`.

### Step 5: Fix Sheet component

Read `src/components/ui/sheet.tsx`. Apply the same treatment as Dialog — `SheetContent` background should be `var(--fm-bg-secondary)` with proper border and text colors.

### Step 6: Fix DropdownMenu

Read `src/components/ui/dropdown-menu.tsx`. The `DropdownMenuContent` should use:
- background: `var(--fm-surface)`
- border: `1px solid var(--fm-surface-border)`
- border-radius: 12px
- Items on hover: `var(--fm-surface-hover)` background

## Rules
- Do NOT add backdrop-filter to any component
- Use CSS variables from the theme provider (`var(--fm-*)`)
- These are base components used everywhere — don't break existing usage
- Test by opening the Create Notebook dialog after changes — it should look native to the dark theme
- Run `pnpm build` at the end
