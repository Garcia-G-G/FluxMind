# FluxMind — Claude Code Max: PERFORMANCE FIX (DO THIS FIRST)

> **Read `CLAUDE.md` first** for stack and code style rules.
> This is the HIGHEST PRIORITY prompt. The app is unusably slow. Fix performance BEFORE anything else.
> Every fix here is specific, with file paths and line numbers. No guessing.

---

## WHY IT'S SLOW — THE 3 ROOT CAUSES

1. **Everything is `"use client"`** — Dashboard, notebook layout, notebook page, studio page are all client components. Server renders an empty shell, browser downloads JS, then client makes API calls. Triple waterfall on every page load.

2. **5 uncached DB queries on dashboard, 2 redundant session lookups per notebook page** — No Redis caching anywhere in the page-level data fetching. The `/api/stats` route has a Redis cache but the dashboard page bypasses it and queries the DB directly.

3. **Giant packages leak into the client bundle** — `@tldraw/tldraw` (~3MB), `jspdf` (~500KB), `html2canvas-pro` (~300KB), `yjs` + `y-websocket` (~200KB) are not in `serverExternalPackages` or properly isolated behind `dynamic()`.

---

## EXECUTION ORDER (do exactly in this order)

1. Fix next.config.ts — bundle isolation
2. Fix dashboard — server component + Redis cache
3. Fix notebook layout — server component + streaming
4. Fix app layout — deduplicate session
5. Fix StudioPage — stop component re-creation
6. Fix ChatPanel — stop streaming re-renders
7. Fix AppShell — memoize handlers + lazy AnimatedBackground
8. Verify

---

## TASK 1: FIX next.config.ts

**File**: `/next.config.ts`

### 1A. Add missing packages to `serverExternalPackages`

These are server-only packages that should NEVER be bundled into client or server route chunks:

```typescript
serverExternalPackages: [
  // existing:
  "@aws-sdk/client-s3",
  "@aws-sdk/s3-request-presigner", 
  // ADD:
  "sharp",
  "fluent-ffmpeg",
  "@ffmpeg-installer/ffmpeg",
  "papaparse",
  "@fal-ai/client",
  "cheerio",
  "bullmq",
  "ioredis",
],
```

### 1B. Add missing packages to `optimizePackageImports`

These packages use barrel exports that bloat the bundle if not tree-shaken:

```typescript
optimizePackageImports: [
  // existing entries...
  // ADD:
  "@tldraw/tldraw",
  "@xyflow/react",
  "jspdf",
  "html2canvas-pro",
  "yjs",
  "y-websocket",
  "@tanstack/react-table",
  "react-markdown",
],
```

### 1C. Add image optimization formats

```typescript
images: {
  formats: ["image/avif", "image/webp"],
  remotePatterns: [
    { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
    { protocol: "https", hostname: "**.r2.dev" },
    { protocol: "https", hostname: "fal.media" },
    { protocol: "https", hostname: "v3.fal.media" },
    { protocol: "https", hostname: "lh3.googleusercontent.com" },
    { protocol: "https", hostname: "avatars.githubusercontent.com" },
  ],
},
```

### 1D. Remove `onDemandEntries` (Pages Router only, ignored in App Router)

Delete the `onDemandEntries` block — it does nothing with App Router.

---

## TASK 2: FIX DASHBOARD — Server Component + Redis Cache

**File**: `/src/app/(app)/dashboard/page.tsx`

The dashboard currently runs 5 DB queries on every load with NO caching.

### 2A. Add Redis caching to `loadDashboardData`

```typescript
import { redis } from "@/lib/redis"; // or wherever your Redis client is

const loadDashboardData = async (userId: string) => {
  // Try Redis first — 60 second TTL
  const cacheKey = `dashboard:${userId}`;
  const cached = await redis?.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as DashboardData;
  }

  // Cache miss — run queries in parallel
  const [notebooks, stats] = await Promise.all([
    db.select(...).from(notebooks).where(...),
    Promise.all([
      db.select({ count: count() }).from(notebooks).where(eq(notebooks.userId, userId)),
      db.select({ count: count() }).from(sources).where(...),
      db.select({ count: count() }).from(conversations).where(...),
      db.select({ count: count() }).from(outputs).where(...),
    ]),
  ]);

  const data = { notebooks, stats: { notebooks: stats[0], sources: stats[1], conversations: stats[2], outputs: stats[3] } };
  
  // Cache for 60 seconds
  await redis?.set(cacheKey, JSON.stringify(data), "EX", 60);
  return data;
};
```

