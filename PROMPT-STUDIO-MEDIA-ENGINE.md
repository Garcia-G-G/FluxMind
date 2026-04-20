# FluxMind Studio — AI Media Generation Engine v2

> **Read `CLAUDE.md` first** for stack and code style rules. All rules there apply here.

---

## THE CORE PROBLEM — Why v1 Failed

FLUX (and most diffusion models) **cannot reliably render text**. The generated infographics had:
- Garbled, illegible labels (random letter-like shapes)
- Incorrect graph orientations (ascending when it should descend)
- No spatial precision (callout boxes overlapping)
- Notebook/book frame artifact from the style prefix

NotebookLM's infographics have **perfectly readable text** because they are NOT generated with a diffusion model. They use a **hybrid approach**: AI generates structured content → programmatic rendering draws the final image with real fonts, vector graphics, and precise layout.

---

## THE SOLUTION: Server-Side Canvas Rendering + AI Illustrations

### Architecture: Two-Layer Composition

```
Layer 1 (Background): AI-generated illustration via fal.ai
  → Scene art only: visual metaphors, decorative elements, abstract shapes
  → NO TEXT, NO LABELS, NO NUMBERS on this layer
  → Example: "mountains at different altitudes with an airplane, palm tree, pressure cooker, thin ink style"

Layer 2 (Overlay): Server-rendered via Sharp + SVG
  → ALL text, labels, numbers, axis labels, callout boxes, arrows
  → Perfect fonts, crisp rendering, exact positioning
  → Composed ON TOP of the AI illustration

Final: Sharp composites Layer 1 + Layer 2 → PNG → R2
```

This gives us:
- **Beautiful AI art** for the visual elements (what diffusion models are good at)
- **Perfect text** rendered programmatically (what code is good at)
- **Precise layout** controlled by structured JSON

---

## PART 1: The Structured Layout Schema

The AI generates a detailed layout specification — NOT an image prompt. This is the single most important design decision.

### 1A. Rewrite `/src/app/api/studio/infographic/route.ts`

Replace the current `contentSchema` with a **layout-first schema** that describes exact visual elements and their positions:

