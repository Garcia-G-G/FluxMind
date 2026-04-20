/* Lists the ElevenLabs voices available to the configured API key.
   Run:  npx tsx --env-file=.env scripts/list-elevenlabs-voices.ts
*/
type Voice = {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
};

const main = async (): Promise<void> => {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    console.error("ELEVENLABS_API_KEY not set");
    process.exit(1);
  }
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
  });
  if (!res.ok) {
    console.error(`list failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const data = (await res.json()) as { voices: Voice[] };
  console.log(`You have access to ${data.voices.length} voice(s):\n`);
  for (const v of data.voices) {
    const labels = v.labels
      ? Object.entries(v.labels).map(([k, val]) => `${k}: ${val}`).join(", ")
      : "";
    console.log(`  ${v.name.padEnd(24)} ${v.voice_id}  [${v.category ?? "?"}]  ${labels}`);
  }
  console.log();
  console.log("Copy any voice_id above into .env as ELEVENLABS_NARRATOR_VOICE.");
};

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