### 2B. Ensure the page is a Server Component

The `page.tsx` should NOT have `"use client"` at the top. If it currently does, remove it. The page should:
1. Fetch data on the server via `loadDashboardData`
2. Pass data as props to a `<DashboardClient>` client component
3. Wrap `<DashboardClient>` in `<Suspense>` with a skeleton fallback

If the page is already a Server Component (check first!), verify that `DashboardClient` or `dashboard-client.tsx` has `"use client"` and receives data as props, not via hooks.

### 2C. Invalidate cache on mutations

In the API routes that modify notebooks, sources, conversations, or outputs — add cache invalidation:
```typescript
await redis?.del(`dashboard:${userId}`);
```

Add this to: `POST /api/notebooks`, `DELETE /api/notebooks/[id]`, `POST /api/sources/upload`, `DELETE /api/sources/[id]`, `POST /api/chat` (on new conversation), and all `POST /api/studio/*` routes (on output creation).

---

## TASK 3: FIX NOTEBOOK LAYOUT — Server Component + Streaming

**File**: `/src/app/(app)/notebook/[id]/layout.tsx`

### Problem
If this file has `"use client"` at the top, it makes EVERY child page (chat, studio, canvas) a client boundary. No server-side streaming, no RSC benefits. Every sub-page pays the full client-render penalty.

### Fix

**If it IS `"use client"`:**

1. Remove `"use client"` from the layout
2. Move any client-only logic (usePathname, useState for tab bar, sidebar toggle) into a small `<NotebookNav>` client component
3. Keep the layout as a Server Component that renders:
```tsx
export default async function NotebookLayout({ children, params }: Props) {
  const { id } = await params;
  // Server-side auth check (already exists)
  const session = await getCachedSession();
  // ... notebook ownership check ...

  return (
    <div className="flex h-full">
      <NotebookNav notebookId={id} /> {/* client component — tab bar + source panel toggle */}
      <Suspense fallback={<NotebookSkeleton />}>
        {children}
      </Suspense>
    </div>
  );
}
```

**If it is NOT `"use client"` already:**
Verify that children are wrapped in `<Suspense>` for streaming. Add a skeleton fallback.

### Also fix: deduplicate source panel data
The source panel should NOT re-fetch sources if they were already loaded by the layout. Consider fetching sources server-side in the layout and passing as props, or using React Query's `initialData` pattern.

---

## TASK 4: FIX APP LAYOUT — Deduplicate Session

**File**: `/src/app/(app)/layout.tsx`

### Problem
Line 13 calls `auth.api.getSession()` on EVERY navigation. Then `notebook/[id]/layout.tsx` calls `getCachedSession()` again. Two session lookups per notebook page.

### Fix
Use React's `cache()` to deduplicate within the same request:

```typescript
import { cache } from "react";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});
```

Export this from a shared file (e.g., `/src/lib/auth/session.ts`). Use it in BOTH the app layout AND the notebook layout. React's `cache()` ensures it only runs once per request, even if called multiple times in the component tree.

---

## TASK 5: FIX STUDIO PAGE — Stop Component Re-creation

**File**: `/src/app/(app)/notebook/[id]/studio/page.tsx`

### 5A. Move StudioCard and SectionHeader OUTSIDE the component

Currently (around line 376): `StudioCard` and `SectionHeader` are defined as `const` functions INSIDE the `StudioPage` render body. React sees them as new component types on every render → unmounts and remounts ALL cards on every state change.

```typescript
// MOVE THESE TO MODULE SCOPE (outside StudioPage):
type StudioCardProps = { ... };
const StudioCard = React.memo(({ ... }: StudioCardProps): React.ReactNode => {
  // ... card JSX
});

type SectionHeaderProps = { ... };
const SectionHeader = ({ ... }: SectionHeaderProps): React.ReactNode => {
  // ... header JSX
};
```

### 5B. Hoist constant objects to module scope

Lines ~204-223: `typeToTab` and `typeIcon` are plain objects inside the component. New references every render.

```typescript
// MOVE TO MODULE SCOPE:
const TYPE_TO_TAB: Record<string, StudioTab> = { ... };
const TYPE_ICON: Record<string, LucideIcon> = { ... };
```

