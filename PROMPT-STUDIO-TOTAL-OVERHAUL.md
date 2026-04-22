# FluxMind — Claude Code Max Prompt: Studio Total Overhaul

> **Read `CLAUDE.md` first** for stack and code style rules.
> **Read `PROMPT-STUDIO-MEDIA-ENGINE.md`** for the hybrid composition architecture (slides/infographic images).
> This prompt covers: rewriting ALL generation prompts for content density, redesigning ALL viewer components to look premium, fixing the Generate Dialog design, and fixing critical bugs.

---

## CONTEXT: WHAT'S WRONG

1. **Generation prompts are weak**: Only infographic and slides have good prompts. The other 8 outputs (flashcards, quiz, thread, newsletter, reel, course, mindmap, datatable) have 5-10 line prompts with no chain-of-thought, no extraction pass, no good/bad examples. Result: shallow, generic content that says nothing specific.

2. **Infographic SVG renderer is the #1 bottleneck**: The prompt generates good structured data, but the SVG overlay TRUNCATES almost everything. Stat boxes are 120x70px (barely fits a number). Callout bodies get sliced to 3 lines. Stat labels have NO text wrapping at all. The layout is always the same rigid top-to-bottom flow. Colors ignore the style config. The result: every infographic looks identical and says almost nothing.

3. **Viewers look basic and dated**: Flashcards are plain white rectangles. Quiz uses tiny progress dots. Thread doesn't look like real Twitter. Course sidebar is broken on mobile. Data tables use default styling. Everything needs premium polish.

4. **Generate Dialog looks AI-generated**: Emoji icons (🔄 ✏️ 🌸 💼 🔬 ◻️) are the #1 signal. Every section uses identical grid tiles with no visual hierarchy. Native range slider for slide count. Sources section is cramped.

5. **Critical bugs**: AudioPlayer imports removed `GlassCard`. Reel route saves as `type: "video"` instead of `"reel"`. `selectedSourceIds` is logged but never used to filter sources. `customPrompt` not supported in 7 of 10 routes.

---

## EXECUTION ORDER

1. **Task 1**: Fix critical bugs first
2. **Task 2**: Rewrite ALL generation prompts (the 8 weak ones)
3. **Task 2.5**: **INFOGRAPHIC OVERHAUL — SVG renderer + layout engine + style colors** ← NEW, CRITICAL
4. **Task 3**: Redesign the Generate Dialog
5. **Task 4**: Redesign Flashcard viewer
6. **Task 5**: Redesign Quiz viewer
7. **Task 6**: Redesign Thread viewer
8. **Task 7**: Redesign Newsletter viewer
9. **Task 8**: Redesign Reel viewer
10. **Task 9**: Redesign Course viewer
11. **Task 10**: Redesign Data Table viewer
12. **Task 11**: Polish Slide and Infographic viewers
13. **Task 12**: Fix AudioPlayer + NarrationPlayer
14. **Task 13**: Wire `customPrompt` and `selectedSourceIds` into all routes
15. **Task 14**: Verification

---

## TASK 1: FIX CRITICAL BUGS

### 1A. AudioPlayer GlassCard import
**File**: `/src/components/audio/audio-player.tsx` — line 17
```typescript
// REMOVE:
import { GlassCard } from "@/components/shared/glass-card";
// REPLACE with: plain div using var(--fm-*) tokens
```
Replace every `<GlassCard>` usage with:
```tsx
<div style={{
  background: "var(--fm-surface)",
  border: "1px solid var(--fm-surface-border)",
  borderRadius: "1rem",
  padding: "1.25rem",
}}>
```

### 1B. Reel route type bug
**File**: `/src/app/api/studio/reel/route.ts` — line 45
```typescript
// WRONG:
type: "video",
// FIX:
type: "reel",
```

### 1C. `selectedSourceIds` not filtering
**Files**: `/src/app/api/studio/infographic/route.ts`, `/src/app/api/studio/slides/route.ts`, `/src/app/api/studio/mindmap/route.ts`, `/src/app/api/studio/video/route.ts`

Currently `selectedSourceIds` is logged but NOT used. Implement actual filtering:
```typescript
// In getStudioContext or in each route after getting ctx:
const selectedIds = body.selectedSourceIds as string[] | undefined;
if (selectedIds && selectedIds.length > 0) {
  // Filter sourceContext to only include selected sources
  // This requires modifying getStudioContext to return individual source objects
  // OR filtering the concatenated context by source title markers
}
```

The simplest approach: modify `getStudioContext` to accept an optional `selectedSourceIds` parameter and add a `WHERE id IN (...)` clause to the sources query when provided.

---

## TASK 2: REWRITE ALL GENERATION PROMPTS

Every prompt must follow this structure (same pattern as the already-good infographic/slides prompts):

```
STEP 1 — EXTRACT: Read all sources. Identify the [N] most specific, surprising, educational facts.
STEP 2 — STRUCTURE: Organize into [output format] with [constraints].
STEP 3 — DENSITY CHECK: Every [unit] must contain a real fact, statistic, named entity, or specific example. Generic filler = failure.
STEP 4 — QUALITY: [output-specific rules]

GOOD example: [concrete example of high-quality output]
BAD example: [concrete example of generic output]

Sources:
${sourceContext}
```

Also: ALL routes must now accept `customPrompt` from the request body and inject it:
```typescript
const userInstr = body.customPrompt
  ? `\nUSER REQUEST: "${body.customPrompt}". Incorporate this focus into the output.\n`
  : "";
```

And ALL routes must accept `detailLevel` and adjust output length:
```typescript
const detailMap: Record<string, string> = {
  concise: "[SHORT version instructions]",
  standard: "[STANDARD version instructions]",
  detailed: "[DETAILED version instructions]",
};
const detailInstr = detailMap[body.detailLevel as string] ?? detailMap.standard;
```

