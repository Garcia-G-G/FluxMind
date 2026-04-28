/**
 * Reusable SVG helpers for the hybrid infographic / slide composition pipeline.
 *
 * Most functions here are pure — no IO, no side effects — so they can be
 * shared between `compose-infographic.ts` and future slide composers.
 *
 * `embeddedFontFace` is the one exception: it reads the bundled Patrick Hand
 * TTF from disk once and returns a cached CSS @font-face block so composers
 * can inline handwriting typefaces into their SVG <defs>. librsvg's support
 * for `@font-face` data URLs varies by version — we include the block so it
 * works where supported, and fall through to system font stacks where it
 * doesn't (via the `font-family` stacks emitted by the composers).
 */
import { readFileSync } from "fs";
import path from "path";

/**
 * Escapes the five XML-reserved characters so arbitrary user text can safely
 * appear inside SVG `<text>` nodes and attribute values.
 */
export const escapeXml = (s: string): string => {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

/**
 * Greedy word-wrap. Splits `text` into an array of lines where each line
 * contains at most `maxChars` characters (approximate — we never split a
 * word). Always returns at least one element (possibly empty string).
 */
export const wrapText = (text: string, maxChars: number): string[] => {
  if (!text) return [""];
  const max = Math.max(1, Math.floor(maxChars));
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      // Word itself exceeds max — keep it anyway (we don't hard-split words)
      current = word;
      continue;
    }
    if (current.length + 1 + word.length <= max) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
};

/**
 * Maps a semantic anchor name to an (x, y) coordinate inside a W×H canvas.
 * Uses three bands vertically (top ~20%, mid ~50%, bottom ~80%) and three
 * bands horizontally (left ~18%, center ~50%, right ~82%).
 */
export const getPosition = (
  pos: string,
  W: number,
  H: number,
): { x: number; y: number } => {
  const left = Math.round(W * 0.18);
  const center = Math.round(W * 0.5);
  const right = Math.round(W * 0.82);
  const top = Math.round(H * 0.22);
  const mid = Math.round(H * 0.5);
  const bottom = Math.round(H * 0.8);

  switch (pos) {
    case "top-left":
      return { x: left, y: top };
    case "top-center":
      return { x: center, y: top };
    case "top-right":
      return { x: right, y: top };
    case "mid-left":
      return { x: left, y: mid };
    case "mid-center":
      return { x: center, y: mid };
    case "mid-right":
      return { x: right, y: mid };
    case "bottom-left":
      return { x: left, y: bottom };
    case "bottom-center":
      return { x: center, y: bottom };
    case "bottom-right":
      return { x: right, y: bottom };
    default:
      return { x: center, y: mid };
  }
};

/**
 * Computes start/end points of a short "leader line" that extends from one
 * edge of a rectangular callout in `dir` direction. Used to draw dashed
 * pointer lines from a callout to a region of the illustration.
 */
export const getLeaderEnd = (
  dir: "left" | "right" | "up" | "down",
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): { x1: number; y1: number; x2: number; y2: number } => {
  const cxBox = boxX + boxW / 2;
  const cyBox = boxY + boxH / 2;
  const len = 60; // leader length in px

  switch (dir) {
    case "left":
      return {
        x1: boxX,
        y1: cyBox,
        x2: boxX - len,
        y2: cyBox,
      };
    case "right":
      return {
        x1: boxX + boxW,
        y1: cyBox,
        x2: boxX + boxW + len,
        y2: cyBox,
      };
    case "up":
      return {
        x1: cxBox,
        y1: boxY,
        x2: cxBox,
        y2: boxY - len,
      };
    case "down":
    default:
      return {
        x1: cxBox,
        y1: boxY + boxH,
        x2: cxBox,
        y2: boxY + boxH + len,
      };
  }
};

/**
 * Returns an SVG `<marker>` element string that renders a filled arrowhead
 * in the given `accent` color. Pass a unique `id` if you need multiple
 * diagrams in the same SVG (defaults to `fm-arrowhead`).
 */
export const arrowheadMarkerDef = (
  accent: string,
  id = "fm-arrowhead",
): string => {
  const color = escapeXml(accent);
  const safeId = escapeXml(id);
  return `<marker id="${safeId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}" /></marker>`;
};

// ---- Font embedding ----
//
// We bundle Patrick Hand (a clean technical-pen handwriting typeface) under
// `src/lib/media/fonts/` and attempt to embed it as a base64 data URL inside
// the composed SVG's `<defs><style>` block. Two font-family aliases are
// registered:
//
//  • `FM-Handwritten` — used for callout titles, callout bodies, chart
//    annotations. Readable hand-lettering feel.
//  • `FM-Technical`   — used for stat labels, axis ticks, bullet detail.
//    Same underlying typeface but semantically separates the technical-label
//    role, so we can later swap to a monospace if needed.
//
// librsvg's support for `@font-face` data URLs varies by build. Where it
// works, the composed PNG picks up real Patrick Hand glyphs. Where it
// doesn't, the stack falls through to `Patrick Hand, Bradley Hand, Segoe
// Print, Noteworthy, cursive` (or `Marker Felt, Menlo, monospace` for the
// technical alias). We pick font-family stacks that look reasonable on
// macOS, Windows, and common Linux font packages.
//
// The result is cached in module scope — we only read the TTF once.

let cachedFontFace: string | null = null;

export const embeddedFontFace = (): string => {
  if (cachedFontFace !== null) return cachedFontFace;
  try {
    const patrick = readFileSync(
      path.join(
        process.cwd(),
        "src/lib/media/fonts/PatrickHand-Regular.ttf",
      ),
    );
    const b64 = patrick.toString("base64");
    // Both FM-Handwritten and FM-Technical resolve to Patrick Hand — the
    // stacks on the <text> elements differ so that when librsvg can't load
    // the embedded font, the fallback cursive vs monospace distinction is
    // preserved.
    cachedFontFace = `
      <style type="text/css"><![CDATA[
        @font-face {
          font-family: "FM-Handwritten";
          src: url("data:font/ttf;base64,${b64}") format("truetype");
          font-weight: 400;
          font-style: normal;
        }
        @font-face {
          font-family: "FM-Technical";
          src: url("data:font/ttf;base64,${b64}") format("truetype");
          font-weight: 400;
          font-style: normal;
        }
      ]]></style>
    `;
  } catch (err) {
    // If the font file is missing, degrade gracefully — the SVG will just
    // fall through to the system font stack.
    console.warn("embeddedFontFace: font file missing, using fallback stacks only:", err);
    cachedFontFace = "";
  }
  return cachedFontFace;
};

// Font-family stacks consumed by the composers. Defined here so both
// compose-infographic and compose-slide use identical values.
export const FONT_HANDWRITTEN =
  "'FM-Handwritten', 'Patrick Hand', 'Bradley Hand', 'Segoe Print', 'Noteworthy', cursive";
export const FONT_TECHNICAL =
  "'FM-Technical', 'Patrick Hand', 'Marker Felt', 'Segoe Print', Menlo, monospace";
export const FONT_SERIF = "Georgia, 'Times New Roman', serif";

// Grid/graph-paper pattern for the paper-feel base layer. The composers emit
// this into `<defs>` and then stamp a full-canvas rect filled with the
// pattern as the first drawn element.
export const gridPatternDef = (id = "fm-grid"): string => {
  const safeId = escapeXml(id);
  return `<pattern id="${safeId}" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0f172a" stroke-width="0.4" opacity="0.07" /></pattern>`;
};