```typescript
const layoutSchema = z.object({
  // Metadata
  title: z.string().describe("Main title — max 8 words, punchy"),
  subtitle: z.string().describe("One-line subtitle — max 14 words"),
  language: z.enum(["en", "es"]).describe("Content language"),
  
  // Visual theme
  accentColor: z.enum(["#ff6b35", "#e11d48", "#7c3aed", "#2563eb", "#059669", "#d97706"]),
  
  // The AI illustration prompt (NO TEXT — only visual elements)
  illustrationPrompt: z.string().describe(
    "A prompt for AI image generation describing ONLY visual/decorative elements. " +
    "NO text, NO labels, NO numbers, NO words of any kind. " +
    "Describe: objects, scenes, icons, metaphors, patterns, backgrounds. " +
    "Example: 'A panoramic mountain range at different elevations, sea level beach with palm trees on the left, " +
    "snow-capped peaks on the right, a commercial airplane flying between them, a pressure cooker with steam on a kitchen counter " +
    "in the foreground. Hand-drawn ink illustration style, thin precise black lines on white background, " +
    "subtle orange watercolor accents on key objects.' " +
    "Length: 100-200 words. ABSOLUTELY NO TEXT IN THE IMAGE."
  ),

  // Layout sections — each will be rendered with code
  header: z.object({
    text: z.string(),
    subtext: z.string().nullable(),
  }),

  // Main content blocks with exact positioning hints
  blocks: z.array(z.discriminatedUnion("type", [
    // Large stat number with label
    z.object({
      type: z.literal("stat"),
      value: z.string().describe("Short: 85%, $2.1B, 3x, 40min"),
      label: z.string().describe("Max 5 words"),
      position: z.enum(["top-left", "top-center", "top-right", "mid-left", "mid-center", "mid-right"]),
    }),
    
    // Callout box with leader line (like NotebookLM's annotated points)
    z.object({
      type: z.literal("callout"),
      title: z.string().describe("Bold header — max 4 words"),
      body: z.string().describe("1-2 short sentences of explanation"),
      position: z.enum(["top-left", "top-right", "mid-left", "mid-right", "bottom-left", "bottom-right"]),
      leaderTo: z.enum(["left", "right", "up", "down"]).describe("Direction the leader line points toward the illustration"),
    }),

    // Horizontal comparison row
    z.object({
      type: z.literal("comparison"),
      items: z.array(z.object({
        label: z.string(),
        value: z.string(),
      })).min(2).max(4),
    }),

    // Graph/Chart description (rendered as SVG)
    z.object({
      type: z.literal("chart"),
      chartType: z.enum(["line", "bar", "area"]),
      xLabel: z.string(),
      yLabel: z.string(),
      dataPoints: z.array(z.object({
        x: z.string().describe("X axis label"),
        y: z.number().describe("Y value (0-100 normalized scale)"),
        annotation: z.string().nullable().describe("Optional label at this point"),
      })).min(3).max(8),
    }),

    // Process/Flow steps
    z.object({
      type: z.literal("flow"),
      steps: z.array(z.object({
        label: z.string().describe("Max 3 words"),
        detail: z.string().describe("Max 8 words"),
      })).min(3).max(6),
    }),

    // Key takeaway box
    z.object({
      type: z.literal("takeaway"),
      text: z.string().describe("One sentence — the main insight"),
    }),

    // Simple text paragraph
    z.object({
      type: z.literal("text"),
      text: z.string().describe("Max 2 sentences"),
    }),

    // Timeline
    z.object({
      type: z.literal("timeline"),
      events: z.array(z.object({
        date: z.string(),
        label: z.string().describe("Max 5 words"),
      })).min(3).max(6),
    }),
  ])).min(4).max(10),

  // Footer
  footer: z.string().describe("Source attribution — one line"),

  // Accessibility metadata
  sections: z.array(z.object({
    heading: z.string(),
    summary: z.string(),
  })).min(3).max(6),

  keyStats: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })).min(2).max(5),
});
```

### 1B. The AI Prompt for Content Generation

This is the prompt that generates the layout specification:

```typescript
const prompt = `${langInstr}

You are a world-class infographic designer. You design layouts for educational infographics that will be RENDERED PROGRAMMATICALLY (not drawn by AI).

Your job:
1. Analyze the sources and identify the most important information to visualize
2. Design a layout using the available block types (stat, callout, comparison, chart, flow, takeaway, text, timeline)
3. Write an illustrationPrompt for a BACKGROUND ILLUSTRATION that contains NO TEXT — only visual metaphors and decorative elements

CRITICAL RULES FOR illustrationPrompt:
- NEVER include any text, labels, numbers, words, letters, or characters
- ONLY describe visual scenes, objects, icons, metaphors
- Describe a SCENE that visually represents the topic
- Think "what would I draw if I could only communicate with pictures?"
- Style: hand-drawn technical illustration, thin black ink lines on white/cream background, minimal watercolor accents
- The illustration will be placed BEHIND text overlay — describe elements positioned to leave breathing room for text

LAYOUT RULES:
- Start with header + 1-2 stat blocks to hook the viewer
- Use callout blocks with leaderTo to annotate parts of the illustration
- Include at least one chart OR comparison OR flow block
- End with a takeaway block
- Keep ALL text extremely concise — this is an infographic, not an essay
- Stats should be punchy: "100°C", "88°C", "40min", "120°C" — not "approximately one hundred degrees"
- Position callouts to not overlap (spread across left/right, top/mid/bottom)