### 2A. Flashcards (`/src/app/api/studio/flashcards/route.ts`)

Replace the entire prompt with:

```
You are creating flashcards for serious study — each card must teach something specific that the student didn't know before.

STEP 1 — EXTRACT: Read all sources carefully. Identify every specific fact, definition, process, comparison, statistic, date, named entity, cause-effect relationship, and technical term.

STEP 2 — DESIGN CARDS: Create ${count} flashcards following these rules:

FRONT (question side):
- Ask about ONE specific concept, never two
- Prefer "Why does X happen?" over "What is X?" — test understanding, not recall
- Include context clues: "In the context of [topic], why..."
- Mix types: 30% definitions, 25% cause-effect, 20% comparisons, 15% application, 10% statistics

BACK (answer side):
- 2-4 sentences. First sentence = direct answer. Following sentences = elaboration with a specific example, statistic, or real-world application.
- MUST include at least one: specific number, named entity, date, or concrete example
- End with a memorable hook: a surprising fact, analogy, or "this matters because..."

HINT:
- Always provide a hint. One short sentence pointing toward the answer without giving it away.
- Example: "Think about what happens to conversion rates when load time increases"

STEP 3 — DENSITY CHECK:
GOOD front: "Why do 53% of mobile users abandon sites that take over 3 seconds to load?"
GOOD back: "Because perceived performance directly impacts trust. Google found that a 1-second delay reduces conversions by 7%. Amazon calculated that every 100ms of latency costs them 1% in sales. This is why Core Web Vitals became a ranking factor in 2021."

BAD front: "What is website performance?"
BAD back: "Website performance refers to how fast a website loads. It is important for user experience."

${detailInstr}
${userInstr}

Sources:
${sourceContext}
```

Detail levels for flashcards:
- concise: "Create ${count} cards. Focus on the 10 most critical facts only."
- standard: "Create ${count} cards covering all major concepts comprehensively."
- detailed: "Create ${count} cards. Include advanced concepts, edge cases, and connections between topics."

Also fix the Zod schema:
```typescript
const flashcardSchema = z.object({
  title: z.string(),
  cards: z.array(z.object({
    id: z.string(),
    front: z.string().min(10),
    back: z.string().min(30),
    hint: z.string().min(5),  // NOT nullable — always required
    difficulty: z.enum(["easy", "medium", "hard"]),
    sourceReference: z.string().nullable(),
    tags: z.array(z.string()),
  })).min(5).max(40),
});
```

### 2B. Quiz (`/src/app/api/studio/quiz/route.ts`)

Replace the entire prompt with:

```
You are creating a challenging, educational quiz. Questions must test real understanding, not surface recall.

STEP 1 — EXTRACT: Read all sources. Identify facts that can be tested: statistics, processes, comparisons, cause-effect chains, definitions with nuance, common misconceptions.

STEP 2 — DESIGN QUESTIONS: Create exactly ${count} questions.

Distribution:
- 60% Multiple Choice (4 options A/B/C/D, exactly 1 correct)
- 20% True/False
- 20% Free Response (short answer, 1-3 sentences)

Difficulty distribution: 25% easy, 50% medium, 25% hard.

QUESTION DESIGN RULES:
- Easy: test a key fact directly. "What percentage of websites use a CMS?"
- Medium: test understanding. "Why would a developer choose server-side rendering over client-side for an e-commerce site?"
- Hard: test application/synthesis. "A site loads in 4.2s on mobile. Based on the sources, which TWO optimizations would have the most impact?"

WRONG ANSWER DESIGN (multiple choice):
- Wrong options must be plausible, not obviously wrong
- Include common misconceptions as wrong answers
- All options must be similar length (don't make the right answer longer)

EXPLANATION DESIGN:
- Every question MUST have a detailed explanation (3-5 sentences)
- Start with WHY the correct answer is right
- Then explain WHY each wrong answer is wrong
- End with a real-world implication or additional fact

GOOD question: "According to Google's research, what is the maximum recommended page load time before the probability of bounce increases by 32%?" → A) 1 second B) 3 seconds C) 5 seconds D) 10 seconds → Correct: B
GOOD explanation: "Google found that as page load time goes from 1s to 3s, the probability of bounce increases 32%. At 5 seconds it's 90%, and at 10 seconds it's 123%. Option A (1 second) is Google's target, not the bounce threshold. Options C and D are beyond the critical threshold."

BAD question: "Is website speed important?" → True/False
BAD explanation: "Yes, website speed is important for user experience."

${detailInstr}
${userInstr}

Sources:
${sourceContext}
```

### 2C. Thread (`/src/app/api/studio/thread/route.ts`)

Replace the entire prompt with:

```
Create a viral X/Twitter thread that teaches something valuable. Every tweet must carry new information — no padding tweets.

STEP 1 — EXTRACT: Read sources. Find the single most surprising or counterintuitive insight. That's your hook.

STEP 2 — STRUCTURE:

Tweet 1 (HOOK): Bold claim or surprising stat that stops the scroll. Must include a specific number or named entity. Set isHook: true.

Tweets 2-N (CONTENT): Each tweet = one insight with evidence.
Format options per tweet:
- Stat tweet: "[Number]% of [thing] does [surprising behavior]. Here's why:"
- Story tweet: "[Named company/person] did [specific thing] and [specific result]."
- Framework tweet: "There are [N] types of [thing]:" followed by bullets using •
- Contrast tweet: "Most people think [common belief]. Actually, [surprising truth]."

Final tweet (CTA): Summarize the single biggest takeaway + call to action. Set isCTA: true.

RULES:
- Each tweet MUST be under 280 characters. Count carefully.
- Total: 8-15 tweets.
- No hashtags. Maximum 2 emojis in the entire thread.
- Every tweet must stand alone — if someone screenshots one tweet, it should still be valuable.
- NO filler tweets like "Let me explain..." or "Here's the thing..." — delete those and merge with the next tweet.

GOOD hook: "Amazon makes $4,722 per second. But in 2013, a 40-minute outage cost them $4.8M. Here's what they learned about reliability engineering:"
BAD hook: "Let me tell you about an interesting topic. 🧵"

${userInstr}

Sources:
${sourceContext}
```

