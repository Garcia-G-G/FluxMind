/**
 * Per-slide hybrid composition engine.
 *
 * Pipeline (same as compose-infographic, specialized for 1920x1080 deck slides):
 *   1. Generate an AI *illustration* (no text) via `generateInfographicImage`.
 *   2. Build an SVG overlay that renders ALL text (titles, bullets, stats, quotes).
 *   3. Composite background + translucent white sheet + SVG with Sharp.
 *   4. Upload the final PNG via the R2 storage abstraction.
 *
 * Each slide is independent so routes can run `Promise.all` over a deck.
 */
import sharp from "sharp";
import { generateInfographicImage } from "@/lib/media/generate-image";
import { uploadFile } from "@/lib/storage/r2";
import { STYLE_CONFIGS, type VisualStyle } from "@/lib/media/styles";
import {
  arrowheadMarkerDef,
  embeddedFontFace,
  escapeXml,
  FONT_HANDWRITTEN,
  FONT_SERIF,
  FONT_TECHNICAL,
  gridPatternDef,
  wrapText,
} from "@/lib/media/svg-helpers";

// ---------- Public types ----------

export type SlideLayout =
  | "title"
  | "content"
  | "stat"
  | "comparison"
  | "quote"
  | "flow"
  | "closing";

export type SlideSpec = {
  id: string;
  layout: SlideLayout;
  title: string | null;
  subtitle: string | null;
  bullets: string[] | null;
  stat: { value: string; label: string } | null;
  comparisonItems: Array<{ label: string; value: string }> | null;
  quote: { text: string; attribution: string | null } | null;
  flowSteps: Array<{ label: string; detail: string }> | null;
  illustrationPrompt: string;
  narrationHint: string;
};

export type SlideComposeOptions = {
  notebookId: string;
  outputId: string;
  deckAccent: string; // hex accent, e.g. "#ff6b35"
  /** Visual style — drives the overlay sheet tint (readability "cream"). */
  style?: VisualStyle;
};

export type ComposedSlide = {
  imageUrl: string;
  persisted: boolean;
};

// ---------- Internal constants ----------

// Sketchbook ink-on-cream palette.
const COLOR_TEXT = "#1a1a1a";
const COLOR_MUTED = "#4a4a4a";
const COLOR_HAIRLINE = "#2a2a2a";

// ---------- SVG layout renderers ----------

const renderFooter = (W: number, H: number): string => {
  return `<text x="${W - 48}" y="${H - 32}" font-family="${FONT_TECHNICAL}" font-size="14" fill="${COLOR_MUTED}" text-anchor="end">FluxMind</text>`;
};

const renderTitleLayout = (
  slide: SlideSpec,
  W: number,
  H: number,
  accent: string,
): string => {
  const parts: string[] = [];
  const cx = W / 2;
  const cy = H / 2;

  const titleText = slide.title ?? "";
  const titleLines = wrapText(titleText, 30);
  const titleLineH = 110;
  const totalTitleH = titleLines.length * titleLineH;
  const startY = cy - totalTitleH / 2;

  titleLines.forEach((line, i) => {
    parts.push(
      `<text x="${cx}" y="${startY + (i + 1) * titleLineH - 28}" font-family="${FONT_SERIF}" font-size="96" font-weight="700" fill="${COLOR_TEXT}" text-anchor="middle" letter-spacing="-2">${escapeXml(line)}</text>`,
    );
  });

  // Accent line under the title block (slightly thinner — hairline feel)
  const accentLineY = startY + totalTitleH + 24;
  parts.push(
    `<rect x="${cx - 60}" y="${accentLineY}" width="120" height="3" rx="1.5" fill="${accent}" />`,
  );

  if (slide.subtitle) {
    const subLines = wrapText(slide.subtitle, 60).slice(0, 2);
    subLines.forEach((line, i) => {
      parts.push(
        `<text x="${cx}" y="${accentLineY + 60 + i * 42}" font-family="${FONT_HANDWRITTEN}" font-size="32" fill="${COLOR_MUTED}" text-anchor="middle">${escapeXml(line)}</text>`,
      );
    });
  }

  return parts.join("\n");
};

