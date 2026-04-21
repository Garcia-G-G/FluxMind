# FluxMind — Performance Audit

> The app is **extremely slow**. This audit identifies every bottleneck across 3 layers:
> client bundle, server/API, and React rendering. Each item has the file, line numbers,
> estimated impact, and a concrete fix.
>
> **Read `CLAUDE.md` first** for stack and code style rules.

---

## LAYER 1: CLIENT BUNDLE — Too Much JavaScript Shipped

### P0-BUNDLE-1: Dashboard is 100% client-side — zero server rendering
**File**: `/src/app/(app)/dashboard/page.tsx` — line 1: `"use client"`, line 34: `force-dynamic`
**Impact**: ~400-800ms extra on every dashboard load (empty shell → JS download → API calls → render)
**Problem**: Server renders an empty div. Client downloads JS, then fires `useNotebooks()` + `useStats()` as separate fetch calls. Triple round-trip before first paint.
**Fix**:
- Convert to async Server Component. Run both queries in one `Promise.all` directly in `page.tsx`
- Pass data as props to a thin `<DashboardClient>` that only handles mutations/real-time
- Remove `force-dynamic`. Use `unstable_cache(fn, [key], { revalidate: 60 })` for the data
- This alone could cut dashboard TTFP (time to first paint) by 50-70%

### P0-BUNDLE-2: Notebook layout is `"use client"` — kills RSC streaming for ALL notebook pages
**File**: `/src/app/(app)/notebook/[id]/layout.tsx` — line 1: `"use client"`
**Impact**: ~200-400ms — every child page (chat, studio, canvas) becomes a client boundary. No server streaming.
**Problem**: The layout uses `usePathname` + `useState` for tab bar. Because it's a client component, Next.js can't stream children as RSC. Every sub-page pays the client-only penalty.
**Fix**:
- Keep layout as a Server Component
- Extract only the tab bar + toggle into a small `<NotebookTabs>` client component
- Wrap `{children}` in `<Suspense fallback={<Skeleton />}>` for streaming
- Result: chat/studio/canvas pages can now be server-rendered + streamed

### P0-BUNDLE-3: `better-auth/react` dragged into landing page first-load bundle (~40-80KB)
**File**: `/src/components/landing/landing-page.tsx` — line 16: `import { signIn, signUp } from "@/lib/auth-client"`
**Impact**: ~40-80KB on first visit for unauthenticated users
**Problem**: Landing page has `"use client"` and statically imports the auth client SDK. Every visitor downloads the auth runtime before seeing the page.
**Fix**:
- Split auth form into `<AuthForm>` component
- Load with `dynamic(() => import('./auth-form'), { ssr: false })`
- Auth SDK only downloads when user interacts with login/signup

### P1-BUNDLE-4: `sharp` not in `serverExternalPackages` — bundled into server chunks
**File**: `next.config.ts` — `serverExternalPackages` array (lines 32-43)
**Impact**: Build overhead + possible runtime crash. Sharp is a native binary (~30MB).
**Fix**: Add `"sharp"` to `serverExternalPackages` array.

### P1-BUNDLE-5: `AnimatedBackground` — 3 permanent GPU compositor layers
**File**: `/src/components/layout/app-shell.tsx` — line 8 (static import)
**Impact**: Constant GPU memory pressure + composite cost on every frame
**Problem**: 3 blobs with `willChange: "transform"` permanently set. Creates 3 GPU layers that persist for the entire session, even when not animating.
**Fix**:
- Remove `willChange: "transform"` from static styles
- Apply only via CSS animation or only when `prefers-reduced-motion: no-preference`
- Or: render blobs as a single CSS `background: radial-gradient(...)` on the body — zero JS, zero GPU layers

### P1-BUNDLE-6: `@xyflow/react` CSS imported eagerly in dynamic chunk
**File**: `/src/components/mind-map/mind-map-canvas.tsx` — line 15: `import "@xyflow/react/dist/style.css"`
**Impact**: ~15-30KB CSS parsed at bundle evaluation time even though the component is lazy
**Fix**: Move the CSS import to the canvas page or a scoped layout, not inside the dynamic component module.

### P2-BUNDLE-7: Inline `<style>` tags in landing page and app shell
**Files**: `landing-page.tsx:261-263`, `app-shell.tsx:47`
**Impact**: Hydration mismatch risk + bypasses Tailwind build-time optimization
**Fix**: Move to `globals.css` or Tailwind utility classes.