Also add to schema: `text: z.string().max(280)` to enforce character limit.

### 2D. Newsletter (`/src/app/api/studio/newsletter/route.ts`)

Replace the entire prompt with:

```
Write a newsletter that someone would actually forward to a colleague. Think: Morning Brew meets Stratechery — informative, opinionated, specific.

STEP 1 — EXTRACT: Read sources. Identify the 3-4 most newsworthy, actionable, or surprising insights.

STEP 2 — WRITE:

HEADLINE: Specific and intriguing, not generic. 
GOOD: "Why 72% of New Websites Fail Within 6 Months (And the 3 Things Survivors Do Differently)"
BAD: "Important Things About Web Development"

INTRODUCTION (2-3 sentences): Lead with the single most surprising fact. Set the stakes — why should the reader care RIGHT NOW?

SECTIONS (3-4):
Each section has:
- title: Specific, not generic. "The $4.8M Lesson Amazon Learned About Uptime" not "Server Reliability"
- body: 2-3 paragraphs of SUBSTANCE. Include specific numbers, named companies, real examples, dates. Write as if every sentence costs $10 — no filler.
- pullQuote: Extract the single most quotable line from this section. If nothing is quotable, the section isn't specific enough — rewrite it.

KEY TAKEAWAYS (3-5): Each takeaway must be actionable. Start with a verb: "Optimize...", "Avoid...", "Consider...", "Test whether...". NOT "It's important to..." or "Remember that...".

CTA: Specific next step. "Run a Lighthouse audit on your top 3 pages this week" not "Learn more about web development".

${detailInstr}
${userInstr}

Sources:
${sourceContext}
```

Detail levels:
- concise: "Write a brief newsletter — 3 sections, 1 paragraph each. Total ~500 words."
- standard: "Write a full newsletter — 3-4 sections, 2-3 paragraphs each. Total ~800-1200 words."
- detailed: "Write an in-depth newsletter — 4 sections, 3 paragraphs each with deep analysis. Total ~1500-2000 words."

### 2E. Reel (`/src/app/api/studio/reel/route.ts`)

Replace the entire prompt with:

```
Write a 30-60 second short-form video script (TikTok/Reels/Shorts) that hooks viewers and delivers real value.

STEP 1 — EXTRACT: Find the single most shareable fact from the sources — something that would make a viewer say "wait, really?"

STEP 2 — SCRIPT:

HOOK (0-3 seconds, type: "hook"):
- Text: One sentence that creates a knowledge gap. "Did you know [surprising fact]?" or "Stop doing [common mistake] — here's why."
- visualSuggestion: Specific shot description. "Close-up of hands typing on laptop, text overlay appears with the stat"
- duration: 2-3

CONTENT (3-50 seconds, type: "content", 3-5 sections):
- Each section = one specific insight, not a vague statement
- Text: What the narrator says. Must include specific facts.
- visualSuggestion: Specific B-roll or on-screen graphic description.
- duration: realistic seconds for the text length (~150 words per minute of speech)

CTA (last 5-10 seconds, type: "cta"):
- Clear action: "Follow for more [topic]" or "Comment [X] if you want the full breakdown"
- visualSuggestion: "Speaker looking at camera, subscribe button animation"

RULES:
- Total duration: 30-60 seconds
- Every section must deliver a specific fact, not generic advice
- Caption: Write an engaging caption with 3-5 relevant hashtags
- Music: Suggest a specific mood/genre, not a copyrighted song name

GOOD hook: "Loading speed affects your revenue. Amazon loses $1.6 billion a year for every extra second."
BAD hook: "Here are some tips for making a better website."

${userInstr}

Sources:
${sourceContext}
```

**ALSO FIX**: Change `type: "video"` to `type: "reel"` on the DB insert (line 45).

### 2F. Course (`/src/app/api/studio/course/route.ts`)

Replace the entire prompt with:

```
Structure a mini-course that takes a student from zero to competent. Each lesson must teach something concrete and testable.

STEP 1 — EXTRACT: Read all sources. Map the knowledge domain: what are the prerequisite concepts, core concepts, and advanced concepts?

STEP 2 — DESIGN CURRICULUM:

Create ${count} lessons (default 6) in a logical progression: fundamentals → core skills → application → advanced topics.

EACH LESSON needs:
- title: Specific. "Setting Up Your First Express.js Server" not "Backend Basics"
- objective: One sentence starting with "After this lesson, you will be able to..." + a measurable verb (explain, implement, compare, debug, optimize)
- content: In Markdown. 3-5 paragraphs of real educational content:
  - Paragraph 1: What this concept is and why it matters (with a specific example or stat)
  - Paragraph 2: How it works (step by step, with code examples if applicable)
  - Paragraph 3: Common mistakes and how to avoid them
  - Paragraph 4 (optional): Advanced considerations or edge cases
- keyConcepts: 3-5 terms. Each concept is a specific term the student should remember, NOT a vague phrase.
  GOOD: ["Express.js middleware", "req/res cycle", "route parameters", "error-handling middleware"]
  BAD: ["important concepts", "key ideas", "things to remember"]
- quiz: 2-3 questions that test understanding of THIS lesson specifically (not generic questions)
- flashcards: 3-4 cards covering the key terms from THIS lesson

PREREQUISITES: List what the student should already know.
ESTIMATED DURATION: Realistic time in hours (e.g., "3-4 hours").

${detailInstr}
${userInstr}

Sources:
${sourceContext}
```

