# FluxMind — Claude Code Max Prompt

> **Read `CLAUDE.md` first** for stack and code style rules. Everything there applies here.
> **Read `PROMPT-STUDIO-MEDIA-ENGINE.md`** to understand the hybrid composition architecture (Sharp + SVG + fal.ai). Do NOT touch that architecture — it works.

---

## THE REAL PROBLEM

Generated slides and infographics are **visually beautiful** but **teach absolutely nothing**. A slide about "Creating a Website" shows a pretty title with a Da Vinci-style illustration, but zero real information — no bullets explaining HTML/CSS/JS, no statistics, no process diagram, no tool comparisons.

The root cause: the prompts inside `generateObject()` spend ~80% of their tokens explaining illustration style and only ~20% requesting educational content. **Flip this ratio.**

### What works well (DO NOT TOUCH)
- The hybrid composition pipeline: `compose-slide.ts` and `compose-infographic.ts`
- The SVG renderers for each layout (title, content, stat, comparison, quote, flow, closing)
- Image generation with fal.ai: `generate-image.ts`
- Zod schemas: `slideSchema`, `deckSchema`, `layoutSchema`
- API route structure, error handling, DB operations
- Type exports: `SlideDeckSlide`, `SlidesContent`, `InfographicContent`
- SVG helpers: `svg-helpers.ts`
- Narration player and narrate route

### What's broken (THIS IS WHAT YOU FIX)
The **prompt strings** inside `generateObject()` calls in exactly two files:
1. `/src/app/api/studio/slides/route.ts` — the prompt string (~lines 153-180)
2. `/src/app/api/studio/infographic/route.ts` — the prompt string (~lines 181-212)

Additionally, the video pipeline is incomplete:
3. `/src/lib/video/generate-video.ts` — implement phases 3-5 (TTS + composition + upload)
4. `/src/components/video/video-player.tsx` — still imports `GlassCard` (removed from codebase)

---

## TASK 1: REWRITE THE SLIDES PROMPT

Open `/src/app/api/studio/slides/route.ts`. Locate the `generateObject()` call (starts at ~line 150). Replace ONLY the prompt string. Keep `${langInstr}` at the top and `Sources:\n${ctx.sourceContext}` at the bottom. Keep `${count}` for slide count.

### The new prompt must follow this exact structure:

