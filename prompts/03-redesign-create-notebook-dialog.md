# Prompt 03 — Redesign Create Notebook Dialog

> For Claude Code Max. Run in `/Users/go/Documents/FluxMind`. Read CLAUDE.md first.
> **Prerequisite**: Run prompt 02 first (fixes base Dialog/Input/Button theming).

## Problem

The Create Notebook dialog at `src/components/notebook/create-notebook-dialog.tsx` uses emoji icons that look amateur and doesn't match the FluxMind premium aesthetic. The overall layout, field styling, and button design all need work.

## Research Context

**Linear's project creation** is intentionally minimal: project name is the only required field. Icon and color are optional customization. Their modal avoids clutter — "clean and purposefully minimal, avoiding clutter with no busy sidebars, pop-ups, or tabs to manage." They use an icons + emoji picker with improved keyboard navigation.

**NotebookLM's notebook creation** is even simpler: just click "Create new" — no modal at all. The title is edited inline after creation. Source upload happens on the next screen, not in the creation flow.

**Modal UX best practices** (from research):
- Information structured into separate blocks for easy scanning
- Clear visual hierarchy with high-contrast titles and subtle subtitles
- Primary action button larger and more prominent than secondary
- Keep text minimal and well-organized
- Avoid borders in dark mode for depth — use surface color stepping instead

**Key insight**: FluxMind currently shows Title + Description + 16 emoji icons + 6 color circles = too much visual noise. Linear proves you only need Name + optional icon/color.

## What to Do

### Step 1: Simplify the layout

The dialog should have 3 sections, not 4:
1. **Title** (required) — single input, auto-focused
2. **Icon + Color** (combined in one row) — icon selector + color dots on the same line
3. **Action buttons** — Cancel + Create

Remove the Description field from the creation dialog. Users can add a description later from the notebook settings. This follows the "get out of the way" pattern from NotebookLM.

### Step 2: Replace emojis with Lucide icons

The current EMOJI_OPTIONS array uses emojis ("📓", "📚", "🧠"...) which look unprofessional and render differently across platforms.

Replace with Lucide icons. Use this list:
```typescript
import {
  BookOpen, Brain, Beaker, Lightbulb, GraduationCap, Code,
  PenTool, Rocket, Globe, Briefcase, Palette, Zap,
} from "lucide-react";

const ICON_OPTIONS = [
  { name: "BookOpen", icon: BookOpen },
  { name: "Brain", icon: Brain },
  { name: "Beaker", icon: Beaker },
  { name: "Lightbulb", icon: Lightbulb },
  { name: "GraduationCap", icon: GraduationCap },
  { name: "Code", icon: Code },
  { name: "PenTool", icon: PenTool },
  { name: "Rocket", icon: Rocket },
  { name: "Globe", icon: Globe },
  { name: "Briefcase", icon: Briefcase },
  { name: "Palette", icon: Palette },
  { name: "Zap", icon: Zap },
];
```

Store the icon NAME string in the database (e.g. `"BookOpen"`) instead of emoji. The database `icon` column is already a text field so this works.

Each icon tile: 36px × 36px, border-radius 10px.
- Default: `background: transparent`, `color: var(--fm-text-tertiary)`
- Hover: `background: var(--fm-surface-hover)`
- Selected: `background` tinted with the selected color at 15% opacity, `color` = selected color, `border: 1px solid` at 30% opacity of selected color

### Step 3: Update color palette

Replace `COLOR_OPTIONS` with FluxMind brand colors:
```typescript
const COLOR_OPTIONS = [
  "#ff6b35", "#e11d48", "#7c3aed", "#2563eb", "#22c55e", "#f59e0b",
];
```

Style: 28px circles, rounded-full. Selected = ring-2 of the same color + scale-110.

### Step 4: Combine Icon + Color on one row

Layout the icon grid (12 icons in a 6×2 grid) with the color dots below or beside it — not in separate labeled sections. Use a single label like "Customize" or no label at all.

### Step 5: Style the Create button

- Primary "Create" button: `background: var(--fm-accent-orange)`, `color: white`, `border-radius: 10px`, `font-weight: 500`
- Hover: `filter: brightness(1.1)`, `transform: translateY(-1px)`
- Cancel button: `background: transparent`, `border: 1px solid var(--fm-surface-border)`, `color: var(--fm-text-secondary)`, `border-radius: 10px`

### Step 6: Add a live preview

At the top of the dialog (before the title input), show a small preview of how the notebook card will look:

```tsx
<div className="flex items-center gap-3 mb-6 p-3 rounded-xl"
  style={{ background: "var(--fm-surface)", border: "1px solid var(--fm-surface-border)" }}>
  <div className="h-10 w-10 rounded-xl flex items-center justify-center"
    style={{ background: `${color}20` }}>
    <SelectedIcon className="h-5 w-5" style={{ color }} />
  </div>
  <span className="text-sm font-medium" style={{ color: "var(--fm-text)" }}>
    {title || "Untitled notebook"}
  </span>
</div>
```

This gives immediate visual feedback as the user types and selects icon/color.

### Step 7: Fix Edit and Delete dialogs too

Apply the same treatment to:
- `src/components/notebook/edit-notebook-dialog.tsx` — same input styling, use Lucide icons instead of emojis
- `src/components/notebook/delete-notebook-dialog.tsx` — destructive button uses `var(--fm-error)` background

### Step 8: Create icon resolver utility

Since we're storing icon names as strings, create a utility to resolve them:

`src/lib/icon-resolver.ts`:
```typescript
import {
  BookOpen, Brain, Beaker, Lightbulb, GraduationCap, Code,
  PenTool, Rocket, Globe, Briefcase, Palette, Zap,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  BookOpen, Brain, Beaker, Lightbulb, GraduationCap, Code,
  PenTool, Rocket, Globe, Briefcase, Palette, Zap,
};

export const resolveIcon = (name: string): LucideIcon => {
  return iconMap[name] ?? BookOpen;
};
```

Use this in the dashboard notebook cards (`src/app/(app)/dashboard/page.tsx`) to render the correct icon instead of the `CARD_ICONS` array cycling.

### Step 9: Update dashboard to use notebook's own icon

In the dashboard page, the notebook cards currently use `CARD_ICONS[i % CARD_ICONS.length]` to assign icons. Instead, use the notebook's stored icon:

```typescript
import { resolveIcon } from "@/lib/icon-resolver";

// Inside the notebook map:
const CardIcon = resolveIcon(notebook.icon ?? "BookOpen");
```

## Rules
- Do NOT use emojis anywhere
- Keep the form validation working (createNotebookSchema)
- Keep the router.push after creation
- Use var(--fm-*) tokens only
- No backdrop-filter
- Run `pnpm build` at the end
