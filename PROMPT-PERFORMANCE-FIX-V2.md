# FluxMind — Claude Code Max: PERFORMANCE FIX V2

> **Read `CLAUDE.md` first** for stack and code style rules.
> **Run `PROMPT-STUDIO-BOLD-CARDS.md` FIRST** — it changes StudioCard. This prompt must not conflict.
> Every fix here is specific, with file paths and line numbers. No guessing.
> Items already fixed in previous sessions have been removed — only UNFIXED issues remain.

---

## WHAT'S ALREADY FIXED (DO NOT REDO)

These were fixed in previous sessions. Listed here so you DON'T waste time re-doing them:

- ✅ Dashboard page is already a Server Component (no `"use client"`)
- ✅ Notebook layout is already a Server Component with `<Suspense>` + `TabContentFallback`
- ✅ `getCachedSession()` already exists at `@/lib/auth-session` and is used in both layouts
- ✅ StudioCard and SectionHeader are already at module scope (not inside render)
- ✅ TYPE_TO_TAB, TYPE_ICON are already at module scope
- ✅ 11 output `useState` already consolidated into single `StudioOutputs` state
- ✅ ChatMessage already wrapped in `memo()`
- ✅ Chat `seededMessages` and `transport` already use `useMemo`
- ✅ AppShell `handleToggleSidebar` and `handleOpenCommandPalette` already use `useCallback`
- ✅ CommandPalette already lazy-loaded with `dynamic()`
- ✅ AnimatedBackground already avoids `will-change: transform`
- ✅ `@tldraw/tldraw` is already behind `dynamic()` in canvas page
- ✅ `serverExternalPackages` already includes: sharp, fluent-ffmpeg, @ffmpeg-installer/ffmpeg, ioredis, bullmq
- ✅ `optimizePackageImports` already includes: @xyflow/react, @tanstack/react-table, react-markdown

---

## WHAT'S STILL BROKEN — 4 REMAINING ISSUES

1. **Dashboard runs 5 DB queries on every page load with NO Redis cache** — The dashboard is a Server Component (good) but hits the database directly every time. No caching.

2. **`next.config.ts` is missing packages in `optimizePackageImports`** — `jspdf`, `html2canvas-pro`, `yjs`, `y-websocket` are barrel exports that bloat chunks. Also missing `image/avif` + `image/webp` formats. And `onDemandEntries` is a Pages Router setting that does nothing in App Router.

3. **Header and Sidebar are NOT wrapped in `React.memo`** — Every state change in `AppShell` re-renders both.

4. **No `@fal-ai/client` or `papaparse` in `serverExternalPackages`** — These are server-only but not marked as external.

---

## EXECUTION ORDER

1. Fix next.config.ts — bundle isolation + cleanup
2. Fix dashboard — add Redis cache
3. Fix AppShell — memo Header/Sidebar
4. Verify

---

## TASK 1: FIX next.config.ts

**File**: `/next.config.ts`

### 1A. Add missing packages to `optimizePackageImports` (line 21-30)

Add these to the existing array:

```typescript
optimizePackageImports: [
  // existing:
  "motion",
  "@xyflow/react",
  "@tanstack/react-table",
  "cmdk",
  "react-markdown",
  "remark-gfm",
  "sonner",
  "@ai-sdk/react",
  // ADD these — heavy barrel exports that bloat the bundle:
  "jspdf",
  "html2canvas-pro",
  "yjs",
  "y-websocket",
],
```

### 1B. Add missing packages to `serverExternalPackages` (line 37-52)

Add these to the existing array:

```typescript
serverExternalPackages: [
  // existing:
  "pdf-parse",
  "mammoth",
  "@aws-sdk/client-s3",
  "ioredis",
  "bullmq",
  "stripe",
  "@ffmpeg-installer/ffmpeg",
  "fluent-ffmpeg",
  "sharp",
  // ADD these — server-only, no reason to bundle:
  "@fal-ai/client",
  "papaparse",
  "@aws-sdk/s3-request-presigner",
],
```

### 1C. Add image optimization formats (line 68-79)

Add `formats` to the existing `images` config:

```typescript
images: {
  formats: ["image/avif", "image/webp"],  // ADD this line
  remotePatterns: [
    // ... keep existing patterns ...
  ],
},
```

### 1D. Remove `onDemandEntries` block (lines 57-60)

Delete the entire block:
```typescript
// DELETE THIS — Pages Router only, does nothing with App Router:
onDemandEntries: {
  maxInactiveAge: 5 * 60 * 1000,
  pagesBufferLength: 8,
},
```

---

## TASK 2: FIX DASHBOARD — Add Redis Cache