```
${langInstr}

You are an expert educator designing a visual presentation. Your #1 job is to TEACH — every slide must contain specific, factual, actionable information extracted from the sources.

═══════════════════════════════════════
CONTENT EXTRACTION (do this FIRST)
═══════════════════════════════════════

Before designing slides, analyze the sources and extract:
- Every specific fact, number, percentage, date, or statistic
- Every named tool, technology, framework, method, or concept
- Every process, workflow, or step-by-step procedure
- Every comparison, trade-off, or alternative
- Every cause-effect relationship
- Every definition or key term
- Any notable quotes or expert opinions

Organize these extractions into teachable chunks. Each chunk becomes one slide.

═══════════════════════════════════════
SLIDE DESIGN RULES
═══════════════════════════════════════

Create ${count} slides (default 6). Structure:
- Slide 1: layout "title" → topic title + subtitle that tells the user WHAT they will learn (e.g. "5 key steps from blank page to live deployment")
- Slides 2 through N-1: teaching slides using "content", "stat", "comparison", "flow", or "quote" layouts. Pick the layout that BEST matches the information type:
  → Explaining concepts with multiple facets? → "content" (3-5 dense bullets)
  → A striking number that anchors the topic? → "stat" (real number + context)
  → Comparing tools/methods/approaches? → "comparison" (2-4 items with specifics)
  → A step-by-step process? → "flow" (3-6 actionable steps)
  → A powerful statement from the source? → "quote" (with attribution)
- Last slide: layout "closing" → a specific, actionable takeaway (NOT "this is important", but a concrete conclusion like "Start with semantic HTML, add CSS Grid for layout, and deploy to Vercel in under 5 minutes")

NEVER repeat the same layout consecutively. Vary the layouts to keep the presentation dynamic.

═══════════════════════════════════════
CONTENT DENSITY REQUIREMENTS (CRITICAL)
═══════════════════════════════════════

Each layout type has structured fields. You MUST populate ALL relevant fields with SUBSTANTIVE content:

● "content" layout:
  - title: 3-8 words naming the specific concept (e.g. "HTML5 Semantic Structure" not "The Basics")
  - bullets: EXACTLY 3-5 bullets. Each bullet is 40-75 characters containing ONE specific fact, technique, or tool name.
  - GOOD bullets: "Use <header>, <nav>, <main>, <footer> for accessibility + SEO", "Flexbox handles 1D layouts; CSS Grid handles 2D layouts"
  - BAD bullets: "It's important to use good practices", "Design matters a lot"

● "stat" layout:
  - stat.value: A REAL number from the sources (or a well-known domain statistic). Format: "53%", "4.9B", "3s", "$12K"
  - stat.label: 15-40 words explaining WHY this number matters and providing context
  - title: 3-6 word eyebrow that categorizes the stat
  - GOOD: value="53%", label="of mobile users abandon sites loading over 3 seconds — speed directly impacts your conversion rate and revenue"
  - BAD: value="Many", label="things to think about"

● "comparison" layout:
  - comparisonItems: 2-4 items, each with a specific NAMED entity and a differentiating value
  - GOOD: [{label:"React", value:"Component-based, 40% market share"}, {label:"Vue", value:"Progressive framework, gentle learning curve"}, {label:"Svelte", value:"No virtual DOM, smallest bundle size"}]
  - BAD: [{label:"Option A", value:"Good"}, {label:"Option B", value:"Also good"}]

● "flow" layout:
  - flowSteps: 3-6 steps. Each step has a label (2-4 words) and a detail (one concrete action sentence).
  - GOOD: {label:"Wireframe Layout", detail:"Sketch page structure in Figma — define header, content zones, sidebar, and footer grid"}
  - BAD: {label:"Plan", detail:"Think about what you want to do"}

● "quote" layout:
  - quote.text: An actual statement from the sources, or a synthesis of a key insight phrased as a memorable quote
  - quote.attribution: The source document title, author, or "— Source analysis"

● "closing" layout:
  - title: A specific, memorable takeaway sentence derived from the content (NOT generic motivation)
  - subtitle: A short eyebrow like "KEY TAKEAWAY" or "RESUMEN" (will be uppercased)

═══════════════════════════════════════
narrationHint (for every slide)
═══════════════════════════════════════

Write 2-3 sentences a teacher would SAY to explain this slide. Add context BEYOND what's written on screen — an example, an analogy, a "why this matters" insight. This powers the TTS narration.

═══════════════════════════════════════
ILLUSTRATION PROMPT (secondary priority)
═══════════════════════════════════════

The illustrationPrompt creates the visual background. It must describe ONLY visual elements — NO text, NO letters, NO numbers, NO labels, NO words, NO typography of any kind. 80-160 words.

Style: pen-and-ink technical illustration on cream-colored graph paper, vintage engineering sketchbook (Leonardo's Codex, old physics textbooks). Describe small illustrated vignettes positioned in specific zones of the canvas (top-left, center-right, bottom, etc.), with plenty of whitespace around each for the text overlay. Confident thin ink lines, slightly off-register hand-drawn feel, occasional muted orange or sepia watercolor wash on focal elements.

The illustration should visually RELATE to the slide's content — if the slide is about database indexing, draw a filing cabinet with index cards and a magnifying glass, not random decorative shapes.

EXAMPLE illustrationPrompt (for a slide about HTML structure):
"A vintage engineering sketchbook page on cream graph paper. In the upper-right, a pen-and-ink tree diagram branching downward with thin confident lines, representing nested structure. In the lower-left, a small browser window frame with a miniature page layout sketched inside — header bar, sidebar, content area. In the center, a detailed magnifying glass hovering over a code bracket symbol. Soft sepia watercolor wash on the tree's root node and the magnifying glass lens. Plenty of open whitespace in the left half and bottom-center for text overlay."

═══════════════════════════════════════
FULL WORKED EXAMPLE
═══════════════════════════════════════

Topic: "How to Create a Website"
Sources mention: HTML, CSS, JavaScript, planning, wireframes, responsive design, SEO, hosting, WordPress vs custom code, performance stats.

Slide 1 (title): title="Building Your First Website", subtitle="From blank page to live site — the 6 essential concepts every web creator needs"
Slide 2 (content): title="The Foundation: HTML5 Structure", bullets=["Every page starts with <!DOCTYPE html> — tells browsers to use modern standards", "Semantic tags: <header>, <nav>, <main>, <article>, <footer>", "The <head> holds metadata, CSS links, and <title> for SEO", "Forms use <input>, <select>, <textarea> — the web's interactive building blocks", "Images need alt text: accessibility + SEO + fallback when images fail"]
Slide 3 (stat): title="PERFORMANCE IMPACT", stat={value:"53%", label:"of mobile visitors leave a page that takes over 3 seconds to load — Google research shows every extra second costs 7% in conversions"}
Slide 4 (comparison): title="Choosing Your Platform", comparisonItems=[{label:"WordPress", value:"60% of CMS market, 55K+ plugins"}, {label:"Custom Code", value:"Full control, zero bloat"}, {label:"Shopify", value:"Built-in payments, $29/mo"}, {label:"Next.js", value:"React framework, SSR + SSG"}]
Slide 5 (flow): title="From Idea to Live Website", flowSteps=[{label:"Plan & Wireframe", detail:"Define pages, navigation, and content layout in Figma or on paper"}, {label:"Write HTML", detail:"Build semantic structure — sections, headings, forms, links"}, {label:"Style with CSS", detail:"Add layout (Grid/Flexbox), colors, typography, responsive breakpoints"}, {label:"Add JavaScript", detail:"Interactivity: form validation, menus, API calls, dynamic content"}, {label:"Test & Deploy", detail:"Cross-browser testing, then push to Vercel/Netlify/GitHub Pages"}]
Slide 6 (closing): title="Start with semantic HTML, layer CSS for layout, add JS for interactivity — deploy in minutes with modern hosting", subtitle="KEY TAKEAWAY"

Sources:
${ctx.sourceContext}
```

