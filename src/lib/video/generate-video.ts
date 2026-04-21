import { generateObject } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { fal } from "@fal-ai/client";
import { createId } from "@paralleldrive/cuid2";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import sharp from "sharp";
import { db } from "@/lib/db";
import { sources } from "@/db/schema/sources";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { uploadFile } from "@/lib/storage/r2";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const VOICE_VIDEO = process.env.ELEVENLABS_VOICE_VIDEO ?? "21m00Tcm4TlvDq8ikWAM";

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
  imageUrl?: string;
  startMs?: number;
  durationMs?: number;
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

const synthesizeNarration = async (text: string): Promise<Buffer> => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

  const res = await fetch(`${ELEVENLABS_API_URL}/${VOICE_VIDEO}`, {
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

const probeDurationMs = (filePath: string): Promise<number> =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const seconds = data.format?.duration ?? 0;
      resolve(Math.round(seconds * 1000));
    });
  });

const buildChapterVideo = (
  imagePath: string,
  audioPath: string,
  outputPath: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .inputOptions(["-loop", "1"])
      .input(audioPath)
      .outputOptions([
        "-c:v",
        "libx264",
        "-tune",
        "stillimage",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-pix_fmt",
        "yuv420p",
        "-vf",
        "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1",
        "-r",
        "30",
        "-shortest",
        "-movflags",
        "+faststart",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });

const concatVideos = async (
  chapterPaths: string[],
  outputPath: string,
  workDir: string,
): Promise<void> => {
  const listPath = path.join(workDir, "concat.txt");
  const content = chapterPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await fs.writeFile(listPath, content);

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .outputOptions(["-c", "copy", "-movflags", "+faststart"])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
};

const downloadToBuffer = async (url: string): Promise<Buffer> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${url} failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

// ─────────────────────────────────────────────────────────────────────
// Main pipeline

export const generateVideo = async (
  notebookId: string,
  outputId: string,
  language: "en" | "es" = "en",
): Promise<void> => {
  const workDir = path.join(os.tmpdir(), `fm-video-${outputId}`);

  try {
    const LANG_NAME = language === "es" ? "Spanish" : "English";
    const langInstr = `IMPORTANT: Generate ALL titles, narration, and labels in ${LANG_NAME}. Do not mix languages. The imagePrompt itself may be in ${LANG_NAME} prose but MUST NOT contain any text/words INSIDE the image.`;
    await updateProgress(outputId, { status: "generating" });
    await fs.mkdir(workDir, { recursive: true });

    // ── Step 1: Pull sources & generate the script ─────────────────
    const notebookSources = await db
      .select({ title: sources.title, rawText: sources.rawText })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));

    const sourceContext = notebookSources
      .filter((s) => s.rawText)
      .map((s) => `[${s.title}]\n${s.rawText!.slice(0, 5000)}`)
      .join("\n\n---\n\n");

    const { object: script } = await generateObject({
      model: getModel("gemini-2.5-flash"),
      schema: scriptSchema,
      prompt: `${langInstr}

You are an expert educator writing a short narrated explainer video. Your #1 job is to TEACH — every chapter must deliver specific, factual, actionable information from the sources, not vague filler.

═══════════════════════════════════════
CONTENT EXTRACTION (do this FIRST)
═══════════════════════════════════════

Before writing chapters, analyze the sources and extract:
- Every specific fact, number, date, statistic, or measurable claim
- Every named tool, technology, framework, method, or concept
- Every process, step, or technique
- Every comparison, trade-off, or cause-effect relationship
- Key definitions and expert insights

Organize these into 5-7 teachable chapters.

═══════════════════════════════════════
CHAPTER STRUCTURE
═══════════════════════════════════════

Return an object with:
- title: 4-8 words naming the overall topic (in ${LANG_NAME})
- chapters: an ordered array of 5-7 entries. Each chapter has { title, narration, imagePrompt }.

Per-chapter rules:

● title (3-7 words): names the specific sub-topic the chapter teaches. NOT generic ("The Basics", "Overview"). Specific ("HTML5 Semantic Structure", "Deployment with Vercel").

● narration (60-90 words, natural spoken ${LANG_NAME}):
  - Teach a SPECIFIC, factual insight drawn from the sources.
  - Include at least one named entity, concrete example, number, or tool reference.
  - Speak directly to the viewer ("you", "we") — this is read aloud by TTS.
  - Sound natural — no bullet-point formatting, no headings. Flowing spoken prose.
  - GOOD: "When a browser loads your HTML, it walks the markup tag by tag and builds a tree called the Document Object Model, or DOM. JavaScript talks to this tree through functions like querySelector to pick a node, or addEventListener to react to a click. Understanding the DOM is what separates a static page from a truly interactive one."
  - BAD: "HTML is important. The DOM is something you should learn about. It helps with things."

● imagePrompt (60-120 words): purely visual description for the chapter's still background image. NO text, NO letters, NO numbers, NO labels, NO words, NO typography inside the image. Style: pen-and-ink technical illustration on cream-colored graph paper, vintage engineering sketchbook (Leonardo's Codex, old physics textbooks). Describe small illustrated vignettes positioned in specific zones (top-left, center, bottom-right), leaving whitespace between them. Confident thin ink lines, slightly off-register hand-drawn feel, occasional muted orange or sepia watercolor wash on focal elements. The illustration should visually relate to the chapter's content.

Example imagePrompt (chapter about the DOM): "Vintage engineering sketchbook page on cream graph paper. In the upper-left vignette, a pen-and-ink browser window frame with a miniature page layout inside — header bar, sidebar, content area. In the center, a branching tree diagram drawn with thin confident lines — a root node with children and grandchildren, each represented by small stylized boxes. In the lower-right, a magnifying glass hovering over one of the tree's leaf nodes, a soft sepia watercolor wash on its lens. Slightly off-register hand-drawn lines. Plenty of open whitespace between vignettes."

═══════════════════════════════════════
GLOBAL RULES
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
    }));

    // Save partial progress (script ready, images/audio coming)
    await updateProgress(outputId, {
      content: {
        script,
        chapters,
        progress: 20,
        phase: "script_ready",
      },
    });

    // ── Step 2: Generate chapter images via fal.ai ─────────────────
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
                `video/${outputId}/${createId()}.png`,
                "image/png",
              );
            } catch {
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
          },
        });
      }
    }

    // If there's no ElevenLabs key, stop here — save as script-only output
    // with chapter images. The viewer renders the script-only mode.
    const hasEleven = !!process.env.ELEVENLABS_API_KEY;
    if (!hasEleven) {
      await db
        .update(outputs)
        .set({
          status: "ready",
          content: {
            script,
            chapters,
            mode: "script_only",
            note: "Full video composition requires ELEVENLABS_API_KEY (and fal.ai keys for images).",
          },
          updatedAt: new Date(),
        })
        .where(eq(outputs.id, outputId));
      return;
    }

    // ── Step 3: Synthesize TTS per chapter ─────────────────────────
    const audioPaths: string[] = [];
    const imagePaths: string[] = [];
    for (let i = 0; i < chapters.length; i++) {
      const audio = await synthesizeNarration(chapters[i].narration);
      const audioPath = path.join(workDir, `chapter-${i}.mp3`);
      await fs.writeFile(audioPath, audio);
      audioPaths.push(audioPath);

      // Resolve a usable image: prefer the persisted R2/local URL; if that's
      // not reachable (e.g. local path not yet served) fall back to a
      // pre-generated cream-colored 1280×720 placeholder PNG.
      let imgBuf: Buffer | null = null;
      const url = chapters[i].imageUrl;
      if (url) {
        try {
          if (url.startsWith("http")) {
            imgBuf = await downloadToBuffer(url);
          } else if (url.startsWith("/uploads/")) {
            const localFs = path.join(process.cwd(), "public", url);
            imgBuf = await fs.readFile(localFs);
          }
        } catch {
          imgBuf = null;
        }
      }
      if (!imgBuf) {
        imgBuf = await makeCreamFrame();
      }
      const imagePath = path.join(workDir, `chapter-${i}.png`);
      await fs.writeFile(imagePath, imgBuf);
      imagePaths.push(imagePath);

      await updateProgress(outputId, {
        content: {
          script,
          chapters,
          progress: 50 + Math.round(((i + 1) / chapters.length) * 25),
          phase: "tts",
        },
      });

      // Soft rate limit
      await new Promise((r) => setTimeout(r, 150));
    }

    // ── Step 4: Build per-chapter MP4s then concatenate ───────────
    const chapterVideoPaths: string[] = [];
    for (let i = 0; i < chapters.length; i++) {
      const out = path.join(workDir, `chapter-${i}.mp4`);
      await buildChapterVideo(imagePaths[i], audioPaths[i], out);
      const dur = await probeDurationMs(out).catch(() => 0);
      chapters[i].durationMs = dur;
      chapterVideoPaths.push(out);

      await updateProgress(outputId, {
        content: {
          script,
          chapters,
          progress: 75 + Math.round(((i + 1) / chapters.length) * 15),
          phase: "compose",
        },
      });
    }

    // Cumulative start timestamps
    let t = 0;
    for (const ch of chapters) {
      ch.startMs = t;
      t += ch.durationMs ?? 0;
    }
    const totalDurationSec = Math.round(t / 1000);

    const finalPath = path.join(workDir, "final.mp4");
    await concatVideos(chapterVideoPaths, finalPath, workDir);

    // ── Step 5: Upload to R2/local + finalize ─────────────────────
    const finalBuf = await fs.readFile(finalPath);
    const fileUrl = await uploadFile(
      finalBuf,
      `video/${outputId}/final.mp4`,
      "video/mp4",
    );

    await db
      .update(outputs)
      .set({
        status: "ready",
        fileUrl,
        duration: totalDurationSec,
        content: {
          script,
          chapters,
          totalDurationSec,
          mode: "full_video",
        },
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
  } finally {
    // Clean up the temp working dir — best-effort.
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
};

// 1280×720 cream-colored PNG used as a placeholder when a chapter's image
// failed to generate or couldn't be fetched. Same cream tone used by the
// compose-slide fallback background so it reads consistently.
const makeCreamFrame = (): Promise<Buffer> =>
  sharp({
    create: {
      width: 1280,
      height: 720,
      channels: 3,
      background: { r: 249, g: 241, b: 225 },
    },
  })
    .png()
    .toBuffer();