const renderContentLayout = (
  slide: SlideSpec,
  W: number,
  H: number,
  accent: string,
): string => {
  const parts: string[] = [];
  const leftX = 100;
  const topY = 120;

  // Title
  const titleLines = wrapText(slide.title ?? "", 32).slice(0, 2);
  titleLines.forEach((line, i) => {
    parts.push(
      `<text x="${leftX}" y="${topY + i * 58}" font-family="${FONT_SERIF}" font-size="48" font-weight="700" fill="${COLOR_TEXT}" letter-spacing="-1">${escapeXml(line)}</text>`,
    );
  });
  const titleBottom = topY + titleLines.length * 58;

  // Accent bar under the title
  parts.push(
    `<rect x="${leftX}" y="${titleBottom + 10}" width="40" height="2.5" rx="1.25" fill="${accent}" />`,
  );

  // Subtitle (optional)
  let cursorY = titleBottom + 10 + 3 + 36;
  if (slide.subtitle) {
    const subLines = wrapText(slide.subtitle, 55).slice(0, 1);
    subLines.forEach((line) => {
      parts.push(
        `<text x="${leftX}" y="${cursorY}" font-family="${FONT_HANDWRITTEN}" font-size="26" fill="${COLOR_MUTED}">${escapeXml(line)}</text>`,
      );
      cursorY += 36;
    });
    cursorY += 8;
  } else {
    cursorY += 8;
  }

  // Bullets on left half
  const bullets = slide.bullets ?? [];
  const bulletLineH = 34;
  const bulletGap = 18;
  const indentX = leftX + 28;

  bullets.slice(0, 5).forEach((bullet) => {
    const lines = wrapText(bullet, 50).slice(0, 2);
    // Bullet square — accent keeps the eye moving down the list
    parts.push(
      `<rect x="${leftX}" y="${cursorY - 16}" width="8" height="8" fill="${accent}" />`,
    );
    lines.forEach((line, li) => {
      parts.push(
        `<text x="${indentX}" y="${cursorY + li * bulletLineH - 4}" font-family="${FONT_HANDWRITTEN}" font-size="26" fill="${COLOR_TEXT}">${escapeXml(line)}</text>`,
      );
    });
    cursorY += lines.length * bulletLineH + bulletGap;
    if (cursorY > H - 120) return;
  });

  return parts.join("\n");
};

const renderStatLayout = (
  slide: SlideSpec,
  W: number,
  H: number,
  accent: string,
): string => {
  const parts: string[] = [];

  // Eyebrow title at top-left (technical face, spaced caps)
  if (slide.title) {
    const titleLines = wrapText(slide.title.toUpperCase(), 50).slice(0, 1);
    titleLines.forEach((line, i) => {
      parts.push(
        `<text x="100" y="${110 + i * 28}" font-family="${FONT_TECHNICAL}" font-size="18" font-weight="700" fill="${COLOR_MUTED}" letter-spacing="2">${escapeXml(line)}</text>`,
      );
    });
  }

  const cx = W / 2;
  const cy = H / 2;

  const statValue = slide.stat?.value ?? "";
  const statLabel = slide.stat?.label ?? "";

  // Big stat value centered — serif feels like a display number in a textbook
  parts.push(
    `<text x="${cx}" y="${cy + 30}" font-family="${FONT_SERIF}" font-size="220" font-weight="900" fill="${accent}" text-anchor="middle" letter-spacing="-6">${escapeXml(statValue)}</text>`,
  );

  // Label beneath (technical face)
  const labelLines = wrapText(statLabel, 35).slice(0, 2);
  labelLines.forEach((line, i) => {
    parts.push(
      `<text x="${cx}" y="${cy + 100 + i * 38}" font-family="${FONT_TECHNICAL}" font-size="30" fill="${COLOR_MUTED}" text-anchor="middle">${escapeXml(line)}</text>`,
    );
  });

  return parts.join("\n");
};

