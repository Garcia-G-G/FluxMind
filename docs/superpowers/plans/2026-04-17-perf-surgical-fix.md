# Performance Surgical Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate scroll and navigation lag by removing the highest-cost backdrop-filter blurs and animation loops, without changing the visual design.

**Architecture:** Pure client-side style changes. Replace `backdrop-filter: blur()` on always-visible surfaces (sidebar, header, glass cards) with solid theme-token backgrounds. Trim `AnimatedBackground` and respect `prefers-reduced-motion`. Swap JS-driven width animation for CSS transition. Slow a noisy poll interval.

**Tech Stack:** Next.js 15.5.15, React 19.2.5, Motion (Framer), CSS.

**Verification model:** This is a UI/perf refactor, not new behavior. There are no unit tests to write — verification per task is `npx tsc --noEmit` passing and visual correctness (user scroll-tests after all tasks land). A final dev-server smoke check runs after the last task.

---

## File Structure

Six existing files are modified; no new files.

- `src/components/layout/sidebar.tsx` — drop blur, swap `motion.aside` → `<aside>` + CSS transition.
- `src/components/layout/header.tsx` — drop blur.
- `src/components/shared/glass-card.tsx` — gate blur behind media query + reduced-motion, reduce radius.
- `src/components/shared/animated-background.tsx` — respect `prefers-reduced-motion`, trim blobs/particles/rays.
- `src/components/shared/theme-provider.tsx` — opaque sidebar/header bg tokens.
- `src/hooks/use-sources.ts` — raise polling interval 3s → 5s.

---

### Task 1: Remove backdrop-filter from the sticky Header

**Files:**
- Modify: `src/components/layout/header.tsx:21-28`

- [ ] **Step 1: Edit header.tsx to drop `backdropFilter`**

Change the header `style` block from:

```tsx
<header
  className="h-[60px] flex items-center justify-between px-4 sticky top-0 z-20"
  style={{
    background: "var(--fm-header-bg)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid var(--fm-header-border)",
  }}
>
```

to:

```tsx
<header
  className="h-[60px] flex items-center justify-between px-4 sticky top-0 z-20"
  style={{
    background: "var(--fm-header-bg)",
    borderBottom: "1px solid var(--fm-header-border)",
  }}
>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "perf(header): drop backdrop-filter blur to eliminate scroll-time recomposite"
```

---

### Task 2: Remove backdrop-filter from the fixed Sidebar + swap width animation to CSS

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Remove `motion` from aside element + drop `backdropFilter`**

Find:

```tsx
    <motion.aside
      animate={{ width: collapsed ? 60 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="hidden md:flex flex-col h-screen fixed left-0 top-0 z-30"
      style={{
        background: "var(--fm-sidebar-bg)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid var(--fm-sidebar-border)",
      }}
    >
```

Replace with:

```tsx
    <aside
      className="hidden md:flex flex-col h-screen fixed left-0 top-0 z-30"
      style={{
        width: collapsed ? 60 : 240,
        background: "var(--fm-sidebar-bg)",
        borderRight: "1px solid var(--fm-sidebar-border)",
        transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
```

- [ ] **Step 2: Close the element with `</aside>` (was `</motion.aside>`)**

At the end of the component's returned JSX, change `</motion.aside>` to `</aside>`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors. (The remaining `motion.span` / `motion.div` usages for label fades keep Motion imported — leave the `import { motion } from "motion/react";` line as-is.)

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "perf(sidebar): drop backdrop-filter and replace width animation with CSS transition"
```

---

### Task 3: Make sidebar and header background tokens fully opaque

**Files:**
- Modify: `src/components/shared/theme-provider.tsx`

- [ ] **Step 1: Edit `darkTokens`**

In `darkTokens` object (~line 51-53), change:

```ts
  "--fm-sidebar-bg": "rgba(12,12,18,0.9)",
```

to:

```ts
  "--fm-sidebar-bg": "#0c0c12",
```

And change:

```ts
  "--fm-header-bg": "rgba(8,8,12,0.8)",
```

to:

```ts
  "--fm-header-bg": "#08080c",
```

- [ ] **Step 2: Edit `lightTokens`**

In `lightTokens` object (~line 100-103), change:

```ts
  "--fm-sidebar-bg": "rgba(248,247,244,0.95)",
```

to:

```ts
  "--fm-sidebar-bg": "#f8f7f4",
```

And change:

```ts
  "--fm-header-bg": "rgba(248,247,244,0.85)",
