# FluxMind — Full Codebase Audit

> **Comprehensive code review**: security, performance, reliability, frontend quality, infrastructure.
> Organized by severity. Each item has file path, line numbers, and a concrete fix.

---

## 🔴 CRITICAL (fix immediately — security or data loss risk)

### 1. Middleware auth bypass — cookie existence check only
**File**: `/src/middleware.ts:11`
The middleware checks `!!sessionCookie` (cookie name exists) to gate protected routes. Any request with a forged cookie name passes. Better Auth provides `auth.api.getSession` to verify the token cryptographically.
**Fix**: Call `auth.api.getSession({ headers })` in the middleware and reject on failure.

### 2. No rate limiting on ANY API route
Every route — chat, TTS, research, all studio generators, upload — accepts unlimited requests. A single user can drain the OpenAI/Gemini/ElevenLabs/Fal.ai budget in minutes. Redis is already in the stack.
**Fix**: Create a `checkRateLimit(userId, key, limit, windowMs)` utility backed by Redis `INCR` + `EXPIRE`. Apply to all AI-generation routes and upload routes.

### 3. No security headers
`next.config.ts` has no `headers()` export. Missing: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`.
**Fix**: Add a `headers()` function to `next.config.ts` with all standard security headers.

### 4. Upload route buffers entire file before size check
**File**: `/src/app/api/sources/upload/route.ts:60`
`Buffer.from(await file.arrayBuffer())` runs before `validateFile`. A 500 MB upload OOMs the serverless function.
**Fix**: Check `file.size` BEFORE calling `arrayBuffer()`.

### 5. Upload route stores entire file as base64 in PostgreSQL
**File**: `/src/app/api/sources/upload/route.ts:71-85`
When R2 is not configured, the full file buffer is base64-encoded into a `jsonb` column. A 20 MB PDF = 27 MB of inline JSON in the DB, exceeding row size limits and killing query performance.
**Fix**: Use the existing local disk fallback in `r2.ts` instead of storing base64 in the DB.

### 6. Video generation fires detached promise in serverless
**File**: `/src/app/api/studio/video/route.ts:82-92`
`generateVideo(...).catch(console.error)` runs without `await` in a serverless function. The runtime terminates the process after returning 201, killing the in-flight generation. Output stays `"pending"` forever.
**Fix**: Use BullMQ to enqueue the job (same pattern as podcast route).

### 7. Missing auth on studio GET handlers
**Files**: `/src/app/api/studio/audio/route.ts:9`, `/src/app/api/studio/video/route.ts:8`
Both GET handlers have NO auth check. Any unauthenticated caller can enumerate output records by guessing `notebookId`.
**Fix**: Add session check at the top of both GET handlers.

### 8. No environment variable validation
Every env access is bare `process.env.FOO!`. No Zod schema, no `@t3-oss/env-nextjs`.
**Fix**: Create `/src/env.ts` with `@t3-oss/env-nextjs` + Zod. Import `env` everywhere. Catches missing keys at build time.

---

## 🟠 IMPORTANT (fix soon — performance, reliability, or UX impact)

### 9. `getStudioContext` fetches ALL raw text from every source
**File**: `/src/lib/studio/generate.ts:32-40`
Selects full `rawText` for every source in the notebook (no `LIMIT`), then slices in JS. 20 PDFs at 50k tokens each = 1 MB+ from Postgres per generation. Duplicated in `flashcards/route.ts:62-70` and `quiz/route.ts:83-91`.
**Fix**: Use `retrieveContext()` from `lib/ai/rag.ts` (vector search) instead of fetching all raw text.

### 10. Research pipeline makes 12 sequential HTTP scrapes
**File**: `/src/lib/research/pipeline.ts:89-101`
`scrapePage` is called one-at-a-time in a `for` loop. 12 serial network round-trips = 10-30+ seconds.
**Fix**: `await Promise.allSettled(pagesToRead.map(r => scrapePage(r.url)))`.

### 11. N+1 query in sources listing
**File**: `/src/app/api/sources/route.ts:43`
Correlated subquery `(SELECT COUNT(*) FROM source_chunks WHERE ...)` executes per source row. 50 sources = 51 DB queries.
**Fix**: Use `LEFT JOIN` + `COUNT()` + `GROUP BY sources.id`.

### 12. `sources/search/route.ts` — blocking AI call (30-60s) on request thread
**File**: `/src/app/api/sources/search/route.ts:63`
Runs `generateText` synchronously. If it exceeds `maxDuration=60`, the source record stays in `"processing"` permanently.
**Fix**: Enqueue via BullMQ and return 202 Accepted, or SSE-stream progress.

### 13. `rawText` stored on the parent `sources` table
**File**: `/src/db/schema/sources.ts:43`
Full document text lives alongside metadata, bloating every `SELECT *`.
**Fix**: Move `rawText` to a separate `source_content` table or only use `source_chunks`.

### 14. TTS route has no text length limit
**File**: `/src/app/api/audio/tts/route.ts:14`
Only checks `if (!text)`. 100k characters = massive ElevenLabs bill. Raw ElevenLabs errors leak to client.
**Fix**: Add `if (text.length > 5000) return NextResponse.json({ error: "Text too long" }, { status: 400 })`.

### 15. `tldraw` is a `devDependency` but used at runtime
**File**: `package.json:71`
`@tldraw/tldraw` under `devDependencies` but imported in `canvas-editor.tsx`. Production builds will fail.
**Fix**: Move to `dependencies`.

### 16. Stripe webhook calculates period end in JS instead of reading from Stripe
**File**: `/src/app/api/webhooks/stripe/route.ts:46-48`
`periodEnd.setMonth(periodEnd.getMonth() + 1)` — annual plans and trials get wrong dates.
**Fix**: Read `subscription.current_period_end` from the Stripe subscription object.

### 17. Redis connection has no error/reconnect handling
**File**: `/src/lib/queue.ts:4-17`
Singleton IORedis connection with no `connection.on('error')` handler. Stale connections after disconnect are never replaced.
**Fix**: Add error handler and reconnect logic.

---

## 🟡 FRONTEND ISSUES

### 18. `FlashcardView` — stale closure bug
**File**: `/src/components/flashcard-view.tsx:112`
`useEffect` registers keyboard listener with no dependency array. `goNext`/`goPrev` are stale closures.
**Fix**: Wrap `goNext`/`goPrev` in `useCallback`, add proper deps.

### 19. `AppShell` — inline `<style>` tag re-injected on every sidebar toggle
**File**: `/src/components/app-shell.tsx:47`
Template-literal `<style>` block in JSX creates/removes a DOM element per toggle. Hydration mismatch risk.
**Fix**: Use `document.documentElement.style.setProperty` in a `useEffect`.

### 20. `StudioPage` — components defined inside render
**File**: `/src/app/(app)/notebook/[id]/studio/page.tsx:376`
`StudioCard` and `SectionHeader` are new function references on every render. All cards unmount/remount on any parent state change.
**Fix**: Extract both to module-level components.

### 21. `SourcePanel` — destructive delete with no confirmation
**File**: `/src/components/source-panel.tsx:234`
Clicking trash icon immediately fires `deleteSource.mutate`. No undo, no dialog. Also missing `aria-label`.
**Fix**: Add confirmation dialog + aria-label.

### 22. `ChatPanel` — `initialMessages` creates new array every render
**File**: `/src/components/chat-panel.tsx:61`
`.map()` not wrapped in `useMemo`. `useChat` receives new array reference on every render.
**Fix**: Wrap in `useMemo([initialMessages])`.

### 23. `SlideViewer` — `<img>` instead of Next.js `<Image>`
**File**: `/src/components/slide-viewer.tsx:183, 329`
16 slides × large PNGs = missed LCP optimization, lazy-loading, and Next.js image pipeline.
**Fix**: Replace with `<Image>` + configure `remotePatterns` in next.config.ts.

### 24. Empty `Suspense` fallbacks cause layout flash
**Files**: `/src/components/sidebar.tsx:187`, `/src/app/(app)/dashboard/page.tsx:350`
Fallback is `<div />` — entire sections flash blank. CLS penalty.
**Fix**: Add skeleton placeholders matching the expected layout.

### 25. Hardcoded English strings throughout UI
`"No sources yet"`, `"Click or press space to flip"`, `"Quiz Complete!"`, etc. The codebase has `language.tsx` utility but no component strings are routed through it.
**Fix**: Route all UI strings through the i18n system.

---

## 🔵 DATABASE & SCHEMA

### 26. Missing composite index on `flashcard_progress`
**File**: `/src/db/schema/progress.ts:68-72`
SRS queries filter by `(outputId, userId, nextReview)` but only separate indexes exist.
**Fix**: Add composite index `.on(table.outputId, table.userId)`.

### 27. Missing index on `users.stripeCustomerId`
Stripe webhook handlers look up users by `stripeCustomerId` with no index. Full table scan.
**Fix**: Add `index("users_stripe_customer_id_idx").on(table.stripeCustomerId)`.

### 28. Missing index on `notebookCollaborators.userId`
Primary key is `(notebookId, userId)`. "All notebooks shared with me" queries need `userId` as leading key.
**Fix**: Add `index("notebook_collaborators_user_id_idx").on(table.userId)`.

### 29. `outputs.likes` race condition
**File**: `/src/db/schema/outputs.ts:52`
Mutable integer counter with read-modify-write pattern.
**Fix**: Use `UPDATE outputs SET likes = likes + 1` or model as a `output_likes` join table.

### 30. Notebooks listing has no pagination
**File**: `/src/app/api/notebooks/route.ts` GET
Returns all notebooks with no `LIMIT`/`OFFSET`. Power users with 500+ notebooks get unbounded responses.
**Fix**: Add cursor-based pagination.

---

## ⚪ MINOR / CONFIG

### 31. `shadcn` CLI listed as production dependency
`package.json` — `shadcn` is a code generator, not a runtime import. Move to `devDependencies`.

### 32. `onDemandEntries` in next.config.ts is Pages Router only
**File**: `next.config.ts:43-46`
Silently ignored with App Router. Remove to avoid confusion.

### 33. `@ffmpeg-installer/ffmpeg` inflates serverless bundle by ~60 MB
**File**: `package.json:27`
Ship the binary only in the worker container. Add to `serverExternalPackages` in next.config.ts.

### 34. `@types/node` pinned at `^20`, Node likely runs 22+
**Fix**: Bump to `^22` for correct type coverage.

### 35. No `@next/bundle-analyzer` configured
With tldraw, motion, xyflow, ffmpeg, jspdf, html2canvas — bundle analysis is essential.
**Fix**: Add `ANALYZE=true` script with `@next/bundle-analyzer`.

### 36. `vitest.config.ts` uses `node` environment for component tests
`.test.tsx` files included but no DOM environment. Component tests will fail.
**Fix**: Add `environmentMatchGlobs: [["**/*.tsx", "happy-dom"]]`.

### 37. TypeScript missing `noUncheckedIndexedAccess`
`tsconfig.json` has `strict: true` but not `noUncheckedIndexedAccess: true`. Array/object index access silently returns `T` instead of `T | undefined`.

### 38. No `images.remotePatterns` in next.config.ts
Any `<Image>` pointing to R2, Google avatars, or fal.ai URLs will throw "hostname not allowed".
**Fix**: Add R2, googleapis.com, fal.ai to `remotePatterns`.

### 39. `sources/[id]/route.ts` DELETE — fragile R2 key extraction
**File**: `/src/app/api/sources/[id]/route.ts:104`
`source.fileUrl.split("/").slice(-4).join("/")` assumes a fixed URL structure.
**Fix**: Store `fileKey` in the `sources` table at upload time.

### 40. Silent queue failure leaves sources in "pending" forever
**File**: `/src/app/api/sources/upload/route.ts:103-106`
Queue error caught with `console.warn` only. No retry, no user signal.
**Fix**: Update source status to `"error"` on queue failure.

---

## PRIORITY ORDER (recommended)

| Priority | Items | Effort | Impact |
|----------|-------|--------|--------|
| **P0 — This week** | #1 (auth bypass), #2 (rate limit), #3 (security headers), #7 (missing auth) | Medium | Prevents exploit |
| **P0 — This week** | #4 (upload OOM), #5 (base64 in DB), #6 (video fire-and-forget) | Low | Prevents data loss/OOM |
| **P1 — Next sprint** | #8 (env validation), #9 (RAG vs rawText), #10 (parallel scrapes), #11 (N+1) | Medium | Performance 3-10x |
| **P1 — Next sprint** | #15 (tldraw dep), #16 (Stripe dates), #26-28 (DB indexes) | Low | Correctness |
| **P2 — Soon** | #18-24 (frontend quality), #25 (i18n) | Medium | UX polish |
| **P3 — Backlog** | #31-40 (config/minor) | Low | DX & maintenance |

---

**Total issues found: 40**
- 🔴 Critical: 8
- 🟠 Important: 9
- 🟡 Frontend: 8
- 🔵 Database: 5
- ⚪ Minor/Config: 10
