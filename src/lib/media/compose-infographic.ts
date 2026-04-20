/**
 * Hybrid infographic composer.
 *
 * Pipeline:
 *   1. Generate an AI *illustration* (no text) via `generateInfographicImage`.
 *   2. Build an SVG overlay that renders ALL text, charts, callouts, etc.
 *   3. Composite the two with Sharp, producing a crisp text + rich visual PNG.
 *   4. Upload the final PNG (and a thumbnail) via the R2 storage abstraction.
 *
 * The philosophy matches NotebookLM: FLUX can't render legible text, so we
 * ask it for visuals only and layer code-rendered typography on top.
 */
import sharp from "sharp";
import { generateInfographicImage } from "@/lib/media/generate-image";
import { uploadFile } from "@/lib/storage/r2";
import {
  arrowheadMarkerDef,
  embeddedFontFace,
  escapeXml,
  FONT_HANDWRITTEN,
  FONT_SERIF,
  FONT_TECHNICAL,
  getLeaderEnd,
  getPosition,
  gridPatternDef,
  wrapText,
} from "@/lib/media/svg-helpers";

// ---------- Layout schema types (mirrors Zod schema in the route) ----------

export type AccentColor =
  | "#ff6b35"
  | "#e11d48"
  | "#7c3aed"
  | "#2563eb"
  | "#059669"
  | "#d97706";

type StatPos =
  | "top-left"
  | "top-center"
  | "top-right"
  | "mid-left"
  | "mid-center"
  | "mid-right";

type CalloutPos =
  | "top-left"
  | "top-right"
  | "mid-left"
  | "mid-right"
  | "bottom-left"
  | "bottom-right";

export type LayoutBlock =
  | { type: "stat"; value: string; label: string; position: StatPos }
  | {
      type: "callout";
      title: string;
      body: string;
      position: CalloutPos;
      leaderTo: "left" | "right" | "up" | "down";
    }
  | {
      type: "comparison";
      items: Array<{ label: string; value: string }>;
    }
  | {
      type: "chart";
      chartType: "line" | "bar" | "area";
      xLabel: string;
      yLabel: string;
      dataPoints: Array<{ x: string; y: number; annotation: string | null }>;
    }
  | { type: "flow"; steps: Array<{ label: string; detail: string }> }
  | { type: "takeaway"; text: string }
  | { type: "text"; text: string }
  | { type: "timeline"; events: Array<{ date: string; label: string }> };

export type InfographicLayout = {
  title: string;
  subtitle: string;
  language: "en" | "es";
  accentColor: AccentColor;
  illustrationPrompt: string;
  header: { text: string; subtext: string | null };
  blocks: LayoutBlock[];
  footer: string;
  sections: Array<{ heading: string; summary: string }>;
  keyStats: Array<{ value: string; label: string }>;
};

export type ComposeOptions = {
  width?: number;
  height?: number;
  notebookId: string;
  outputId: string;
};

export type ComposedInfographic = {
  imageUrl: string;
  thumbnailUrl: string | null;
};

// Color palette — sketchbook/ink on cream. Near-black for primary text,
// warm grey for muted, accent reserved for high-signal elements (stat
// values, chart dots, leader dots, takeaway eyebrow).
const COLOR_TEXT = "#1a1a1a";
const COLOR_MUTED = "#4a4a4a";
const COLOR_HAIRLINE = "#2a2a2a";

// Append 2-digit hex alpha to a 6-digit hex color.
const withAlpha = (hex: string, alphaHex: string): string => {
  const clean = hex.startsWith("#") ? hex : `#${hex}`;
  return `${clean}${alphaHex}`;
};

// ---------- Internal: chart renderer ----------