### Verification:
- The Zod schema does NOT change (same `slideSchema` and `deckSchema`)
- Imports do NOT change
- The `generateObject({ model, schema, prompt })` call stays the same, only the `prompt` string is new
- `${langInstr}`, `${count}`, and `${ctx.sourceContext}` interpolate the same as before

---

## TASK 2: REWRITE THE INFOGRAPHIC PROMPT

Open `/src/app/api/studio/infographic/route.ts`. Locate the `generateObject()` call (starts at ~line 178). Replace ONLY the prompt string.

### The new prompt must follow this structure:

```
${langInstr}

You are a world-class data visualization designer and expert educator. Your job is to create an infographic that TEACHES complex information through dense, specific, visual data. Every block must contain REAL data extracted from the sources.

═══════════════════════════════════════
CONTENT EXTRACTION (do this FIRST)
═══════════════════════════════════════

Deeply analyze the sources. Extract:
- Every number, percentage, statistic, date, or measurable fact
- Every process or workflow (ordered steps)
- Every comparison or trade-off between alternatives
- Every timeline or historical progression
- Every cause-effect chain
- Every definition of a key concept
- Every expert insight or notable finding

You will structure these extractions into 4-10 visual blocks.

═══════════════════════════════════════
BLOCK SELECTION STRATEGY
═══════════════════════════════════════

A great infographic tells a visual STORY. Structure it:

Opening (hook the reader):
→ 1-2 "stat" blocks with surprising numbers to grab attention

Body (teach the details):
→ 1 "chart" block if there's quantitative data (trends, growth, distributions)
→ 1-2 "callout" blocks for concepts that need deeper explanation
→ 1 "flow" or "timeline" block if there's a process or chronology
→ 1 "comparison" block if alternatives are discussed
→ 0-1 "text" blocks for essential context

Closing (seal the insight):
→ 1 "takeaway" block with a specific, memorable conclusion

Mix 5-8 block types total. Never use more than 2 of the same type.

═══════════════════════════════════════
BLOCK CONTENT DENSITY (CRITICAL)
═══════════════════════════════════════

● "stat" block:
  value = a REAL number ("68%", "$4.2T", "3.2s", "1.8B")
  label = 10-25 words explaining significance
  position = place semantically (important stats at top)
  GOOD: {value:"68%", label:"of all online experiences begin with a search engine — SEO is the #1 organic traffic source", position:"top-left"}
  BAD: {value:"Lots", label:"of people use the internet", position:"top-left"}

● "callout" block:
  title = 3-6 words naming the concept
  body = 2-4 sentences of REAL explanation with specifics — tool names, techniques, concrete details
  position = place near related illustration area
  leaderTo = direction pointing toward related visual element
  GOOD: {title:"The DOM Tree", body:"When a browser loads HTML, it builds a Document Object Model — a tree structure where every element becomes a node. JavaScript's querySelector() finds nodes; addEventListener() makes them respond to clicks, hovers, and keyboard input. Understanding the DOM is the key to dynamic web pages.", position:"mid-right", leaderTo:"left"}
  BAD: {title:"Important Concept", body:"This is something you should know about because it matters.", position:"mid-right", leaderTo:"left"}

● "chart" block:
  chartType = "line" for trends, "bar" for comparisons, "area" for volume/cumulative
  dataPoints = 3-8 points with REAL or realistic data. x = specific label (year, category, stage name). y = numeric value. annotation = highlight key inflection points.
  GOOD: {chartType:"bar", xLabel:"Framework", yLabel:"npm Downloads/week (M)", dataPoints:[{x:"React",y:22.5,annotation:"Market leader"},{x:"Vue",y:4.2,annotation:null},{x:"Angular",y:3.1,annotation:null},{x:"Svelte",y:0.8,annotation:"Fastest growing"}]}
  BAD: {chartType:"bar", xLabel:"Things", yLabel:"Amount", dataPoints:[{x:"A",y:10,annotation:null},{x:"B",y:20,annotation:null}]}

● "flow" block:
  steps = 3-6, each with label (2-4 words) and detail (concrete action sentence)
  Same quality bar as slides — every step is specific and actionable

● "timeline" block:
  events = 3-6 entries with real dates/periods and specific event descriptions
  GOOD: [{date:"1991", label:"Tim Berners-Lee publishes the first website at CERN"}, {date:"1995", label:"JavaScript created in 10 days by Brendan Eich at Netscape"}, ...]
  BAD: [{date:"Long ago", label:"The web started"}, {date:"Recently", label:"Things changed"}]

● "comparison" block:
  items = 2-4 with named entities and quantifiable differences (same bar as slides)

● "takeaway" block:
  text = A specific, memorable insight (not "this topic is important")
  GOOD: "Every second of load time costs 7% in conversions — optimize images, minify CSS, and use a CDN to keep your site under the 3-second threshold"
  BAD: "Web development is an important field with many opportunities"

● "text" block:
  text = 2-3 sentences of essential context (use sparingly — prefer visual blocks)

═══════════════════════════════════════
METADATA FIELDS
═══════════════════════════════════════

- title: max 8 words, punchy, specific to the topic (not "Important Information")
- subtitle: max 14 words framing what the reader will learn
- header.text: the big heading at the top of the infographic
- header.subtext: optional one-liner beneath it
- footer: short attribution or source note
- accentColor: pick one that matches the topic's mood (orange=energy, blue=tech, emerald=nature/growth, violet=creative, rose=health/people, amber=finance/caution)

═══════════════════════════════════════
SECTIONS and KEYSTATS (fallback view)
═══════════════════════════════════════

These power the text-only fallback when images can't render:
- sections (3-6): each has a heading + a 2-3 sentence summary of a major topic area from the sources. Be comprehensive — this is the user's backup way to consume the information.
- keyStats (2-5): the most impactful numbers repeated as {value, label} pairs.

═══════════════════════════════════════
ILLUSTRATION PROMPT (secondary priority)
═══════════════════════════════════════

illustrationPrompt creates the visual background (1280×1600 portrait). Describe ONLY visual elements — NO text, NO letters, NO numbers, NO labels, NO words, NO typography.

100-200 words. Style: pen-and-ink technical illustration on cream-colored graph paper, vintage engineering sketchbook (Leonardo's Codex, old physics textbooks). Describe small illustrated vignettes positioned in specific zones of the canvas (top-left, center-right, bottom, etc.), leaving whitespace between each for the text/chart overlay. Thin ink lines, off-register hand-drawn feel, occasional muted orange/sepia watercolor wash on focal elements.

The illustration should visually RELATE to the infographic's topic. If the topic is cooking, draw utensils and ingredients. If it's web development, draw browsers and code brackets and server racks.

Sources:
${ctx.sourceContext}
```