EXAMPLE for rice engineering topic:
- illustrationPrompt: "Panoramic scene showing three altitude levels from left to right: (1) a beach with a palm tree and a pot on a stove at sea level, (2) a commercial airplane flying at mid-altitude above clouds, (3) snow-capped mountains with a small village. In the foreground bottom-right, a pressure cooker with steam lines. Thin black ink on white, watercolor orange accents on the steam and sun. No text anywhere."
- header: "Termodinámica: La Ley de la Presión Atmosférica"  
- blocks: stat(100°C, Nivel del Mar), stat(88°C, La Paz 3600m), callout(Avión Comercial, Cabina a 2400m — el agua hierve a 90°C...), chart(line, Altitud, Punto de Ebullición, [...datapoints]), callout(Olla de Presión, Eleva la temperatura a 120°C...), takeaway(La presión atmosférica determina...)

Sources:
${ctx.sourceContext}`;
```

---

## PART 2: Server-Side Image Composition with Sharp + SVG

### 2A. Create `/src/lib/media/compose-infographic.ts`

This is the core rendering engine. It takes the structured layout and creates a real PNG image with perfect text.

```typescript
import sharp from "sharp";
// sharp is already commonly available in Node.js servers

/**
 * Composes a final infographic image:
 * 1. Generates AI illustration background via fal.ai (no text)
 * 2. Renders SVG overlay with all text, charts, callouts, arrows
 * 3. Composites both layers into final PNG
 */
export const composeInfographic = async (
  layout: LayoutSchema,
  options: {
    width?: number;      // default 1280
    height?: number;     // default 1600
    notebookId: string;
    outputId: string;
  }
): Promise<{ imageUrl: string; thumbnailUrl: string | null }> => {
  const W = options.width ?? 1280;
  const H = options.height ?? 1600;
  
  // Step 1: Generate background illustration (NO TEXT)
  let bgBuffer: Buffer;
  try {
    const { generateInfographicImage } = await import("./generate-image");
    const bg = await generateInfographicImage(layout.illustrationPrompt, {
      size: { width: W, height: H },
      model: "fal-ai/flux-pro/v1.1",  // or flux/dev for higher quality
    });
    const res = await fetch(bg.url);
    bgBuffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    // If AI image fails, use plain white background
    console.warn("Background generation failed, using plain white:", err);
    bgBuffer = await sharp({
      create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
    }).png().toBuffer();
  }

  // Step 2: Build SVG overlay with all text elements
  const svg = buildSvgOverlay(layout, W, H);
  const svgBuffer = Buffer.from(svg);

  // Step 3: Composite layers
  const finalBuffer = await sharp(bgBuffer)
    .resize(W, H, { fit: "cover" })
    // Semi-transparent white overlay to make text readable over illustration
    .composite([
      {
        input: await sharp({
          create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.7 } }
        }).png().toBuffer(),
        blend: "over",
      },
      {
        input: svgBuffer,
        blend: "over",
      },
    ])
    .png({ quality: 90 })
    .toBuffer();

  // Step 4: Upload to R2
  const { uploadFile } = await import("@/lib/storage/r2");
  const imageUrl = await uploadFile(
    finalBuffer,
    `infographics/${options.notebookId}/${options.outputId}.png`,
    "image/png"
  );

  // Step 5: Generate thumbnail
  let thumbnailUrl: string | null = null;
  try {
    const thumbBuffer = await sharp(finalBuffer).resize(400, 500).png().toBuffer();
    thumbnailUrl = await uploadFile(
      thumbBuffer,
      `infographics/${options.notebookId}/${options.outputId}-thumb.png`,
      "image/png"
    );
  } catch { thumbnailUrl = null; }

  return { imageUrl, thumbnailUrl };
};
```

### 2B. SVG Overlay Builder

The SVG builder renders all text elements with proper fonts and positioning:

