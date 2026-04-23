/**
 * 30 infographic layout templates.
 *
 * Each template receives the shared `InfoCtx` (split blocks + pure
 * position renderers + canvas dims) and arranges everything on the canvas.
 * They are selected deterministically per page by `selectTemplate(style,
 * seed, pageIndex)` — same seed+pageIndex always picks the same template,
 * but different pageIndex values roll across the pool so a multi-page
 * series always looks varied.
 *
 * Templates never touch the title or footer (handled by compose-infographic).
 * They only render the middle band between `ctx.top` and `ctx.bottom`.
 */

import type { InfoCtx, LayoutBlock } from "@/lib/media/compose-infographic";
import type { VisualStyle } from "@/lib/media/styles";
import {
  escapeXml,
  FONT_HANDWRITTEN,
  FONT_SERIF,
  FONT_TECHNICAL,
  wrapText,
} from "@/lib/media/svg-helpers";

// ---------- Helpers shared by templates ----------

/** Stack every remaining block (stats + callouts + others) full-width
 *  in source order starting at `y0`. Skips blocks already rendered. */
const stackRemaining = (
  ctx: InfoCtx,
  y0: number,
  x: number,
  w: number,
  skip: Set<LayoutBlock>,
): number => {
  let y = y0;
  for (const block of ctx.blocks) {
    if (skip.has(block)) continue;
    if (y > ctx.bottom - 60) break;
    switch (block.type) {
      case "stat":
        y = ctx.renderStat(block, x, y, Math.min(300, w), 115);
        break;
      case "callout":
        y = ctx.renderCallout(block, x, y, w, 180);
        break;
      case "chart":
        y = ctx.renderChart(block, x, y, w, 210);
        break;
      case "flow":
        y = ctx.renderFlow(block, x, y, w);
        break;
      case "timeline":
        y = ctx.renderTimeline(block, x, y, w);
        break;
      case "comparison":
        y = ctx.renderComparison(block, x, y, w);
        break;
      case "takeaway":
        y = ctx.renderTakeaway(block, x, y, w);
        break;
      case "text":
        y = ctx.renderText(block, x, y, w);
        break;
    }
  }
  return y;
};

const renderBlockAt = (
  ctx: InfoCtx,
  block: LayoutBlock,
  x: number,
  y: number,
  w: number,
): number => {
  switch (block.type) {
    case "stat":
      return ctx.renderStat(block, x, y, Math.min(280, w), 115);
    case "callout":
      return ctx.renderCallout(block, x, y, w, 180);
    case "chart":
      return ctx.renderChart(block, x, y, w, 210);
    case "flow":
      return ctx.renderFlow(block, x, y, w);
    case "timeline":
      return ctx.renderTimeline(block, x, y, w);
    case "comparison":
      return ctx.renderComparison(block, x, y, w);
    case "takeaway":
      return ctx.renderTakeaway(block, x, y, w);
    case "text":
      return ctx.renderText(block, x, y, w);
  }
};

const chapterDivider = (
  ctx: InfoCtx,
  y: number,
  n: number,
  label: string,
): number => {
  const { parts, W, accent, colors } = ctx;
  parts.push(
    `<circle cx="60" cy="${y + 10}" r="13" fill="${accent}" />`,
  );
  parts.push(
    `<text x="60" y="${y + 14}" font-family="${FONT_SERIF}" font-size="14" font-weight="700" fill="white" text-anchor="middle">${n}</text>`,
  );
  parts.push(
    `<text x="82" y="${y + 15}" font-family="${FONT_TECHNICAL}" font-size="13" font-weight="700" fill="${colors.text}" letter-spacing="1">${escapeXml(label.toUpperCase())}</text>`,
  );
  parts.push(
    `<line x1="60" y1="${y + 28}" x2="${W - 60}" y2="${y + 28}" stroke="${colors.hairline}" stroke-opacity="0.25" stroke-width="0.75" />`,
  );
  return y + 42;
};

