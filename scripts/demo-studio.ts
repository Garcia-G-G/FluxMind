/* End-to-end Studio media demo — runs image + narration with R2/local fallback.
   Run:  npx tsx --env-file=.env scripts/demo-studio.ts
*/
import { generateInfographicImage } from "../src/lib/media/generate-image";
import { generateNarration } from "../src/lib/media/generate-narration";

const INFOGRAPHIC_PROMPT = `A hand-drawn ink illustration titled "Termodinámica: La Ley de la Presión Atmosférica" rendered at the top in bold serif font on off-white graph paper. The center features a large XY graph with "Altitud" labeled on the horizontal X-axis and "Punto de Ebullición" on the vertical Y-axis. A thin curve descends from upper-right to lower-left across the graph. Four callout boxes with thin leader lines point to specific points on the curve: (1) at the sea-level point, a tiny palm tree and sun, box text: "Nivel del Mar: El agua hierve a 100°C. Tiempo estándar: 15-20 min"; (2) mid-altitude, a small airplane sketch, box text: "Avión Comercial (2400m): Agua hierve a 90°C. Altera la extracción de sabores"; (3) upper-right with a mountain, box text: "La Paz, Bolivia (3600m): Hierve a 88°C. Arroz tarda 40 min"; (4) lower-right, a pressure cooker with steam, box text: "Olla de Presión: Atrapa el vapor, eleva a 120°C, tiempos reducidos". Monochrome ink, thin line weight, selective orange accent on key numbers. Footer: small attribution line.`;

const MOCK_OUTPUT = {
  title: "Rice Engineering: The Physics of the Perfect Grain",
  subtitle: "How atmospheric pressure dictates cooking time",
  sections: [
    { heading: "Boiling at altitude", summary: "At sea level water boils at 100°C; at La Paz (3600m) only 88°C — rice cooking doubles to ~40 minutes." },
    { heading: "Pressure cookers invert the curve", summary: "Trapping steam raises the boiling point to 120°C, slashing cooking times regardless of altitude." },
    { heading: "Why it matters", summary: "Recipes written for sea-level kitchens fail at elevation unless time and water ratios are adjusted or a pressure vessel is used." },
  ],
  keyStats: [
    { value: "100°C", label: "sea level" },
    { value: "88°C",  label: "La Paz (3600m)" },
    { value: "120°C", label: "pressure cooker" },
    { value: "40min", label: "rice at altitude" },
  ],
};

const elapsed = (start: number): string => `${((Date.now() - start) / 1000).toFixed(1)}s`;
const demoId = "demo-" + Date.now().toString(36);

const main = async (): Promise<void> => {
  console.log("──────── FluxMind Studio Media Demo ────────");
  console.log("env:", {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    FAL_KEY: !!process.env.FAL_KEY,
    ELEVENLABS_API_KEY: !!process.env.ELEVENLABS_API_KEY,
    R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
  });
  const storage = process.env.R2_ACCOUNT_ID ? "R2 (cloud)" : "local (public/uploads/)";
  console.log("storage:", storage);
  console.log();

  console.log("[1/2] generating infographic image (fal-ai/flux/dev)...");
  const imgStart = Date.now();
  try {
    const image = await generateInfographicImage(INFOGRAPHIC_PROMPT, {
      size: { width: 1280, height: 1600 },
      persistTo: { key: `infographics/${demoId}/main.png` },
    });
    console.log(`  ✓ done in ${elapsed(imgStart)}`);
    console.log("  url:       ", image.url);
    console.log("  persisted: ", image.persisted);
  } catch (e) {
    console.log(`  ✗ failed in ${elapsed(imgStart)}`);
    console.log("  error:", e instanceof Error ? e.message : String(e));
  }
  console.log();

  console.log("[2/2] generating narration (script + ElevenLabs TTS)...");
  const narrStart = Date.now();
  try {
    const narration = await generateNarration(
      demoId,
      MOCK_OUTPUT,
      "infographic",
      "demo-notebook",
    );
    console.log(`  ✓ done in ${elapsed(narrStart)}`);
    console.log("  duration:  ", narration.duration, "seconds");
    console.log("  persisted: ", narration.persisted);
    console.log("  audio url: ", narration.audioUrl.length > 200 ? narration.audioUrl.slice(0, 120) + "...(truncated)" : narration.audioUrl);
    console.log("  script preview:");
    console.log(narration.script.split("\n").slice(0, 3).map(l => "    " + l).join("\n"));
  } catch (e) {
    console.log(`  ✗ failed in ${elapsed(narrStart)}`);
    console.log("  error:", e instanceof Error ? e.message : String(e));
  }
  console.log();
  console.log("──────── demo complete ────────");
  console.log();
  if (!process.env.R2_ACCOUNT_ID) {
    console.log("Local mode: files are in public/uploads/. The Next.js server serves them at /uploads/* — URLs above will work in your app.");
  }
};

main().catch((err) => {
  console.error("\nfatal:", err);
  process.exit(1);
});
