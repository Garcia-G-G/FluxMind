/* Exercises the v2 hybrid pipeline: AI illustration (no text) + SVG overlay
   (all text) → Sharp composite → real PNG with crisp typography.
   Run:  npx tsx --env-file=.env scripts/demo-compose.ts
*/
import { composeInfographic, type InfographicLayout } from "../src/lib/media/compose-infographic";
import { composeSlide, type SlideSpec } from "../src/lib/media/compose-slide";

const LAYOUT: InfographicLayout = {
  title: "Rice Engineering",
  subtitle: "How atmospheric pressure rewrites the physics of the perfect grain",
  language: "en",
  accentColor: "#ff6b35",
  illustrationPrompt:
    "A panoramic scene on cream-colored paper: on the left, a palm tree and a cooking pot on a beach at sea level with gentle waves. In the center-upper area, a commercial airplane silhouette above layered clouds. On the right, snow-capped mountains with a small village nestled below the peaks. In the foreground bottom-right, a vintage pressure cooker with steam lines rising from the valve. Thin black ink illustration style, watercolor orange accents on the sun, steam, and airplane. No letters, no numbers, no text of any kind, purely visual.",
  header: {
    text: "Thermodynamics: The Law of Atmospheric Pressure",
    subtext: "Why rice refuses to cook the same way twice",
  },
  blocks: [
    {
      type: "stat",
      value: "100°C",
      label: "Sea level boiling",
      position: "top-left",
    },
    {
      type: "stat",
      value: "88°C",
      label: "La Paz (3600m)",
      position: "top-right",
    },
    {
      type: "chart",
      chartType: "line",
      xLabel: "Altitude",
      yLabel: "Boiling point",
      dataPoints: [
        { x: "0m (sea)", y: 100, annotation: "100°C · 15min rice" },
        { x: "2400m", y: 91, annotation: "90°C · airplane cabin" },
        { x: "3600m", y: 80, annotation: "88°C · 40min rice" },
        { x: "4500m", y: 72, annotation: null },
        { x: "5500m", y: 65, annotation: null },
      ],
    },
    {
      type: "callout",
      title: "Pressure Cooker",
      body: "Traps steam, raises boiling point to 120°C — cuts cook time dramatically at any altitude.",
      position: "mid-left",
      leaderTo: "right",
    },
    {
      type: "comparison",
      items: [
        { label: "Sea level", value: "15m" },
        { label: "La Paz", value: "40m" },
        { label: "Pressure", value: "8m" },
      ],
    },
    {
      type: "takeaway",
      text: "Atmospheric pressure sets the ceiling on boiling temperature — cook times are altitude-bound unless you control pressure.",
    },
  ],
  footer: "Sources: atmospheric physics notes, culinary guides",
  sections: [
    { heading: "Boiling at altitude", summary: "Water boils at lower temperatures as altitude rises, extending cook times." },
    { heading: "Pressure cookers", summary: "By trapping steam, they invert the altitude effect and slash cook times." },
    { heading: "Practical impact", summary: "Recipes written at sea level fail at altitude unless adjusted." },
  ],
  keyStats: [
    { value: "100°C", label: "sea level" },
    { value: "120°C", label: "pressure cooker" },
    { value: "40min", label: "rice in La Paz" },
  ],
};

const SLIDE: SlideSpec = {
  id: "demo-slide-1",
  layout: "content",
  title: "Boiling at altitude",
  subtitle: null,
  bullets: [
    "Sea-level water boils at a reliable 100°C",
    "At 3600m, boiling tops out around 88°C",
    "Lower heat ceiling = longer cook times",
    "Recipes written for sea-level kitchens stall at altitude",
  ],
  stat: null,
  comparisonItems: null,
  quote: null,
  flowSteps: null,
  illustrationPrompt:
    "A hand-drawn thermometer on cream paper next to a steaming pot on a stove, with faint mountain silhouettes in the background. Thin black ink lines, subtle orange watercolor on the steam. No text or numbers anywhere in the illustration.",
  narrationHint: "Walks the viewer through why boiling temperature drops with altitude",
};

const elapsed = (start: number): string => `${((Date.now() - start) / 1000).toFixed(1)}s`;
const demoId = "compose-" + Date.now().toString(36);

const main = async (): Promise<void> => {
  console.log("──────── v2 Hybrid Compose Demo ────────");
  console.log("env:", {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    FAL_KEY: !!process.env.FAL_KEY,
    R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
  });
  console.log();

  console.log("[1/2] composing infographic (illustration + SVG overlay + Sharp)...");
  const t1 = Date.now();
  try {
    const r = await composeInfographic(LAYOUT, {
      notebookId: "demo-notebook",
      outputId: demoId,
    });
    console.log(`  ✓ done in ${elapsed(t1)}`);
    console.log("  imageUrl:    ", r.imageUrl);
    console.log("  thumbnailUrl:", r.thumbnailUrl);
  } catch (e) {
    console.log(`  ✗ failed in ${elapsed(t1)}`);
    console.log("  error:", e instanceof Error ? e.message : String(e));
  }
  console.log();

  console.log("[2/2] composing single slide (16:9 landscape)...");
  const t2 = Date.now();
  try {
    const r = await composeSlide(SLIDE, {
      notebookId: "demo-notebook",
      outputId: demoId,
      deckAccent: "#ff6b35",
    });
    console.log(`  ✓ done in ${elapsed(t2)}`);
    console.log("  imageUrl: ", r.imageUrl);
    console.log("  persisted:", r.persisted);
  } catch (e) {
    console.log(`  ✗ failed in ${elapsed(t2)}`);
    console.log("  error:", e instanceof Error ? e.message : String(e));
  }
  console.log();
  console.log("──────── done ────────");
};

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
