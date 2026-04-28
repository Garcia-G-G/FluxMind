import { generateText } from "ai";
import { getModel } from "@/lib/ai/models";
import { uploadFile } from "@/lib/storage/r2";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
// Matilda — "Knowledgeable, Professional" multilingual premade voice. Reads
// both English and Spanish cleanly on eleven_multilingual_v2 when no
// per-language override is configured. Rachel (21m00Tcm4TlvDq8ikWAM) is gone
// from new ElevenLabs accounts, so hardcoding her as a fallback breaks TTS
// out-of-the-box for anyone without explicit env overrides.
const DEFAULT_VOICE_EN = "XrExE9yKIg1WjnnlVkGX";
// Default Spanish narrator. Still a multilingual premade voice so it works
// without a cloned voice — if the account has a Spanish-cloned voice, set
// ELEVENLABS_NARRATOR_VOICE_ES in .env to override.
const DEFAULT_VOICE_ES = "XrExE9yKIg1WjnnlVkGX";

export type NarrationResult = {
  audioUrl: string;
  script: string;
  duration: number; // seconds, rough estimate
  persisted: boolean; // true if on R2
};

const buildScriptPrompt = (
  content: unknown,
  outputType: string,
  language: "en" | "es",
): string => {
  const LANG_NAME = language === "es" ? "Spanish" : "English";
  const langInstr = `IMPORTANT: Write the entire narration in ${LANG_NAME}. Every sentence, every word, every verbal connective must be natural, fluent ${LANG_NAME}. Do NOT mix languages. Do NOT translate word-for-word from English — write idiomatic ${LANG_NAME} as a native speaker would narrate.`;

  const hookExamples =
    language === "es"
      ? `"Analicemos lo que estamos viendo aquí..." o "Aquí hay algo interesante..."`
      : `"Let's break down what we're looking at here..." or "Here's something interesting..."`;
  const connectiveExamples =
    language === "es"
      ? `"Ahora, aquí se pone interesante...", "Entonces, ¿qué significa esto?"`
      : `"Now here's where it gets interesting...", "So, what does this mean?"`;

  return `${langInstr}

You are a friendly, engaging narrator explaining a ${outputType} to a curious student. Write a natural-sounding spoken narration (200-350 words) in ${LANG_NAME} that:

- Opens with a hook like ${hookExamples}
- Walks through each section/data point conversationally
- Highlights the most surprising or important findings (use specific numbers from the content)
- Uses natural pauses and verbal connectives: ${connectiveExamples}
- Sounds like a knowledgeable friend, NOT a textbook
- Closes with a clear takeaway
- Avoids filler, corporate-speak, or vague statements

Content to narrate:
${JSON.stringify(content, null, 2).slice(0, 6000)}

Output ONLY the narration text in ${LANG_NAME} — no stage directions, no speaker labels, no markdown.`;
};

export const generateNarrationScript = async (
  content: unknown,
  outputType: string,
  language: "en" | "es" = "en",
): Promise<string> => {
  const { text } = await generateText({
    model: getModel("gemini-2.5-flash"),
    prompt: buildScriptPrompt(content, outputType, language),
  });
  return text.trim();
};

export const synthesizeSpeech = async (
  script: string,
  voiceId: string,
): Promise<Buffer> => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

  const { fetchWithTimeout } = await import("@/lib/utils/fetch-timeout");
  const res = await fetchWithTimeout(`${ELEVENLABS_API_URL}/${voiceId}`, {
    method: "POST",
    timeoutMs: 60_000,
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: script,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${errText}`);
  }
  return Buffer.from(await res.arrayBuffer());
};

export const generateNarration = async (
  outputId: string,
  content: unknown,
  outputType: string,
  notebookId: string,
  language: "en" | "es" = "en",
): Promise<NarrationResult> => {
  const script = await generateNarrationScript(content, outputType, language);
  // Allow an optional per-language voice override; fall back to the shared
  // narrator voice, then the module default. eleven_multilingual_v2 reads
  // Spanish cleanly on any multilingual voice.
  const voiceId =
    (language === "es"
      ? process.env.ELEVENLABS_NARRATOR_VOICE_ES
      : process.env.ELEVENLABS_NARRATOR_VOICE_EN) ??
    process.env.ELEVENLABS_NARRATOR_VOICE ??
    (language === "es" ? DEFAULT_VOICE_ES : DEFAULT_VOICE_EN);
  const audioBuffer = await synthesizeSpeech(script, voiceId);

  // Rough MP3 duration at ~128kbps (~16KB/sec).
  const duration = Math.max(1, Math.round(audioBuffer.length / 16000));

  let audioUrl: string;
  let persisted = false;
  try {
    audioUrl = await uploadFile(
      audioBuffer,
      `narrations/${notebookId}/${outputId}.mp3`,
      "audio/mpeg",
    );
    persisted = true;
  } catch (e) {
    console.warn("R2 persist failed for narration:", e);
    // Fall back to base64 data URL (only for small buffers; abort if >5MB).
    if (audioBuffer.length <= 5 * 1024 * 1024) {
      audioUrl = `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`;
    } else {
      throw new Error(
        "R2 unavailable and audio too large for inline fallback",
      );
    }
  }

  return { audioUrl, script, duration, persisted };
};
