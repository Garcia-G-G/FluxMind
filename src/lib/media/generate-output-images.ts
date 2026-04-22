import {
  generateInfographicImage,
  type ImageSize,
  type FluxModel,
} from "@/lib/media/generate-image";
import type { VisualStyle } from "@/lib/media/styles";

export type OutputImage = {
  url: string;
  alt: string;
  persisted: boolean;
};

type Opts = {
  /** Topic descriptions for each image prompt — order preserved. */
  topics: string[];
  /** Output type — R2 key prefix (e.g. "flashcards", "course"). */
  outputType: string;
  /** Output ID — R2 key discriminator. */
  outputId: string;
  /** Notebook ID — R2 key prefix. */
  notebookId: string;
  /** Optional visual style override — falls through to `"auto"`. */
  style?: VisualStyle;
  /** Image size — smaller than infographic since these are supplementary. */
  size?: ImageSize;
  /** Model — defaults to flux/schnell for speed. */
  model?: FluxModel;
};

/**
 * Generate N supporting illustrations for a studio output in parallel.
 *
 * Each image is a topic-scoped visual (no text, no labels — those rules live
 * inside `getStylePrefix`). All failures are swallowed individually via
 * `Promise.allSettled` so one flaky call can't void the whole output; if
 * `FAL_KEY` is missing we fail open and return `[]` so the route still
 * ships the text content.
 *
 * Return array is 1:1 positional with `topics` — callers rely on index to
 * map images back onto cards / lessons / sections.
 */
export const generateOutputImages = async (
  opts: Opts,
): Promise<(OutputImage | null)[]> => {
  if (!process.env.FAL_KEY) {
    // Fail open — text-only output is still useful.
    return opts.topics.map(() => null);
  }

  const size = opts.size ?? { width: 768, height: 768 };
  const model = opts.model ?? "fal-ai/flux/schnell";
  const style = opts.style ?? "auto";

  const settled = await Promise.allSettled(
    opts.topics.map(async (topic, i): Promise<OutputImage | null> => {
      try {
        const image = await generateInfographicImage(
          `Illustration for educational content about: ${topic}. Scene with visual metaphors and objects related to the topic. Rich, colorful, engaging, no people unless the topic is about people.`,
          {
            size,
            model,
            style,
            persistTo: {
              key: `studio/${opts.notebookId}/${opts.outputType}/${opts.outputId}/img-${i}.png`,
            },
          },
        );
        return { url: image.url, alt: topic, persisted: image.persisted };
      } catch (err) {
        console.warn(
          `[generateOutputImages] image ${i} (${opts.outputType}) failed:`,
          err,
        );
        return null;
      }
    }),
  );

  return settled.map((r) =>
    r.status === "fulfilled" ? r.value : null,
  );
};
