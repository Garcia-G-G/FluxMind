# FluxMind — Claude Code Max: STUDIO VISUAL RICHNESS

> **Read `CLAUDE.md` first** for stack and code style rules.
> Every fix here is specific, with file paths and line numbers. No guessing.

---

## GOAL

Make ALL studio outputs more visually rich with AI-generated images via fal.ai. Currently only `infographic` and `slides` generate images — everything else is pure text JSON. Users want vivacidad (vivacity/life), not text walls.

**The approach:** For each output type, generate 1-3 supporting images via fal.ai and include the image URLs in the output JSON. The frontend viewers then render these images alongside the text content.

---

## CURRENT STATE

### Routes that already generate images:
- `src/app/api/studio/infographic/route.ts` → uses `composeInfographic` which calls `generateInfographicImage` from `@/lib/media/generate-image.ts`
- `src/app/api/studio/slides/route.ts` → uses `composeSlide` which calls `generateInfographicImage`

### Routes that are text-only (need images):
| Route | File | Schema | Lines |
|-------|------|--------|-------|
| flashcards | `src/app/api/studio/flashcards/route.ts` | `flashcardsSchema` | 214 |
| quiz | `src/app/api/studio/quiz/route.ts` | `quizSchema` | 233 |
| course | `src/app/api/studio/course/route.ts` | `courseSchema` | 187 |
| thread | `src/app/api/studio/thread/route.ts` | `threadSchema` | 136 |
| newsletter | `src/app/api/studio/newsletter/route.ts` | `newsletterSchema` | 153 |
| mindmap | `src/app/api/studio/mindmap/route.ts` | mindmap schema | 230 |

### Image generation utility:
`src/lib/media/generate-image.ts` (120 lines) — exports `generateInfographicImage()` which:
- Takes a prompt + opts (size, model, persistTo, style)
- Returns `{ url: string; persisted: boolean }`
- Uses `getStylePrefix(style)` to prepend style-specific illustration instructions
- Supports multiple fal.ai models (flux-pro, flux/dev, flux/schnell, ideogram, recraft)
- Can persist to R2 via `persistTo: { key }` option

---

## EXECUTION ORDER

1. Create a shared `generateOutputImages` utility
2. Add images to flashcards
3. Add images to quiz
4. Add images to course
5. Add images to newsletter
6. Add images to thread
7. Update frontend viewers to display images
8. Verify

---

## TASK 1: CREATE SHARED IMAGE GENERATION UTILITY

**New file**: `src/lib/media/generate-output-images.ts`

Create a utility that generates topic-relevant images for any output type:

```typescript
import { generateInfographicImage, type GeneratedImage } from "@/lib/media/generate-image";
import type { VisualStyle } from "@/lib/media/styles";

export type OutputImage = {
  url: string;
  alt: string;
  persisted: boolean;
};

/**
 * Generate 1-N supporting images for a studio output.
 * Each image is a visual illustration (NO text in image) relevant to the topic.
 * Fails gracefully — returns empty array if FAL_KEY is missing or generation fails.
 */
export const generateOutputImages = async (opts: {
  /** Topic description for the image prompts */
  topics: string[];
  /** Output type — used for the R2 key prefix */
  outputType: string;
  /** Output ID — used for the R2 key */
  outputId: string;
  /** Notebook ID — used for the R2 key prefix */
  notebookId: string;
  /** Visual style for style-aware illustration */
  style?: VisualStyle;
  /** Image size — smaller than infographic since these are supplementary */
  size?: { width: number; height: number };
}): Promise<OutputImage[]> => {
  if (!process.env.FAL_KEY) return [];

  const size = opts.size ?? { width: 768, height: 768 };
  const results: OutputImage[] = [];

  // Generate images in parallel, fail individually
  const promises = opts.topics.map(async (topic, i) => {
    try {
      const image = await generateInfographicImage(
        `Illustration for educational content about: ${topic}. Scene showing visual metaphors and objects related to the topic. Rich, colorful, engaging.`,
        {
          size,
          model: "fal-ai/flux/schnell", // Fast model for supplementary images
          style: opts.style ?? "auto",
          persistTo: {
            key: `studio/${opts.notebookId}/${opts.outputType}/${opts.outputId}/img-${i}.png`,
          },
        },
      );
      return {
        url: image.url,
        alt: topic,
        persisted: image.persisted,
      };
    } catch (err) {
      console.warn(`Output image ${i} generation failed:`, err);
      return null;
    }
  });

  const settled = await Promise.allSettled(promises);
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      results.push(result.value);
    }
  }

  return results;
};
```

