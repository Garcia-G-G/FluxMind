# Performance Comprehensive Audit — Make FluxMind Fluid

**Date:** 2026-04-20
**Status:** Draft — pending user approval
**Scope:** Full codebase perf audit. Surgical fixes only. No design changes, no feature changes, no rewrites.

## Context

Previous pass (`2026-04-17-perf-surgical-fix-design.md`) fixed backdrop-filter abuse on sidebar/header/cards, trimmed `AnimatedBackground`, removed sidebar width-animation, slowed source polling. That pass was implemented on the current branch `perf/surgical-fix`.

User reports it still feels laggy — both on `pnpm dev` AND on the production build. Asks for "completely fluid" regardless of time cost, no design or functional changes, languages/architectures negotiable.

## Diagnosis summary

The audit found two independent problem classes, plus one **blocker**:

**BLOCKER — production build is broken.** `pnpm build` fails with `TypeError: Cannot read properties of undefined (reading 'call')` at `.next/server/webpack-runtime.js` while prerendering `/dashboard`. Reproduced twice from a clean `.next`. Nothing here is shippable until this is fixed. It also means the user has probably been judging "prod perf" from a prod build that never actually runs.

**Class A — "the app ships too much JS at the wrong time."** Fixable, high-impact, low-risk, mostly config and lazy-import work. This is the 80/20.

**Class B — "dev mode is dev mode."** Next.js `pnpm dev` on 42 routes with this many client components is structurally ~5× slower than prod. We can claw back 30–50% with Turbopack + config, but we will not make dev match prod fluidity. User must test on the production build to judge real perf.

## Non-goals

- No redesign. Every visual stays pixel-identical.
- No feature removals.
- No framework migration, no Rust/Go rewrite — the findings don't justify it.
- No schema changes (indexes already cover the hot paths).
- No worker / BullMQ / queue redesign — those are correctly isolated from the request path.
- No changes to auth, Stripe, R2, Fal, ElevenLabs integration surfaces.

## Findings

### 0. Build failure (BLOCKER)

Clean `rm -rf .next && pnpm build` fails consistently:
```
Generating static pages (31/42)
TypeError: Cannot read properties of undefined (reading 'call')
    at Object.c [as require] (.next/server/webpack-runtime.js:1:143)
Error occurred prerendering page "/dashboard"
Export encountered an error on /(app)/dashboard/page, exiting the build.
```

Next.js is attempting to SSG `/dashboard`. It shouldn't be — the `(app)/layout.tsx` already calls `headers()` via `auth.api.getSession`, which should opt the whole segment into dynamic rendering. Despite that, the prerender runs and blows up in webpack chunk resolution.

**Likely cause (ranked):**
1. The `useSearchParams()` + `<Suspense fallback={<div/>}>` pattern in `dashboard/page.tsx` lets Next prerender the outer shell. During shell prerender, a client chunk expected at module id X is absent in the server bundle graph → `require(X)` returns undefined → `.call` on undefined → crash.
2. A transitive client-only import at module top-level evaluates on the server (possible candidate: `better-auth/react` or a `@tanstack/react-query` re-export quirk).

**Fix:** add `export const dynamic = "force-dynamic"` to `src/app/(app)/dashboard/page.tsx`. That opts the page out of prerender entirely. The `(app)` layout is already dynamic, so runtime performance is unchanged. Low-risk, one-line fix. Verify with clean rebuild.

If that isn't sufficient, fallback: `export const dynamic = "force-dynamic"` on the `(app)/layout.tsx` itself, and/or bisect the offending module.

### 1. `next.config.ts` is bare

Current file (entire contents):
```ts
const nextConfig: NextConfig = { output: "standalone" };
```

Everything Next.js 15 gives you for free is turned off. Fix by adding:

- **`experimental.optimizePackageImports`** for packages Next doesn't optimize by default. `lucide-react` is already default-optimized, but **`motion`, `@xyflow/react`, `cmdk`, `@tanstack/react-query`, `@tanstack/react-table`, `react-markdown`, `remark-gfm`** are not and they're used across many client components. Expected win: ~15–25% smaller client chunks on most pages, dev compile 15–40% faster.
- **`compiler.removeConsole: { exclude: ["error", "warn"] }`** in prod. The codebase has dozens of `console.log` / `console.error` that ship to the client today.
- **`images.remotePatterns`** covering R2 and Fal — currently `next/image` is unused; once we use it, this avoids breakage.
- **`serverExternalPackages`**: `pdf-parse`, `mammoth`, `cheerio`, `@aws-sdk/client-s3`, `ioredis`, `bullmq`, `stripe`, `youtube-transcript`. These are server-only heavy deps; `serverExternalPackages` keeps them out of the server bundle graph — faster cold starts and avoids the kind of module graph issue that caused the build break.
- **`poweredByHeader: false`**, **`compress: true`** (on by default but explicit).
- **`turbopack`** config (empty object is enough to opt in for dev). Turbopack for `next dev` is stable in 15.5 and delivers the large dev-mode win. Don't enable for `build` yet in 15.5 — still has edges.
- **`onDemandEntries`** raise `maxInactiveAge` to 5 min so dev doesn't recompile routes the user flips back to.

### 2. Global `Providers` forces every page into client rendering

`src/app/layout.tsx` wraps everything in `<Providers>`, which is `"use client"` and hosts `QueryClientProvider + ThemeProvider + LanguageProvider`. That means the landing page, the marketing/pricing page, and all auth pages boot React, hydrate, and evaluate QueryClient even though they need none of it.

**Fix:** keep the global `Providers` where it is, but make it a pure forwarder — split the client providers into a `<ClientProviders>` that is only mounted under `(app)/layout.tsx` (which is authenticated and always client-heavy). Marketing / auth / public routes get a minimal, server-only layout.

Savings: the landing page especially — it's presentational with a single form — drops React Query, Theme, and Language from its initial hydration pass. LCP + TTI win.

### 3. Three Google fonts loaded globally for every page

`src/app/layout.tsx` imports `Plus_Jakarta_Sans` (5 weights), `JetBrains_Mono` (default), and `Instrument_Serif` (normal + italic). All three are declared at the root layout, so every page — even pricing and login — ships all three font families.