```

to:

```ts
  "--fm-header-bg": "#f8f7f4",
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/theme-provider.tsx
git commit -m "style(theme): make sidebar/header bg tokens opaque now that blur is gone"
```

---

### Task 4: GlassCard — gate blur behind large screens + reduced-motion preference, reduce radius

**Files:**
- Modify: `src/components/shared/glass-card.tsx`
- Modify: `src/styles/animations.css` (add new utility class)

- [ ] **Step 1: Add a gated blur utility class to `src/styles/animations.css`**

Append to the end of `src/styles/animations.css`:

```css
/* === GlassCard blur — opt-in, only on large screens with motion on === */
.fm-glass-blur {
  background: var(--fm-glass-bg, rgba(20, 20, 35, 0.6));
}
@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  .fm-glass-blur {
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
}
```

- [ ] **Step 2: Remove inline backdrop-filter from `GlassCard`, add class**

In `src/components/shared/glass-card.tsx` (~lines 21-40), change:

```tsx
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl",
          paddingMap[padding],
          hover && "transition-transform duration-300 hover:-translate-y-1",
          className
        )}
        style={{
          background: "var(--fm-glass-bg, rgba(20,20,35,0.6))",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid var(--fm-glass-border, rgba(255,255,255,0.08))",
          boxShadow: "var(--fm-card-shadow, 0 4px 24px rgba(0,0,0,0.3))",
        }}
      >
        {children}
      </div>
    );
```

to:

```tsx
    return (
      <div
        ref={ref}
        className={cn(
          "fm-glass-blur rounded-2xl",
          paddingMap[padding],
          hover && "transition-transform duration-300 hover:-translate-y-1",
          className
        )}
        style={{
          border: "1px solid var(--fm-glass-border, rgba(255,255,255,0.08))",
          boxShadow: "var(--fm-card-shadow, 0 4px 24px rgba(0,0,0,0.3))",
        }}
      >
        {children}
      </div>
    );
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/glass-card.tsx src/styles/animations.css
git commit -m "perf(glass-card): gate blur behind >=1024px + motion-on, cut radius 20->8"
```

---

### Task 5: AnimatedBackground — trim layers and honor prefers-reduced-motion

**Files:**
- Modify: `src/components/shared/animated-background.tsx`

- [ ] **Step 1: Add a reduced-motion hook and conditionally render**

Rewrite the file top section. Replace the imports and `BLOB_CONFIG` / `PARTICLES` / `GOD_RAYS` constants with the trimmed versions below, and wrap the component body with an early-return.

Find:

```tsx
"use client";

import { useMemo } from "react";

const BLOB_CONFIG = [
  { size: 900, top: "-10%", left: "-5%", blur: 140, anim: "blob1", dur: "32s", color: "var(--fm-blob1)" },
  { size: 750, top: "20%", right: "-10%", blur: 120, anim: "blob2", dur: "36s", color: "var(--fm-blob2)" },
  { size: 650, bottom: "10%", left: "15%", blur: 100, anim: "blob3", dur: "40s", color: "var(--fm-blob3)" },
  { size: 800, top: "50%", left: "50%", blur: 160, anim: "blob4", dur: "44s", color: "var(--fm-blob4)" },
  { size: 550, top: "5%", left: "40%", blur: 80, anim: "blob5", dur: "28s", color: "var(--fm-blob5)" },
  { size: 600, bottom: "20%", right: "5%", blur: 110, anim: "blob6", dur: "48s", color: "var(--fm-blob6)" },
  { size: 1000, top: "30%", left: "-15%", blur: 150, anim: "blob7", dur: "50s", color: "var(--fm-blob7)" },
];
```

Replace with:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";

const BLOB_CONFIG = [
  { size: 900, top: "-10%", left: "-5%", blur: 140, anim: "blob1", dur: "32s", color: "var(--fm-blob1)" },
  { size: 750, top: "20%", right: "-10%", blur: 120, anim: "blob2", dur: "36s", color: "var(--fm-blob2)" },
  { size: 800, top: "50%", left: "50%", blur: 160, anim: "blob4", dur: "44s", color: "var(--fm-blob4)" },
];
```

- [ ] **Step 2: Remove `PARTICLES` and `GOD_RAYS` constants**

Delete these blocks entirely:

```tsx
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  left: `${5 + Math.random() * 90}%`,
  size: 2 + Math.random() * 3,
  anim: `particleFloat${(i % 4) + 1}`,
  dur: `${8 + Math.random() * 12}s`,
  delay: `${Math.random() * 15}s`,
}));

const GOD_RAYS = [
  { anim: "godRay1", dur: "45s", delay: "0s", top: "10%", width: "200px", height: "150vh" },
  { anim: "godRay2", dur: "55s", delay: "8s", top: "0%", width: "150px", height: "140vh" },
  { anim: "godRay3", dur: "50s", delay: "15s", top: "5%", width: "180px", height: "145vh" },
  { anim: "godRay4", dur: "60s", delay: "22s", top: "15%", width: "160px", height: "135vh" },
];
```

Keep `CONSTELLATION_DOTS` and `NOISE_SVG`.

- [ ] **Step 3: Add reduced-motion early return in the component**

Replace the existing component:

```tsx
export const AnimatedBackground = (): React.ReactNode => {
  const constellationLines = useMemo(() => {
    // ...
  }, []);

  return (
    <div ...>
```

with:

```tsx
export const AnimatedBackground = (): React.ReactNode => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const constellationLines = useMemo(() => {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const threshold = 18;
    for (let i = 0; i < CONSTELLATION_DOTS.length; i++) {
      for (let j = i + 1; j < CONSTELLATION_DOTS.length; j++) {
        const dx = CONSTELLATION_DOTS[i].cx - CONSTELLATION_DOTS[j].cx;
        const dy = CONSTELLATION_DOTS[i].cy - CONSTELLATION_DOTS[j].cy;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          lines.push({
            x1: CONSTELLATION_DOTS[i].cx,
            y1: CONSTELLATION_DOTS[i].cy,
            x2: CONSTELLATION_DOTS[j].cx,
            y2: CONSTELLATION_DOTS[j].cy,
          });
        }
      }
    }
    return lines;
  }, []);

  if (reducedMotion) {
    return null;
  }

  return (
    <div
```

- [ ] **Step 4: Remove the GOD_RAYS `.map(...)` block and the PARTICLES `.map(...)` block from JSX**

Delete the entire block:

```tsx
      {/* Layer 3: God rays */}
      {GOD_RAYS.map((ray, i) => (
        <div
          key={`ray-${i}`}
          style={{
            position: "absolute",
            top: ray.top,
            left: "-50%",
            width: ray.width,
            height: ray.height,
            background: `linear-gradient(180deg, transparent, var(--fm-godray), transparent)`,
            animation: `${ray.anim} ${ray.dur} linear infinite`,
            animationDelay: ray.delay,
            opacity: 0,
          }}
        />
      ))}
```

And delete:

```tsx
      {/* Layer 6: Floating particles */}
      {PARTICLES.map((p, i) => (
        <div
          key={`particle-${i}`}
          style={{
            position: "absolute",
            left: p.left,
            bottom: 0,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: "var(--fm-particle)",
            animation: `${p.anim} ${p.dur} linear infinite`,
            animationDelay: p.delay,
          }}
        />
      ))}
```

- [ ] **Step 5: Drop `mix-blend-mode` from the noise overlay**

Find:

```tsx
      {/* Layer 5: Noise grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: NOISE_SVG,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
          opacity: "var(--fm-noise-opacity, 0.03)",
          mixBlendMode: "overlay",
        }}
      />
```

Replace with:

```tsx
      {/* Layer 5: Noise grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: NOISE_SVG,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
          opacity: "var(--fm-noise-opacity, 0.03)",
        }}
      />
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/animated-background.tsx
git commit -m "perf(animated-bg): trim blobs 7->3, drop particles/rays, honor reduced-motion"
```

---

### Task 6: Reduce sources polling frequency

**Files:**
- Modify: `src/hooks/use-sources.ts:31`

- [ ] **Step 1: Edit the polling interval**

Find:

```ts
      return hasProcessing ? 3000 : false;
```

Replace with:

```ts
      return hasProcessing ? 5000 : false;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-sources.ts
git commit -m "perf(sources): poll every 5s instead of 3s while processing"
```

---

### Task 7: Final smoke check

**Files:** (none modified)

- [ ] **Step 1: Type-check entire project**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 2: Start dev server and confirm it boots**

Run: `pnpm dev` (background it; the user will stop it)
Expected: server listening on `http://localhost:4500`, no compile errors in terminal output.

- [ ] **Step 3: Summarize changes for user verification**

Report to the user:
- List of files changed (7 commits).
- Ask them to:
  1. Visit `/dashboard` and scroll — should feel smooth.
  2. Visit `/` (marketing) — animated background should be lighter.
  3. Visit `/login` — same.
  4. Collapse/expand sidebar — should animate smoothly.

If user reports lag is gone → done. If still slow → propose approach B (code-splitting heavy bundles).
