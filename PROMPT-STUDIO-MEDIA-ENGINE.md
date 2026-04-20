# FluxMind Studio — AI Media Generation Engine

## Objective

Transform Studio outputs from plain HTML/CSS components into **real AI-generated media**: images, audio narrations, and videos — matching or exceeding the quality of NotebookLM's generated infographics (hand-drawn style illustrations with annotations, diagrams, and data visualizations).

Read `CLAUDE.md` first for stack and code style rules. All rules there apply here.

---

## Architecture Overview

```
User clicks "Generate Infographic"
  → POST /api/studio/infographic
    → Step 1: AI generates structured content (title, sections, data points)
    → Step 2: AI generates detailed image prompt from structured content
    → Step 3: fal.ai generates the actual image (FLUX model)
    → Step 4: Upload image to Cloudflare R2
    → Step 5: Save output with imageUrl + structured content as metadata
  → Frontend renders <img> with fullscreen viewer + overlay annotations
```

---

## PART 1: Image-Based Infographic Generation

### 1A. Rewrite `/src/app/api/studio/infographic/route.ts`

The current infographic route generates structured JSON rendered as HTML. Replace it with a **two-phase pipeline**: structured content → image generation.

```typescript
// Phase 1: Generate structured content + image prompt
const contentSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  imagePrompt: z.string().describe("Detailed prompt for AI image generation — see rules below"),
  sections: z.array(z.object({
    heading: z.string(),
    summary: z.string(),
  })),
  keyStats: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })),
});
```

**Image Prompt Engineering** — this is the most critical part. The prompt sent to fal.ai must produce NotebookLM-quality illustrations. Use a system prompt like:

```
You are an expert data visualization designer. Given source material, create:
1. Structured content (title, sections, stats)
2. A DETAILED image generation prompt that describes a professional infographic illustration.

IMAGE PROMPT RULES:
- Style: Clean educational illustration, hand-drawn ink style with annotations
- MUST describe specific visual elements: graphs, diagrams, icons, arrows, labels
- MUST include spatial layout: "top-left shows X, center features Y, bottom has Z"
- MUST specify the exact text/numbers to render on the image
- MUST describe a clear visual hierarchy with a main focal illustration
- Reference style: "technical whiteboard illustration", "editorial infographic", "scientific diagram with annotations"
- Include color palette: "monochrome ink with selective orange/red accents"
- Resolution: designed for 1280x1600 vertical format
- NO generic descriptions — be SPECIFIC about what's drawn

EXAMPLE IMAGE PROMPT:
"A clean educational infographic illustration in hand-drawn ink style on white background. Title 'Thermodynamics: Atmospheric Pressure Law' at top in bold serif font. Center: a large XY graph with 'Altitude' on X-axis and 'Boiling Point' on Y-axis showing a descending curve. Along the curve, three annotated callout boxes: (1) at sea level showing a pot with '100°C, 15-20min rice', (2) mid-altitude showing an airplane with '90°C, flavor extraction changes', (3) high altitude showing mountains labeled 'La Paz 3600m, 88°C, 40min rice'. Bottom-right: a pressure cooker illustration with arrow pointing down on the curve, labeled '120°C, reduced times'. Style: monochrome ink with thin line weight, selective orange accent on key numbers. Professional, clean, educational."
```

### 1B. Fal.ai Image Generation

Create `/src/lib/media/generate-image.ts`:

```typescript
import { fal } from "@fal-ai/client";

// Configure fal client
fal.config({ credentials: process.env.FAL_KEY });

export const generateInfographicImage = async (
  prompt: string,
  options?: { width?: number; height?: number }
): Promise<string> => {
  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt,
      image_size: { width: options?.width ?? 1280, height: options?.height ?? 1600 },
      num_images: 1,
      guidance_scale: 7.5,
      num_inference_steps: 28,
      enable_safety_checker: false,
    },
  });
  
  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) throw new Error("No image generated");
  
  return imageUrl; // Temporary fal URL — download and upload to R2
};
```

**IMPORTANT**: The current code in `src/lib/video/generate-video.ts` uses raw `fetch()` to fal.ai's queue API. This works but is fragile. Instead:
- Install `@fal-ai/client` package: `pnpm add @fal-ai/client`
- Use `fal.subscribe()` which handles polling automatically
- Available models to try:
  - `fal-ai/flux/dev` — best quality, slower (~15s)
  - `fal-ai/flux-pro/v1.1` — production quality, faster
  - `fal-ai/flux/schnell` — fastest, lower quality (good for thumbnails)

### 1C. R2 Upload Pipeline

