/* Runs narration once and saves the MP3 to scripts/out/narration.mp3.
   Run:  npx tsx --env-file=.env scripts/demo-narration-save.ts
*/
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { generateNarrationScript, synthesizeSpeech } from "../src/lib/media/generate-narration";

const MOCK_OUTPUT = {
  title: "Rice Engineering: The Physics of the Perfect Grain",
  sections: [
    { heading: "Boiling at altitude", summary: "At sea level water boils at 100°C; at La Paz (3600m) only 88°C — rice cooking doubles to ~40 minutes." },
    { heading: "Pressure cookers invert the curve", summary: "Trapping steam raises the boiling point to 120°C, slashing cooking times regardless of altitude." },
  ],
  keyStats: [{ value: "100°C", label: "sea level" }, { value: "120°C", label: "pressure cooker" }],
};

const main = async (): Promise<void> => {
  console.log("generating script...");
  const script = await generateNarrationScript(MOCK_OUTPUT, "infographic");
  console.log(`  script length: ${script.length} chars`);

  console.log("synthesizing speech...");
  const voiceId = process.env.ELEVENLABS_NARRATOR_VOICE ?? "21m00Tcm4TlvDq8ikWAM";
  const buf = await synthesizeSpeech(script, voiceId);
  console.log(`  audio size: ${(buf.length / 1024).toFixed(1)} KB`);

  const outDir = path.join(process.cwd(), "scripts", "out");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "narration.mp3");
  await writeFile(outPath, buf);

  console.log(`\n✓ saved: ${outPath}`);
  console.log(`  → play with: open ${outPath}`);
};

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