### Verification:
- The Zod `layoutSchema` does NOT change
- Imports do NOT change
- Only the prompt string inside `generateObject()` changes

---

## TASK 3: COMPLETE THE VIDEO PIPELINE

The video pipeline at `/src/lib/video/generate-video.ts` currently only generates a script with chapters and images but does NOT produce a real video. The viewer shows text cards instead of a video player.

### What already works:
- Phase 1: Script generation with `generateObject()` (5-7 chapters with title, narration, imagePrompt)
- Phase 2: Image generation with fal.ai (one landscape 16:9 image per chapter, persisted to R2)

### What needs to be implemented:

**Phase 3: Text-to-Speech with ElevenLabs**
- For each chapter, generate TTS audio from the `narration` field using the ElevenLabs API
- Use the `eleven_multilingual_v2` model (already used in the podcast pipeline)
- Voice: use a single narrator voice (not two hosts like the podcast) — `VOICE_ALEX` from podcast or configurable via `ELEVENLABS_VOICE_VIDEO`
- Store each audio as a buffer, not as an intermediate file
- The podcast pipeline (`/src/lib/podcast/generate-podcast.ts`) already has a working pattern for calling ElevenLabs — reuse that logic

**Phase 4: Composition with FFmpeg**
- Install `fluent-ffmpeg` + `@ffmpeg-installer/ffmpeg` as dependencies
- For each chapter: create a video segment combining the static image + TTS audio
  - The image displays for the full duration of that chapter's audio
  - Smooth transition (fade) between chapters (~0.5s crossfade)