After fal.ai generates the image, download it and upload to R2:

```typescript
// In the infographic route, after image generation:
const imageBuffer = await fetch(falImageUrl).then(r => r.arrayBuffer()).then(Buffer.from);
const r2Key = `infographics/${notebookId}/${outputId}.png`;
const permanentUrl = await uploadFile(imageBuffer, r2Key, "image/png");

// Also generate a thumbnail
const thumbnailResult = await fal.subscribe("fal-ai/flux/schnell", {
  input: { prompt: `${prompt}. Thumbnail preview.`, image_size: { width: 400, height: 300 }, num_images: 1 },
});
const thumbBuffer = await fetch(thumbnailResult.data.images[0].url).then(r => r.arrayBuffer()).then(Buffer.from);
const thumbUrl = await uploadFile(thumbBuffer, `infographics/${notebookId}/${outputId}-thumb.png`, "image/png");
```

### 1D. Infographic Viewer Component

Replace the current HTML-based `InfographicViewer` with an image viewer:

```typescript
// src/components/studio/infographic-viewer.tsx
export const InfographicViewer = ({ infographic }: { infographic: InfographicOutput }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  return (
    <div>
      {/* Toolbar: Download PNG, Fullscreen, Regenerate */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="outline" size="sm" onClick={() => downloadImage(infographic.imageUrl)}>
          <Download /> Download PNG
        </Button>
        <Button variant="outline" size="sm" onClick={() => setIsFullscreen(true)}>
          <Maximize /> Fullscreen
        </Button>
      </div>
      
      {/* The actual generated image */}
      <div className="rounded-xl overflow-hidden border border-border">
        <img 
          src={infographic.imageUrl} 
          alt={infographic.title}
          className="w-full h-auto"
          loading="lazy"
        />
      </div>
      
      {/* Structured data below for accessibility / SEO */}
      <div className="mt-4 space-y-2">
        {infographic.sections?.map((section, i) => (
          <details key={i} className="text-sm">
            <summary className="font-medium cursor-pointer">{section.heading}</summary>
            <p className="text-muted-foreground mt-1 pl-4">{section.summary}</p>
          </details>
        ))}
      </div>
      
      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setIsFullscreen(false)}>
          <img src={infographic.imageUrl} alt={infographic.title} className="max-w-full max-h-full object-contain" />
          <button className="absolute top-4 right-4 text-white"><X /></button>
        </div>
      )}
    </div>
  );
};
```

### 1E. Update Type Exports

The `InfographicContent` type must change since the output is now image-based:

```typescript
export type InfographicContent = {
  title: string;
  subtitle: string;
  imageUrl: string;        // R2 permanent URL
  thumbnailUrl?: string;   // R2 thumbnail URL
  imagePrompt: string;     // For regeneration
  sections: Array<{ heading: string; summary: string }>;  // Structured metadata
  keyStats: Array<{ value: string; label: string }>;
};
```

---

## PART 2: Audio Narration for Any Output

### 2A. Create `/src/lib/media/generate-narration.ts`

Any Studio output should be able to have an audio explanation layered on top.

```typescript
const generateNarrationScript = async (content: Record<string, unknown>, type: string): Promise<string> => {
  const { text } = await generateText({
    model: getModel("gemini-2.5-flash"),
    prompt: `You are a friendly, engaging narrator explaining a ${type} to a student.

Content to explain:
${JSON.stringify(content, null, 2)}

Write a natural-sounding narration (200-400 words) that:
- Opens with a hook: "Let's break down what we're looking at here..."
- Walks through each section/data point conversationally
- Highlights the most surprising or important findings
- Closes with a takeaway
- Sounds like a knowledgeable friend, NOT a textbook
- Use natural pauses: "Now here's where it gets interesting..."
- Reference specific numbers and facts from the content`,
  });
  return text;
};

export const generateNarration = async (
  outputId: string,
  content: Record<string, unknown>,
  outputType: string,
  notebookId: string,
): Promise<{ audioUrl: string; script: string; duration: number }> => {
  // Step 1: Generate script
  const script = await generateNarrationScript(content, outputType);
  
  // Step 2: ElevenLabs TTS
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");
  
  const voiceId = process.env.ELEVENLABS_NARRATOR_VOICE ?? "21m00Tcm4TlvDq8ikWAM";
  
  const ttsResponse = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
      }),
    }
  );
  
  if (!ttsResponse.ok) throw new Error(`TTS failed: ${await ttsResponse.text()}`);
  
  const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
  
  // Step 3: Upload to R2
  const { uploadFile } = await import("@/lib/storage/r2");
  const audioUrl = await uploadFile(
    audioBuffer,
    `narrations/${notebookId}/${outputId}.mp3`,
    "audio/mpeg"
  );
  
  const duration = Math.round(audioBuffer.length / 16000); // rough estimate
  
  return { audioUrl, script, duration };
};
```