const renderComparisonLayout = (
  slide: SlideSpec,
  W: number,
  H: number,
  accent: string,
): string => {
  const parts: string[] = [];
  const leftX = 100;
  const topY = 120;

  // Title
  const titleLines = wrapText(slide.title ?? "", 40).slice(0, 2);
  titleLines.forEach((line, i) => {
    parts.push(
      `<text x="${leftX}" y="${topY + i * 58}" font-family="${FONT_SERIF}" font-size="48" font-weight="700" fill="${COLOR_TEXT}" letter-spacing="-1">${escapeXml(line)}</text>`,
    );
  });
  const titleBottom = topY + titleLines.length * 58;
  parts.push(
    `<rect x="${leftX}" y="${titleBottom + 10}" width="40" height="2.5" rx="1.25" fill="${accent}" />`,
  );

  const items = slide.comparisonItems ?? [];
  const n = Math.max(1, items.length);

  // Grid spanning 75% of the canvas width
  const totalW = W * 0.75;
  const startX = (W - totalW) / 2;
  const gap = 24;
  const colW = (totalW - gap * (n - 1)) / n;
  const boxH = 240;
  const boxY = H / 2 - boxH / 2 + 40;

  items.forEach((item, i) => {
    const bx = startX + i * (colW + gap);
    parts.push(
      `<rect x="${bx}" y="${boxY}" width="${colW}" height="${boxH}" rx="6" fill="white" fill-opacity="0.92" stroke="${COLOR_HAIRLINE}" stroke-width="0.75" />`,
    );

    // Value
    const valueLines = wrapText(item.value, 14).slice(0, 1);
    valueLines.forEach((line) => {
      parts.push(
        `<text x="${bx + colW / 2}" y="${boxY + boxH / 2 - 4}" font-family="${FONT_SERIF}" font-size="64" font-weight="700" fill="${accent}" text-anchor="middle" letter-spacing="-1">${escapeXml(line)}</text>`,
      );
    });

    // Label
    const labelLines = wrapText(item.label, 26).slice(0, 2);
    labelLines.forEach((line, li) => {
      parts.push(
        `<text x="${bx + colW / 2}" y="${boxY + boxH / 2 + 50 + li * 28}" font-family="${FONT_TECHNICAL}" font-size="22" fill="${COLOR_MUTED}" text-anchor="middle">${escapeXml(line)}</text>`,
      );
    });
  });

  return parts.join("\n");
};

const renderQuoteLayout = (
  slide: SlideSpec,
  W: number,
  H: number,
  accent: string,
): string => {
  const parts: string[] = [];
  const leftX = 140;

  // Giant left quotation mark at ~30% opacity
  parts.push(
    `<text x="${leftX}" y="${H * 0.34}" font-family="${FONT_SERIF}" font-size="260" font-weight="700" fill="${accent}" fill-opacity="0.3">&#8220;</text>`,
  );

  const quoteText = slide.quote?.text ?? "";
  const attribution = slide.quote?.attribution ?? null;

  // Quote lines, indented a bit so the mark reads as a margin ornament
  const quoteLines = wrapText(quoteText, 50).slice(0, 6);
  const lineH = 64;
  const quoteStartY = H / 2 - (quoteLines.length * lineH) / 2 + 20;
  const quoteX = leftX + 60;
  quoteLines.forEach((line, i) => {
    parts.push(
      `<text x="${quoteX}" y="${quoteStartY + i * lineH}" font-family="${FONT_SERIF}" font-size="42" font-style="italic" fill="${COLOR_TEXT}">${escapeXml(line)}</text>`,
    );
  });

  // Attribution — right-aligned below the quote
  if (attribution) {
    const attrY = quoteStartY + quoteLines.length * lineH + 40;
    parts.push(
      `<text x="${W - 140}" y="${attrY}" font-family="${FONT_HANDWRITTEN}" font-size="24" fill="${COLOR_MUTED}" text-anchor="end">${escapeXml(`— ${attribution}`)}</text>`,
    );
  }

  return parts.join("\n");
};

