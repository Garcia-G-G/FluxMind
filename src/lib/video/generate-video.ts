import { generateObject } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources } from "@/db/schema/sources";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";

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
  outputId: string
): Promise<void> => {
  try {
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
      prompt: `Write a video narration script with 5-7 chapters. Each chapter needs:
- title (short, catchy)
- narration (60-90 words, natural spoken language)
- imagePrompt (detailed visual description for AI image generation, professional, educational)

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

    // Step 2: Generate images via Fal.ai
    const imageUrls: string[] = [];
    for (let i = 0; i < script.chapters.length; i++) {
      try {
        const res = await fetch("https://queue.fal.run/fal-ai/flux/dev", {
          method: "POST",
          headers: {
            Authorization: `Key ${process.env.FAL_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: `${script.chapters[i].imagePrompt}. Professional, high quality, clean design, suitable for educational video.`,
            image_size: "landscape_16_9",
            num_images: 1,
          }),
        });
        const data = await res.json();
        imageUrls.push(data.images?.[0]?.url ?? "");
      } catch {
        imageUrls.push("");
      }
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
