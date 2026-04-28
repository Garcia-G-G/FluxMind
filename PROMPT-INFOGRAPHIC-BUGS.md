# FluxMind — Claude Code Max: INFOGRAPHIC BUGS + VISUAL VARIETY

> **Read `CLAUDE.md` first** for stack and code style rules.

---

## WHAT'S ALREADY DONE (don't redo)

- ✅ 30 layout templates exist in `src/lib/media/infographic-templates.ts` (823 lines)
- ✅ `selectTemplate()` with deterministic hash-based selection works
- ✅ Multi-page generation (3-10 pages) works
- ✅ Viewer has pagination ("3 / 3" counter, arrows, thumbnail strip)
- ✅ `pageIndex` passed through to template selection

---

## WHAT'S STILL BROKEN — 3 PROBLEMS

### Problem 1: ALL PAGES LOOK THE SAME despite 30 templates

**Root cause**: The LLM prompt (file `src/app/api/studio/infographic/route.ts`, lines 282-370) prescribes a FIXED recipe for every page:

```
Opening (hook):
→ 1-2 "stat" blocks
Body (teach):
→ 1 "chart" block
→ 1-2 "callout" blocks  
→ 1 "flow" or "timeline" block
→ 1 "comparison" block
Closing (seal):
→ 1 "takeaway" block
```

Every page follows this EXACT pattern, so they all get ~2 stats + 1 chart + 2 callouts + 1 flow + 1 comparison + 1 takeaway. The 30 templates render these same block types similarly because most templates pair stats 2-up and flow callouts the same way.

**Fix**: Change the LLM prompt so each page in the series uses a DIFFERENT block composition. Page 1 should be stat-heavy, page 2 chart-heavy, page 3 comparison-focused, etc. The prompt must EXPLICITLY tell the LLM what block mix to use for each page position.

Replace the current "STEP 2 — STRUCTURE" section (lines 317-336) with page-specific instructions:

```
STEP 2 — STRUCTURE (EACH PAGE MUST BE DIFFERENT)

The series must showcase VARIETY. Each page should feel visually distinct.
Follow these block compositions strictly:

Page 1 (Overview): 
  → 3-4 "stat" blocks (data dashboard style — hook with numbers)
  → 1 "text" block (brief framing paragraph)
  → 1 "takeaway" block

Page 2 (Deep Dive A):
  → 1 "chart" block (hero visual — takes center stage)
  → 2 "callout" blocks explaining what the chart reveals
  → 0 stat blocks (none — this page is about the chart)

Page 3 (Deep Dive B):
  → 1 "flow" OR "timeline" block (hero — process or history)
  → 1 "comparison" block
  → 1 "callout" block
  → 0 stat blocks, 0 chart blocks

For pages 4+, cycle through these patterns:
  - Pattern A: 4 stats + 1 takeaway (numbers dashboard)
  - Pattern B: 1 chart + 3 callouts (analysis page)
  - Pattern C: 1 timeline + 1 comparison + 1 text (narrative page)
  - Pattern D: 2 comparisons + 2 stats (versus page)

CRITICAL: Never put the same block types on consecutive pages. If page 2 has a chart, page 3 must NOT have a chart. If page 3 has a flow, page 4 must NOT have a flow.
```

### Problem 2: COMPARISON TEXT OVERFLOWS ITS BOX

**Root cause**: File `src/lib/media/compose-infographic.ts`, line 566:

```typescript
const labelLines = wrapText(item.label, 16).slice(0, 3);
```

The `wrapText` call wraps at **16 characters**, but comparison box widths are 300-600px (depending on item count). The text "Rails supports full stack, Django focuses on backend" has words way longer than what 16-char wrapping can handle properly — the entire label renders as one long line that overflows the box.

Also, `item.value` on line 564 is rendered at font-size 26 with NO wrapping at all:
```typescript
`<text ... font-size="26" ...>${escapeXml(item.value)}</text>`
```

If the value is a long sentence (not a short number), it bleeds out of the box.

**Fix**: 