### 2B. Add Narration API Route

Create `/src/app/api/studio/narrate/route.ts`:

```typescript
// POST { outputId, notebookId } → generates audio narration for any existing output
// Loads the output content, generates script, TTS, uploads to R2
// Updates the output record with audioUrl in content jsonb
```

### 2C. Audio Player Component

Add an inline audio player to every output viewer. Create or update `/src/components/studio/narration-player.tsx`:

```typescript
// Compact audio player that sits above any output
// Shows: play/pause, progress bar, speed control (1x, 1.5x, 2x), download
// Fetches narration on-demand: first click → calls /api/studio/narrate → plays when ready
// Caches audioUrl in output content so subsequent views don't regenerate
```

---

## PART 3: Video Generation (Image + Audio Combined)

### 3A. Update `/src/lib/video/generate-video.ts`

The existing code already has the right structure but stops at image generation. Complete the pipeline:

```
Step 1: Generate script with chapters (already works) ✓
Step 2: Generate images via fal.ai for each chapter (already works) ✓
Step 3: Generate TTS for each chapter narration via ElevenLabs
Step 4: Use fal.ai video model to create video segments OR compose on server
Step 5: Upload final video to R2
```

For Step 4, there are two approaches:

**Option A: fal.ai image-to-video** (recommended for quality)
```typescript
// Use fal-ai/kling-video/v1/standard/image-to-video
// Takes a static image and animates it subtly (zoom, pan)
const videoResult = await fal.subscribe("fal-ai/kling-video/v1/standard/image-to-video", {
  input: {
    prompt: chapter.imagePrompt,
    image_url: chapter.imageUrl,
    duration: "5",  // 5 seconds per chapter
    aspect_ratio: "16:9",
  },
});
```

**Option B: Server-side composition with fluent-ffmpeg** (faster, cheaper)
```typescript
// Compose still images + audio using FFmpeg
// Each chapter: image displayed for (audioLength / chapters) seconds
// Requires: pnpm add fluent-ffmpeg @types/fluent-ffmpeg
// And FFmpeg binary installed on server (available on Vercel via layer)
```

### 3B. Video Player Component

The existing `/src/components/video/video-player.tsx` should be updated to handle the new video URLs from R2 and show chapter navigation.

---

## PART 4: Slide Deck Image Generation

### 4A. Visual Slides (Image-Based)

Each slide can optionally have a background illustration generated by fal.ai:

```typescript
// In the slides route, for "title", "section_break", and "stat" layouts:
// Generate a background illustration using fal.ai
const bgPrompt = `Subtle, clean background illustration for a presentation slide about "${slide.title}". 
Minimalist, professional, soft gradient with abstract geometric shapes. 
Color palette: ${accentColor} tones. No text. 16:9 landscape format.`;

const bgImage = await generateInfographicImage(bgPrompt, { width: 1920, height: 1080 });
```

This is optional and expensive — gate behind a "Premium" or "Enhanced" toggle.

---

## PART 5: Performance Requirements

### CRITICAL: Follow these rules to avoid the performance issues we've already fixed.

1. **NO infinite CSS animations on the main views** — zero `animation: X infinite` on dashboard or notebook pages
2. **NO `filter: blur()` or `filter: drop-shadow()`** on visible elements — these recompute every frame
3. **NO SVG filters** (feTurbulence, feGaussianBlur) — extremely expensive
4. **Lazy-load ALL Studio viewers** with `dynamic(() => import(...), { ssr: false })`
5. **Images must use `loading="lazy"`** and proper dimensions to avoid layout shift
6. **Use `<img>` not `<Image>` from next/image** for R2-hosted images (external URLs, no optimization needed since we control the size)
7. **Background blobs**: keep the existing 3-blob radial-gradient system with translate3d animations — DO NOT add more or change to blur-based
8. **Icon components (OrbitalIcon, BreathingIcon, RotatingBorderIcon, AccentIcon)**: all are now static — DO NOT add animations back
9. **The dashboard greeting text**: static gradient — DO NOT add `animation: gradientShift` back
10. **`contain: strict`** on the AnimatedBackground wrapper
11. **All generation runs server-side** — never call fal.ai or ElevenLabs from the client
12. **Use React Query `staleTime: 30_000`** to avoid refetching outputs on every tab switch
13. **Thumbnail images for output cards** — show small thumbnails (~400x300) in the output list, not full images
14. **Audio: stream via HTML5 `<audio>` element** — don't load full audio into memory

