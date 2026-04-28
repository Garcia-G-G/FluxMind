# FluxMind — Claude Code Max: SOURCES URL DISPLAY FIX

> **Read `CLAUDE.md` first** for stack and code style rules.
> Every fix here is specific, with file paths and line numbers. No guessing.

---

## GOAL

Make ALL source types display their origin URLs in the source panel. Currently only `web-search` sources (metadata.origin === "web-search") show their found URLs. Direct URL and YouTube sources don't show their URLs at all.

---

## ROOT CAUSE ANALYSIS

### What already works:
- `POST /api/sources/search` (file: `src/app/api/sources/search/route.ts`, 217 lines) — **ALREADY uses Serper API** and saves `foundUrls` in `metadata` (line 155-161). This was fixed in a previous session.
- Source panel (file: `src/components/notebook/source-panel.tsx`) — **ALREADY has expandable URL list** at lines 331-371 for web-search sources with `foundUrls`.
- `getFoundUrls()` at line 52-65 and `isWebSearchSource()` at line 47-50 already extract the data correctly.

### What's broken:

**Problem 1: `GET /api/sources` doesn't return `originalUrl`**

File: `src/app/api/sources/route.ts` lines 33-46

The SELECT query returns: `id, type, title, tokenCount, status, metadata, createdAt, updatedAt, chunkCount`

It does **NOT** select `sources.originalUrl`. This column exists in the DB schema (`src/db/schema/sources.ts` line 46) and is populated for URL and YouTube sources by `POST /api/sources/url` (line 57). But it never reaches the frontend.

**Problem 2: Source panel only shows URLs for web-search sources**

File: `src/components/notebook/source-panel.tsx` line 217:
```typescript
const foundUrls = isWebSearch ? getFoundUrls(source.metadata) : [];
```

If the source is NOT a web-search source (e.g., it's a direct URL or YouTube), `foundUrls` is forced to `[]` and `canExpand` is `false` (line 219), so no URL is ever displayed.

**Problem 3: Old search sources created before Serper update**

Sources created with the old GPT-4o synthetic text route have `metadata: { origin: "ai-research" }` — no `foundUrls` array. These show up as plain text files with no URLs.

---

## EXECUTION ORDER

1. Add `originalUrl` to GET /api/sources response
2. Show URLs for ALL source types in the panel
3. Verify

---

## TASK 1: ADD `originalUrl` TO THE API RESPONSE

**File**: `src/app/api/sources/route.ts`

### 1A. Add `originalUrl` to the SELECT query (line 34)

Find this block (lines 33-46):
```typescript
const notebookSources = await db
  .select({
    id: sources.id,
    type: sources.type,
    title: sources.title,
    tokenCount: sources.tokenCount,
    status: sources.status,
    metadata: sources.metadata,
    createdAt: sources.createdAt,
    updatedAt: sources.updatedAt,
    chunkCount: sql<number>`COALESCE(COUNT(${sourceChunks.id}), 0)::int`.as(
      "chunk_count",
    ),
  })
```

Add `originalUrl` to the select:

```typescript
const notebookSources = await db
  .select({
    id: sources.id,
    type: sources.type,
    title: sources.title,
    originalUrl: sources.originalUrl,  // ← ADD THIS
    tokenCount: sources.tokenCount,
    status: sources.status,
    metadata: sources.metadata,
    createdAt: sources.createdAt,
    updatedAt: sources.updatedAt,
    chunkCount: sql<number>`COALESCE(COUNT(${sourceChunks.id}), 0)::int`.as(
      "chunk_count",
    ),
  })
```

Also add `originalUrl` to the `.groupBy()` if needed — Drizzle might require all non-aggregated columns in GROUP BY. Check if adding it causes a type error; if so, add `sources.originalUrl` to the groupBy call at line 57.

---

## TASK 2: SHOW URLs FOR ALL SOURCE TYPES IN THE PANEL

**File**: `src/components/notebook/source-panel.tsx`

### 2A. Change URL extraction logic (line 217)

Replace the current logic that only gets URLs for web-search sources:

```typescript
// BEFORE (line 217):
const foundUrls = isWebSearch ? getFoundUrls(source.metadata) : [];
```

With logic that gets URLs for ALL source types:

```typescript
// Build URL list from whatever data is available
const foundUrls = (() => {
  // Web-search sources: multiple URLs in metadata.foundUrls
  if (isWebSearch) return getFoundUrls(source.metadata);

  // URL/YouTube sources: single URL in originalUrl
  if (source.originalUrl) {
    const hostname = (() => {
      try { return new URL(source.originalUrl).hostname; }
      catch { return source.originalUrl; }
    })();
    return [{
      url: source.originalUrl,
      title: source.title || hostname,
      domain: hostname,
      favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
    }] satisfies FoundUrl[];
  }

  return [] as FoundUrl[];
})();
```

### 2B. Allow expand for URL/YouTube sources too (line 219)

The current line:
```typescript
const canExpand = foundUrls.length > 0;
```

This is already correct — it will now be `true` for URL/YouTube sources since `foundUrls` will have 1 item. No change needed here.

### 2C. Show the source type icon correctly for URL sources

Currently URL sources have `type: "url"` or `type: "youtube"` in the DB, and `typeConfig` at line 24-32 already maps them to the correct icons (Link for url, PlayCircle for youtube). But sources added via search have `type: "txt"`. The `isWebSearch` check already overrides to Globe icon. No change needed.

### 2D. Update the type for `source` to include `originalUrl`

Check how `useSources` hook types the response. Find `src/hooks/use-sources.ts` and ensure the type includes `originalUrl: string | null`. If it uses `typeof` inference from the API response, it should auto-include it after Task 1. If it has an explicit type, add `originalUrl`.

---

## TASK 3: VERIFY

1. **`pnpm build`** — zero errors
2. **`pnpm lint`** — zero errors
3. **`pnpm test`** — existing tests pass
4. **Check:**
   - Add a source via URL paste → source card should show the URL with favicon and domain (expandable)
   - Add a source via search → source card should show all found URLs (expandable, same as before)
   - Add a YouTube source → should show the YouTube URL
   - Old sources (no metadata.foundUrls, no originalUrl) → should still work, just no expand button

---

## GUIDELINES

You have full freedom to change whatever is needed. The instructions above are a detailed starting point based on the actual root cause — not restrictions. If you find a better approach, go for it.

**Key context:**
- `POST /api/sources/search` already uses Serper API and saves `foundUrls` — don't redo that work
- `POST /api/sources/url` already saves `originalUrl` — don't redo that either
- The core fix is small: add `originalUrl` to the GET response + show it in the panel for all source types
- `pnpm build && pnpm lint && pnpm test` must all pass