1. Change `wrapText(item.label, 16)` to use a dynamic character width based on box width:
```typescript
// ~7.5px per char at font-size 13 with FONT_TECHNICAL
const charsPerLine = Math.floor(colW / 7.5);
const labelLines = wrapText(item.label, Math.max(12, charsPerLine)).slice(0, 4);
```

2. Also wrap `item.value` to prevent overflow:
```typescript
const valueText = item.value.length > 20 
  ? item.value.slice(0, 18) + "…"
  : item.value;
```

3. Increase `rowH` from 110 to at least 130 to fit 4 lines of label text.

### Problem 3: BAR CHART LOOKS LIKE SOLID RECTANGLES

**Root cause**: File `src/lib/media/compose-infographic.ts`, lines 194-200:

```typescript
const barW = Math.max(8, plotW / (n * 2));
```

With 3 data points and `plotW` = 1180, each bar is `1180 / 6 = 197px` wide. That's nearly 200 pixels — almost touching each other, creating a wall of solid blue.

**Fix**: Cap bar width and add proper spacing:

```typescript
const barW = Math.min(60, Math.max(8, plotW / (n * 3)));
```

This caps bars at 60px wide, creating visible gaps between them. Also add a subtle rounded-rect visual:

```typescript
// Add subtle label on top of each bar
parts.push(
  `<text x="${p.px.toFixed(1)}" y="${(p.py - 6).toFixed(1)}" font-family="${FONT_TECHNICAL}" font-size="11" fill="${accent}" text-anchor="middle" font-weight="600">${p.y}</text>`,
);
```

---

## EXECUTION ORDER

1. Fix the LLM prompt — force different block compositions per page
2. Fix comparison text wrapping — dynamic char width + value truncation
3. Fix bar chart width — cap at 60px
4. Verify

---

## TASK 1: FIX THE LLM PROMPT

**File**: `src/app/api/studio/infographic/route.ts`

Find the prompt string that starts around line 282 with `generateObject`. Replace the "STEP 2 — STRUCTURE" section (approximately lines 317-336).

**Current** (REMOVE this entire block):
```
STEP 2 — STRUCTURE (target: ${detailPick})

An infographic tells a visual story. Compose:

Opening (hook):
→ 1-2 "stat" blocks with surprising numbers to anchor attention

Body (teach):
→ 1 "chart" block if the sources contain quantitative data
→ 1-2 "callout" blocks for concepts that need deeper explanation
→ 1 "flow" or "timeline" block if there's a process or chronology
→ 1 "comparison" block if named alternatives are discussed
→ 0-1 "text" blocks ONLY when essential context can't be conveyed visually

Closing (seal):
→ 1 "takeaway" block with a specific, memorable, actionable conclusion

Never use more than 2 of the same block type. Vary layouts.
```

**Replace with** (page-specific compositions):
```
STEP 2 — STRUCTURE (EACH PAGE MUST HAVE A DIFFERENT BLOCK MIX)

The infographic series must feel visually varied. Each page uses a DIFFERENT combination of block types. Follow these compositions:

PAGE 1 — "Data Dashboard" (overview with numbers):
  • 3–4 "stat" blocks (the biggest, most surprising numbers from the sources)
  • 1 "text" block (2-3 sentences framing the topic)
  • 1 "takeaway" block (the single most important insight)
  • NO chart, NO flow, NO comparison on this page

PAGE 2 — "Chart Analysis" (visual data story):
  • 1 "chart" block — this is the hero (line, bar, or area chart with 4-8 real data points)
  • 2–3 "callout" blocks explaining what the chart reveals, with specific numbers
  • NO stat blocks on this page

PAGE 3 — "Process & Context" (narrative flow):
  • 1 "flow" or "timeline" block — the main visual element
  • 1 "comparison" block (2-4 named alternatives with quantifiable differences)
  • 1 "callout" block for extra context
  • NO stat blocks, NO chart on this page

FOR PAGES 4+ (if ${infographicCount} > 3), rotate through these patterns:
  • "Versus Page": 2 "comparison" blocks + 2 "stat" blocks (head-to-head analysis)
  • "Deep Analysis": 1 "chart" + 1 "timeline" + 1 "takeaway" (trends over time)
  • "Key Concepts": 3 "callout" blocks + 1 "stat" (definitions and explanations)
  • "Summary Dashboard": 4 "stat" blocks + 1 "takeaway" (numbers recap)

STRICT RULE: No two consecutive pages may share the same dominant block type. If page 2 has a chart, page 3 must NOT have a chart. If page 3 has a timeline, page 4 must NOT have a timeline.

Each page should have 4–8 blocks total (density: ${detailPick}).
```