const renderChart = (
  block: Extract<LayoutBlock, { type: "chart" }>,
  cx: number,
  cy: number,
  w: number,
  h: number,
  accent: string,
  text: string,
  muted: string,
): string => {
  const padding = 50;
  const plotW = w - padding * 2;
  const plotH = h - padding * 2;
  const n = block.dataPoints.length;

  // y is normalized 0..100 — but we guard anyway in case the model returns 0..1
  const maxY = Math.max(...block.dataPoints.map((d) => d.y), 1);
  const scale = maxY <= 1 ? 100 : maxY <= 100 ? 100 : maxY;

  const points = block.dataPoints.map((d, i) => {
    const px = cx + padding + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const py = cy + h - padding - (d.y / scale) * plotH;
    return { px, py, x: d.x, y: d.y, annotation: d.annotation };
  });

  const baselineY = cy + h - padding;
  const parts: string[] = [];

  // Axes — thin hairlines, sketchbook feel
  parts.push(
    `<line x1="${cx + padding}" y1="${cy + padding}" x2="${cx + padding}" y2="${baselineY}" stroke="${text}" stroke-width="0.9" />`,
  );
  parts.push(
    `<line x1="${cx + padding}" y1="${baselineY}" x2="${cx + w - padding}" y2="${baselineY}" stroke="${text}" stroke-width="0.9" />`,
  );

  // Axis labels (technical-pen face)
  parts.push(
    `<text x="${cx + w / 2}" y="${cy + h - 8}" font-family="${FONT_TECHNICAL}" font-size="12" fill="${muted}" text-anchor="middle">${escapeXml(block.xLabel)}</text>`,
  );
  parts.push(
    `<text x="${cx + 14}" y="${cy + h / 2}" font-family="${FONT_TECHNICAL}" font-size="12" fill="${muted}" text-anchor="middle" transform="rotate(-90 ${cx + 14} ${cy + h / 2})">${escapeXml(block.yLabel)}</text>`,
  );

  // Path
  if (points.length >= 2) {
    const pathD = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.px.toFixed(1)},${p.py.toFixed(1)}`)
      .join(" ");

    if (block.chartType === "area") {
      const closed =
        pathD +
        ` L${points[points.length - 1].px.toFixed(1)},${baselineY.toFixed(1)}` +
        ` L${points[0].px.toFixed(1)},${baselineY.toFixed(1)} Z`;
      parts.push(
        `<path d="${closed}" fill="${withAlpha(accent, "22")}" stroke="none" />`,
      );
      parts.push(
        `<path d="${pathD}" fill="none" stroke="${accent}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" />`,
      );
    } else if (block.chartType === "bar") {
      const barW = Math.max(8, plotW / (n * 2));
      for (const p of points) {
        parts.push(
          `<rect x="${(p.px - barW / 2).toFixed(1)}" y="${p.py.toFixed(1)}" width="${barW.toFixed(1)}" height="${(baselineY - p.py).toFixed(1)}" fill="${accent}" rx="2" />`,
        );
      }
    } else {
      parts.push(
        `<path d="${pathD}" fill="none" stroke="${accent}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" />`,
      );
    }
  }

  // Points + x-labels + annotations
  for (const p of points) {
    if (block.chartType !== "bar") {
      // Slightly smaller dot radius (4 → 3.5) for the thinner line weight.
      parts.push(
        `<circle cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="3.5" fill="${accent}" stroke="white" stroke-width="1.5" />`,
      );
    }
    parts.push(
      `<text x="${p.px.toFixed(1)}" y="${(baselineY + 16).toFixed(1)}" font-family="${FONT_TECHNICAL}" font-size="11" fill="${muted}" text-anchor="middle">${escapeXml(p.x)}</text>`,
    );
    if (p.annotation) {
      const annoLines = wrapText(p.annotation, 22);
      const boxH = 18 + annoLines.length * 13;
      const boxW = Math.min(
        170,
        Math.max(60, Math.max(...annoLines.map((l) => l.length)) * 7 + 14),
      );
      const boxX = p.px - boxW / 2;
      const boxY = p.py - boxH - 10;
      parts.push(
        `<rect x="${boxX.toFixed(1)}" y="${boxY.toFixed(1)}" width="${boxW}" height="${boxH}" rx="4" fill="white" fill-opacity="0.9" stroke="${COLOR_HAIRLINE}" stroke-width="0.75" />`,
      );
      annoLines.forEach((line, li) => {
        parts.push(
          `<text x="${p.px.toFixed(1)}" y="${(boxY + 14 + li * 13).toFixed(1)}" font-family="${FONT_HANDWRITTEN}" font-size="12" fill="${text}" text-anchor="middle">${escapeXml(line)}</text>`,
        );
      });
    }
  }

  return parts.join("\n");
};

// ---------- Internal: full SVG overlay ----------

const buildSvgOverlay = (
  layout: InfographicLayout,
  W: number,
  H: number,
): string => {
  const accent = layout.accentColor;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
  );
  parts.push(
    `<defs>${embeddedFontFace()}${gridPatternDef("fm-grid")}${arrowheadMarkerDef(accent, "fm-arrowhead")}</defs>`,
  );

  // Graph-paper grid baked into the overlay — very faint, keeps the paper
  // feel even when the AI background doesn't carry grid lines.
  parts.push(`<rect width="${W}" height="${H}" fill="url(#fm-grid)" />`);

  // ---- Title block ----
  let y = 60;
  const titleY = y + 50;
  parts.push(
    `<text x="${W / 2}" y="${titleY}" font-family="${FONT_SERIF}" font-size="42" font-weight="700" fill="${COLOR_TEXT}" text-anchor="middle" letter-spacing="-1">${escapeXml(layout.title)}</text>`,
  );
  if (layout.subtitle) {
    parts.push(
      `<text x="${W / 2}" y="${titleY + 28}" font-family="${FONT_HANDWRITTEN}" font-size="20" fill="${COLOR_MUTED}" text-anchor="middle">${escapeXml(layout.subtitle)}</text>`,
    );
  }
  parts.push(
    `<rect x="${W / 2 - 30}" y="${titleY + 44}" width="60" height="2.5" fill="${accent}" rx="1.25" />`,
  );
  y += 130;

  // ---- Blocks ----
  for (const block of layout.blocks) {
    switch (block.type) {
      case "stat": {
        const { x, y: py } = getPosition(block.position, W, H);
        const bw = 120;
        const bh = 70;
        const bx = x - bw / 2;
        const by = py - bh / 2;
        parts.push(
          `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6" fill="white" fill-opacity="0.95" stroke="${COLOR_HAIRLINE}" stroke-width="0.75" />`,
        );
        parts.push(
          `<text x="${x}" y="${by + 36}" font-family="${FONT_SERIF}" font-size="32" font-weight="700" fill="${accent}" text-anchor="middle">${escapeXml(block.value)}</text>`,
        );
        parts.push(
          `<text x="${x}" y="${by + 56}" font-family="${FONT_TECHNICAL}" font-size="13" fill="${COLOR_MUTED}" text-anchor="middle">${escapeXml(block.label)}</text>`,
        );
        // stat uses absolute positioning — y cursor unchanged
        break;
      }
      case "callout": {
        const { x, y: py } = getPosition(block.position, W, H);
        const bw = 260;
        const bh = 80;
        const bx = x - bw / 2;
        const by = py - bh / 2;
        parts.push(
          `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="4" fill="white" fill-opacity="0.92" stroke="${COLOR_HAIRLINE}" stroke-width="0.75" />`,
        );
        parts.push(
          `<text x="${bx + 14}" y="${by + 26}" font-family="${FONT_HANDWRITTEN}" font-size="20" font-weight="700" fill="${COLOR_TEXT}">${escapeXml(block.title)}</text>`,
        );
        const bodyLines = wrapText(block.body, 38).slice(0, 3);
        bodyLines.forEach((line, i) => {
          parts.push(
            `<text x="${bx + 14}" y="${by + 46 + i * 15}" font-family="${FONT_HANDWRITTEN}" font-size="14" fill="${COLOR_TEXT}">${escapeXml(line)}</text>`,
          );
        });
        // Leader — thin dashed with accent dot terminal (accent only here).
        const lead = getLeaderEnd(block.leaderTo, bx, by, bw, bh);
        parts.push(
          `<line x1="${lead.x1}" y1="${lead.y1}" x2="${lead.x2}" y2="${lead.y2}" stroke="${COLOR_HAIRLINE}" stroke-width="0.75" stroke-dasharray="4,3" />`,
        );
        parts.push(
          `<circle cx="${lead.x2}" cy="${lead.y2}" r="3.5" fill="${accent}" />`,
        );
        // callout is also absolute — y cursor unchanged
        break;
      }
      case "chart": {
        const chartH = 200;
        const chartW = W - 160;
        const cx = 80;
        parts.push(
          renderChart(
            block,
            cx,
            y,
            chartW,
            chartH,
            accent,
            COLOR_TEXT,
            COLOR_MUTED,
          ),
        );
        y += 240;
        break;
      }
      case "comparison": {
        const n = block.items.length;
        const gap = 16;
        const totalW = W - 120;
        const colW = (totalW - gap * (n - 1)) / n;
        const rowH = 70;
        const startX = 60;
        block.items.forEach((item, i) => {
          const bx = startX + i * (colW + gap);
          parts.push(
            `<rect x="${bx}" y="${y}" width="${colW}" height="${rowH}" rx="4" fill="white" fill-opacity="0.92" stroke="${COLOR_HAIRLINE}" stroke-width="0.75" />`,
          );
          parts.push(
            `<text x="${bx + colW / 2}" y="${y + 34}" font-family="${FONT_SERIF}" font-size="26" font-weight="700" fill="${accent}" text-anchor="middle">${escapeXml(item.value)}</text>`,
          );
          parts.push(
            `<text x="${bx + colW / 2}" y="${y + 56}" font-family="${FONT_TECHNICAL}" font-size="13" fill="${COLOR_MUTED}" text-anchor="middle">${escapeXml(item.label)}</text>`,
          );
        });
        y += 80;
        break;
      }
      case "flow": {
        const n = block.steps.length;
        const r = 22;
        const startX = 80;
        const endX = W - 80;
        const span = endX - startX;
        const cy = y + r;
        block.steps.forEach((step, i) => {
          const stepX =
            startX + (n === 1 ? span / 2 : (i / (n - 1)) * span);
          parts.push(
            `<circle cx="${stepX}" cy="${cy}" r="${r}" fill="${accent}" />`,
          );
          parts.push(
            `<text x="${stepX}" y="${cy + 7}" font-family="${FONT_SERIF}" font-size="20" font-weight="700" fill="white" text-anchor="middle">${i + 1}</text>`,
          );
          parts.push(
            `<text x="${stepX}" y="${cy + r + 20}" font-family="${FONT_HANDWRITTEN}" font-size="16" font-weight="700" fill="${COLOR_TEXT}" text-anchor="middle">${escapeXml(step.label)}</text>`,
          );
          const detailLines = wrapText(step.detail, 24).slice(0, 2);
          detailLines.forEach((line, li) => {
            parts.push(
              `<text x="${stepX}" y="${cy + r + 36 + li * 13}" font-family="${FONT_TECHNICAL}" font-size="11" fill="${COLOR_MUTED}" text-anchor="middle">${escapeXml(line)}</text>`,
            );
          });
          // arrow to next step — thinner, hairline color with accent arrowhead
          if (i < n - 1) {
            const nextX = startX + ((i + 1) / (n - 1)) * span;
            const ax1 = stepX + r + 4;
            const ax2 = nextX - r - 4;
            parts.push(
              `<line x1="${ax1}" y1="${cy}" x2="${ax2}" y2="${cy}" stroke="${COLOR_HAIRLINE}" stroke-width="1" marker-end="url(#fm-arrowhead)" />`,
            );
          }
        });
        y += 90;
        break;
      }
      case "takeaway": {
        const bw = W - 120;
        const bh = 60;
        const bx = 60;
        parts.push(
          `<rect x="${bx}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${withAlpha(accent, "1a")}" stroke="${withAlpha(accent, "55")}" stroke-width="0.75" />`,
        );
        const eyebrow =
          layout.language === "es" ? "IDEA CLAVE" : "KEY TAKEAWAY";
        parts.push(
          `<text x="${bx + 16}" y="${y + 20}" font-family="${FONT_TECHNICAL}" font-size="11" font-weight="700" fill="${accent}" letter-spacing="1.5">${escapeXml(eyebrow)}</text>`,
        );
        const bodyLines = wrapText(block.text, 80).slice(0, 2);
        bodyLines.forEach((line, i) => {
          parts.push(
            `<text x="${bx + 16}" y="${y + 40 + i * 16}" font-family="${FONT_HANDWRITTEN}" font-size="16" fill="${COLOR_TEXT}">${escapeXml(line)}</text>`,
          );
        });
        y += 70;
        break;
      }
      case "timeline": {
        const startX = 80;
        const endX = W - 80;
        const span = endX - startX;
        const cy = y + 20;
        const n = block.events.length;
        parts.push(
          `<line x1="${startX}" y1="${cy}" x2="${endX}" y2="${cy}" stroke="${COLOR_HAIRLINE}" stroke-width="1.25" />`,
        );
        block.events.forEach((ev, i) => {
          const ex =
            startX + (n === 1 ? span / 2 : (i / (n - 1)) * span);
          parts.push(
            `<circle cx="${ex}" cy="${cy}" r="5" fill="${accent}" stroke="white" stroke-width="1.5" />`,
          );
          parts.push(
            `<text x="${ex}" y="${cy - 12}" font-family="${FONT_TECHNICAL}" font-size="12" font-weight="700" fill="${COLOR_TEXT}" text-anchor="middle">${escapeXml(ev.date)}</text>`,
          );
          const lines = wrapText(ev.label, 18).slice(0, 2);
          lines.forEach((line, li) => {
            parts.push(
              `<text x="${ex}" y="${cy + 22 + li * 13}" font-family="${FONT_HANDWRITTEN}" font-size="13" fill="${COLOR_MUTED}" text-anchor="middle">${escapeXml(line)}</text>`,
            );
          });
        });
        y += 60;
        break;
      }
      case "text": {
        const lines = wrapText(block.text, 72).slice(0, 4);
        lines.forEach((line, i) => {
          parts.push(
            `<text x="60" y="${y + 14 + i * 18}" font-family="${FONT_HANDWRITTEN}" font-size="16" fill="${COLOR_TEXT}">${escapeXml(line)}</text>`,
          );
        });
        y += 40;
        break;
      }
      default:
        // exhaustiveness — ignore unknown types
        break;
    }
  }

  // ---- Footer ----
  const footerY = H - 36;
  parts.push(
    `<line x1="60" y1="${footerY - 10}" x2="${W - 60}" y2="${footerY - 10}" stroke="${COLOR_MUTED}" stroke-width="0.75" stroke-opacity="0.35" />`,
  );
  parts.push(
    `<text x="60" y="${footerY + 8}" font-family="${FONT_TECHNICAL}" font-size="11" fill="${COLOR_MUTED}">${escapeXml(layout.footer)}</text>`,
  );
  parts.push(
    `<text x="${W - 60}" y="${footerY + 8}" font-family="${FONT_TECHNICAL}" font-size="11" fill="${COLOR_MUTED}" text-anchor="end">Generated by FluxMind</text>`,
  );

  parts.push(`</svg>`);
  return parts.join("\n");
};

