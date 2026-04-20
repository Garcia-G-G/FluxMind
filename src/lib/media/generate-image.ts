import { fal } from "@fal-ai/client";
import { uploadFile } from "@/lib/storage/r2";

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

export type ImageSize = { width: number; height: number };

export type FluxModel =
  | "fal-ai/flux/dev"
  | "fal-ai/flux/schnell"
  | "fal-ai/flux-pro/v1.1";

export type GeneratedImage = {
  url: string; // permanent R2 URL if upload succeeded, else fal.ai temp URL
  persisted: boolean; // true if on R2, false if temp fal URL (~24h TTL)
};

const STYLE_PREFIX =
  "Clean educational infographic in hand-drawn ink illustration style on bright white background. Professional, high detail, thin black line weight, precise pen strokes. Selective accent colors used sparingly. Annotated diagrams with callout boxes, arrows, hand-lettered labels. Legible, crisp typography. ";

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
  } = {},
): Promise<GeneratedImage> => {
  if (!process.env.FAL_KEY) {
    throw new Error("FAL_KEY not configured");
  }

  const model = opts.model ?? "fal-ai/flux/dev";
  const size = opts.size ?? { width: 1280, height: 1600 };
  const fullPrompt = STYLE_PREFIX + prompt;

  const result = (await fal.subscribe(model, {
    input: {
      prompt: fullPrompt,
      image_size: size,
      num_images: 1,
      guidance_scale: 7.5,
      num_inference_steps: model === "fal-ai/flux/schnell" ? 4 : 28,
      enable_safety_checker: false,
    },
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