const renderFlowLayout = (
  slide: SlideSpec,
  W: number,
  H: number,
  accent: string,
): string => {
  const parts: string[] = [];
  const leftX = 100;
  const topY = 120;

  // Title
  const titleLines = wrapText(slide.title ?? "", 40).slice(0, 2);
  titleLines.forEach((line, i) => {
    parts.push(
      `<text x="${leftX}" y="${topY + i * 58}" font-family="${FONT_SERIF}" font-size="48" font-weight="700" fill="${COLOR_TEXT}" letter-spacing="-1">${escapeXml(line)}</text>`,
    );
  });
  const titleBottom = topY + titleLines.length * 58;
  parts.push(
    `<rect x="${leftX}" y="${titleBottom + 10}" width="40" height="2.5" rx="1.25" fill="${accent}" />`,
  );

  const steps = slide.flowSteps ?? [];
  const n = Math.max(1, steps.length);
  const r = 28;
  const startX = 180;
  const endX = W - 180;
  const span = endX - startX;
  const cy = H / 2 + 20;

  steps.forEach((step, i) => {
    const stepX = startX + (n === 1 ? span / 2 : (i / (n - 1)) * span);

    // Circle
    parts.push(
      `<circle cx="${stepX}" cy="${cy}" r="${r}" fill="${accent}" />`,
    );
    // Step number (serif numeral, textbook feel)
    parts.push(
      `<text x="${stepX}" y="${cy + 10}" font-family="${FONT_SERIF}" font-size="28" font-weight="700" fill="white" text-anchor="middle">${i + 1}</text>`,
    );

    // Label below circle
    const labelLines = wrapText(step.label, 22).slice(0, 2);
    labelLines.forEach((line, li) => {
      parts.push(
        `<text x="${stepX}" y="${cy + r + 36 + li * 28}" font-family="${FONT_HANDWRITTEN}" font-size="22" font-weight="700" fill="${COLOR_TEXT}" text-anchor="middle">${escapeXml(line)}</text>`,
      );
    });
    const labelBottom = cy + r + 36 + labelLines.length * 28;

    // Detail below label
    const detailLines = wrapText(step.detail, 28).slice(0, 3);
    detailLines.forEach((line, li) => {
      parts.push(
        `<text x="${stepX}" y="${labelBottom + 8 + li * 22}" font-family="${FONT_TECHNICAL}" font-size="16" fill="${COLOR_MUTED}" text-anchor="middle">${escapeXml(line)}</text>`,
      );
    });

    // Arrow to next — thinner hairline
    if (i < n - 1) {
      const nextX = startX + ((i + 1) / (n - 1)) * span;
      const ax1 = stepX + r + 8;
      const ax2 = nextX - r - 8;
      parts.push(
        `<line x1="${ax1}" y1="${cy}" x2="${ax2}" y2="${cy}" stroke="${COLOR_HAIRLINE}" stroke-width="1.25" marker-end="url(#fm-slide-arrowhead)" />`,
      );
    }
  });

  return parts.join("\n");
};

const renderClosingLayout = (
  slide: SlideSpec,
  W: number,
  H: number,
  accent: string,
): string => {
  const parts: string[] = [];
  const cx = W / 2;
  const cy = H / 2;

  // Eyebrow — default "SUMMARY". Route may pass a localized title like "RESUMEN"
  // if needed in the future.
  const eyebrow = slide.subtitle?.toUpperCase() ?? "SUMMARY";
  parts.push(
    `<text x="${cx}" y="${cy - 180}" font-family="${FONT_TECHNICAL}" font-size="18" font-weight="700" fill="${accent}" text-anchor="middle" letter-spacing="4">${escapeXml(eyebrow)}</text>`,
  );

  // Accent rule
  parts.push(
    `<rect x="${cx - 40}" y="${cy - 160}" width="80" height="2.5" rx="1.25" fill="${accent}" />`,
  );

  // Takeaway (use title as the single sentence)
  const takeawayText = slide.title ?? "";
  const maxWidthChars = 36; // narrower max-width — roughly center 60% of canvas
  const lines = wrapText(takeawayText, maxWidthChars).slice(0, 4);
  const lineH = 72;
  const startY = cy - ((lines.length - 1) * lineH) / 2 + 10;
  lines.forEach((line, i) => {
    parts.push(
      `<text x="${cx}" y="${startY + i * lineH}" font-family="${FONT_SERIF}" font-size="56" font-weight="700" fill="${COLOR_TEXT}" text-anchor="middle" letter-spacing="-1">${escapeXml(line)}</text>`,
    );
  });

  return parts.join("\n");
};