---

## LAYER 2: SERVER & API — Slow Queries and Waterfalls

### P0-SERVER-1: `/api/stats` — 4 uncached COUNT queries on every dashboard load
**File**: `/src/app/api/stats/route.ts` — lines 18-36
**Impact**: ~200-400ms per dashboard visit
**Problem**: 4 separate `COUNT(*)` queries in `Promise.all` on every request. Counts are stale-tolerant.
**Fix**:
```typescript
// Redis cache with 60s TTL
const cacheKey = `stats:${userId}`;
const cached = await redis.get(cacheKey);
if (cached) return NextResponse.json(JSON.parse(cached));
// ... run queries ...
await redis.set(cacheKey, JSON.stringify(stats), "EX", 60);
```
Invalidate on notebook/source/output mutation.

### P0-SERVER-2: `getStudioContext` fetches ALL rawText from every source
**File**: `/src/lib/studio/generate.ts` — lines 32-40
**Impact**: ~500ms-5s depending on source count (20 PDFs × 50KB = 1MB over Postgres wire)
**Problem**: `SELECT rawText FROM sources WHERE notebookId = ?` with no LIMIT. Slices to 5000 chars in JS AFTER transferring the full text.
**Fix**:
- Use `retrieveContext()` from `lib/ai/rag.ts` — it already does vector search and returns only relevant chunks
- Or at minimum: `LEFT(raw_text, 6000)` at DB level + `LIMIT 8`
- **Same problem duplicated in**: `studio/quiz/route.ts:91-98` and `studio/flashcards/route.ts` — both do their own full source fetch instead of using `getStudioContext()`

### P0-SERVER-3: `getStudioContext` — 2 sequential DB round-trips
**File**: `/src/lib/studio/generate.ts` — lines 68-87
**Impact**: ~100-200ms (2 sequential queries)
**Problem**: Notebook ownership check is a separate query, then sources fetched separately. They're independent.
**Fix**: `Promise.all([notebookQuery, sourcesQuery])` — or fold into one JOIN query.

### P0-SERVER-4: Research pipeline — sequential web searches
**File**: `/src/lib/research/pipeline.ts` — lines 62-77
**Impact**: ~3-8 seconds saved (5-8 sequential API calls → parallel)
**Problem**: `for` loop calls `searchWeb(query)` one at a time. Scraping was parallelized but search phase is still serial.
**Fix**: `await Promise.allSettled(plan.queries.map(q => searchWeb(q, 5)))`

### P1-SERVER-5: `/api/sources` — N+1 correlated subquery
**File**: `/src/app/api/sources/route.ts` — line 43
**Impact**: ~100-500ms with many sources (50 sources = 51 DB queries)
**Problem**: `(SELECT COUNT(*) FROM source_chunks WHERE ...)` runs per source row.
**Fix**: `LEFT JOIN source_chunks GROUP BY sources.id` — single query.

### P1-SERVER-6: `/api/sources` — double DB round-trip for ownership check
**File**: `/src/app/api/sources/route.ts` — lines 25-51
**Impact**: ~50-100ms
**Fix**: Merge notebook ownership into the sources query with `INNER JOIN notebooks ON ... AND notebooks.userId = ?`