Fix schema: Add `lessons: z.array(...).min(4).max(10)`.

### 2G. Data Table (`/src/app/api/studio/datatable/route.ts`)

Replace the entire prompt with:

```
Extract and organize ALL data from the sources into well-structured tables. Create tables that a data analyst would find useful.

STEP 1 — SCAN: Read all sources. Identify every piece of data that can be tabulated: statistics, comparisons, timelines, feature lists, pricing, measurements, rankings.

STEP 2 — STRUCTURE:

For each table:
- title: Descriptive. "Page Load Time vs Bounce Rate by Industry (2024)" not "Data Table 1"
- description: One sentence explaining what this table shows and why it's useful.
- columns: Define with type annotations:
  - "text": for labels, names, categories
  - "number": for quantities, percentages, prices (format: include units in the label, e.g., "Load Time (ms)", "Revenue ($M)")
  - "date": for timestamps
  - "badge": for status/category indicators (new column type)
- rows: Populate with REAL data from the sources. If the source says "72% of websites use a CMS", that's a real data point. Do NOT invent numbers.

RULES:
- Create at least 2 tables, maximum 6
- Each table must have at least 4 rows and 3 columns
- Include a sourceReference for each table citing which source the data came from
- If the sources don't contain explicit tabular data, extract comparisons and create comparison tables (e.g., "WordPress vs Shopify vs Squarespace: Feature Comparison")
- Number columns should contain actual numbers (not strings with units). Put units in the column label.

GOOD table: "Content Management System Market Share 2024" with columns: CMS Name (text), Market Share % (number), Year Founded (number), Open Source (badge)
BAD table: "Information" with columns: Topic (text), Details (text)

${userInstr}

Sources:
${sourceContext}
```

### 2H. Mind Map (`/src/app/api/studio/mindmap/route.ts`)

The existing prompt is decent but needs these additions:
- Add `${userInstr}` injection for customPrompt
- Add `${detailInstr}` for detail levels:
  - concise: "3 subtopics, 2 details each — focused overview"
  - standard: "4-5 subtopics, 2-3 details each — balanced depth"
  - detailed: "5-6 subtopics, 3-4 details each — comprehensive map"

---

## TASK 2.5: INFOGRAPHIC OVERHAUL — THE BIGGEST PROBLEM

The infographic prompt (route) is actually decent — it generates structured data with stats, charts, callouts, etc. But the **SVG renderer** (`compose-infographic.ts`) destroys all that data by rendering it in tiny, cramped boxes with aggressive text truncation. Every infographic looks identical because the layout is a rigid top-to-bottom flow with fixed spacing.

This task fixes THREE things: the SVG renderer sizes, the layout engine variety, and the style color integration.

### Root causes (with line numbers):

**A. Stat box is 120×70px — can barely fit a number + 1 line**
File: `/src/lib/media/compose-infographic.ts` lines 275-286
- `bw = 120, bh = 70` — tiny
- Stat label is a SINGLE `<text>` element at 13px with NO text wrapping — long labels overflow the box
- Fix: increase to `bw = 200, bh = 100`. Add `wrapText(block.label, 28).slice(0, 2)` for the label.

**B. Callout box is 260×80px — body truncated to 3 lines**
Lines 291-316
- `bw = 260, bh = 80` — cramped
- Body: `wrapText(block.body, 38).slice(0, 3)` — max ~114 chars shown from a 2-4 sentence body
- The prompt asks for "2-4 sentences of REAL explanation" but the renderer can only show ~1.5 sentences
- Fix: increase to `bw = 320, bh = 130`. Increase body lines to `.slice(0, 5)`. Increase wrap width to 42 chars.

**C. Comparison boxes are 70px tall — just a number + label**
Lines 337-357
- `rowH = 70` — no room for meaningful labels
- Fix: increase to `rowH = 90`. Add wrap for labels.

**D. Flow steps are cramped — detail truncated to 2 lines of 24 chars**
Lines 359-395
- Detail: `wrapText(step.detail, 24).slice(0, 2)` — max ~48 chars = ~8 words
- Fix: increase wrap to 30 chars, allow 3 lines. Increase `y += 90` to `y += 120`.

**E. Timeline is the worst — labels truncated to 2 lines of 18 chars**
Lines 418-444
- `wrapText(ev.label, 18).slice(0, 2)` — max ~36 chars = ~6 words
- Timeline events should explain WHAT happened, not just name the date
- Fix: increase wrap to 24 chars, allow 3 lines. Increase `y += 60` to `y += 80`.

**F. Takeaway is 60px tall — 2 lines max**
Lines 397-415
- `bh = 60`, body: `wrapText(text, 80).slice(0, 2)` — max ~160 chars
- Fix: increase to `bh = 80`, allow 3 lines.

**G. Text block is only 40px tall for 4 lines**
Lines 446-455
- `y += 40` — 4 lines × ~18px line height = 72px needed, but only 40px allocated
- Fix: `y += lines.length * 18 + 16` (dynamic based on actual content).

**H. Colors ignore style config — always hardcoded**
Lines 111-113
```typescript
// HARDCODED — ignores user's style selection:
const COLOR_TEXT = "#1a1a1a";
const COLOR_MUTED = "#4a4a4a";
const COLOR_HAIRLINE = "#2a2a2a";
```
The style system in `styles.ts` defines `textColor` and `mutedColor` per style, but the infographic renderer never reads them.

**Fix**: Accept `VisualStyle` in `buildSvgOverlay` and use the style config:
```typescript
const buildSvgOverlay = (
  layout: InfographicLayout,
  W: number,
  H: number,
  style: VisualStyle = "auto",
): string => {
  const styleConfig = STYLE_CONFIGS[style];
  const COLOR_TEXT = styleConfig.textColor;
  const COLOR_MUTED = styleConfig.mutedColor;
  const COLOR_HAIRLINE = styleConfig.textColor; // same as text but used for thin lines
  // ... rest of function
};
```

