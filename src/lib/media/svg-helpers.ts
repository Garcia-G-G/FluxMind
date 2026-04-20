/**
 * Reusable SVG helpers for the hybrid infographic / slide composition pipeline.
 *
 * All functions here are pure — no IO, no side effects — so they can be
 * shared between `compose-infographic.ts` and future slide composers.
 */

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

export type AnchorPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "mid-left"
  | "mid-center"
  | "mid-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

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