```typescript
const buildSvgOverlay = (layout: LayoutSchema, W: number, H: number): string => {
  const accent = layout.accentColor;
  const textColor = "#0f172a";
  const mutedColor = "#64748b";
  const bgCallout = "rgba(255,255,255,0.92)";
  
  let y = 60; // vertical cursor
  const elements: string[] = [];

  // Helper: escape XML
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // ── Title block ──
  elements.push(`
    <text x="${W/2}" y="${y}" text-anchor="middle" font-family="Georgia, serif" font-size="42" font-weight="bold" fill="${textColor}" letter-spacing="-1">
      ${esc(layout.header.text)}
    </text>
  `);
  y += 50;
  if (layout.header.subtext) {
    elements.push(`
      <text x="${W/2}" y="${y}" text-anchor="middle" font-family="Inter, sans-serif" font-size="18" fill="${mutedColor}">
        ${esc(layout.header.subtext)}
      </text>
    `);
    y += 20;
  }
  // Accent line
  elements.push(`<rect x="${W/2 - 30}" y="${y}" width="60" height="3" rx="1.5" fill="${accent}" />`);
  y += 40;

  // ── Render each block ──
  for (const block of layout.blocks) {
    switch (block.type) {
      case "stat": {
        // Position-based placement
        const pos = getPosition(block.position, W, H);
        elements.push(`
          <g transform="translate(${pos.x}, ${pos.y})">
            <rect x="-60" y="-35" width="120" height="70" rx="12" fill="${bgCallout}" stroke="${accent}" stroke-width="1.5"/>
            <text x="0" y="-5" text-anchor="middle" font-family="Inter, sans-serif" font-size="32" font-weight="800" fill="${accent}">
              ${esc(block.value)}
            </text>
            <text x="0" y="20" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" fill="${mutedColor}">
              ${esc(block.label)}
            </text>
          </g>
        `);
        break;
      }

      case "callout": {
        const pos = getPosition(block.position, W, H);
        const boxW = 260;
        const boxH = 80;
        elements.push(`
          <g transform="translate(${pos.x}, ${pos.y})">
            <rect x="0" y="0" width="${boxW}" height="${boxH}" rx="8" fill="${bgCallout}" stroke="${textColor}" stroke-width="1"/>
            <text x="12" y="22" font-family="Inter, sans-serif" font-size="14" font-weight="700" fill="${textColor}">
              ${esc(block.title)}
            </text>
            <text x="12" y="42" font-family="Inter, sans-serif" font-size="11" fill="${mutedColor}">
              ${wrapText(esc(block.body), 40).map((line, i) => 
                `<tspan x="12" dy="${i === 0 ? 0 : 14}">${line}</tspan>`
              ).join("")}
            </text>
          </g>
        `);
        // Leader line
        const leaderEnd = getLeaderEnd(block.leaderTo, pos.x, pos.y, boxW, boxH);
        elements.push(`
          <line x1="${leaderEnd.x1}" y1="${leaderEnd.y1}" x2="${leaderEnd.x2}" y2="${leaderEnd.y2}" 
                stroke="${textColor}" stroke-width="1" stroke-dasharray="4 2"/>
          <circle cx="${leaderEnd.x2}" cy="${leaderEnd.y2}" r="3" fill="${accent}"/>
        `);
        break;
      }

      case "chart": {
        // Render a simple SVG chart at the current y position
        const chartW = W - 160;
        const chartH = 200;
        const chartX = 80;
        elements.push(renderChart(block, chartX, y, chartW, chartH, accent, textColor, mutedColor));
        y += chartH + 40;
        break;
      }

      case "comparison": {
        const colW = (W - 120) / block.items.length;
        block.items.forEach((item, i) => {
          const cx = 60 + i * colW + colW / 2;
          elements.push(`
            <rect x="${60 + i * colW}" y="${y}" width="${colW - 8}" height="60" rx="8" fill="${bgCallout}" stroke="${accent}20" stroke-width="1"/>
            <text x="${cx}" y="${y + 25}" text-anchor="middle" font-family="Inter, sans-serif" font-size="20" font-weight="800" fill="${accent}">
              ${esc(item.value)}
            </text>
            <text x="${cx}" y="${y + 45}" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" fill="${mutedColor}">
              ${esc(item.label)}
            </text>
          `);
        });
        y += 80;
        break;
      }

      case "flow": {
        const stepW = (W - 100) / block.steps.length;
        block.steps.forEach((step, i) => {
          const cx = 50 + i * stepW + stepW / 2;
          // Circle with number
          elements.push(`
            <circle cx="${cx}" cy="${y + 20}" r="16" fill="${accent}"/>
            <text x="${cx}" y="${y + 25}" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" font-weight="700" fill="white">
              ${i + 1}
            </text>
            <text x="${cx}" y="${y + 50}" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="600" fill="${textColor}">
              ${esc(step.label)}
            </text>
            <text x="${cx}" y="${y + 66}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" fill="${mutedColor}">
              ${esc(step.detail)}
            </text>
          `);
          // Arrow between steps
          if (i < block.steps.length - 1) {
            elements.push(`
              <line x1="${cx + 20}" y1="${y + 20}" x2="${cx + stepW - 20}" y2="${y + 20}" 
                    stroke="${accent}" stroke-width="1.5" marker-end="url(#arrowhead)"/>
            `);
          }
        });
        y += 90;
        break;
      }

      case "takeaway": {
        elements.push(`
          <rect x="40" y="${y}" width="${W - 80}" height="50" rx="10" fill="${accent}15" stroke="${accent}40" stroke-width="1"/>
          <text x="60" y="${y + 20}" font-family="Inter, sans-serif" font-size="11" font-weight="700" fill="${accent}" letter-spacing="1">
            KEY TAKEAWAY
          </text>
          <text x="60" y="${y + 38}" font-family="Inter, sans-serif" font-size="13" font-weight="500" fill="${textColor}">
            ${esc(block.text)}
          </text>
        `);
        y += 70;
        break;
      }

      case "timeline": {
        const lineY = y + 15;
        elements.push(`<line x1="80" y1="${lineY}" x2="${W - 80}" y2="${lineY}" stroke="${accent}40" stroke-width="2"/>`);
        const stepW = (W - 200) / (block.events.length - 1);
        block.events.forEach((ev, i) => {
          const cx = 100 + i * stepW;
          elements.push(`
            <circle cx="${cx}" cy="${lineY}" r="6" fill="${accent}"/>
            <text x="${cx}" y="${lineY - 16}" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" font-weight="700" fill="${accent}">
              ${esc(ev.date)}
            </text>
            <text x="${cx}" y="${lineY + 22}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" fill="${mutedColor}">
              ${esc(ev.label)}
            </text>
          `);
        });
        y += 60;
        break;
      }

      case "text": {
        elements.push(`
          <text x="60" y="${y + 5}" font-family="Inter, sans-serif" font-size="13" fill="${mutedColor}">
            ${wrapText(esc(block.text), 80).map((line, i) => 
              `<tspan x="60" dy="${i === 0 ? 0 : 18}">${line}</tspan>`
            ).join("")}
          </text>
        `);
        y += 40;
        break;
      }
    }
  }

  // ── Footer ──
  elements.push(`
    <line x1="40" y1="${H - 50}" x2="${W - 40}" y2="${H - 50}" stroke="${mutedColor}30" stroke-width="1"/>
    <text x="40" y="${H - 28}" font-family="Inter, sans-serif" font-size="10" fill="${mutedColor}">
      ${esc(layout.footer)}
    </text>
    <text x="${W - 40}" y="${H - 28}" text-anchor="end" font-family="Inter, sans-serif" font-size="10" fill="${mutedColor}">
      Generated by FluxMind
    </text>
  `);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="${accent}"/>
      </marker>
    </defs>
    ${elements.join("\n")}
  </svg>`;
};