**File**: `/src/app/(app)/dashboard/page.tsx`

The dashboard is already a Server Component that fetches data with `loadDashboardData`. But it hits the DB on EVERY page load. Add Redis caching with a 60-second TTL.

### 2A. Find the Redis client

Check if `/src/lib/redis.ts` exists. If it does, import from there. If not, check `/src/lib/queue.ts` — it likely has an ioredis client. Import whichever one exists.

If NEITHER exists, create `/src/lib/redis.ts`:

```typescript
import Redis from "ioredis";

const getRedisUrl = (): string => {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  return url;
};

export const redis = process.env.REDIS_URL
  ? new Redis(getRedisUrl(), { maxRetriesPerRequest: 3, lazyConnect: true })
  : null;
```

### 2B. Add caching to `loadDashboardData`

At the top of `/src/app/(app)/dashboard/page.tsx`, add the Redis import:

```typescript
import { redis } from "@/lib/redis"; // adjust path if needed
```

Then wrap `loadDashboardData` (starts around line 23):

```typescript
const loadDashboardData = async (
  userId: string,
): Promise<{ notebooks: NotebookWithCount[]; stats: Stats }> => {
  // ── Redis cache: 60s TTL ──
  const cacheKey = `dashboard:${userId}`;
  try {
    const cached = await redis?.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Redis down — fall through to DB
  }

  // ── Cache miss — run existing queries ──
  // ... keep ALL existing query code exactly as-is ...
  
  // At the end, before the return statement, add:
  try {
    await redis?.set(cacheKey, JSON.stringify(result), "EX", 60);
  } catch {
    // Redis down — don't fail the page
  }

  return result;
};
```

**IMPORTANT:** Wrap redis calls in try/catch. If Redis is down, the page must still work — it just won't be cached.

### 2C. Invalidate cache on mutations

Add `await redis?.del(\`dashboard:${userId}\`);` to these API routes after successful mutations:

- `POST /api/notebooks` — after creating a notebook
- `DELETE /api/notebooks/[id]` — after deleting
- `POST /api/sources/upload` or wherever sources are created — after creating
- `DELETE /api/sources/[id]` — after deleting
- `POST /api/chat` — after creating a new conversation (only first message)
- All `POST /api/studio/*` routes — after output creation

Search for these routes, find the mutation point, and add the invalidation AFTER the DB write succeeds. Import redis at the top of each file.

---

## TASK 3: FIX APP SHELL — Memo Header and Sidebar

**File**: `/src/components/layout/app-shell.tsx`

Header and Sidebar re-render on every AppShell state change (sidebar toggle, command palette open/close). Wrap them:

```typescript
import { memo } from "react";
// ... existing imports of Header and Sidebar ...

const MemoizedHeader = memo(Header);
const MemoizedSidebar = memo(Sidebar);
```

Then use `<MemoizedHeader>` and `<MemoizedSidebar>` in the JSX instead of `<Header>` and `<Sidebar>`.

**Also check:** If `Header` and `Sidebar` receive object/array props that are created inline (like `style={{...}}`), extract them to constants or use `useMemo`. Otherwise `memo` won't help because the props change every render.

---

## TASK 4: VERIFY

1. **`pnpm build`** — zero errors. Check build output:
   - First Load JS should be under 150KB (ideally under 120KB)
   - No route should have >300KB JS
   - If any route is over 300KB, investigate what's being bundled

2. **`pnpm lint`** — zero errors

3. **`pnpm test`** — existing tests pass

4. **Check:**
   - Dashboard loads fast (Redis cache hit on second load)
   - No console errors
   - Studio Bold Cards render correctly (from PROMPT-STUDIO-BOLD-CARDS.md)

---

## ABSOLUTE CONSTRAINTS

**DO NOT:**
- Change the database schema
- Change the auth system
- Change API route paths
- Remove any features
- Change the visual design (this prompt is ONLY about speed)
- Redo anything from the "ALREADY FIXED" list above
- Touch the StudioCard component (it's being redesigned by PROMPT-STUDIO-BOLD-CARDS.md)

**YES, you can:**
- Add Redis caching to `loadDashboardData`
- Add packages to `serverExternalPackages` and `optimizePackageImports`
- Wrap components in `React.memo`
- Remove dead config (`onDemandEntries`)
- Add `image/avif` and `image/webp` formats
- Create `/src/lib/redis.ts` if it doesn't exist

**Code style:**
- TypeScript strict, named exports
- Wrap Redis calls in try/catch (never let Redis failure break the page)
- Use existing Redis client if one exists (check `src/lib/queue.ts` first)