### P1-SERVER-7: `/api/chat` — 2-3 sequential DB writes in `onFinish`
**File**: `/src/app/api/chat/route.ts` — lines 127-168
**Impact**: ~50-150ms per chat turn
**Problem**: Save message → fetch conversation title → update title. 3 sequential awaits.
**Fix**: Check title before streaming (it's already known). Eliminate the SELECT inside `onFinish`.

### P1-SERVER-8: `/api/outputs` ships full `content` JSON on list endpoint
**File**: `/src/app/api/outputs/route.ts` — lines 22-40
**Impact**: ~100-500ms with many outputs (slide deck content = 50-500KB JSON each)
**Problem**: List endpoint fetches the full `content` jsonb column for every output.
**Fix**: Exclude `content` from the list query. Add `GET /api/outputs/[id]` for detail view.

### P1-SERVER-9: `/api/conversations/[id]` — 2 sequential queries
**File**: `/src/app/api/conversations/[id]/route.ts` — lines 21-41
**Impact**: ~100ms
**Fix**: `Promise.all([conversationQuery, messagesQuery])` or merge into one JOIN.

### P2-SERVER-10: No Redis caching on frequently-read data
**Impact**: Every navigation re-queries Postgres
**Missing caches**:
- Notebook metadata (read on every page under `/notebook/[id]`) — cache 30s
- Source list (read on every tab switch) — cache 15s
- User quota/plan (read on every generation) — cache 60s
- Conversation list (read on every notebook visit) — cache 15s

### P2-SERVER-11: App layout calls `auth.api.getSession` on every navigation
**File**: `/src/app/(app)/layout.tsx` — line 13
**Impact**: ~50-100ms per navigation
**Problem**: Full DB-backed session verification on every route, even though middleware already verified the cookie.
**Fix**: Use React `cache()` to deduplicate within the request, or cache the session in a short-TTL Redis entry.

### P2-SERVER-12: Missing database indexes
**Files**: `/src/db/schema/`
- `conversations` — missing composite `(notebookId, userId)` index
- `users` — missing `stripeCustomerId` index (Stripe webhook lookups)
- `notebookCollaborators` — missing `userId` index (shared notebooks query)
- `flashcard_progress` — missing composite `(outputId, userId)` index for SRS queries

---

## LAYER 3: REACT RENDERING — Unnecessary Re-renders

### P0-RENDER-1: StudioPage — components defined inside render body
**File**: `/src/app/(app)/notebook/[id]/studio/page.tsx` — lines 376-492
**Impact**: Every state change unmounts and remounts ALL studio cards. During generation, `isPending` flips many times → mass DOM churn.
**Problem**: `StudioCard` and `SectionHeader` are `const` functions inside `StudioPage`. React creates new component types each render → destroys all instances.
**Fix**:
```typescript
// MOVE OUTSIDE the component, at module scope:
const StudioCard = React.memo(({ ... }: StudioCardProps) => { ... });
const SectionHeader = ({ ... }: SectionHeaderProps) => { ... };
```

### P0-RENDER-2: StudioPage — 11 separate useState variables
**File**: Same file — lines 191-201
**Impact**: Any single state change re-renders the entire page with all cards.
**Fix**: Collapse into one `useState<Record<StudioTab, unknown>>({})` + wrap card grid in `React.memo`.

### P0-RENDER-3: StudioPage — inline objects recreated every render
**File**: Same file — lines 204-223
**Problem**: `typeToTab` and `typeIcon` are object literals inside the component. New references every render.
**Fix**: Hoist to module scope as `const`.

### P0-RENDER-4: ChatMessage — no React.memo → all messages re-render on every streaming token
**File**: `/src/components/chat/chat-panel.tsx` — lines 112-133
**Impact**: During streaming, `messages` array updates on every token. All prior messages re-render because `ChatMessage` has no memo.
**Fix**: Wrap `ChatMessage` in `React.memo`. Extract streaming indicator to only re-render the last message.

### P1-RENDER-5: AppShell — Header/Sidebar re-render on every sidebar toggle
**File**: `/src/components/layout/app-shell.tsx` — lines 64-66
**Problem**: `onToggleSidebar` is an inline arrow `() => setSidebarCollapsed(...)`. New function reference → Header gets new props every render.
**Fix**: `useCallback` for both handlers. Wrap `Header` and `Sidebar` in `React.memo`.

### P1-RENDER-6: Dashboard — `setNowMs` ticking every 60s re-renders entire page
**File**: `/src/app/(app)/dashboard/page.tsx` — lines 93-106
**Problem**: `nowMs` state lives in the parent. Every 60s tick re-renders all notebook cards.
**Fix**: Move the clock into a tiny `<RelativeTime timestamp={...} />` component. Only time labels update.

### P1-RENDER-7: SourcePanel — inline hover handlers on every source row
**File**: `/src/components/notebook/source-panel.tsx` — lines 178-183, 247-253
**Problem**: `onMouseEnter`/`onMouseLeave` are inline arrows per row, recreated every render.
**Fix**: Replace with CSS `hover:` Tailwind classes. Zero JS needed for hover styles.

### P2-RENDER-8: MindMapCanvas — Dagre layout recomputed synchronously on expand/collapse
**File**: `/src/components/mind-map/mind-map-canvas.tsx` — lines 167-179
**Problem**: `useMemo` depends on `expanded` Set. Every toggle re-runs full graph layout on main thread.
**Fix**: Wrap in `startTransition` so it doesn't block painting. Or debounce toggles.

### P2-RENDER-9: MindMapCanvas — inline `style` prop on ReactFlow
**File**: Same file — line 205: `style={{ background: "var(--fm-bg)" }}`
**Problem**: New object reference every render. ReactFlow internally diffs this.
**Fix**: Hoist as `const FLOW_STYLE = { background: "var(--fm-bg)" }` at module scope.

### P2-RENDER-10: ChatPanel — `initialMessages` mapping not memoized
**File**: `/src/components/chat/chat-panel.tsx` — line 61
**Problem**: `.map()` creates new array reference every render. `useChat` may reset.
**Fix**: Wrap in `useMemo([initialMessages])`.

---

## EXECUTION PLAN — Ordered by Impact

### Sprint 1: "Stop the bleeding" (biggest wins, ~1-2 days)

| # | Fix | Est. Improvement | Effort |
|---|-----|-----------------|--------|
| P0-BUNDLE-1 | Dashboard → Server Component | -400-800ms TTFP | Medium |
| P0-BUNDLE-2 | Notebook layout → Server Component | -200-400ms all notebook pages | Medium |
| P0-RENDER-1 | StudioCard outside render | Stops mass DOM churn | 5 min |
| P0-RENDER-2 | Merge 11 useState into 1 | Halves studio re-renders | 15 min |
| P0-RENDER-3 | Hoist objects to module scope | Stops needless diffing | 5 min |
| P0-RENDER-4 | React.memo on ChatMessage | Fixes streaming jank | 10 min |
| P0-SERVER-1 | Cache /api/stats in Redis | -200-400ms dashboard | 20 min |
| P0-SERVER-2 | Use RAG instead of rawText | -500ms-5s per generation | 30 min |
| P0-SERVER-3 | Parallelize getStudioContext | -100-200ms per generation | 10 min |

### Sprint 2: "Smooth everything out" (~1 day)

| # | Fix | Est. Improvement | Effort |
|---|-----|-----------------|--------|
| P0-BUNDLE-3 | Lazy auth on landing page | -40-80KB first load | 20 min |
| P0-SERVER-4 | Parallel web searches | -3-8s research pipeline | 10 min |
| P1-SERVER-5 | Fix N+1 in sources | -100-500ms source list | 20 min |
| P1-SERVER-7 | Optimize chat onFinish | -50-150ms per turn | 15 min |
| P1-SERVER-8 | Exclude content from list | -100-500ms studio load | 20 min |
| P1-RENDER-5 | Memo AppShell handlers | Stops nav re-renders | 10 min |
| P1-RENDER-6 | Isolate dashboard clock | Stops 60s full re-render | 15 min |
| P1-BUNDLE-4 | sharp in serverExternalPackages | Fixes build + runtime | 2 min |

### Sprint 3: "Polish" (~0.5 day)

| # | Fix | Est. Improvement | Effort |
|---|-----|-----------------|--------|
| P2-SERVER-10 | Redis caching layer | -50-200ms per navigation | 1 hour |
| P2-SERVER-11 | Cache getSession | -50-100ms per navigation | 15 min |
| P2-SERVER-12 | Add missing DB indexes | -50-200ms on filtered queries | 20 min |
| P2-RENDER-7-10 | Minor memo/CSS fixes | Smoother interactions | 30 min |
| P1-BUNDLE-5 | Fix AnimatedBackground GPU | Less GPU pressure | 15 min |
| P1-BUNDLE-6 | Scope xyflow CSS import | -15-30KB eager CSS | 10 min |

---

## TOTAL ESTIMATED IMPACT

If all fixes are applied:
- **Dashboard load**: from ~1.5-2s → ~300-500ms
- **Notebook pages**: from ~800ms-1.2s → ~200-400ms  
- **Studio generation**: from ~2-8s overhead → ~500ms-1s overhead (before AI time)
- **Chat streaming**: from janky/laggy → smooth (only last message re-renders)
- **Research pipeline**: from ~15-30s → ~5-10s
- **First visit (landing)**: -40-80KB less JS to download

---

## ABSOLUTE CONSTRAINTS

**DO NOT touch**: Zod schemas, svg-helpers.ts, the generation prompt content, existing type exports.

**DO NOT introduce**: New dependencies for caching (use existing Redis), new state management libs, CSS-in-JS.

**YES, you can**: Convert pages from client→server components, add `React.memo`/`useCallback`/`useMemo`, add Redis caching utilities, add `serverExternalPackages`, create `GET /api/outputs/[id]`, add DB indexes via Drizzle migrations, split components into smaller files.
