import { fal } from "@fal-ai/client";
import { uploadFile } from "@/lib/storage/r2";
import { STYLE_CONFIGS, type VisualStyle } from "@/lib/media/styles";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

export type ImageSize = { width: number; height: number };

export type FluxModel =
  | "fal-ai/flux/dev"
  | "fal-ai/flux/schnell"
  | "fal-ai/flux-pro/v1.1"
  | "fal-ai/ideogram/v2"
  | "fal-ai/recraft-v3";

export type GeneratedImage = {
  url: string; // permanent R2 URL if upload succeeded, else fal.ai temp URL
  persisted: boolean; // true if on R2, false if temp fal URL (~24h TTL)
};

/**
 * Returns the fal.ai prompt prefix for the chosen visual style, combined with
 * the ABSOLUTE RULE that forbids text/letters/numbers in the output image.
 *
 * Default (`"auto"`) is the vintage engineering sketchbook look — identical
 * to the pre-style-registry behavior.
 */
export const getStylePrefix = (style: VisualStyle = "auto"): string => {
  const config = STYLE_CONFIGS[style];
  return (
    config.illustrationPrefix +
    "ABSOLUTE RULE: NO TEXT, NO LETTERS, NO NUMBERS, NO WORDS, NO LABELS, NO TYPOGRAPHY anywhere in the image. Visual elements only. Leave breathing room for text overlay. "
  );
};

type FalImageResult = {
  data?: {
    images?: Array<{ url: string; width?: number; height?: number }>;
    image?: { url: string };
  };
  requestId?: string;
};

export const generateInfographicImage = async (
  prompt: string,
  opts: {
    size?: ImageSize;
    model?: FluxModel;
    persistTo?: { key: string }; // R2 key for permanent upload
    /** Visual style — defaults to `"auto"` which preserves legacy look. */
    style?: VisualStyle;
  } = {},
): Promise<GeneratedImage> => {
  if (!process.env.FAL_KEY) {
    throw new Error("FAL_KEY not configured");
  }

  const model = opts.model ?? "fal-ai/flux-pro/v1.1";
  const size = opts.size ?? { width: 1280, height: 1600 };
  const fullPrompt = getStylePrefix(opts.style) + prompt;

  // Per-model input shape. Ideogram + Recraft use different knobs than Flux.
  const input: Record<string, unknown> = (() => {
    if (model === "fal-ai/ideogram/v2") {
      return {
        prompt: fullPrompt,
        aspect_ratio: size.height > size.width ? "4:5" : "16:9",
        style: "design",
        expand_prompt: false,
      };
    }
    if (model === "fal-ai/recraft-v3") {
      return {
        prompt: fullPrompt,
        image_size: size,
        style: "digital_illustration/hand_drawn",
      };
    }
    // flux/dev, flux/schnell, flux-pro/v1.1
    return {
      prompt: fullPrompt,
      image_size: size,
      num_images: 1,
      guidance_scale: 4.5,
      num_inference_steps: model === "fal-ai/flux/schnell" ? 4 : 28,
      enable_safety_checker: false,
    };
  })();

  const result = (await fal.subscribe(model, {
    input,
    logs: false,
  })) as FalImageResult;

  const falUrl =
    result.data?.images?.[0]?.url ?? result.data?.image?.url ?? null;
  if (!falUrl) throw new Error("fal.ai returned no image");

  if (!opts.persistTo) {
    return { url: falUrl, persisted: false };
  }

  // Try to persist to R2; fall back to fal URL on any failure
  try {
    const res = await fetch(falUrl);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const permanentUrl = await uploadFile(
      buf,
      opts.persistTo.key,
      "image/png",
    );
    return { url: permanentUrl, persisted: true };
  } catch (e) {
    console.warn("R2 persist failed, using fal URL:", e);
    return { url: falUrl, persisted: false };
  }
};
