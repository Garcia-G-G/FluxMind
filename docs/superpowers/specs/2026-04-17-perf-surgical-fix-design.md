# Performance Surgical Fix — Scroll & Navigation Lag

**Date:** 2026-04-17
**Status:** Approved for implementation
**Scope:** Approach A from brainstorming — surgical fixes to the highest-cost offenders without redesigning the UI.

## Problem

User reports: "all the web feels super slow when I'm scrolling and going wherever I go it feels laggy."

Diagnosis found five major runtime-perf offenders:

1. `backdrop-filter: blur(20px)` on the fixed sidebar (`src/components/layout/sidebar.tsx:54`) — forces a GPU blur pass on every scroll frame for everything behind it.
2. `backdrop-filter: blur(20px)` on the sticky header (`src/components/layout/header.tsx:25`) — same issue, app-wide.
3. `backdrop-filter: blur(20px)` on every `GlassCard` (`src/components/shared/glass-card.tsx:32`) — each card is a heavy compositor layer; dashboards render many at once.
4. `AnimatedBackground` on marketing + auth layouts (`src/components/shared/animated-background.tsx`) — 7 huge blurred blobs, 24 constellation dots, 18 particles, 4 god rays, mesh SVG, noise overlay with `mix-blend-mode: overlay`, all infinite-animated. GPU-bound.
5. `motion.aside` width animation on sidebar collapse (`sidebar.tsx:49`) — animates `width` (layout property) instead of a cheaper CSS transition.

Plus one minor: `use-sources` polls every 3s while processing, causing frequent re-renders (`src/hooks/use-sources.ts:31`).

## Non-goals

- No changes to `tldraw`, `@xyflow/react`, `wavesurfer.js` bundle-splitting (deferred to approach B if needed).
- No visual redesign — colors, layout, and spacing stay identical.
- No DB / API / query changes.
- No removal of features.

## Changes

### 1. Sidebar — drop backdrop blur, lighter width transition
**File:** `src/components/layout/sidebar.tsx`

- Remove `backdropFilter: "blur(20px)"` from the aside style.
- Replace `motion.aside` with a plain `<aside>` using CSS `transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1)`.
- Keep existing `--fm-sidebar-bg` var (theme provider update in step 5 makes it opaque).

### 2. Header — drop backdrop blur
**File:** `src/components/layout/header.tsx`

- Remove `backdropFilter: "blur(20px)"` from the header style.
- Keep existing `--fm-header-bg` var (opaque via theme update).

### 3. GlassCard — gate blur, reduce cost
**File:** `src/components/shared/glass-card.tsx`

- Move blur off the inline `style` onto a CSS class gated by `@media (min-width: 1024px)` AND `@media (prefers-reduced-motion: no-preference)`.
- Reduce blur radius `20px` → `8px`.
- Below 1024px or when reduced-motion is requested, fall back to the solid `--fm-glass-bg` token.

### 4. AnimatedBackground — trim + respect reduced-motion
**File:** `src/components/shared/animated-background.tsx`

- If `window.matchMedia("(prefers-reduced-motion: reduce)").matches`, render `null` (empty div).
- Otherwise:
  - Blobs: 7 → 3 (keep `blob1`, `blob2`, `blob4`).
  - Particles: 18 → 0 (remove).
  - God rays: 4 → 0 (remove).
  - Remove `mix-blend-mode: overlay` on noise overlay.
  - Keep mesh SVG + noise + bottom gradient.

### 5. Theme tokens — opaque sidebar/header bg
**File:** `src/components/shared/theme-provider.tsx`

- `--fm-sidebar-bg`: dark `rgba(12,12,18,0.9)` → `#0c0c12`; light `rgba(248,247,244,0.95)` → `#f8f7f4`.
- `--fm-header-bg`: dark `rgba(8,8,12,0.8)` → `#08080c`; light `rgba(248,247,244,0.85)` → `#f8f7f4`.

### 6. Sources polling — reduce frequency
**File:** `src/hooks/use-sources.ts`

- Change `return hasProcessing ? 3000 : false;` → `5000`.

## Verification

1. `npx tsc --noEmit` must return 0 errors.
2. `pnpm dev` must start cleanly on port 4500.
3. Manual scroll test on: `/dashboard`, `/notebook/[id]`, `/settings`, `/` (marketing), `/login`.
4. Visual regression check: sidebar, header, and cards should look ≥95% identical (loss of translucency behind sidebar/header is acceptable).

## Risks

- **Loss of translucency** behind sidebar/header — acceptable per approach A tradeoff, opaque colors chosen to match the prior perceived tone.
- **AnimatedBackground looks less rich** — intentional; 3 blobs + mesh + noise still conveys the aesthetic without destroying perf.
- **GlassCard looks flat on mobile / reduced-motion** — intentional fallback; the design still works visually.

## Rollback

All changes are small and isolated per file. `git revert` on the single implementation commit reverses.
