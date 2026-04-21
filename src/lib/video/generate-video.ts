/**
 * Video overview pipeline — serverless-friendly slideshow mode.
 *
 * Phases:
 *   1. Pull source text & generate a structured multi-chapter script via LLM.
 *   2. Generate a cream-style still image per chapter via fal.ai (best-effort).
 *   3. Synthesize narration per chapter via ElevenLabs (multilingual v2).
 *   4. Save chapters as a slideshow — the viewer steps image+audio per chapter
 *      and auto-advances on audio end. No FFmpeg, no MP4 concat.
 *
 * Design: graceful degradation.
 *   - Missing FAL_KEY       → chapters have no imageUrl, TTS still runs.
 *   - Missing ELEVENLABS    → chapters have no audioUrl, output is "ready"
 *                              with `partial: true` so the viewer renders an
 *                              "audio unavailable" state.
 *   - Per-chapter failures  → logged, that chapter's media is left blank,
 *                              the overall output still ships.
 */
import { generateObject } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { fal } from "@fal-ai/client";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { sources } from "@/db/schema/sources";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { uploadFile } from "@/lib/storage/r2";
import {
  getStyleInstructions,
  type VisualStyle,
} from "@/lib/media/styles";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

// Voice fallback chain:
//   1. ELEVENLABS_VOICE_VIDEO  — dedicated video voice if configured
//   2. ELEVENLABS_VOICE_ALEX   — shared with the podcast path
//   3. Rachel (21m00Tcm4TlvDq8ikWAM) — ElevenLabs default multilingual voice
const resolveVoice = (): string =>
  process.env.ELEVENLABS_VOICE_VIDEO ??
  process.env.ELEVENLABS_VOICE_ALEX ??
  "21m00Tcm4TlvDq8ikWAM";

const scriptSchema = z.object({
  title: z.string(),
  chapters: z.array(
    z.object({
      title: z.string(),
      narration: z.string(),
      imagePrompt: z.string(),
    }),
  ),
});

export type VideoChapter = z.infer<typeof scriptSchema>["chapters"][number];

type ChapterMeta = {
  title: string;
  narration: string;
  imagePrompt: string;
  imageUrl: string;
  audioUrl: string;
  duration: number; // seconds
};

export type VideoGenerateOpts = {
  language?: "en" | "es";
  style?: VisualStyle;
  detailLevel?: "concise" | "standard" | "detailed";
  customPrompt?: string;
  /** Scraped content from discovered sources, concatenated. */
  extraSourceContent?: string;
};

// ─────────────────────────────────────────────────────────────────────
// Helpers

const updateProgress = async (
  outputId: string,
  extra: Record<string, unknown> = {},
): Promise<void> => {
  await db
    .update(outputs)
    .set({ ...extra, updatedAt: new Date() })
    .where(eq(outputs.id, outputId));
};

const synthesizeNarration = async (
  text: string,
  voiceId: string,
): Promise<Buffer> => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

  const res = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75,
        style: 0.25,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${errBody.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
};

const downloadToBuffer = async (url: string): Promise<Buffer> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${url} failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

/**
 * Estimate narration duration from word count. 150 words per minute is a good
 * neutral pace for explainer narration. We use this because ElevenLabs does
 * not return duration and we don't ship ffprobe.
 */
const estimateDurationSec = (text: string): number => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const wpm = 150;
  return Math.max(3, Math.round((words / wpm) * 60));
};

// ─────────────────────────────────────────────────────────────────────
// Main pipeline