---

## TASK 2: ADD IMAGES TO FLASHCARDS

**File**: `src/app/api/studio/flashcards/route.ts`

### 2A. Extend the schema to include images

Add to `flashcardsSchema` (line 15-28):

```typescript
const flashcardsSchema = z.object({
  title: z.string(),
  coverImagePrompt: z.string().describe(
    "A 1-sentence visual description for a cover illustration. NO text, NO labels. Just visual objects and scenes related to the overall topic. Example: 'Colorful neurons firing in a brain cross-section with synapses glowing blue and purple'"
  ),
  cards: z.array(
    z.object({
      id: z.string(),
      front: z.string(),
      back: z.string(),
      hint: z.string().min(5),
      difficulty: z.enum(["easy", "medium", "hard"]),
      sourceReference: z.string(),
      tags: z.array(z.string()),
      imagePrompt: z.string().nullable().describe(
        "Optional: 1-sentence visual for this card's concept. NO text/labels. null if concept is too abstract to illustrate. Example for 'photosynthesis': 'A leaf cross-section showing chloroplasts absorbing sunlight rays with green and gold energy particles'"
      ),
    })
  ),
});
```

### 2B. Generate images after content generation

After the `generateObject` call (around line 118-179), add image generation:

```typescript
// Generate images for cards that have imagePrompts
import { generateOutputImages, type OutputImage } from "@/lib/media/generate-output-images";

// After const { object: flashcards } = await generateObject(...);

// Generate cover + up to 5 card images (to avoid excessive API calls)
const imageTopics: string[] = [flashcards.coverImagePrompt];
const cardsWithImages = flashcards.cards
  .filter(c => c.imagePrompt)
  .slice(0, 5);
imageTopics.push(...cardsWithImages.map(c => c.imagePrompt!));

const images = await generateOutputImages({
  topics: imageTopics,
  outputType: "flashcards",
  outputId,
  notebookId,
});

// Attach cover image
const coverImage = images[0]?.url ?? null;

// Attach card images (map back to card IDs)
const cardImages: Record<string, string> = {};
cardsWithImages.forEach((card, i) => {
  const img = images[i + 1];
  if (img) cardImages[card.id] = img.url;
});
```

### 2C. Include images in the saved output

When saving to DB and returning the response, include:

```typescript
const savedContent = {
  ...flashcards,
  coverImage,
  cardImages, // { cardId: imageUrl }
};
```

---

## TASK 3: ADD IMAGES TO QUIZ

**File**: `src/app/api/studio/quiz/route.ts`

Same pattern as flashcards:

### 3A. Add `coverImagePrompt` to `quizSchema` (after `title`)

```typescript
coverImagePrompt: z.string().describe(
  "A 1-sentence visual description for a cover illustration. NO text. Visual objects and scenes related to the quiz topic."
),
```

### 3B. Generate 1 cover image after content generation

```typescript
const images = await generateOutputImages({
  topics: [quiz.coverImagePrompt],
  outputType: "quiz",
  outputId,
  notebookId,
});
const coverImage = images[0]?.url ?? null;
```

### 3C. Save with `coverImage` field

---

## TASK 4: ADD IMAGES TO COURSE

**File**: `src/app/api/studio/course/route.ts`

### 4A. Add image prompts to `courseSchema`

Add to the course schema:

```typescript
coverImagePrompt: z.string().describe("Cover illustration prompt. NO text."),
```

Add to each lesson object:

```typescript
imagePrompt: z.string().describe(
  "1-sentence visual for this lesson's main concept. NO text/labels."
),
```

### 4B. Generate 1 cover image + 1 image per lesson (max 6 lessons)

```typescript
const imageTopics = [
  course.coverImagePrompt,
  ...course.lessons.slice(0, 6).map(l => l.imagePrompt),
];

const images = await generateOutputImages({
  topics: imageTopics,
  outputType: "course",
  outputId,
  notebookId,
});

const coverImage = images[0]?.url ?? null;
const lessonImages: Record<string, string> = {};
course.lessons.slice(0, 6).forEach((lesson, i) => {
  const img = images[i + 1];
  if (img) lessonImages[lesson.id] = img.url;
});
```

---

## TASK 5: ADD IMAGES TO NEWSLETTER