### Theme System
- Use CSS custom properties (`--fm-*`) with `data-theme` attribute, NOT `next-themes`
- Theme tokens are in `/src/styles/theme-tokens.css`
- Support both `data-theme="dark"` and `data-theme="light"`

### Animations Allowed
- `fadeInUp` for enter animations (one-shot, not infinite)
- `translate3d()` for GPU-composited transforms
- `transition` for hover effects (transform, opacity only)
- `motion/react` (Framer Motion) ONLY inside Studio viewers that are lazy-loaded

---

## PART 6: Implementation Order

1. **Install fal.ai client**: `pnpm add @fal-ai/client`
2. **Create `/src/lib/media/generate-image.ts`** — fal.ai wrapper with R2 upload
3. **Create `/src/lib/media/generate-narration.ts`** — ElevenLabs narration + R2 upload
4. **Rewrite `/src/app/api/studio/infographic/route.ts`** — two-phase: content → image
5. **Rewrite `/src/components/studio/infographic-viewer.tsx`** — image viewer with fullscreen
6. **Create `/src/app/api/studio/narrate/route.ts`** — narration for any output
7. **Create `/src/components/studio/narration-player.tsx`** — inline audio player
8. **Update `/src/lib/video/generate-video.ts`** — complete the TTS + composition pipeline
9. **Update output types** — add imageUrl, audioUrl, thumbnailUrl fields to content types
10. **Test each step independently** — `pnpm build` and `pnpm test` after each file
11. **Performance audit** — verify zero infinite animations, lazy loading, proper image sizes

---

## PART 7: Environment Variables Required

Make sure these are set in `.env`:

```
FAL_KEY=your-fal-ai-key
ELEVENLABS_API_KEY=your-elevenlabs-key
ELEVENLABS_NARRATOR_VOICE=21m00Tcm4TlvDq8ikWAM  # optional, default voice
R2_ACCOUNT_ID=your-account
R2_ACCESS_KEY_ID=your-key
R2_SECRET_ACCESS_KEY=your-secret
R2_BUCKET_NAME=fluxmind
R2_PUBLIC_URL=https://your-r2-public-url.com
```

---

## PART 8: Existing Code to NOT Break

These files are already correct and working — do NOT modify unless specified:

- `/src/styles/animations.css` — cleaned up, only essential animations remain
- `/src/styles/theme-tokens.css` — CSS custom property theme system
- `/src/components/shared/animated-background.tsx` — radial-gradient blobs, no blur
- `/src/components/shared/orbital-icon.tsx` — static, no animations
- `/src/components/shared/breathing-icon.tsx` — static, no animations
- `/src/components/shared/rotating-border-icon.tsx` — static, no animations
- `/src/components/shared/accent-icon.tsx` — static, no animations
- `/src/components/notebook/source-panel.tsx` — flat list with checkboxes (NotebookLM style)
- `/src/app/(app)/dashboard/page.tsx` — static gradient greeting, no shimmer animation
- `/src/lib/storage/r2.ts` — Cloudflare R2 upload/download utilities
- `/src/lib/podcast/generate-podcast.ts` — working podcast generation pipeline
- `/src/app/api/audio/tts/route.ts` — working ElevenLabs TTS streaming

---

## PART 9: Quality Benchmarks

The generated infographic images should have these characteristics:
- **Hand-drawn/ink illustration style** — like NotebookLM's output
- **Annotated diagrams** with callout boxes, arrows, labels
- **Data visualizations** embedded in the illustration (graphs, charts, timelines)
- **Specific text/numbers** rendered within the image
- **Clean, educational aesthetic** — not generic stock photo style
- **Consistent style across regenerations** — use a style prefix in all prompts

Style prefix to prepend to all fal.ai image prompts:
```
"Clean educational infographic in hand-drawn ink illustration style on white background. Professional, high detail, thin line weight. Selective accent colors. Annotated with callout boxes and labels. "
```

---

## Summary

The key insight is: **NotebookLM generates real images, not HTML**. Their infographics are AI-generated illustrations with embedded text, diagrams, and data visualizations — not styled divs with CSS. FluxMind needs to shift from "render structured JSON as HTML" to "use AI to generate actual visual media and display the images."

The pipeline: **Sources → AI structures content → AI generates image prompt → fal.ai generates image → R2 stores it → Frontend displays `<img>`**

This applies to infographics, slide backgrounds, video chapters, and any future visual output type.