export const generateVideo = async (
  notebookId: string,
  outputId: string,
  opts: VideoGenerateOpts = {},
): Promise<void> => {
  const language: "en" | "es" = opts.language ?? "en";
  const style: VisualStyle = opts.style ?? "auto";
  const detailLevel = opts.detailLevel ?? "standard";
  const customPrompt = opts.customPrompt ?? "";
  const extraSourceContent = (opts.extraSourceContent ?? "").slice(0, 80_000);

  try {
    const LANG_NAME = language === "es" ? "Spanish" : "English";
    const langInstr = `IMPORTANT: Generate ALL content in ${LANG_NAME}. Titles, narration, all user-facing text. The imagePrompt must still contain NO text inside the image.`;
    const userInstr = customPrompt.trim()
      ? `\nUSER REQUEST: "${customPrompt.trim()}". Incorporate this into the output.\n`
      : "";
    const styleInstr = getStyleInstructions(style);

    const detailMap = {
      concise: { count: "4-5", perChapter: "45-60 words" },
      standard: { count: "5-7", perChapter: "60-90 words" },
      detailed: { count: "7-9", perChapter: "90-120 words with extra context" },
    } as const;
    const detailPick = detailMap[detailLevel] ?? detailMap.standard;

    await updateProgress(outputId, { status: "generating" });

    // ── Step 1: Pull sources & generate the script ─────────────────
    const notebookSources = await db
      .select({ title: sources.title, rawText: sources.rawText })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));

    const baseSourceContext = notebookSources
      .filter((s) => s.rawText)
      .map((s) => `[${s.title}]\n${s.rawText!.slice(0, 5000)}`)
      .join("\n\n---\n\n");

    const sourceContext = extraSourceContent
      ? `${baseSourceContext}\n\n--- Additional sources ---\n${extraSourceContent}`
      : baseSourceContext;

    const { object: script } = await generateObject({
      model: getModel("gemini-2.5-flash"),
      schema: scriptSchema,
      prompt: `${langInstr}
${userInstr}
You are an expert teacher writing a short narrated explainer video. Your #1 priority is TEACHING real, specific facts from the provided sources. Vague filler is a failure.

═══════════════════════════════════════
STEP 1 — EXTRACT (do this first, silently)
═══════════════════════════════════════

Read the sources and pull out:
- Every specific fact, number, date, duration, or measurable claim
- Every named tool, technology, framework, method, person, place, or product
- Every process, step, or technique
- Every comparison, trade-off, or cause-effect relationship
- Key definitions and expert insights

Organize these extractions into ${detailPick.count} teachable chapters. All narration content must come from these extractions.

═══════════════════════════════════════
STEP 2 — CHAPTER STRUCTURE
═══════════════════════════════════════

Return an object with:
- title: 4-8 words naming the overall topic (in ${LANG_NAME})
- chapters: ${detailPick.count} ordered entries, each with { title, narration, imagePrompt }.

Per-chapter rules:

● title (3-7 words): names the specific sub-topic the chapter teaches. Be concrete — "HTML5 Semantic Structure", not "The Basics".

● narration (${detailPick.perChapter} of natural spoken ${LANG_NAME}):
  - Teach ONE specific, factual insight drawn directly from the sources.
  - Include at least one named entity, concrete example, number, or tool reference.
  - Speak directly to the viewer ("you", "we") — this is read aloud by TTS.
  - Sound natural: flowing spoken prose, no bullet-point formatting, no headings.
  - GOOD: "When a browser loads your HTML, it walks the markup tag by tag and builds a tree called the Document Object Model, or DOM. JavaScript talks to this tree through functions like querySelector to pick a node, or addEventListener to react to a click. Understanding the DOM is what separates a static page from a truly interactive one."
  - BAD:  "HTML is important. The DOM is something you should learn about. It helps with things."

● imagePrompt: a purely visual description of a still background image for the chapter. NO text, NO letters, NO numbers, NO labels, NO words, NO typography anywhere in the image.

${styleInstr}

Write each imagePrompt as 60-120 words describing small vignettes positioned in specific zones (top-left, center, bottom-right), with whitespace between each. The illustration must visually RELATE to the chapter's content.

═══════════════════════════════════════
STEP 3 — GLOBAL RULES
═══════════════════════════════════════

- First chapter introduces the topic and teases what will be learned.
- Last chapter delivers a concrete, memorable takeaway (not motivational filler).
- Never repeat an imagePrompt subject between chapters — each should feel visually distinct.
- All text in ${LANG_NAME}. No language mixing.

Sources:
${sourceContext}`,
    });

    const chapters: ChapterMeta[] = script.chapters.map((c) => ({
      title: c.title,
      narration: c.narration,
      imagePrompt: c.imagePrompt,
      imageUrl: "",
      audioUrl: "",
      duration: estimateDurationSec(c.narration),
    }));

    // Save partial progress — script ready, media coming next.
    await updateProgress(outputId, {
      content: {
        script,
        chapters,
        progress: 20,
        phase: "script_ready",
        mode: "slideshow",
      },
    });

    // ── Step 2: Generate chapter images via fal.ai (best-effort) ────
    const hasFal = !!process.env.FAL_KEY;
    if (hasFal) {
      for (let i = 0; i < chapters.length; i++) {
        try {
          const result = (await fal.subscribe("fal-ai/flux/schnell", {
            input: {
              prompt: `${chapters[i].imagePrompt}. Landscape 16:9. Professional, high quality, clean design, suitable for educational video.`,
              image_size: "landscape_16_9",
              num_images: 1,
              num_inference_steps: 4,
              enable_safety_checker: false,
            },
            logs: false,
          })) as { data?: { images?: Array<{ url: string }> } };
          const falUrl = result.data?.images?.[0]?.url;
          if (falUrl) {
            try {
              const buf = await downloadToBuffer(falUrl);
              chapters[i].imageUrl = await uploadFile(
                buf,
                `videos/${notebookId}/${outputId}/images/${i}-${createId()}.png`,
                "image/png",
              );
            } catch {
              // Fall back to the short-lived fal URL — better than nothing.
              chapters[i].imageUrl = falUrl;
            }
          }
        } catch (err) {
          console.warn(`Chapter ${i} image failed:`, err);
        }
        await updateProgress(outputId, {
          content: {
            script,
            chapters,
            progress: 20 + Math.round(((i + 1) / chapters.length) * 30),
            phase: "images",
            mode: "slideshow",
          },
        });
      }
    }

    // ── Step 3: Synthesize TTS per chapter (ElevenLabs) ─────────────
    const hasEleven = !!process.env.ELEVENLABS_API_KEY;
    let partial = !hasEleven;
    const voiceId = resolveVoice();

    if (hasEleven) {
      for (let i = 0; i < chapters.length; i++) {
        try {
          const audio = await synthesizeNarration(
            chapters[i].narration,
            voiceId,
          );
          const key = `videos/${notebookId}/${outputId}/chapters/${i}.mp3`;
          chapters[i].audioUrl = await uploadFile(audio, key, "audio/mpeg");
        } catch (err) {
          console.warn(`Chapter ${i} TTS failed:`, err);
          partial = true;
          chapters[i].audioUrl = "";
        }

        await updateProgress(outputId, {
          content: {
            script,
            chapters,
            progress: 50 + Math.round(((i + 1) / chapters.length) * 40),
            phase: "tts",
            mode: "slideshow",
          },
        });

        // Soft rate limit — ElevenLabs per-second cap guardrail.
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    // ── Step 4: Finalize as slideshow (image + audio per chapter) ───
    const totalDuration = chapters.reduce(
      (sum, c) => sum + (c.duration ?? 0),
      0,
    );

    const finalContent: Record<string, unknown> = {
      script,
      chapters,
      duration: totalDuration,
      mode: "slideshow",
    };
    if (partial) finalContent.partial = true;

    await db
      .update(outputs)
      .set({
        status: "ready",
        fileUrl: null,
        duration: totalDuration,
        content: finalContent,
        updatedAt: new Date(),
      })
      .where(eq(outputs.id, outputId));
  } catch (error) {
    console.error("Video generation failed:", error);
    await db
      .update(outputs)
      .set({
        status: "error",
        content: {
          error: error instanceof Error ? error.message : "Generation failed",
        },
        updatedAt: new Date(),
      })
      .where(eq(outputs.id, outputId));
  }
};
