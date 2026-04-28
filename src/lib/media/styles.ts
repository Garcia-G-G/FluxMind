/**
 * Visual style registry for Studio generation.
 *
 * The registry is consumed by:
 *   - `generate-image.ts` (picks the illustration prefix for fal.ai)
 *   - `compose-infographic.ts` / `compose-slide.ts` (picks the overlay tint)
 *   - the studio dialog (renders the style tiles)
 *
 * Keep exports stable: downstream agents import `VisualStyle`,
 * `STYLE_CONFIGS` and `getStyleInstructions` by name.
 */

export type VisualStyle =
  | "auto"
  | "sketch"
  | "kawaii"
  | "professional"
  | "scientific"
  | "minimalist";

export type StyleConfig = {
  name: string;
  illustrationPrefix: string;
  overlayBg: { r: number; g: number; b: number; alpha: number };
  textColor: string;
  mutedColor: string;
};

const ABSOLUTE_RULE =
  "ABSOLUTE RULE: NO TEXT, NO LETTERS, NO NUMBERS, NO WORDS, NO LABELS, NO TYPOGRAPHY anywhere in the image. Visual elements only. Leave breathing room for text overlay. ";

export const STYLE_CONFIGS: Record<VisualStyle, StyleConfig> = {
  auto: {
    name: "Auto",
    // Vintage engineering sketchbook — preserves the default look today.
    illustrationPrefix:
      "Vintage engineering sketchbook illustration on cream-colored graph paper. Loose pen-and-ink style, confident thin black line work, small illustrated vignettes (icons, scenes, metaphoric objects, technical apparatus), occasional subtle watercolor wash in muted orange or sepia on key focal elements. Slightly off-register as if drawn by hand. Style reference: Leonardo da Vinci's Codex, old physics textbook diagrams, technical illustrated notebooks. ",
    overlayBg: { r: 253, g: 250, b: 243, alpha: 0.6 },
    textColor: "#1a1a2e",
    mutedColor: "#5a5a6a",
  },
  sketch: {
    name: "Sketch",
    illustrationPrefix:
      "Hand-drawn pen-and-ink sketch on white paper. Loose, expressive line work in black ink with cross-hatching and stippling. Small vignettes, doodles, and marginalia. Confident but imperfect strokes, the look of a designer's notebook or storyboard. No color, just black ink on cream paper with very subtle texture. ",
    overlayBg: { r: 255, g: 253, b: 248, alpha: 0.7 },
    textColor: "#1a1a2e",
    mutedColor: "#5a5a6a",
  },
  kawaii: {
    name: "Kawaii",
    illustrationPrefix:
      "Cute Japanese kawaii illustration style. Soft pastel colors (pink, mint, lavender, peach), rounded shapes, friendly characters with simple expressive faces, tiny sparkle and star accents, gentle gradients. Chibi proportions, soft outlines, wholesome and approachable mood. Like a Studio Ghibli sketchbook mixed with stationery design. ",
    overlayBg: { r: 255, g: 248, b: 252, alpha: 0.65 },
    textColor: "#3a2a3e",
    mutedColor: "#8a6a7e",
  },
  professional: {
    name: "Professional",
    illustrationPrefix:
      "Clean corporate flat-design illustration. Geometric shapes, confident solid fills in a restrained palette (deep navy, slate gray, muted teal, subtle accent orange). Minimal outlines, crisp vector look, isometric business vignettes. Think modern SaaS marketing site, Stripe, or Linear brand illustrations. Polished, authoritative, and legible. ",
    overlayBg: { r: 248, g: 250, b: 253, alpha: 0.7 },
    textColor: "#0f1e2e",
    mutedColor: "#4a5a6e",
  },
  scientific: {
    name: "Scientific",
    illustrationPrefix:
      "Precise scientific diagram illustration. Technical cross-sections, anatomical accuracy, biological plates, engineering schematics. Fine line weights, stippled shading, annotation arrows WITHOUT labels, careful proportion, scientific textbook aesthetic. Muted academic palette: bone white, ochre, deep blue-gray, rust, moss green. Think Ernst Haeckel, Gray's Anatomy, NASA technical drawings. ",
    overlayBg: { r: 250, g: 248, b: 240, alpha: 0.65 },
    textColor: "#1a1f2e",
    mutedColor: "#4a5060",
  },
  minimalist: {
    name: "Minimalist",
    illustrationPrefix:
      "Ultra-minimalist geometric illustration. Two or three colors maximum. Large negative space, simple primitive shapes (circle, square, triangle) in deliberate compositions. Bauhaus-inspired, Swiss poster design, flat and calm. Confident shapes with no texture, no shading, no gradients. Editorial magazine feel. ",
    overlayBg: { r: 252, g: 252, b: 252, alpha: 0.7 },
    textColor: "#111111",
    mutedColor: "#555555",
  },
};

/**
 * Returns the LLM prompt fragment describing the chosen style, with the
 * ABSOLUTE RULE about no text appended so the image model never writes words.
 */
export const getStyleInstructions = (style: VisualStyle): string => {
  const config = STYLE_CONFIGS[style];
  return `Illustration style: ${config.name}.\n\n${config.illustrationPrefix}\n\n${ABSOLUTE_RULE}`;
};

