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

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

const scriptSchema = z.object({
  title: z.string(),
  chapters: z.array(
    z.object({
      title: z.string(),
      narration: z.string(),
      imagePrompt: z.string(),
    })
  ),
});

export type VideoChapter = z.infer<typeof scriptSchema>["chapters"][number];

const updateProgress = async (
  outputId: string,
  extra: Record<string, unknown> = {}
): Promise<void> => {
  await db
    .update(outputs)
    .set({ ...extra, updatedAt: new Date() })
    .where(eq(outputs.id, outputId));
};

export const generateVideo = async (
  notebookId: string,
  outputId: string,
  language: "en" | "es" = "en"
): Promise<void> => {
  try {
    const LANG_NAME = language === "es" ? "Spanish" : "English";
    const langInstr = `IMPORTANT: Generate ALL content in ${LANG_NAME}. Titles, narration, labels, everything must be in ${LANG_NAME}. Do not mix languages.`;
    await updateProgress(outputId, { status: "generating" });

    // Step 1: Fetch sources and generate script
    const notebookSources = await db
      .select({ title: sources.title, rawText: sources.rawText })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));

    const sourceContext = notebookSources
      .filter((s) => s.rawText)
      .map((s) => `[${s.title}]\n${s.rawText!.slice(0, 3000)}`)
      .join("\n\n---\n\n");

    const { object: script } = await generateObject({
      model: getModel("gemini-2.5-flash"),
      schema: scriptSchema,
      prompt: `${langInstr}

Write a video narration script with 5-7 chapters. Each chapter needs:
- title (short, catchy)
- narration (60-90 words, natural spoken language)
- imagePrompt (detailed visual description for AI image generation, professional, educational — any text rendered IN the image should also be in ${LANG_NAME})

Sources:\n${sourceContext}`,
    });

    await updateProgress(outputId, {
      content: { script, status: "script_complete" },
    });

    // Steps 2-5 require Fal.ai, ElevenLabs, and FFmpeg
    // For now, save the script as the output and mark ready
    // Full pipeline runs when APIs are configured
    const hasApis = !!(process.env.FAL_KEY && process.env.ELEVENLABS_API_KEY);

    if (!hasApis) {
      // Save script-only output
      await db
        .update(outputs)
        .set({
          status: "ready",
          content: {
            script,
            chapters: script.chapters,
            mode: "script_only",
            note: "Video composition requires FAL_KEY and ELEVENLABS_API_KEY",
          },
          updatedAt: new Date(),
        })
        .where(eq(outputs.id, outputId));
      return;
    }

    // Step 2: Generate images via Fal.ai. `fal.subscribe` handles the
    // queue-poll cycle internally (the raw queue.fal.run POST returns a
    // request id, not the image — using fetch directly against it was
    // why every chapter imageUrl came back as an empty string).
    const imageUrls: string[] = [];
    for (let i = 0; i < script.chapters.length; i++) {
      let chapterImageUrl = "";
      try {
        const result = (await fal.subscribe("fal-ai/flux/schnell", {
          input: {
            prompt: `${script.chapters[i].imagePrompt}. Professional, high quality, clean design, suitable for educational video.`,
            image_size: "landscape_16_9",
            num_images: 1,
            num_inference_steps: 4,
            enable_safety_checker: false,
          },
          logs: false,
        })) as { data?: { images?: Array<{ url: string }> } };
        const falUrl = result.data?.images?.[0]?.url;
        if (falUrl) {
          // Persist to R2 / local uploads so the URL stays valid past
          // fal's ~24h TTL.
          try {
            const res = await fetch(falUrl);
            if (res.ok) {
              const buf = Buffer.from(await res.arrayBuffer());
              chapterImageUrl = await uploadFile(
                buf,
                `video/${outputId}/${createId()}.png`,
                "image/png",
              );
            } else {
              chapterImageUrl = falUrl;
            }
          } catch {
            chapterImageUrl = falUrl;
          }
        }
      } catch (err) {
        console.warn(`Chapter ${i} image gen failed:`, err);
      }
      imageUrls.push(chapterImageUrl);
      await updateProgress(outputId, {
        content: { script, progress: 15 + Math.round(((i + 1) / script.chapters.length) * 40) },
      });
    }

    // Steps 3-5: TTS + FFmpeg composition would go here
    // For now, save with image URLs
    await db
      .update(outputs)
      .set({
        status: "ready",
        content: {
          script,
          chapters: script.chapters.map((ch, i) => ({
            ...ch,
            imageUrl: imageUrls[i],
          })),
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
  }
};