### Also update the SERIES STRUCTURE section (lines 286-296)

Make it match the new block compositions:

```
SERIES STRUCTURE:
- Page 1: "Data Dashboard" — hook with the most surprising numbers, overview the topic
- Page 2: "Chart Analysis" — visual data deep dive with charts and annotations
- Page 3: "Process & Context" — how things work or evolved, with comparisons
- Pages 4+: Rotate through different emphases (versus, trends, concepts, summary)
- Last page: Always end with a strong "takeaway" block
```

---

## TASK 2: FIX COMPARISON TEXT WRAPPING

**File**: `src/lib/media/compose-infographic.ts`

### 2A. Fix label wrapping (line 566)

Find:
```typescript
const labelLines = wrapText(item.label, 16).slice(0, 3);
```

Replace with:
```typescript
// Dynamic char width based on actual column width (~7.5px per char at font-size 13)
const charsPerLine = Math.max(12, Math.floor(colW / 7.5));
const labelLines = wrapText(item.label, charsPerLine).slice(0, 4);
```

### 2B. Truncate long values (line 564)

Find:
```typescript
`<text x="${bx + colW / 2}" y="${y0 + 34}" font-family="${FONT_SERIF}" font-size="26" font-weight="700" fill="${accent}" text-anchor="middle">${escapeXml(item.value)}</text>`,
```

Replace with:
```typescript
// Truncate value if too long for the column width
const maxValueChars = Math.max(8, Math.floor(colW / 14)); // ~14px per char at font-size 26
const displayValue = item.value.length > maxValueChars
  ? item.value.slice(0, maxValueChars - 1) + "…"
  : item.value;
`<text x="${bx + colW / 2}" y="${y0 + 34}" font-family="${FONT_SERIF}" font-size="26" font-weight="700" fill="${accent}" text-anchor="middle">${escapeXml(displayValue)}</text>`,
```

### 2C. Increase comparison row height (line 557)

Find: `const rowH = 110;`
Replace: `const rowH = 140;`

---

## TASK 3: FIX BAR CHART WIDTH

**File**: `src/lib/media/compose-infographic.ts`

### 3A. Cap bar width (around line 195)

Find:
```typescript
const barW = Math.max(8, plotW / (n * 2));
```

Replace with:
```typescript
const barW = Math.min(60, Math.max(8, plotW / (n * 3)));
```

### 3B. Add value labels on top of bars (after line 200)

After the bar rect is drawn, add a label showing the value:

```typescript
// Value label on top of each bar
parts.push(
  `<text x="${p.px.toFixed(1)}" y="${(p.py - 8).toFixed(1)}" font-family="${FONT_TECHNICAL}" font-size="11" fill="${accent}" text-anchor="middle" font-weight="600">${p.y}</text>`,
);
```

---

## TASK 4: VERIFY

1. **`pnpm build`** — zero errors
2. **`pnpm lint`** — zero errors
3. **`pnpm test`** — existing tests pass
4. **Generate 3 infographics and visually check:**
   - Page 1 should be STAT-HEAVY (data dashboard, mostly numbers)
   - Page 2 should be CHART-HEAVY (big chart with callouts, NO stats)
   - Page 3 should have a FLOW or TIMELINE (process/history, NO chart)
   - All 3 should look visually DIFFERENT from each other
   - Comparison text should NOT overflow its box
   - Bar charts should have gaps between bars, not solid walls

---

## GUIDELINES

You have full freedom to modify the LLM prompt, block renderers, templates, types, or anything else needed. The fixes above are based on verified root causes — but if you find a better solution, use it.

The core insight: **the 30 templates already exist and work, but they all receive the same block-type mix because the LLM prompt prescribes a fixed recipe**. The fix is in the prompt, not the rendering engine.