// Helper: map position enum to x,y coordinates
const getPosition = (pos: string, W: number, H: number): { x: number; y: number } => {
  const positions: Record<string, { x: number; y: number }> = {
    "top-left":    { x: 60,         y: 180 },
    "top-center":  { x: W / 2 - 130, y: 180 },
    "top-right":   { x: W - 320,   y: 180 },
    "mid-left":    { x: 60,         y: H * 0.4 },
    "mid-center":  { x: W / 2 - 130, y: H * 0.4 },
    "mid-right":   { x: W - 320,   y: H * 0.4 },
    "bottom-left": { x: 60,         y: H * 0.7 },
    "bottom-right":{ x: W - 320,   y: H * 0.7 },
  };
  return positions[pos] ?? positions["mid-center"];
};

// Helper: leader line end point
const getLeaderEnd = (dir: string, x: number, y: number, bw: number, bh: number) => {
  const offsets: Record<string, { x1: number; y1: number; x2: number; y2: number }> = {
    left:  { x1: x,          y1: y + bh/2, x2: x - 40,      y2: y + bh/2 },
    right: { x1: x + bw,     y1: y + bh/2, x2: x + bw + 40, y2: y + bh/2 },
    up:    { x1: x + bw/2,   y1: y,        x2: x + bw/2,    y2: y - 40 },
    down:  { x1: x + bw/2,   y1: y + bh,   x2: x + bw/2,    y2: y + bh + 40 },
  };
  return offsets[dir] ?? offsets.down;
};