### 5C. Consolidate 11 output useState into 1

Lines ~191-201: Replace 11 separate `useState` calls with one:

```typescript
// BEFORE: 11 separate states
const [quizData, setQuizData] = useState(null);
const [flashcardData, setFlashcardData] = useState(null);
// ... 9 more ...

// AFTER: 1 state
const [outputData, setOutputData] = useState<Record<string, unknown>>({});
const updateOutput = useCallback((tab: string, data: unknown) => {
  setOutputData(prev => ({ ...prev, [tab]: data }));
}, []);
```

---

## TASK 6: FIX CHAT — Stop Streaming Re-renders

**File**: `/src/components/chat/chat-panel.tsx`

### 6A. Memoize ChatMessage

During streaming, `messages` updates on every token. Without `React.memo`, ALL prior messages re-render on every token.

```typescript
// In chat-message.tsx or wherever ChatMessage is defined:
export const ChatMessage = React.memo(({ message, isLast, isStreaming }: Props) => {
  // ... existing render logic
});
```

### 6B. Memoize initialMessages mapping

Line ~61: `.map()` creates new array reference every render.

```typescript
const formattedMessages = useMemo(
  () => initialMessages?.map(m => ({ ... })) ?? [],
  [initialMessages],
);
```

---

## TASK 7: FIX APP SHELL — Memoize + Lazy Background

**File**: `/src/components/layout/app-shell.tsx`

### 7A. Memoize event handlers

```typescript
const handleToggleSidebar = useCallback(() => {
  setSidebarCollapsed(prev => !prev);
}, []);

const handleOpenCommand = useCallback(() => {
  setCommandOpen(true);
}, []);
```

### 7B. Wrap Header and Sidebar in React.memo

```typescript
const MemoizedHeader = React.memo(Header);
const MemoizedSidebar = React.memo(Sidebar);
```

### 7C. Lazy-load AnimatedBackground

If `AnimatedBackground` is statically imported (line ~8), make it lazy:

```typescript
const AnimatedBackground = dynamic(
  () => import("@/components/layout/animated-background").then(m => ({ default: m.AnimatedBackground })),
  { ssr: false }
);
```

### 7D. Remove permanent `willChange: "transform"` from background blobs

If `AnimatedBackground` uses `willChange: "transform"` on its blob divs, remove it. This creates permanent GPU compositor layers that consume memory. Use CSS `will-change` only during active animations via `@keyframes`.

---

## TASK 8: VERIFY

1. `pnpm build` — zero errors, check the build output for chunk sizes:
   - First Load JS should be under 150KB (ideally under 120KB)
   - No route should have >300KB JS
   - If any route is over 300KB, investigate what's being bundled

2. `pnpm lint` — zero errors

3. `pnpm test` — existing tests pass

4. Manual checks:
   - Dashboard loads fast (check Network tab — should be 1-2 requests, not 5+)
   - Navigating to a notebook does NOT flash blank
   - Chat input appears immediately, not after a loading spinner
   - Studio cards don't unmount/remount when clicking "Generate"
   - During chat streaming, scroll is smooth (not janky)

5. **Lighthouse audit** (Chrome DevTools):
   - Performance score should be >70 (currently likely <40)
   - LCP should be under 2.5s
   - CLS should be under 0.1
   - TBT should be under 300ms

---

## ABSOLUTE CONSTRAINTS

**DO NOT:**
- Change the database schema
- Change the auth system
- Change API route paths
- Remove any features
- Change the visual design (this prompt is ONLY about speed)

**YES, you can:**
- Convert `"use client"` pages to Server Components
- Add `React.memo`, `useCallback`, `useMemo` everywhere needed
- Add Redis caching
- Add `<Suspense>` boundaries with skeleton fallbacks
- Move components from inline to module scope
- Add packages to `serverExternalPackages` and `optimizePackageImports`
- Create utility files for shared session/caching logic
- Use `dynamic()` for heavy component imports
- Add `images.remotePatterns` to next.config.ts

**Code style:**
- TypeScript strict, named exports
- Use existing Redis client from the codebase (check `src/lib/queue.ts` or `src/lib/redis.ts`)
- If no Redis utility exists, create `/src/lib/redis.ts` that exports a singleton IORedis client
- Skeleton components: simple divs with `animate-pulse` and `bg-[var(--fm-surface)]`