- Concatenate all segments into a single MP4 (H.264 video + AAC audio)
- Simpler alternative if FFmpeg is problematic on serverless: use fal.ai's video API if they have a model that accepts image+audio, or generate a slideshow MP4 purely with Sharp frame-by-frame (slower but no FFmpeg dependency)

**Phase 5: Upload and finalization**
- Upload the final MP4 to R2 using `uploadFile()`
- Update the output in DB with: `fileUrl` = video URL, `status` = "ready", `duration` = total duration in seconds
- The `content` JSON must include chapters with timestamps for the chapter player

### Podcast pattern to reuse:
The file `/src/lib/podcast/generate-podcast.ts` already does TTS with ElevenLabs successfully. It has:
- The API URL: `https://api.elevenlabs.io/v1/text-to-speech`
- Voices configured via env vars
- The flow: generate audio per segment → concatenate → upload to R2

Reuse that pattern adapted for video (single voice, no dialogue).

### Also update the video prompt:
The script prompt in `generate-video.ts` (lines 63-70) is also too generic. Apply the same content density rules:
- Each chapter narration must contain REAL, specific information from the sources
- imagePrompts must follow the same illustration style (ink on cream graph paper, no text)
- Narration must be educational, not just descriptive

### Update the video player:
The component `/src/components/video/video-player.tsx` imports `GlassCard` which was already removed from the codebase. Replace with div + inline styles using CSS custom properties `var(--fm-*)`, consistent with the rest of the app. Keep the three player modes (loading, script-only, full video).

---

## TASK 4: FIX THE AI MODEL

The file `/src/lib/ai/models.ts` only supports OpenAI (gpt-4o, gpt-4o-mini), but the slides and infographic routes pass `modelId = "gemini-2.5-flash"` and `modelId = "gpt-4o"` respectively, and the video uses `getModel("gemini-2.5-flash")`.

**Problem**: `getModel("gemini-2.5-flash")` falls through to the `default` case and returns `openai("gpt-4o-mini")`, the weakest model. This directly contributes to shallow, uninformative content.

**Solution**: Update `models.ts` to support Google Gemini. The project already lists `@ai-sdk/google` in its dependencies (mentioned in CLAUDE.md). Add:
```typescript
import { google } from "@ai-sdk/google";

// In getModel():
case "gemini-2.5-flash":
  return google("gemini-2.5-flash");
case "gemini-2.5-pro":
  return google("gemini-2.5-pro");
```

And add the models to the `models[]` array with tier "pro" or "ultra".

**IMPORTANT**: Verify that `@ai-sdk/google` is installed (`pnpm list @ai-sdk/google`). If not, install it with `pnpm add @ai-sdk/google`.

---

## TASK 5: VERIFICATION

After all changes:

1. `pnpm build` — must compile with zero TypeScript errors
2. `pnpm lint` — must pass with zero errors
3. `pnpm test` — existing tests must pass
4. Manually verify that:
   - The `GlassCard` import no longer exists in video-player.tsx
   - Slides and infographic prompts prioritize CONTENT over illustration
   - The video pipeline has TTS + composition implemented (or at minimum an improved fallback that generates a slideshow)
   - `getModel("gemini-2.5-flash")` returns the correct Google model

---

## EXECUTION ORDER

1. **Task 4 first** (model fix) — this is a dependency so the other tasks generate content with the correct model
2. **Task 1** (slides prompt) — the highest-impact change for visible quality
3. **Task 2** (infographic prompt) — second highest impact
4. **Task 3** (video pipeline) — the most complex, do last
5. **Task 5** (verification) — always last

---

## ABSOLUTE CONSTRAINTS

- **DO NOT** modify the Zod schemas (they already represent the correct structure)
- **DO NOT** modify `compose-slide.ts` or `compose-infographic.ts` (the SVG renderers work)
- **DO NOT** modify `svg-helpers.ts` or `generate-image.ts`
- **DO NOT** change the API route structure, error handling, or DB operations
- **DO NOT** change existing type exports
- **DO NOT** add unnecessary dependencies (use what's already there: ai, zod, sharp, @fal-ai/client, drizzle-orm)
- **YES** you can add `fluent-ffmpeg` + `@ffmpeg-installer/ffmpeg` for the video task if you choose to use FFmpeg
- **YES** you can add `@ai-sdk/google` if it's not already installed
- All files must compile under TypeScript strict mode
- Use named exports, not default exports (except Next.js pages)
- Use `type` imports for type-only imports