// ---------- Full SVG overlay ----------

const buildSlideSvg = (
  slide: SlideSpec,
  W: number,
  H: number,
  accent: string,
): string => {
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
  );
  parts.push(
    `<defs>${embeddedFontFace()}${gridPatternDef("fm-slide-grid")}${arrowheadMarkerDef(accent, "fm-slide-arrowhead")}</defs>`,
  );

  // Graph-paper grid baked into overlay for the paper feel.
  parts.push(`<rect width="${W}" height="${H}" fill="url(#fm-slide-grid)" />`);

  switch (slide.layout) {
    case "title":
      parts.push(renderTitleLayout(slide, W, H, accent));
      break;
    case "content":
      parts.push(renderContentLayout(slide, W, H, accent));
      break;
    case "stat":
      parts.push(renderStatLayout(slide, W, H, accent));
      break;
    case "comparison":
      parts.push(renderComparisonLayout(slide, W, H, accent));
      break;
    case "quote":
      parts.push(renderQuoteLayout(slide, W, H, accent));
      break;
    case "flow":
      parts.push(renderFlowLayout(slide, W, H, accent));
      break;
    case "closing":
      parts.push(renderClosingLayout(slide, W, H, accent));
      break;
    default:
      // Fallback: just render title
      parts.push(renderTitleLayout(slide, W, H, accent));
      break;
  }

  parts.push(renderFooter(W, H));
  parts.push(`</svg>`);
  return parts.join("\n");
};

// ---------- Public entry point ----------

export const composeSlide = async (
  slide: SlideSpec,
  options: SlideComposeOptions,
): Promise<ComposedSlide> => {
  const W = 1920;
  const H = 1080;
  const { notebookId, outputId, deckAccent } = options;

  // 1. AI illustration background (best effort — cream paper fallback)
  let bgBuffer: Buffer;
  try {
    const bg = await generateInfographicImage(slide.illustrationPrompt, {
      size: { width: W, height: H },
      model: "fal-ai/flux-pro/v1.1",
    });
    const res = await fetch(bg.url);
    if (!res.ok) throw new Error(`background download failed: ${res.status}`);
    bgBuffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.warn(
      `Slide ${slide.id} illustration generation failed, using cream fallback:`,
      err,
    );
    bgBuffer = await sharp({
      create: {
        width: W,
        height: H,
        channels: 4,
        background: { r: 253, g: 252, b: 247, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
  }

  // 2. SVG overlay
  const svg = buildSlideSvg(slide, W, H, deckAccent);
  const svgBuffer = Buffer.from(svg);

  // 3. Readability sheet for legibility — tint driven by visual style.
  // Title / closing are hero slides → more illustration shows through
  // (alpha scaled 0.75x for those layouts). Auto style preserves the
  // byte-exact RGBA of the prior hardcoded sheet (0.6 base → 0.45 hero).
  const overlayTint = STYLE_CONFIGS[options.style ?? "auto"].overlayBg;
  const heroLayout = slide.layout === "title" || slide.layout === "closing";
  const sheetAlpha = heroLayout ? overlayTint.alpha * 0.75 : overlayTint.alpha;
  const creamSheet = await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: {
        r: overlayTint.r,
        g: overlayTint.g,
        b: overlayTint.b,
        alpha: sheetAlpha,
      },
    },
  })
    .png()
    .toBuffer();

  // 4. Composite bg → cream sheet → SVG
  const finalBuffer = await sharp(bgBuffer)
    .resize(W, H, { fit: "cover" })
    .composite([
      { input: creamSheet, top: 0, left: 0 },
      { input: svgBuffer, top: 0, left: 0 },
    ])
    .png({ quality: 90 })
    .toBuffer();

  // 5. Upload
  const key = `slides/${notebookId}/${outputId}/${slide.id}.png`;
  const imageUrl = await uploadFile(finalBuffer, key, "image/png");

  // `uploadFile` returns a local /uploads path in dev (no R2). We mark
  // `persisted` true whenever an R2 bucket was configured. We detect this
  // by whether the URL is absolute (starts with http) — matches the r2
  // helper's behavior.
  const persisted = imageUrl.startsWith("http");

  return { imageUrl, persisted };
};