// Helper: wrap text into lines
const wrapText = (text: string, maxChars: number): string[] => {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      lines.push(current.trim());
      current = word;
    } else {
      current += " " + word;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
};

// Helper: render a simple SVG line/bar/area chart
const renderChart = (
  chart: { chartType: string; xLabel: string; yLabel: string; dataPoints: Array<{x: string; y: number; annotation: string | null}> },
  cx: number, cy: number, w: number, h: number,
  accent: string, textColor: string, mutedColor: string,
): string => {
  const padding = 50;
  const plotW = w - padding * 2;
  const plotH = h - padding * 2;
  const elements: string[] = [];

  // Axes
  elements.push(`<line x1="${cx + padding}" y1="${cy + padding}" x2="${cx + padding}" y2="${cy + h - padding}" stroke="${textColor}" stroke-width="1.5"/>`);
  elements.push(`<line x1="${cx + padding}" y1="${cy + h - padding}" x2="${cx + w - padding}" y2="${cy + h - padding}" stroke="${textColor}" stroke-width="1.5"/>`);

  // Axis labels
  elements.push(`<text x="${cx + w/2}" y="${cy + h - 5}" text-anchor="middle" font-size="12" fill="${mutedColor}" font-family="Inter, sans-serif">${chart.xLabel}</text>`);
  elements.push(`<text x="${cx + 15}" y="${cy + h/2}" text-anchor="middle" font-size="12" fill="${mutedColor}" font-family="Inter, sans-serif" transform="rotate(-90, ${cx + 15}, ${cy + h/2})">${chart.yLabel}</text>`);

  // Data points and line
  const points = chart.dataPoints.map((dp, i) => {
    const px = cx + padding + (i / (chart.dataPoints.length - 1)) * plotW;
    const py = cy + h - padding - (dp.y / 100) * plotH;
    return { px, py, ...dp };
  });

  // Draw line/area
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.px} ${p.py}`).join(" ");
  if (chart.chartType === "area") {
    elements.push(`<path d="${pathD} L ${points[points.length-1].px} ${cy + h - padding} L ${points[0].px} ${cy + h - padding} Z" fill="${accent}15" stroke="none"/>`);
  }
  elements.push(`<path d="${pathD}" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`);

  // Data point dots and annotations
  points.forEach((p) => {
    elements.push(`<circle cx="${p.px}" cy="${p.py}" r="4" fill="${accent}" stroke="white" stroke-width="2"/>`);
    // X label
    elements.push(`<text x="${p.px}" y="${cy + h - padding + 18}" text-anchor="middle" font-size="9" fill="${mutedColor}" font-family="Inter, sans-serif">${p.x}</text>`);
    // Annotation
    if (p.annotation) {
      elements.push(`
        <rect x="${p.px - 50}" y="${p.py - 28}" width="100" height="20" rx="4" fill="rgba(255,255,255,0.9)" stroke="${accent}40" stroke-width="0.5"/>
        <text x="${p.px}" y="${p.py - 14}" text-anchor="middle" font-size="9" font-weight="600" fill="${textColor}" font-family="Inter, sans-serif">${p.annotation}</text>
      `);
    }
  });

  return elements.join("\n");
};
```