**File**: `src/app/api/studio/newsletter/route.ts`

### 5A. Add to `newsletterSchema`:

```typescript
heroImagePrompt: z.string().describe("Hero illustration for the newsletter header. NO text."),
```

Add to each section:

```typescript
imagePrompt: z.string().nullable().describe("Optional section illustration. NO text. null if not needed."),
```

### 5B. Generate hero + section images

```typescript
const imageTopics = [
  newsletter.heroImagePrompt,
  ...newsletter.sections.filter(s => s.imagePrompt).slice(0, 3).map(s => s.imagePrompt!),
];

const images = await generateOutputImages({
  topics: imageTopics,
  outputType: "newsletter",
  outputId,
  notebookId,
});

const heroImage = images[0]?.url ?? null;
const sectionImages: Record<number, string> = {};
let imgIdx = 1;
newsletter.sections.forEach((section, i) => {
  if (section.imagePrompt && images[imgIdx]) {
    sectionImages[i] = images[imgIdx].url;
    imgIdx++;
  }
});
```

---

## TASK 6: ADD IMAGES TO THREAD

**File**: `src/app/api/studio/thread/route.ts`

### 6A. Add to `threadSchema`:

```typescript
coverImagePrompt: z.string().describe("Visual illustration for the thread topic. NO text."),
```

### 6B. Generate 1 cover image

```typescript
const images = await generateOutputImages({
  topics: [thread.coverImagePrompt],
  outputType: "thread",
  outputId,
  notebookId,
});
const coverImage = images[0]?.url ?? null;
```

---

## TASK 7: UPDATE FRONTEND VIEWERS

Find the viewer components for each output type. They're likely in `src/components/studio/` or `src/components/notebook/`. Search for:

```
grep -r "FlashcardContent" src/components/
grep -r "QuizContent" src/components/
grep -r "CourseContent" src/components/
grep -r "NewsletterContent" src/components/
grep -r "ThreadContent" src/components/
```

For each viewer:

### 7A. Flashcard viewer — show card images

When rendering a flashcard, check if `cardImages[card.id]` exists. If so, show the image on the card front:

```tsx
{cardImages?.[card.id] && (
  <img
    src={cardImages[card.id]}
    alt={card.front}
    className="w-full h-32 object-cover rounded-lg mb-3"
  />
)}
```

Also show the cover image at the top of the flashcard deck.

### 7B. Quiz viewer — show cover image

Show the cover image as a banner at the top of the quiz.

### 7C. Course viewer — show lesson images

Show the cover image as a course banner. For each lesson, show its image as a lesson header illustration.

### 7D. Newsletter viewer — show hero + section images

Show the hero image as a large banner at the top. Show section images inline within each section.

### 7E. Thread viewer — show cover image

Show the cover image at the top of the thread preview.

### IMPORTANT for all viewers:

- Use `next/image` or `<img>` with proper sizing
- Add `loading="lazy"` to non-hero images
- Images should have `rounded-lg` or `rounded-xl` styling
- Add a fallback: if image URL is null/undefined, don't render the `<img>` at all
- Never break the viewer if images are missing (backward compatibility with existing outputs that don't have images)

---

## TASK 8: VERIFY

1. **`pnpm build`** — zero errors
2. **`pnpm lint`** — zero errors  
3. **`pnpm test`** — existing tests pass
4. **Check:**
   - Generate flashcards → should have a cover image + some card images
   - Generate quiz → should have a cover image
   - Generate course → should have cover + lesson images
   - Generate newsletter → should have hero + section images
   - Generate thread → should have a cover image
   - Old outputs (without images) should still render correctly (no errors)
   - If `FAL_KEY` is not set, all outputs should still work (just without images)

---

## GUIDELINES

You have full freedom to modify schemas, types, functions, the image generation utility, or anything else needed. The instructions above are a detailed starting point — not restrictions.

**Key goals:**
- Every output type should have at least a cover image generated via fal.ai
- Flashcards and courses should have per-card/per-lesson images where the concept is illustratable
- Old outputs without images must still render (backward compat in viewers — just don't render `<img>` if URL is null)
- If `FAL_KEY` is not set, outputs should still work (just without images)
- Use `fal-ai/flux/schnell` for speed on supplementary images (not flux-pro)
- Use `Promise.allSettled` so one failed image doesn't break the output
- Cap at ~6 images per output to keep costs reasonable
- `pnpm build && pnpm lint && pnpm test` must all pass