/** Fill two columns in source order, blocks wrap when column is full. */
const twoCol = (
  ctx: InfoCtx,
  x0: number,
  x1: number,
  w: number,
  yStart: number,
): number => {
  const yCols = [yStart, yStart];
  const xCols = [x0, x1];
  for (const b of ctx.blocks) {
    // Charts / flows / timelines / comparisons / takeaways span full when
    // too wide for a column, otherwise hug the column.
    const col = yCols[0] <= yCols[1] ? 0 : 1;
    if (yCols[col] > ctx.bottom - 60) break;
    const y = renderBlockAt(ctx, b, xCols[col], yCols[col], w);
    yCols[col] = y;
  }
  return Math.max(yCols[0], yCols[1]);
};

// ---------- The 30 templates ----------

export type LayoutTemplate = {
  id: number;
  name: string;
  render: (ctx: InfoCtx) => void;
};

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  // === GROUP A: data-forward ==============================================
  {
    id: 1,
    name: "stat-banner",
    render: (ctx) => {
      const { stats, W, top } = ctx;
      const inner = W - 120;
      let y = top;
      if (stats.length > 0) {
        const cols = Math.min(stats.length, 4);
        const colW = (inner - (cols - 1) * 16) / cols;
        stats.slice(0, cols).forEach((s, i) => {
          ctx.renderStat(s, 60 + i * (colW + 16), y, colW, 120);
        });
        y += 132;
      }
      const skip = new Set<LayoutBlock>(stats.slice(0, 4));
      stackRemaining(ctx, y, 60, inner, skip);
    },
  },
  {
    id: 2,
    name: "stat-sidebar",
    render: (ctx) => {
      const { stats, W, top, bottom } = ctx;
      const sidebarW = Math.floor((W - 120) * 0.28);
      const mainX = 60 + sidebarW + 24;
      const mainW = W - 60 - mainX;
      let sy = top;
      for (const s of stats.slice(0, 5)) {
        if (sy > bottom - 140) break;
        sy = ctx.renderStat(s, 60, sy, sidebarW, 120);
      }
      const skip = new Set<LayoutBlock>(stats);
      stackRemaining(ctx, top, mainX, mainW, skip);
    },
  },
  {
    id: 3,
    name: "stat-hero",
    render: (ctx) => {
      const { stats, W, top, parts, accent, colors } = ctx;
      const inner = W - 120;
      let y = top;
      if (stats.length > 0) {
        const s = stats[0];
        parts.push(
          `<rect x="60" y="${y}" width="${inner}" height="170" rx="8" fill="${accent}" />`,
        );
        parts.push(
          `<text x="${W / 2}" y="${y + 92}" font-family="${FONT_SERIF}" font-size="72" font-weight="700" fill="white" text-anchor="middle">${escapeXml(s.value)}</text>`,
        );
        wrapText(s.label, 48)
          .slice(0, 2)
          .forEach((line, i) => {
            parts.push(
              `<text x="${W / 2}" y="${y + 130 + i * 20}" font-family="${FONT_HANDWRITTEN}" font-size="18" fill="white" fill-opacity="0.9" text-anchor="middle">${escapeXml(line)}</text>`,
            );
          });
        y += 190;
        // rest of stats as small row
        const rest = stats.slice(1, 5);
        if (rest.length > 0) {
          const cols = rest.length;
          const colW = (inner - (cols - 1) * 16) / cols;
          rest.forEach((st, i) => {
            ctx.renderStat(st, 60 + i * (colW + 16), y, colW, 105);
          });
          y += 120;
        }
      }
      void colors;
      stackRemaining(ctx, y, 60, inner, new Set<LayoutBlock>(stats));
    },
  },
  {
    id: 4,
    name: "stat-cards-3col",
    render: (ctx) => {
      const { stats, W, top, parts, accent } = ctx;
      const inner = W - 120;
      const cols = 3;
      const colW = (inner - (cols - 1) * 16) / cols;
      const cardH = 140;
      let y = top;
      stats.slice(0, 6).forEach((s, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const cx = 60 + col * (colW + 16);
        const cy = y + row * (cardH + 16);
        parts.push(
          `<rect x="${cx}" y="${cy}" width="${colW}" height="4" rx="2" fill="${accent}" />`,
        );
        ctx.renderStat(s, cx, cy + 6, colW, cardH - 6);
      });
      if (stats.length > 0)
        y += Math.ceil(Math.min(stats.length, 6) / cols) * (cardH + 16);
      stackRemaining(ctx, y, 60, inner, new Set<LayoutBlock>(stats.slice(0, 6)));
    },
  },
  {
    id: 5,
    name: "stat-scattered",
    render: (ctx) => {
      const { stats, W, top, bottom } = ctx;
      const inner = W - 120;
      const zones: Record<string, { x: number; y: number }> = {
        "top-left": { x: 60, y: top },
        "top-center": { x: 60 + inner / 2 - 130, y: top },
        "top-right": { x: W - 60 - 260, y: top },
        "mid-left": { x: 60, y: top + 140 },
        "mid-center": { x: 60 + inner / 2 - 130, y: top + 140 },
        "mid-right": { x: W - 60 - 260, y: top + 140 },
      };
      stats.slice(0, 6).forEach((s) => {
        const z = zones[s.position] ?? { x: 60, y: top };
        ctx.renderStat(s, z.x, z.y, 260, 115);
      });
      const y0 = stats.length > 3 ? top + 280 : top + 140;
      stackRemaining(ctx, Math.min(y0, bottom - 200), 60, inner, new Set<LayoutBlock>(stats.slice(0, 6)));
    },
  },
  // === GROUP B: narrative =================================================
  {
    id: 6,
    name: "story-zigzag",
    render: (ctx) => {
      const { W, top } = ctx;
      const inner = W - 180;
      let y = top;
      let left = true;
      for (const b of ctx.blocks) {
        if (y > ctx.bottom - 80) break;
        const x = left ? 60 : 60 + 120;
        y = renderBlockAt(ctx, b, x, y, inner) + 8;
        left = !left;
      }
    },
  },
  {
    id: 7,
    name: "story-centered",
    render: (ctx) => {
      const { W, top } = ctx;
      const w = Math.floor((W - 120) * 0.7);
      const x = (W - w) / 2;
      let y = top + 10;
      for (const b of ctx.blocks) {
        if (y > ctx.bottom - 80) break;
        y = renderBlockAt(ctx, b, x, y, w) + 16;
      }
    },
  },
  {
    id: 8,
    name: "story-chapters",
    render: (ctx) => {
      const { W, top } = ctx;
      const inner = W - 120;
      let y = top;
      const chapterLabels = ["INTRO", "DETAIL", "EVIDENCE", "INSIGHT", "TAKEAWAY", "BEYOND"];
      let ch = 0;
      for (const b of ctx.blocks) {
        if (y > ctx.bottom - 80) break;
        if (b.type !== "text" && b.type !== "stat" && ch < 6) {
          y = chapterDivider(ctx, y, ch + 1, chapterLabels[ch++] ?? `CH ${ch}`);
        }
        y = renderBlockAt(ctx, b, 60, y, inner) + 4;
      }
    },
  },
  {
    id: 9,
    name: "story-spine",
    render: (ctx) => {
      const { W, top, parts, colors, accent } = ctx;
      const spineX = Math.floor(W * 0.18);
      const contentX = spineX + 30;
      const contentW = W - 60 - contentX;
      let y = top;
      parts.push(
        `<line x1="${spineX}" y1="${top}" x2="${spineX}" y2="${ctx.bottom - 20}" stroke="${colors.hairline}" stroke-width="1.5" stroke-opacity="0.35" />`,
      );
      for (const b of ctx.blocks) {
        if (y > ctx.bottom - 80) break;
        parts.push(
          `<circle cx="${spineX}" cy="${y + 14}" r="5" fill="${accent}" stroke="white" stroke-width="1.5" />`,
        );
        y = renderBlockAt(ctx, b, contentX, y, contentW) + 6;
      }
    },
  },
  {
    id: 10,
    name: "story-cards",
    render: (ctx) => {
      const { W, top, parts, colors } = ctx;
      const inner = W - 120;
      let y = top;
      for (const b of ctx.blocks) {
        if (y > ctx.bottom - 100) break;
        const y0 = y;
        const yAfter = renderBlockAt(ctx, b, 74, y + 12, inner - 28);
        const cardH = yAfter - y0;
        parts.push(
          `<rect x="60" y="${y0}" width="${inner}" height="${cardH + 4}" rx="10" fill="white" fill-opacity="0.3" stroke="${colors.hairline}" stroke-width="0.5" stroke-opacity="0.4" />`,
        );
        y = yAfter + 10;
      }
    },
  },
  // === GROUP C: grid ======================================================
  {
    id: 11,
    name: "grid-2col",
    render: (ctx) => {
      const { W, top } = ctx;
      const gutter = 24;
      const colW = (W - 120 - gutter) / 2;
      twoCol(ctx, 60, 60 + colW + gutter, colW, top);
    },
  },
  {
    id: 12,
    name: "grid-3col",
    render: (ctx) => {
      const { W, top, stats, callouts } = ctx;
      const inner = W - 120;
      const gutter = 16;
      const colW = (inner - gutter * 2) / 3;
      let y = top;
      const skip = new Set<LayoutBlock>();
      // Row 1: stats in 3-col
      stats.slice(0, 3).forEach((s, i) => {
        skip.add(s);
        ctx.renderStat(s, 60 + i * (colW + gutter), y, colW, 120);
      });
      if (stats.length > 0) y += 132;
      // Row 2: callouts in 3-col
      callouts.slice(0, 3).forEach((c, i) => {
        skip.add(c);
        ctx.renderCallout(c, 60 + i * (colW + gutter), y, colW, 180);
      });
      if (callouts.length > 0) y += 192;
      // remainder full width
      stackRemaining(ctx, y, 60, inner, skip);
    },
  },
  {
    id: 13,
    name: "grid-masonry",
    render: (ctx) => {
      const { W, top } = ctx;
      const gutter = 20;
      const colW = (W - 120 - gutter) / 2;
      const yCols = [top, top];
      const xCols = [60, 60 + colW + gutter];
      // Masonry: place each block in the shorter column
      for (const b of ctx.blocks) {
        const col = yCols[0] <= yCols[1] ? 0 : 1;
        if (yCols[col] > ctx.bottom - 80) break;
        yCols[col] = renderBlockAt(ctx, b, xCols[col], yCols[col], colW) + 8;
      }
    },
  },
  {
    id: 14,
    name: "grid-hero",
    render: (ctx) => {
      const { W, top, blocks } = ctx;
      const inner = W - 120;
      if (blocks.length === 0) return;
      const hero = blocks[0];
      const y1 = renderBlockAt(ctx, hero, 60, top, inner) + 16;
      const gutter = 20;
      const colW = (inner - gutter) / 2;
      const yCols = [y1, y1];
      const xCols = [60, 60 + colW + gutter];
      for (let i = 1; i < blocks.length; i++) {
        const col = yCols[0] <= yCols[1] ? 0 : 1;
        if (yCols[col] > ctx.bottom - 80) break;
        yCols[col] = renderBlockAt(ctx, blocks[i], xCols[col], yCols[col], colW) + 8;
      }
    },
  },
  {
    id: 15,
    name: "grid-sidebar-main",
    render: (ctx) => {
      const { stats, takeaways, W, top, bottom } = ctx;
      const sidebarW = Math.floor((W - 120) * 0.32);
      const mainX = 60 + sidebarW + 24;
      const mainW = W - 60 - mainX;
      const skip = new Set<LayoutBlock>();
      // Sidebar: stats first, then takeaway
      let sy = top;
      for (const s of stats.slice(0, 4)) {
        if (sy > bottom - 120) break;
        sy = ctx.renderStat(s, 60, sy, sidebarW, 115);
        skip.add(s);
      }
      for (const t of takeaways.slice(0, 1)) {
        if (sy > bottom - 120) break;
        sy = ctx.renderTakeaway(t, 60, sy, sidebarW);
        skip.add(t);
      }
      stackRemaining(ctx, top, mainX, mainW, skip);
    },
  },
  // === GROUP D: visual ====================================================
  {
    id: 16,
    name: "magazine-spread",
    render: (ctx) => {
      const { W, top, charts } = ctx;
      const inner = W - 120;
      const gutter = 24;
      const colW = (inner - gutter) / 2;
      const skip = new Set<LayoutBlock>();
      // Chart spans both columns at center
      let midY = top;
      if (charts.length > 0) {
        midY = ctx.renderChart(charts[0], 60, top, inner, 220) + 16;
        skip.add(charts[0]);
      }
      // Split remainder between two cols
      const yCols = [midY, midY];
      const xCols = [60, 60 + colW + gutter];
      for (const b of ctx.blocks) {
        if (skip.has(b)) continue;
        const col = yCols[0] <= yCols[1] ? 0 : 1;
        if (yCols[col] > ctx.bottom - 80) break;
        yCols[col] = renderBlockAt(ctx, b, xCols[col], yCols[col], colW) + 8;
      }
    },
  },
  {
    id: 17,
    name: "poster-title",
    render: (ctx) => {
      // Compressed layout — blocks use tighter vertical spacing because
      // the composer's title band already takes 30% of the frame.
      const { W, top, bottom } = ctx;
      const inner = W - 120;
      const gutter = 16;
      const colW = (inner - gutter) / 2;
      const yCols = [top + 4, top + 4];
      const xCols = [60, 60 + colW + gutter];
      for (const b of ctx.blocks) {
        const col = yCols[0] <= yCols[1] ? 0 : 1;
        if (yCols[col] > bottom - 60) break;
        yCols[col] = renderBlockAt(ctx, b, xCols[col], yCols[col], colW) + 4;
      }
    },
  },
  {
    id: 18,
    name: "diagonal-flow",
    render: (ctx) => {
      const { W, top } = ctx;
      const baseX = 60;
      const maxOffset = 140;
      let y = top;
      let step = 0;
      for (const b of ctx.blocks) {
        if (y > ctx.bottom - 80) break;
        const offset = Math.min(step * 30, maxOffset);
        const x = baseX + offset;
        const w = W - 120 - offset;
        y = renderBlockAt(ctx, b, x, y, w) + 10;
        step++;
      }
    },
  },
  {
    id: 19,
    name: "offset-blocks",
    render: (ctx) => {
      const { W, top } = ctx;
      let y = top;
      let alt = false;
      for (const b of ctx.blocks) {
        if (y > ctx.bottom - 80) break;
        const x = alt ? 130 : 60;
        const w = W - x - 60;
        y = renderBlockAt(ctx, b, x, y, w) + 8;
        alt = !alt;
      }
    },
  },
  {
    id: 20,
    name: "accent-band",
    render: (ctx) => {
      const { stats, W, top, parts, accent, bottom } = ctx;
      const inner = W - 120;
      const bandY = top + Math.floor((bottom - top) * 0.08);
      const bandH = 140;
      parts.push(
        `<rect x="0" y="${bandY}" width="${W}" height="${bandH}" fill="${accent}" />`,
      );
      // Stats inside band — override colors would be ideal; we use white
      // ring overlays on the dark band via the normal stat renderer so it
      // stays consistent even if the band color is light.
      const bandStats = stats.slice(0, 3);
      const cols = bandStats.length || 1;
      const colW = (inner - (cols - 1) * 16) / cols;
      bandStats.forEach((s, i) => {
        ctx.renderStat(s, 60 + i * (colW + 16), bandY + 10, colW, bandH - 20);
      });
      const y0 = bandY + bandH + 20;
      const skip = new Set<LayoutBlock>(bandStats);
      stackRemaining(ctx, y0, 60, inner, skip);
    },
  },
  // === GROUP E: content-driven ============================================
  {
    id: 21,
    name: "chart-hero",
    render: (ctx) => {
      const { charts, W, top, H } = ctx;
      const inner = W - 120;
      const skip = new Set<LayoutBlock>();
      let y = top;
      if (charts.length > 0) {
        const heroH = Math.min(Math.floor(H * 0.4), 440);
        y = ctx.renderChart(charts[0], 60, y, inner, heroH);
        skip.add(charts[0]);
      }
      stackRemaining(ctx, y + 8, 60, inner, skip);
    },
  },
  {
    id: 22,
    name: "comparison-focus",
    render: (ctx) => {
      const { comparisons, W, top } = ctx;
      const inner = W - 120;
      const skip = new Set<LayoutBlock>();
      let y = top;
      if (comparisons.length > 0) {
        y = ctx.renderComparison(comparisons[0], 60, y, inner) + 16;
        skip.add(comparisons[0]);
      }
      // Remainder in a compact 2-col grid
      const colW = (inner - 24) / 2;
      const yCols = [y, y];
      const xCols = [60, 60 + colW + 24];
      for (const b of ctx.blocks) {
        if (skip.has(b)) continue;
        const col = yCols[0] <= yCols[1] ? 0 : 1;
        if (yCols[col] > ctx.bottom - 80) break;
        yCols[col] = renderBlockAt(ctx, b, xCols[col], yCols[col], colW) + 8;
      }
    },
  },
  {
    id: 23,
    name: "flow-hero",
    render: (ctx) => {
      const { flows, timelines, stats, W, top } = ctx;
      const inner = W - 120;
      const skip = new Set<LayoutBlock>();
      let y = top;
      if (flows[0]) {
        y = ctx.renderFlow(flows[0], 60, y, inner) + 12;
        skip.add(flows[0]);
      } else if (timelines[0]) {
        y = ctx.renderTimeline(timelines[0], 60, y, inner) + 12;
        skip.add(timelines[0]);
      }
      // Stats as small badge row
      const row = stats.slice(0, 4);
      if (row.length > 0) {
        const colW = (inner - (row.length - 1) * 16) / row.length;
        row.forEach((s, i) => {
          ctx.renderStat(s, 60 + i * (colW + 16), y, colW, 110);
          skip.add(s);
        });
        y += 122;
      }
      stackRemaining(ctx, y, 60, inner, skip);
    },
  },
  {
    id: 24,
    name: "mixed-wide-narrow",
    render: (ctx) => {
      const { W, top } = ctx;
      const inner = W - 120;
      let y = top;
      let wide = true;
      for (const b of ctx.blocks) {
        if (y > ctx.bottom - 80) break;
        const w = wide ? inner : Math.floor(inner * 0.62);
        const x = wide ? 60 : Math.floor((W - w) / 2);
        y = renderBlockAt(ctx, b, x, y, w) + 10;
        wide = !wide;
      }
    },
  },
  {
    id: 25,
    name: "takeaway-hero",
    render: (ctx) => {
      const { takeaways, W, top } = ctx;
      const inner = W - 120;
      const skip = new Set<LayoutBlock>();
      let y = top;
      if (takeaways.length > 0) {
        y = ctx.renderTakeaway(takeaways[0], 60, y, inner) + 16;
        skip.add(takeaways[0]);
      }
      stackRemaining(ctx, y, 60, inner, skip);
    },
  },
  // === GROUP F: minimal / modern ==========================================
  {
    id: 26,
    name: "minimal-left",
    render: (ctx) => {
      const { W, top } = ctx;
      const w = Math.floor((W - 120) * 0.55);
      let y = top;
      for (const b of ctx.blocks) {
        if (y > ctx.bottom - 80) break;
        y = renderBlockAt(ctx, b, 60, y, w) + 16;
      }
    },
  },
  {
    id: 27,
    name: "minimal-centered",
    render: (ctx) => {
      const { W, top } = ctx;
      const w = Math.floor((W - 120) * 0.52);
      const x = (W - w) / 2;
      let y = top;
      for (const b of ctx.blocks) {
        if (y > ctx.bottom - 80) break;
        y = renderBlockAt(ctx, b, x, y, w) + 20;
      }
    },
  },
  {
    id: 28,
    name: "type-only",
    render: (ctx) => {
      // Typography-first: stats+takeaways render as big bare text lines,
      // callouts as indented paragraphs, flows/charts/timelines fall back
      // to the regular renderer so real data is never hidden.
      const { parts, W, top, accent, colors, stats, takeaways } = ctx;
      const inner = W - 120;
      const skip = new Set<LayoutBlock>();
      let y = top;
      for (const s of stats) {
        if (y > ctx.bottom - 80) break;
        parts.push(
          `<text x="60" y="${y + 40}" font-family="${FONT_SERIF}" font-size="56" font-weight="700" fill="${accent}">${escapeXml(s.value)}</text>`,
        );
        wrapText(s.label, 60)
          .slice(0, 2)
          .forEach((line, i) => {
            parts.push(
              `<text x="60" y="${y + 64 + i * 18}" font-family="${FONT_TECHNICAL}" font-size="14" fill="${colors.muted}">${escapeXml(line)}</text>`,
            );
          });
        y += 110;
        skip.add(s);
      }
      for (const t of takeaways) {
        if (y > ctx.bottom - 80) break;
        wrapText(t.text, 80)
          .slice(0, 4)
          .forEach((line, i) => {
            parts.push(
              `<text x="60" y="${y + 24 + i * 26}" font-family="${FONT_SERIF}" font-size="22" fill="${colors.text}" font-style="italic">${escapeXml(line)}</text>`,
            );
          });
        y += 110;
        skip.add(t);
      }
      stackRemaining(ctx, y, 60, inner, skip);
    },
  },
  {
    id: 29,
    name: "dark-accent-bar",
    render: (ctx) => {
      const { stats, W, top, parts, accent } = ctx;
      const inner = W - 120;
      const skip = new Set<LayoutBlock>();
      let y = top;
      if (stats.length > 0) {
        const cols = Math.min(stats.length, 4);
        const barH = 155;
        parts.push(
          `<rect x="0" y="${y - 6}" width="${W}" height="${barH + 12}" fill="${accent}" />`,
        );
        const colW = (inner - (cols - 1) * 16) / cols;
        stats.slice(0, cols).forEach((s, i) => {
          ctx.renderStat(s, 60 + i * (colW + 16), y + 8, colW, barH - 16);
          skip.add(s);
        });
        y += barH + 14;
      }
      stackRemaining(ctx, y, 60, inner, skip);
    },
  },
  {
    id: 30,
    name: "split-half",
    render: (ctx) => {
      const { stats, takeaways, W, top, bottom, parts, accent } = ctx;
      const halfW = W / 2;
      const leftContentW = halfW - 84;
      const rightContentW = halfW - 84;
      parts.push(
        `<rect x="0" y="${top - 10}" width="${halfW}" height="${bottom - top + 20}" fill="${accent}" fill-opacity="0.08" />`,
      );
      // Left half: stats + takeaway
      let ly = top;
      const skip = new Set<LayoutBlock>();
      for (const s of stats.slice(0, 3)) {
        if (ly > bottom - 130) break;
        ly = ctx.renderStat(s, 42, ly, leftContentW, 115);
        skip.add(s);
      }
      for (const t of takeaways.slice(0, 1)) {
        if (ly > bottom - 130) break;
        ly = ctx.renderTakeaway(t, 42, ly, leftContentW);
        skip.add(t);
      }
      // Right half: everything else
      stackRemaining(ctx, top, halfW + 42, rightContentW, skip);
    },
  },
];

// ---------- Deterministic selection ----------

const STYLE_PREFIX: Record<VisualStyle, string[]> = {
  professional: ["stat-", "grid-", "chart-", "comparison-"],
  scientific: ["chart-", "grid-", "stat-", "flow-"],
  kawaii: ["story-", "diagonal-", "offset-", "takeaway-"],
  sketch: ["story-", "magazine-", "poster-", "offset-"],
  minimalist: ["minimal-", "type-", "split-"],
  auto: [],
};

const hashSeed = (seed: string, pageIndex: number): number => {
  let h = pageIndex * 2654435761;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 1597334677);
  }
  return h >>> 0;
};

export const selectTemplate = (
  style: VisualStyle,
  seed: string,
  pageIndex: number,
): LayoutTemplate => {
  const preferences = STYLE_PREFIX[style] ?? [];
  const biased =
    preferences.length > 0
      ? LAYOUT_TEMPLATES.filter((t) =>
          preferences.some((p) => t.name.startsWith(p)),
        )
      : [];
  const pool = biased.length >= 5 ? biased : LAYOUT_TEMPLATES;
  const h = hashSeed(seed || "fluxmind", pageIndex);
  return pool[h % pool.length];
};