**I. Layout is always the same top-to-bottom flow**
The `y` cursor starts at 130 (after title) and advances rigidly downward for each block. Every infographic looks identical.

**Fix**: Implement 3 layout strategies based on block composition:

```typescript
type LayoutStrategy = "magazine" | "dashboard" | "story";

const pickLayoutStrategy = (blocks: LayoutBlock[]): LayoutStrategy => {
  const hasChart = blocks.some(b => b.type === "chart");
  const statCount = blocks.filter(b => b.type === "stat").length;
  const hasFlow = blocks.some(b => b.type === "flow" || b.type === "timeline");
  
  if (statCount >= 3) return "dashboard";  // stat-heavy → grid of metric cards
  if (hasChart && hasFlow) return "story";  // narrative → alternating left/right sections
  return "magazine";                         // default → current flow but with 2-column zones
};
```

**"magazine" layout**: Current top-to-bottom flow but with alternating full-width and 2-column rows. Stats render in a 2×2 or 3×1 grid at the top instead of scattered absolutely. Callouts render in 2-column layout side by side.

**"dashboard" layout**: Stats in a prominent 2×3 or 3×2 grid at the top (large cards, ~200×120px each). Chart below spanning full width. Callouts in a 2-column footer.

**"story" layout**: Alternating left-image/right-text and right-image/left-text sections. Flow/timeline renders as a centered vertical strip. Stats sprinkled inline.

The key change: **stop using absolute positioning for stats and callouts**. The current `getPosition()` places stats/callouts at fixed coordinates (18%/50%/82% × 22%/50%/80%) which overlap with the sequential blocks. Instead, render ALL blocks through the `y` cursor, and use the layout strategy to decide column placement.

### Implementation plan for compose-infographic.ts:

1. **Add style parameter** to `buildSvgOverlay` and `composeInfographic`
2. **Pick layout strategy** based on block types
3. **Enlarge ALL box sizes** (stat: 200×100, callout: 320×130, comparison row: 90, flow: y+=120, timeline: y+=80, takeaway: 80, text: dynamic)
4. **Add text wrapping to stat labels** (currently no wrapping at all)
5. **Increase all text truncation limits** (callout body: 5 lines, flow detail: 3 lines, timeline label: 3 lines, takeaway: 3 lines)
6. **Use style colors** instead of hardcoded COLOR_TEXT/COLOR_MUTED
7. **Render stats in a grid** (not absolutely positioned) — at least for "dashboard" and "magazine" layouts
8. **Render callouts sequentially** (not absolutely positioned) — with 2-column layout where possible

### Also update the route's schema description:

**File**: `/src/app/api/studio/infographic/route.ts` line 34-37

The `illustrationPrompt` schema `.describe()` hardcodes "pen-and-ink technical illustration on graph paper" — this overrides whatever style the user selected. Remove the hardcoded style from the description:

```typescript
illustrationPrompt: z
  .string()
  .describe(
    "Visual-only prompt for AI image generation. NO text, NO labels, NO numbers, NO words anywhere. Describe small illustrated vignettes positioned in specific zones of the canvas, leaving whitespace for text overlay. 100-200 words. The style is defined by the system — focus only on the subject matter and spatial composition.",
  ),
```

### Also apply the same fixes to compose-slide.ts:

**File**: `/src/lib/media/compose-slide.ts`

The slide composer has similar but less severe truncation. Key fixes:
- Bullet points: `wrapText(bullet, 50).slice(0, 2)` → allow 3 lines: `.slice(0, 3)`
- Comparison values: `wrapText(item.value, 14).slice(0, 1)` → allow 2 lines: `.slice(0, 2)`, increase wrap to 18
- Flow step details: `wrapText(step.detail, 28).slice(0, 3)` → increase wrap to 32
- Use style colors (textColor, mutedColor from STYLE_CONFIGS) instead of hardcoded `COLOR_TEXT = "#1a1a1a"` and `COLOR_MUTED = "#4a4a4a"`
- Accept `VisualStyle` parameter and pass through from the route

### Also update the infographic viewer:

**File**: `/src/components/studio/infographic-viewer.tsx`