### 2C. Install Sharp

```bash
pnpm add sharp @types/sharp
```

Sharp works natively in Node.js and on Vercel (they have a built-in layer). It's the standard for server-side image processing in the Node ecosystem.

---

## PART 3: Updated Route — Full Pipeline

The infographic route now calls `composeInfographic` instead of raw fal.ai:

```typescript
// In the infographic route, after Phase 1 (AI generates layout):

// Phase 2 — Compose final image
const { composeInfographic } = await import("@/lib/media/compose-infographic");
const { imageUrl, thumbnailUrl } = await composeInfographic(content, {
  width: 1280,
  height: 1600,
  notebookId,
  outputId,
});

// Phase 3 — Save to DB
const saved: InfographicContent = {
  title: content.title,
  subtitle: content.subtitle,
  imageUrl,
  thumbnailUrl,
  imagePrompt: content.illustrationPrompt,
  sections: content.sections,
  keyStats: content.keyStats,
};
```

---

## PART 4: Slides — Same Hybrid Approach

Each slide uses the same composition pattern:
1. AI generates illustration-only background (no text)
2. SVG overlay adds title, bullet points, annotations
3. Sharp composites both layers

Create `/src/lib/media/compose-slide.ts` following the same pattern as `compose-infographic.ts` but with slide-specific layouts (title slide, content slide, stat slide, etc.).

---

## PART 5: Audio Narration

### 5A. Create `/src/components/studio/narration-player.tsx`

This component is already imported by the infographic and slide viewers but doesn't exist yet. Create it:

```typescript
"use client";

import { useState, useRef } from "react";
import { Play, Pause, Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  outputId: string;
  existingAudioUrl: string | null;
};

export const NarrationPlayer = ({ outputId, existingAudioUrl }: Props): React.ReactNode => {
  const [audioUrl, setAudioUrl] = useState<string | null>(existingAudioUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const generateNarration = async (): Promise<void> => {
    if (audioUrl || isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/studio/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputId }),
      });
      if (!res.ok) throw new Error("Narration failed");
      const data = await res.json();
      setAudioUrl(data.audioUrl);
    } catch (err) {
      console.error("Narration generation failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlay = (): void => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  if (!audioUrl) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="mb-3 gap-2"
        onClick={generateNarration}
        disabled={isLoading}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
        {isLoading ? "Generating..." : "Listen to explanation"}
      </Button>
    );
  }

  return (
    <div
      className="flex items-center gap-3 mb-3 rounded-lg px-3 py-2"
      style={{ background: "var(--fm-surface)", border: "1px solid var(--fm-surface-border)" }}
    >
      <button onClick={togglePlay} className="shrink-0">
        {isPlaying
          ? <Pause className="h-5 w-5" style={{ color: "var(--fm-text)" }} />
          : <Play className="h-5 w-5" style={{ color: "var(--fm-text)" }} />}
      </button>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--fm-surface-border)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "var(--fm-accent-orange)" }} />
      </div>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
          }
        }}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
};
```

### 5B. Create `/src/app/api/studio/narrate/route.ts`

```typescript
// POST { outputId }
// 1. Load output from DB
// 2. Generate narration script from content using AI
// 3. Call ElevenLabs TTS
// 4. Upload audio to R2
// 5. Update output with audioUrl
// 6. Return { audioUrl, script, duration }
```

