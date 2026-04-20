# Prompt 01 — Fix Sidebar Navigation

> For Claude Code Max. Run in `/Users/go/Documents/FluxMind`. Read CLAUDE.md first.

## Problem

The sidebar at `src/components/layout/sidebar.tsx` has a critical bug: ALL five nav items point to `/dashboard`. "All Notebooks", "Recent", "Shared with Me", "Starred" are all dead links. Nothing happens when you click them.

## Research Context

**Notion's sidebar** (224px wide) groups items into logical sections: workspace-level tools at top (Search, Home, Inbox), then Favorites, then Shared, then Private — each section is collapsible with its own header. Active item gets a subtle background fill (not a bold highlight), and hover state is even lighter. Everything follows an 8px grid.

**Linear's sidebar** dims navigation to reduce visual weight — the content area should take precedence. Their recent redesign made the sidebar "recede" while keeping it functional. Active items have a subtle background, not a heavy indicator. They allow users to reorder and hide sidebar items.

**Key pattern across premium apps**: sidebar items that don't have their own page use filters/views within the same page, not separate routes. Notion's "Favorites" and "Shared" are filters on the same page list, not different URLs.

## What to Do

### Step 1: Add view filtering to the dashboard

Read `src/app/(app)/dashboard/page.tsx`. The dashboard currently shows all notebooks. Add URL-based filtering using query parameters.

Use `useSearchParams()` from `next/navigation` to read a `view` param:
- No param or `view=all` → show all notebooks (current behavior)
- `view=recent` → same as all, sorted by updatedAt desc (semantic alias)
- `view=starred` → filter to `notebook.starred === true` (check if the field exists in the schema at `src/db/schema/notebooks.ts` — if it doesn't exist, show an empty state: "No starred notebooks yet. Star a notebook to find it here.")
- `view=shared` → show empty state: "No shared notebooks yet. Notebooks shared with you will appear here."

Add a `starred` boolean field to the notebooks schema if it doesn't exist. Create a migration.

### Step 2: Fix the sidebar navItems

Change the sidebar to use proper hrefs with query params:

```typescript
const navItems = [
  { href: "/dashboard", icon: LayoutGrid, label: "Dashboard", color: "#ff6b35", view: undefined },
  { href: "/dashboard?view=all", icon: BookOpen, label: "All Notebooks", color: "#7c3aed", view: "all" },
  { href: "/dashboard?view=recent", icon: Clock, label: "Recent", color: "#2563eb", view: "recent" },
  { href: "/dashboard?view=shared", icon: Users, label: "Shared with Me", color: "#22c55e", view: "shared" },
  { href: "/dashboard?view=starred", icon: Star, label: "Starred", color: "#f59e0b", view: "starred" },
];
```

### Step 3: Fix isActive detection

Replace the hardcoded `idx === 0 && pathname === "/dashboard"` with proper detection:

```typescript
const searchParams = useSearchParams();
const currentView = searchParams.get("view");

// Inside the map:
const isActive = pathname === "/dashboard" && (
  item.view === undefined ? !currentView : currentView === item.view
);
```

When a user is on `/notebook/[id]` (pathname starts with `/notebook/`), NO sidebar nav items should be active — but the notebook should appear highlighted in the "Recent Notebooks" section at the bottom.

### Step 4: Add hover state

Following Linear's approach of subtle, receding navigation — every nav item should have a hover background:

```typescript
style={{
  borderRadius: 10,
  color: isActive ? "var(--fm-text)" : "var(--fm-text-secondary)",
  background: isActive ? "var(--fm-surface-hover)" : undefined,
  fontWeight: isActive ? 500 : 400,
}}
// Add onMouseEnter/Leave or use CSS :hover via a class
```

Add a CSS class `fm-sidebar-item` to `src/styles/animations.css`:
```css
.fm-sidebar-item:hover {
  background: var(--fm-surface-hover);
}
```

### Step 5: Highlight active notebook in Recent section

When `pathname` starts with `/notebook/`, find that notebook in the recent list and give it the active styling (subtle background + left accent bar).

## Rules
- Keep the collapsed/expanded behavior working
- Don't break the "New Notebook" button or Settings link
- Use `var(--fm-*)` tokens, never hardcode colors
- Wrap the page component with `<Suspense>` if `useSearchParams()` requires it (Next.js 15 does)
- Run `pnpm build` at the end