The fallback view (when there's no image) currently renders stats in a basic grid. Improve:
- Stats: use colored cards with large numbers and proper labels
- Sections: use distinct card containers with headers
- Add a fade-in animation on the image
- Extract shared `downloadImage` to a utility

---

## TASK 3: REDESIGN GENERATE DIALOG

**File**: `/src/components/studio/generate-dialog.tsx`

### 3A. Replace emoji with SVG mini-icons

Remove all emoji from style tiles. Replace with small inline SVGs or unicode symbols that feel designed:

```typescript
const STYLE_ICONS: Record<string, React.ReactNode> = {
  auto: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 3v14M3 10h14" />
    </svg>
  ),
  sketch: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 17L17 3M5 14l3 3M8 11l3 3M11 8l3 3" />
    </svg>
  ),
  kawaii: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="10" cy="10" r="8" />
      <circle cx="7" cy="9" r="1" fill="currentColor" />
      <circle cx="13" cy="9" r="1" fill="currentColor" />
      <path d="M7 13c1.5 2 4.5 2 6 0" />
    </svg>
  ),
  professional: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M3 8h14M8 8v9" />
    </svg>
  ),
  scientific: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 3v8l-4 6h12l-4-6V3" />
      <path d="M6 3h8" />
    </svg>
  ),
  minimalist: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="9" width="12" height="2" rx="1" />
    </svg>
  ),
};
```

### 3B. Visual hierarchy — group sections

Add subtle separators between logical groups:

```
[Orientation] ← appearance group
[Style]
[Detail]
─── thin separator (border-top: 1px solid var(--fm-surface-border)) ───
[Accent color]  ← personalization group
[Language]
─── thin separator ───
[Sources] ← content group
[Custom prompt]
─── ───
[Generate button]
```

### 3C. Replace native range slider for slide count

Replace `<input type="range">` with selectable number tiles:

```tsx
const SLIDE_COUNTS = [4, 6, 8, 10, 12];

<div className="flex gap-2">
  {SLIDE_COUNTS.map(n => (
    <button
      key={n}
      onClick={() => setSlideCount(n)}
      style={{
        background: slideCount === n ? "var(--fm-accent-orange)" : "var(--fm-surface-elevated)",
        color: slideCount === n ? "white" : "var(--fm-text-secondary)",
        border: "1px solid " + (slideCount === n ? "transparent" : "var(--fm-surface-border)"),
        borderRadius: "0.5rem",
        padding: "0.5rem 0.75rem",
        fontSize: "0.8125rem",
        fontWeight: 500,
        minWidth: "3rem",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 150ms ease",
      }}
    >
      {n}
    </button>
  ))}
</div>
```

### 3D. Style tiles — add visual weight

Make style tiles taller and more distinct:
```
- Height: min-h-[4.5rem] (not h-10)
- Icon above label (flex-col)
- Selected state: accent border + subtle accent background at 8% opacity
- Unselected: muted border, dimmer text
- Font: icon at 20px, label at 12px with letter-spacing: 0.02em, uppercase
```

### 3E. Sources section — cleaner container

Wrap the sources section in a rounded container:
```tsx
<div style={{
  background: "var(--fm-surface-elevated)",
  borderRadius: "0.75rem",
  padding: "1rem",
  border: "1px solid var(--fm-surface-border)",
}}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--fm-text)" }}>Sources</span>
    <button ...>Find sources</button>
  </div>
  {/* source checkboxes */}
</div>
```

### 3F. Submit button — use shadcn Button

Replace the custom `<button>` with the shadcn `<Button>` component for consistency.

### 3G. Dialog entrance animation

Add a subtle slide-up entrance:
```css
/* In the Dialog content wrapper */
animation: dialogSlideUp 200ms ease-out;

@keyframes dialogSlideUp {
  from { transform: translateY(12px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

---

## TASK 4: REDESIGN FLASHCARD VIEWER

**File**: `/src/components/studio/flashcard-view.tsx`

### Design principles (from Quizlet/Anki research):
- Card should command the screen — large question text, generous padding
- Color-coded difficulty visible on the card edge
- White/light card on the dark app background creates premium contrast
- The flip animation already exists and is good — keep it

### Changes:

1. **Card size**: Change `max-w-lg` to `max-w-2xl` and `h-64` to `min-h-[18rem]`. The card should breathe.

2. **Card styling**: Replace `bg-card border-border` with `--fm-surface` tokens:
```typescript
style={{
  background: "var(--fm-surface)",
  border: "1px solid var(--fm-surface-border)",
  borderRadius: "1.25rem",
  padding: "2.5rem",
  boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
}}
```

3. **Question text**: Increase to `text-xl font-semibold` on front. Center both vertically and horizontally.

4. **Answer text**: `text-base leading-relaxed` with enough line height to breathe.

5. **Difficulty indicator**: Add a colored left border on the card:
```typescript
const difficultyColor = {
  easy: "#22c55e",    // green
  medium: "#f59e0b",  // amber
  hard: "#ef4444",    // red
};
// Add: borderLeft: `4px solid ${difficultyColor[card.difficulty]}`
```

6. **Stats badges**: Color-code them:
- "got it" → green background at 12% opacity, green text
- "missed" → red background at 12% opacity, red text  
- "due" → amber background at 12% opacity, amber text
- "unseen" → default muted

7. **Hide flip hint after first interaction**: Use a `hasFlipped` state. Only show "Click or press space to flip" when `!hasFlipped`.

8. **Card transition**: Add slide animation between cards using `AnimatePresence` + `motion.div` with `initial={{ x: 40, opacity: 0 }}` and `exit={{ x: -40, opacity: 0 }}`.

9. **"Missed It" / "Got It" buttons**: Make them larger, color-coded:
```
Missed It: red-500/10 background, red-400 text, red-500/20 border
Got It: green-500/10 background, green-400 text, green-500/20 border
Both: min-w-[8rem], py-3, rounded-xl, font-medium
```

---

## TASK 5: REDESIGN QUIZ VIEWER

**File**: `/src/components/studio/quiz-view.tsx`

### Design principles (from Kahoot/Quizizz research):
- Large tappable answer tiles, not tiny radio buttons
- Color-coded options (each gets a distinct hue)
- Visible progress with colored segments
- Celebratory feedback on correct answers
- Full explanation panel after answering

### Changes:

1. **Progress bar**: Increase to `h-2.5` with rounded segments. Color segments:
- Answered correctly: green-500
- Answered wrong: red-500
- Current: accent color pulse animation
- Unanswered: muted/dim

2. **Question card**: `max-w-3xl mx-auto`, generous padding `p-8`. Question text `text-2xl font-semibold text-center`.

3. **Multiple choice tiles**: Replace the current options with large tappable tiles:
```tsx
const MC_COLORS = [
  { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)", text: "#60a5fa" },  // blue
  { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", text: "#f87171" },    // red
  { bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.3)", text: "#facc15" },    // yellow
  { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)", text: "#4ade80" },    // green
];
// Each option: min-h-[3.5rem], rounded-xl, flex items-center, text-base font-medium
// Letter prefix (A, B, C, D) in a small circle badge to the left
```

4. **True/False buttons**: Make them big and distinct:
- True: green-tinted tile, left half
- False: red-tinted tile, right half
- Both: `min-h-[4rem]`, `text-lg`, `font-semibold`, `rounded-xl`

5. **Free response**: `min-h-[120px]` textarea with proper `--fm-surface` styling.

6. **After answering**: Show a colored banner:
- Correct: green background at 10%, "✓ Correct!" in green, then the explanation below
- Wrong: red background at 10%, "✗ Incorrect" in red, show correct answer, then explanation

7. **Results screen**: Add a score circle/ring (SVG) showing percentage. Trophy icon in amber. Show "Retake" AND "Review All Explanations" buttons.

8. **Difficulty badge on each question**: Small pill showing "easy" / "medium" / "hard" color-coded.

---

## TASK 6: REDESIGN THREAD VIEWER

**File**: `/src/components/studio/thread-preview.tsx`

### Design principles (from Twitter/X research):
- Mimic real X UI for authenticity
- Thread connector line between tweets
- Engagement metrics row (even if fake — they set the visual context)

### Changes:

1. **Tweet card**: Use the X visual language more faithfully:
```
- Avatar: 40px circle with initials or a generic user icon
- Name: "FluxMind" in bold 15px + "@fluxmind" in muted 15px + "· just now" in muted
- Text: 15px, line-height 1.5, max-width 504px
- Thread connector: 2px solid line from avatar bottom to next avatar top
```

2. **Engagement row** (display-only, below each tweet):
```tsx
<div style={{ display: "flex", gap: "3rem", marginTop: "0.75rem", color: "var(--fm-text-tertiary)", fontSize: "0.8125rem" }}>
  <span>💬 —</span>
  <span>🔁 —</span>
  <span>❤️ —</span>
  <span>📊 —</span>
</div>
```
Use simple icons (lucide-react: MessageCircle, Repeat2, Heart, BarChart2), not emoji. Keep counts as "—" since they're mock.

3. **Character counter**: Show `{text.length}/280` below the tweet text when editing, with the number turning red when over 280.

4. **Mobile actions**: Replace hover-only action buttons with always-visible small icon row on mobile (use `@media (hover: none)` or `md:opacity-0 md:group-hover:opacity-100`).

5. **Tweet numbering**: Add "1/N" counter on each tweet to show thread position.

---

## TASK 7: REDESIGN NEWSLETTER VIEWER

**File**: `/src/components/studio/newsletter-preview.tsx`

### Changes:

1. **Style switcher**: Replace raw buttons with proper segmented control using `--fm-surface` tokens.

2. **Typography upgrade**: Use a serif font for the headline in "editorial" and "clean" themes:
```css
fontFamily: "'Georgia', 'Times New Roman', serif"
```

3. **Section cards**: Each section should be a distinct visual block:
```
- Rounded container (1px border)
- Section title in 18px semibold
- Body text in 15px with line-height 1.75
- Pull quote with thick left border (3px) in accent color, italic, slightly larger text
```

4. **Key takeaways**: Style as a numbered list with accent-colored numbers:
```
1. Optimize your images... (number in accent color, bold)
2. Implement lazy loading... 
```

5. **Transitions**: Wrap the preview content in `AnimatePresence` so switching between style themes fades smoothly (200ms opacity transition).

6. **CTA button**: Style as display-only (add `pointer-events-none`, `cursor-default`).

---

## TASK 8: REDESIGN REEL VIEWER

**File**: `/src/components/studio/reel-script-view.tsx`

### Changes:

1. **Phone mockup**: Keep the concept but improve styling:
- Use `--fm-surface` tokens instead of hardcoded `border-zinc-800`
- Add a subtle notch/dynamic island at the top for realism
- Make text inside readable: bump to `text-sm` minimum

2. **Script breakdown** (outside the phone): Add a clear script table:
```
| Section | Duration | Text                  | Visual Direction |
|---------|----------|-----------------------|------------------|
| HOOK    | 3s       | "Did you know..."     | Close-up shot... |
| CONTENT | 12s      | "Here's what we..."   | B-roll of...     |
```
This is more useful than squinting at tiny text inside a phone SVG.

3. **Timeline bar**: Make it interactive — clicking a segment highlights the corresponding script section.

---

## TASK 9: REDESIGN COURSE VIEWER

**File**: `/src/components/studio/course-view.tsx`

### Changes:

1. **Mobile lesson navigation**: Add a mobile drawer or top dropdown that appears when `md:hidden`:
```tsx
{/* Mobile lesson selector */}
<div className="md:hidden mb-4">
  <select
    value={activeLesson}
    onChange={(e) => setActiveLesson(Number(e.target.value))}
    style={{
      width: "100%",
      background: "var(--fm-surface)",
      border: "1px solid var(--fm-surface-border)",
      borderRadius: "0.75rem",
      padding: "0.75rem 1rem",
      color: "var(--fm-text)",
    }}
  >
    {lessons.map((l, i) => (
      <option key={i} value={i}>{`${i + 1}. ${l.title}`}</option>
    ))}
  </select>
</div>
```

2. **Sidebar styling**: Add lesson numbers as accent-colored circles:
```
(1) Setting Up Express.js  [13 min]
(2) Routing Basics          [18 min]  ← active: accent left border
(3) Middleware               [22 min]
```

3. **Key concepts**: Display as small pill badges with accent background at 10% opacity, not plain text.

4. **Inline quiz**: Style quiz questions within lessons using the same colored-tile approach from the quiz redesign (Task 5), but smaller and inline.

5. **Prose styling**: Use `--fm-text` token for body text, not default prose colors.

---

## TASK 10: REDESIGN DATA TABLE VIEWER

**File**: `/src/components/studio/data-table-view.tsx`

### Design principles (from dashboard research):
- Minimal visible borders — use spacing and subtle backgrounds
- Uppercase tiny headers
- Right-align numbers, use tabular-nums
- Subtle row hover

### Changes:

1. **Column headers**: Style as uppercase small-caps:
```typescript
style={{
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--fm-text-tertiary)",
  padding: "0.75rem 1rem",
}}
```

2. **Rows**: Remove visible borders. Use alternating background:
```
odd rows: transparent
even rows: rgba(255,255,255,0.02) in dark mode
hover: rgba(255,255,255,0.04) with 150ms transition
```

3. **Number columns**: Right-align + tabular-nums:
```css
text-align: right; font-variant-numeric: tabular-nums;
```

4. **Badge column type**: Add rendering for `"badge"` type:
```tsx
if (column.type === "badge") {
  return (
    <span style={{
      background: "var(--fm-accent-orange-10)",
      color: "var(--fm-accent-orange)",
      borderRadius: "0.375rem",
      padding: "0.125rem 0.5rem",
      fontSize: "0.75rem",
      fontWeight: 600,
    }}>
      {String(value)}
    </span>
  );
}
```

5. **Search input**: Add proper `aria-label="Search table"`.

---

## TASK 11: POLISH SLIDE AND INFOGRAPHIC VIEWERS

### SlideViewer (`/src/components/studio/slide-viewer.tsx`)

1. **Slide transitions**: Add a crossfade when switching slides:
```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={currentSlide}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
  >
    <img ... />
  </motion.div>
</AnimatePresence>
```

2. **Arrow button hover**: Add `hover:bg-[rgba(255,255,255,0.06)]` and `focus-visible:ring-2`.

3. **Loading skeleton**: Show a pulsing placeholder while images load.

### InfographicViewer (`/src/components/studio/infographic-viewer.tsx`)

1. **Fade-in**: Add `motion.img` with `initial={{ opacity: 0 }} animate={{ opacity: 1 }}`.

2. **Section details**: Add visual separators between `<details>` items (thin border-bottom).

3. **Extract shared `downloadImage` utility** from both viewers into `/src/lib/utils/download.ts`.

---

## TASK 12: FIX AUDIO PLAYER + NARRATION PLAYER

### AudioPlayer (`/src/components/audio/audio-player.tsx`)

1. **Remove GlassCard import** (line 17) — replace with `--fm-surface` div (see Task 1A).
2. **Fix autoPlay**: Remove the `autoPlay` attribute. Use `ref.play()` triggered by user's first click.
3. **Replace hardcoded Tailwind colors** with `var(--fm-*)` tokens.

### NarrationPlayer (`/src/components/studio/narration-player.tsx`)

1. **Speed toggle**: Replace the cycling badge with a visible segmented control: `[1x] [1.5x] [2x]`
2. **Seek drag**: Add `onMouseMove` + `onMouseDown` for click-and-drag seeking on the progress bar.

---

## TASK 13: WIRE `customPrompt` AND `selectedSourceIds` INTO ALL ROUTES

Currently only infographic, slides, and mindmap support `customPrompt`. Wire it into ALL routes:

**Routes to update**: flashcards, quiz, thread, newsletter, reel, course, datatable

For each route, add to the body parsing:
```typescript
const customPrompt = (body.customPrompt as string) ?? "";
const detailLevel = (body.detailLevel as string) ?? "standard";
const selectedSourceIds = (body.selectedSourceIds as string[]) ?? [];
```

And inject into the prompt:
```typescript
const userInstr = customPrompt
  ? `\nUSER REQUEST: "${customPrompt}". Incorporate this focus into the output.\n`
  : "";
```

Also update the hooks in `/src/hooks/use-studio-outputs.ts` to accept `Partial<GenerateConfig>` for ALL generators (not just the 4 that currently support it).

And update the studio page to open the Generate Dialog for ALL output types that support customization (add "thread", "newsletter", "reel", "course", "datatable", "flashcards", "quiz" to the dialog-enabled types).

---

## TASK 14: VERIFICATION

1. `pnpm build` — zero TypeScript errors
2. `pnpm lint` — zero lint errors  
3. `pnpm test` — existing tests pass
4. Visual checks:
   - Generate Dialog: no emoji, SVG icons, visual hierarchy with separators
   - Flashcards: large card, colored difficulty border, animated transitions
   - Quiz: large tappable tiles, color-coded options, celebratory correct feedback
   - Thread: looks like real X/Twitter, engagement row, character count
   - Newsletter: serif headlines, distinct section cards, smooth theme transitions
   - Reel: readable phone mockup, script table, interactive timeline
   - Course: mobile dropdown works, numbered sidebar, styled key concepts
   - Data table: uppercase headers, no visible borders, right-aligned numbers
   - Slides: crossfade transition between slides
   - Infographic: fade-in animation
   - Audio player: no GlassCard crash, proper tokens
5. Content quality check — generate at least one of each output type and verify:
   - Contains specific facts, statistics, named entities
   - No generic filler like "It's important to note..."
   - Custom prompt is reflected in the output
   - Detail level affects output length/depth

---

## ABSOLUTE CONSTRAINTS

**DO NOT touch:**
- The hybrid image composition pipeline (compose-slide.ts, compose-infographic.ts, svg-helpers.ts) — it works
- The visual style system (styles.ts) — already implemented
- Route structure, auth patterns, DB operations — unless adding customPrompt/selectedSourceIds support
- Existing type exports that other files depend on

**DO NOT use:**
- GlassCard (removed), glassmorphism, backdrop-blur on components
- Emoji as decorative icons (the whole point is removing these)
- Generic placeholder text in prompts ("important topic", "interesting fact")

**Code style:**
- TypeScript strict, named exports, `type` imports for type-only
- `const Component = (): React.ReactNode => { ... }`
- Inline styles with `var(--fm-*)` CSS custom properties for dynamic values
- Tailwind classes for static layout
- File naming: kebab-case