---

## PART 6: Performance Rules

### ABSOLUTE DO-NOTs (already fixed, do NOT regress):

1. **NO infinite CSS animations** on dashboard or notebook pages — zero `animation: X infinite`
2. **NO `filter: blur()` or `filter: drop-shadow()`** — recompute every frame
3. **NO SVG filters** (feTurbulence, feGaussianBlur)
4. **Icon components are STATIC** — OrbitalIcon, BreathingIcon, RotatingBorderIcon, AccentIcon all have zero animations
5. **Dashboard greeting** — static gradient, no shimmer animation
6. **Background blobs** — 3 only, radial-gradient + translate3d, no blur

### Image Performance:
7. **Use `<img>` not `<Image>`** for R2-hosted images (external URLs)
8. **`loading="lazy"`** on all images
9. **Thumbnails (400x500)** for output list cards — never load full 1280x1600 images in lists
10. **Sharp runs server-side only** — never in the client
11. **Audio: HTML5 `<audio>`** — stream from R2 URL, never load into memory

### Generation Performance:
12. **Image generation is async** — show "Generating..." state with progress, don't block UI
13. **Illustration generation** runs in parallel with any non-dependent step
14. **Thumbnail generation** is best-effort — don't fail the whole output if it fails
15. **React Query `staleTime: 30_000`** — avoid refetching on tab switch

### Files to NOT modify:
- `/src/styles/animations.css` — only essential animations remain
- `/src/styles/theme-tokens.css` — CSS custom property theme
- `/src/components/shared/animated-background.tsx` — radial-gradient blobs
- `/src/components/shared/orbital-icon.tsx` — static
- `/src/components/shared/breathing-icon.tsx` — static
- `/src/components/shared/rotating-border-icon.tsx` — static
- `/src/components/shared/accent-icon.tsx` — static
- `/src/app/(app)/dashboard/page.tsx` — static gradient greeting

---

## PART 7: Implementation Order

1. `pnpm add sharp @types/sharp` (if not installed)
2. Create `/src/components/studio/narration-player.tsx` (MUST — already imported, currently breaks build)
3. Create `/src/lib/media/compose-infographic.ts` — SVG overlay builder + Sharp composition
4. Update `/src/app/api/studio/infographic/route.ts` — new layout schema + compose pipeline
5. Create `/src/lib/media/compose-slide.ts` — slide-specific composition
6. Update `/src/app/api/studio/slides/route.ts` — updated illustrationPrompt (no text) + compose pipeline
7. Create `/src/app/api/studio/narrate/route.ts` — narration endpoint
8. Update `/src/lib/media/generate-image.ts` — update STYLE_PREFIX to explicitly say NO TEXT
9. Test each step: `pnpm build && pnpm test`

---

## PART 8: Why This Approach Works

| Aspect | Old Approach (FLUX-only) | New Approach (Hybrid) |
|--------|--------------------------|----------------------|
| Text readability | Garbled, illegible | Perfect — programmatic fonts |
| Graph accuracy | Wrong orientation, random | Correct — SVG data visualization |
| Layout precision | Random placement | Exact — coordinate-based SVG |
| Visual appeal | AI-generated art | AI art background + clean overlay |
| Consistency | Random style each time | Consistent — same SVG templates |
| Numbers/Data | Hallucinated | Exact — from source material |
| Multi-language | Broken Unicode | Perfect — SVG supports all chars |

The AI does what it's good at (visual metaphors, scene illustration) and code does what code is good at (text, charts, layout). This is how NotebookLM achieves their quality.

---

## PART 9: Environment Variables

```
FAL_KEY=your-fal-ai-key               # For illustration backgrounds
ELEVENLABS_API_KEY=your-elevenlabs-key # For audio narration
R2_ACCOUNT_ID=...                      # For image/audio storage
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=fluxmind
R2_PUBLIC_URL=https://your-r2-url.com
```