**Fix:** keep `Plus_Jakarta_Sans` at the root with `display: "swap"`. Move `JetBrains_Mono` into the chat / markdown surfaces only (lazy CSS variable set by the chat route) — nothing else needs mono. Keep `Instrument_Serif` at root (it's used for display headings on marketing and dashboard).

Actually on measurement: drop `JetBrains_Mono` entirely if it's only used for `<code>` inside chat; we can swap to the system mono stack — saves a network request on every page for a feature most users never see.

### 4. Studio overview page statically imports 7 view components

`src/app/(app)/notebook/[id]/studio/page.tsx` mixes dynamic imports (Slides, Infographic, Research, Course, MindMap, Video) with **static** imports (Quiz, Flashcards, StudyStats, DataTable, Thread, Newsletter, Reel). The static imports drag their `motion/react` trees into the initial studio bundle even though the user only renders one at a time after a click.

**Fix:** make the remaining seven view components dynamic too, exact same pattern already used for the other six. Only the overview card grid ships on first paint. Every view is lazy on demand.

### 5. `motion` is used in 9 components, not in `optimizePackageImports`, and not LazyMotion'd

`motion/react` imports appear in: onboarding-wizard, audio-player, live-cursor, flashcard-view, course-view, reel-script-view, interactive-mode, deep-research, thread-preview, quiz-view.

**Fixes (in order of value):**
- Add `"motion"` to `experimental.optimizePackageImports` — mechanical win.
- For studio views that are already gated behind `activeTab !== "overview"`, also make them dynamic (item 4 above).
- For components that only do simple `fade-in` / `translateY` entrance (many of them), replace `motion.div initial/animate/exit` with the existing `fm-fade-in` CSS class. The app already has that CSS in `src/styles/animations.css`; no behavior change, motion dep disappears from those files. Rough count: at least 5 of the 9 files can drop motion entirely.
- Keep motion for real gesture / spring interactions (live-cursor, interactive-mode) — those need the runtime.

### 6. `tsconfig` target is ES2017

`"target": "ES2017"` means TypeScript down-levels modern syntax (async/await, spread, optional chaining) that every browser from 2020 onward runs natively. Bundles are bigger than necessary.

**Fix:** `"target": "ES2022"`. No browser in our Next.js `browserslist` default needs ES2017. Pure savings.

### 7. Landing page runs a mouse-follow RAF loop with three `filter: blur(40px)` surfaces

`src/components/landing/landing-page.tsx:104-130` starts a `requestAnimationFrame` loop on mount that updates `--mx` / `--my` CSS vars **every frame**. Three absolutely-positioned divs read those vars via `calc(...)` and each applies `filter: blur(30–40px)`.

Each frame the compositor must recompute three ~500×500 blurred surfaces whose positions just changed. On a mid-range laptop this alone is enough to pin the landing page at <60fps even when the tab is idle.

**Fixes:**
- Gate the RAF loop behind `prefers-reduced-motion: no-preference` (start-only, remove when reduced).
- Replace `filter: blur(30–40px)` on the three solid-color divs with **`radial-gradient` backgrounds that fade to transparent** (same visual, no runtime filter). The existing `AnimatedBackground` component already uses this exact technique and documents why (`src/components/shared/animated-background.tsx:4`).
- Optional (lower priority): snap the RAF to `pointermove` with `passive: true` + throttle to 60 Hz. Or remove mouse-reactivity entirely — prior memory says visual identity comes from color + gradient, not motion.

### 8. Dashboard is a pure client component that fetches on the client

`src/app/(app)/dashboard/page.tsx` is `"use client"`. It:
- Boots React Query on the client
- Calls `useSession()` (another auth round-trip from the browser)
- Fires `GET /api/notebooks` (returns user's notebooks with a subquery per row for source counts)
- Fires `GET /api/stats` (four parallel count queries)

All on the client. After HTML arrives, nothing useful renders until three network round-trips finish.

**Fix:** keep the page client (the create/edit/delete dialogs need it) but hoist the initial fetches to a server component:
- Make `dashboard/page.tsx` an RSC that fetches notebooks + stats server-side in parallel via `Promise.all`, passes them as props to a `<DashboardClient initialNotebooks initialStats>` child.
- `DashboardClient` is `"use client"` and calls `useNotebooks` with `initialData` (TanStack Query supports this out of the box) — subsequent navigations still feel live.

Savings: dashboard's above-the-fold content renders on first HTML paint, not after two `fetch` round-trips.

### 9. `/api/notebooks` scalar subquery + `/api/stats` four-round-trip

`src/app/api/notebooks/route.ts:42` does:
```sql
(SELECT COUNT(*) FROM sources WHERE sources.notebook_id = ${notebooks.id}) AS source_count
```
This is a correlated subquery per row — for a user with N notebooks it fans out to N+1 queries under the hood of Postgres. Fine for small N, bad for large.

**Fix:** rewrite as a `LEFT JOIN sources GROUP BY notebooks.id` — one scan instead of N.

`src/app/api/stats/route.ts` already parallelizes with `Promise.all` — ✓ good. But the four-way fanout can be one SQL with `COUNT(*) FILTER (WHERE ...)` patterns. Nice-to-have, lower priority; four parallel short queries in the same session are fine for now.

### 10. `better-auth` configuration spam in every build

The build log shows Better Auth re-initialized ~12 times during "Collecting page data" because `src/lib/auth.ts` is evaluated per-route during build. Each init logs four warnings. This is mostly noise but adds ~1s of build time and suggests `auth.ts` is not being tree-shaken / cached as expected.

**Fix:** keep `auth.ts` as-is but ensure the warning noise is eliminated in prod — set `BETTER_AUTH_SECRET` to 32+ chars, and set real Google/GitHub creds or explicitly disable the providers when env vars are missing (the current `?? ""` makes Better Auth spam the warning every init).

### 11. Middleware is fine — one small tune

`src/middleware.ts` is already minimal. But the matcher `["/dashboard/:path*", "/notebook/:path*", "/settings/:path*", "/login", "/register"]` is good — excludes static assets automatically.

Leave it alone. (Note for the record: several perf guides recommend an exclusion regex `((?!_next/static|_next/image|favicon.ico).*)`; ours doesn't need that because we whitelist rather than blacklist.)

### 12. 84 client components is too many, but mostly unavoidable here

Map of `"use client"` distribution:
- 9 in `src/components/ui/` (shadcn — correct, those wrap Base UI primitives)
- 7 in `src/components/shared/` (theme, language, animated-bg, icons — mostly correct)
- 12 in `src/components/studio/` (viewers — mostly correct; but see item 4)
- 5 in `src/components/chat/` (correct)
- 4 in `src/components/auth/` (correct)
- 4 in `src/components/canvas/`, 2 in `mind-map/`, 1 in `video/`, 1 in `audio/`, 6 in `notebook/`, 6 in `upload/`, 5 in `layout/`, 7 in `app/(app)`, 5 in `hooks/`, 9 in `app/*` pages

Most are legit. Low-value candidates to convert to server: none worth calling out unless they pop up during implementation.

### 13. Small but cheap wins

- `src/db/schema` indexes already cover all the hot FKs. No changes.
- The notebook layout's source panel is always rendered, always loads all sources — fine.
- Mind map uses `@xyflow/react` behind a dynamic import — ✓ good.
- Canvas uses `@tldraw/tldraw` behind a dynamic import with `ssr: false` — ✓ good.

## Proposed implementation plan

Grouped by rough order. Each group ships as one commit after local verify.

**Phase 0 — Unblock build (must-do first)**
- F0.1 `export const dynamic = "force-dynamic"` on `dashboard/page.tsx`. Verify clean rebuild green.
- F0.2 If F0.1 doesn't fix it, bisect with `useSearchParams` and imports. Fallback: move `dynamic` to `(app)/layout.tsx`.
- Verify: `rm -rf .next && pnpm build` → 0 errors, `pnpm start` serves all routes.

**Phase 1 — Config-only wins (lowest risk, biggest dev-mode jump)**
- F1.1 Flesh out `next.config.ts` (item 1).
- F1.2 Raise `tsconfig.json` target to ES2022 (item 6).
- Verify: clean `pnpm build`, compare bundle table to the pre-change capture.

**Phase 2 — Provider & font surgery**
- F2.1 Split `Providers` into server-root + client-only-for-(app) (item 2).
- F2.2 Rescope fonts — keep Jakarta + Instrument at root, drop or defer JetBrains Mono (item 3).
- Verify: landing, login, pricing, dashboard all look identical, all still function.

**Phase 3 — Studio + Motion bundle**
- F3.1 Dynamic-import the remaining 7 studio view components (item 4).
- F3.2 Replace `motion` in entrance-only components with the existing `fm-fade-in` CSS (item 5).
- F3.3 Clean up the three unused imports (`Clock`, `ChevronRight`, `RotatingBorderIcon` — build warns).
- Verify: every studio tab still renders, animations still visible, bundle table shows drop.

**Phase 4 — Landing page RAF + blur filters**
- F4.1 Replace `filter: blur(30–40px)` surfaces with radial-gradient blobs (item 7).
- F4.2 Gate the mouse-follow RAF on reduced-motion and throttle (item 7).
- Verify: landing page scrolls at 60fps, visual identity intact.

**Phase 5 — Dashboard server hydration**
- F5.1 Split `dashboard/page.tsx` into RSC + `DashboardClient` with `initialData` (item 8).
- F5.2 Rewrite `/api/notebooks` subquery as LEFT JOIN + GROUP BY (item 9).
- Verify: dashboard feels instant on refresh, notebook counts correct.

**Phase 6 — Quality-of-life cleanups**
- F6.1 Strip `console.*` in prod via `compiler.removeConsole`.
- F6.2 Fix Better Auth env wiring so prod logs are clean (item 10).
- F6.3 Add a tiny `.env.local.example` section documenting `BETTER_AUTH_SECRET` length.

## What we explicitly are **not** doing (and why)

- **No Turbopack for `build`.** Still rough in 15.5 for this many client components; we'll revisit when the project upgrades to Next 16.
- **No React Compiler.** Requires babel plugin + aggressive testing; large blast radius for a small, still-experimental gain in this codebase's component style. Revisit later.
- **No Rust/Go services.** None of the findings justify it. Every hot path is either React rendering (fixed by bundle cuts + RSC), DB (already indexed, single scan away from optimal), or external APIs (OpenAI/Fal/ElevenLabs/Stripe) whose latency is outside our code.
- **No schema / index changes.** The schema is clean.
- **No design changes.** Every change above preserves pixels and motion where it matters.

## Expected impact

Honest-but-confident estimates, not marketing numbers:

| Area | Before | After | Mechanism |
|---|---|---|---|
| Prod build | **fails** | green | Phase 0 |
| Landing page FPS (idle) | likely <30 with cursor in window | 60 | Phase 4 |
| Dashboard First Contentful Paint | ~2× HTTP RTT (HTML → fetch notebooks → fetch stats) | 1× RTT | Phase 5 |
| Studio overview first load JS | statically imports 7 heavy views | dynamic | Phase 3 |
| Dev-server route compile (first visit) | baseline | 15–40% faster | Phase 1 (optimizePackageImports + Turbopack) |
| Route transitions in prod | baseline | smoother | Phase 2 (smaller provider graph off marketing routes) |

Whether this adds up to a "feels completely fluid" depends on the user's hardware and which routes they use most. If after Phase 5 verification you still feel lag, we re-profile with Chrome DevTools on the specific laggy interaction and do a second targeted pass.

## Verification (Phase 7 — after everything lands)

Mandatory before declaring done:

1. `pnpm build` — green, no warnings that weren't there before.
2. `pnpm lint` — green.
3. `pnpm test` — green (unit tests in `src/lib/__tests__`, `src/hooks/__tests__`).
4. Bundle table — before / after saved to `/tmp/fm-build-before.log` and `/tmp/fm-build-after.log`.
5. Lighthouse on `pnpm start` — run on `/`, `/dashboard`, `/notebook/[id]` — before/after captured. Target ≥90 performance.
6. Manual click-through of the full app:
   - Landing → sign up with email → redirect to dashboard.
   - Dashboard → create notebook → navigate in.
   - Notebook → upload a PDF source → wait for processing → ask a question in chat → streaming response renders with citations.
   - Studio → generate a quiz → open it → back → generate a slide deck.
   - Canvas → load tldraw → draw a shape → close.
   - Settings → toggle theme → toggle language → sign out → sign in.
   - Landing in an incognito window → check FPS while moving the cursor.

## Risks

- **F0.1 turns out not to fix the build.** Mitigation: Phase 0 has a fallback path; worst case we add `dynamic` to the layout, which we'd probably do anyway.
- **F5.1 RSC conversion breaks the dashboard dialogs.** Mitigation: the dialogs stay client; only the initial data fetch moves. TanStack `initialData` is a well-documented path.
- **F4.1 makes the landing page look subtly different** (gradient blob vs true filter-blur). Mitigation: the `AnimatedBackground` elsewhere already uses this technique and the aesthetic translates well; we adjust opacity until visual parity.
- **Dev-mode lag doesn't improve enough.** Unavoidable floor; the user must test on prod for real perf judgments. Documented in the delivery notes.

## Rollback

Every phase is an isolated commit on this branch. Any phase can be reverted with `git revert <sha>` without affecting other phases. Phase 0 is independent and reversible; phases 1–6 are independently reversible.