// ---------- Public entry point ----------

export const composeInfographic = async (
  layout: InfographicLayout,
  options: ComposeOptions,
): Promise<ComposedInfographic> => {
  const W = options.width ?? 1280;
  const H = options.height ?? 1600;
  const { notebookId, outputId } = options;

  // 1. AI illustration background (best effort — fall back to cream paper)
  let bgBuffer: Buffer;
  try {
    const bg = await generateInfographicImage(layout.illustrationPrompt, {
      size: { width: W, height: H },
      model: "fal-ai/flux-pro/v1.1",
    });
    const res = await fetch(bg.url);
    if (!res.ok) throw new Error(`background download failed: ${res.status}`);
    bgBuffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.warn(
      "Infographic background generation failed, using cream fallback:",
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
  const svg = buildSvgOverlay(layout, W, H);
  const svgBuffer = Buffer.from(svg);

  // 3. Cream-colored readability sheet between bg and text. RGB ~253,250,243
  // at 60% alpha so the illustration still reads through but the text keeps
  // contrast. Warmer than white — makes the composite feel like paper not
  // glass.
  const creamSheet = await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { r: 253, g: 250, b: 243, alpha: 0.6 },
    },
  })
    .png()
    .toBuffer();

  // 4. Composite pipeline
  const finalBuffer = await sharp(bgBuffer)
    .resize(W, H, { fit: "cover" })
    .composite([
      { input: creamSheet, top: 0, left: 0 },
      { input: svgBuffer, top: 0, left: 0 },
    ])
    .png({ quality: 90 })
    .toBuffer();

  const mainKey = `infographics/${notebookId}/${outputId}.png`;
  const imageUrl = await uploadFile(finalBuffer, mainKey, "image/png");

  // 5. Thumbnail (best effort)
  let thumbnailUrl: string | null = null;
  try {
    const thumbBuffer = await sharp(finalBuffer)
      .resize(400, 500, { fit: "cover" })
      .png()
      .toBuffer();
    const thumbKey = `infographics/${notebookId}/${outputId}-thumb.png`;
    thumbnailUrl = await uploadFile(thumbBuffer, thumbKey, "image/png");
  } catch (err) {
    console.warn("Infographic thumbnail generation failed (non-fatal):", err);
    thumbnailUrl = null;
  }

  return { imageUrl, thumbnailUrl };
};
