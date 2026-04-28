import { generateText } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources } from "@/db/schema/sources";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";

export type PodcastSegment = {
  speaker: "Alex" | "Jordan";
  text: string;
};

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
// Two contrasting voices per language — all default to premade multilingual
// voices that exist on every ElevenLabs account, so podcasts work OOTB. The
// old Rachel/Bella IDs (21m00Tcm4TlvDq8ikWAM / AZnzlk1XvdvUeBnXmlld) are no
// longer provisioned on new accounts and caused TTS to 404.
const VOICE_ALEX_EN =
  process.env.ELEVENLABS_VOICE_ALEX ?? "EXAVITQu4vr4xnSDxMaL"; // Sarah — warm, curious
const VOICE_JORDAN_EN =
  process.env.ELEVENLABS_VOICE_JORDAN ?? "pNInz6obpgDQGcFmaJgB"; // Adam — authoritative
const VOICE_ALEX_ES =
  process.env.ELEVENLABS_VOICE_ALEX_ES ?? VOICE_ALEX_EN;
const VOICE_JORDAN_ES =
  process.env.ELEVENLABS_VOICE_JORDAN_ES ?? VOICE_JORDAN_EN;

const resolveVoice = (
  speaker: "Alex" | "Jordan",
  language: "en" | "es",
): string => {
  if (language === "es") {
    return speaker === "Alex" ? VOICE_ALEX_ES : VOICE_JORDAN_ES;
  }
  return speaker === "Alex" ? VOICE_ALEX_EN : VOICE_JORDAN_EN;
};

const updateProgress = async (
  outputId: string,
  progress: number,
  extra: Record<string, unknown> = {}
): Promise<void> => {
  await db
    .update(outputs)
    .set({ ...extra, updatedAt: new Date() })
    .where(eq(outputs.id, outputId));
};

// Step 1: Summarize sources
const summarizeSources = async (
  notebookId: string,
  language: "en" | "es",
): Promise<string> => {
  const notebookSources = await db
    .select({ title: sources.title, rawText: sources.rawText })
    .from(sources)
    .where(eq(sources.notebookId, notebookId));

  const context = notebookSources
    .filter((s) => s.rawText)
    .map((s) => `[${s.title}]\n${s.rawText!.slice(0, 5000)}`)
    .join("\n\n---\n\n");

  const prompt =
    language === "es"
      ? `Produce un resumen completo de 500-800 palabras de estas fuentes, cubriendo todos los temas clave, argumentos, datos relevantes y conclusiones. Escribe en español natural e idiomático:\n\n${context}`
      : `Produce a 500-800 word comprehensive summary of these sources covering all key topics, arguments, data points, and conclusions:\n\n${context}`;

  const { text } = await generateText({
    model: getModel("gemini-2.5-flash"),
    prompt,
  });

  return text;
};

// Step 2: Generate two-host script
const generateScript = async (
  summary: string,
  language: "en" | "es",
): Promise<PodcastSegment[]> => {
  const prompt =
    language === "es"
      ? `Escribe una conversación de podcast natural entre dos presentadores sobre el siguiente tema. ESCRIBE TODO EN ESPAÑOL NATURAL E IDIOMÁTICO — no traduzcas palabra por palabra desde el inglés.

Presentadores:
- Alex (entrevistador curioso): hace preguntas perspicaces, expresa interés genuino, ocasionalmente se sorprende con los datos
- Jordan (experto informado): explica conceptos con claridad, aporta contexto, da ejemplos concretos

Reglas:
- 15-25 intercambios en total
- Incluye micro-interjecciones naturales: "mmm", "claro", "interesante", "exacto", "¡vaya!"
- Comienza con una breve introducción al tema
- Termina con una conclusión clara
- Formatea cada línea como "ALEX: [diálogo]" o "JORDAN: [diálogo]"

Resumen:
${summary}`
      : `Write a natural podcast conversation between two hosts about the following topic.

Hosts:
- Alex (curious interviewer): asks insightful questions, expresses genuine interest, occasionally surprised by facts
- Jordan (knowledgeable expert): explains concepts clearly, provides broader context, gives concrete examples

Rules:
- 15-25 exchanges total
- Include natural micro-interjections: "hmm", "right", "interesting", "exactly", "oh wow"
- Start with a brief intro setting the topic
- End with a summary takeaway
- Format each line as "ALEX: [dialogue]" or "JORDAN: [dialogue]"

Summary:
${summary}`;

  const { text } = await generateText({
    model: getModel("gemini-2.5-flash"),
    prompt,
  });

  const segments: PodcastSegment[] = [];
  const lines = text.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    const match = line.match(/^(ALEX|JORDAN):\s*(.+)/i);
    if (match) {
      segments.push({
        speaker: match[1].toUpperCase() === "ALEX" ? "Alex" : "Jordan",
        text: match[2].trim(),
      });
    }
  }

  return segments.length > 0 ? segments : [{ speaker: "Alex", text: summary }];
};

// Step 3: Synthesize audio via ElevenLabs
const synthesizeSegment = async (
  segment: PodcastSegment,
  language: "en" | "es",
): Promise<Buffer> => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY not configured");
  }

  const voiceId = resolveVoice(segment.speaker, language);

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
      text: segment.text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
      },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`ElevenLabs API error: ${res.status} ${error}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

// Main pipeline
export const generatePodcast = async (
  notebookId: string,
  outputId: string,
  language: "en" | "es" = "en",
): Promise<void> => {
  try {
    await updateProgress(outputId, 5, { status: "generating" });

    // Step 1: Summarize
    const summary = await summarizeSources(notebookId, language);
    await updateProgress(outputId, 20);

    // Step 2: Generate script
    const segments = await generateScript(summary, language);
    await updateProgress(outputId, 35);

    // Step 3: Synthesize audio
    const audioBuffers: Buffer[] = [];
    for (let i = 0; i < segments.length; i++) {
      try {
        const audio = await synthesizeSegment(segments[i], language);
        audioBuffers.push(audio);
      } catch (error) {
        console.error(`Failed to synthesize segment ${i}:`, error);
        // Use empty buffer as placeholder
        audioBuffers.push(Buffer.alloc(0));
      }

      const segmentProgress = 35 + Math.round(((i + 1) / segments.length) * 45);
      await updateProgress(outputId, segmentProgress);

      // Rate limit delay
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Step 4: Concatenate audio buffers
    const combinedAudio = Buffer.concat(audioBuffers.filter((b) => b.length > 0));
    await updateProgress(outputId, 90);

    // Step 5: Upload to R2
    let fileUrl: string | null = null;
    try {
      const { uploadFile } = await import("@/lib/storage/r2");
      fileUrl = await uploadFile(
        combinedAudio,
        `podcasts/${notebookId}/${outputId}.mp3`,
        "audio/mpeg"
      );
    } catch {
      // R2 not configured — store placeholder
      fileUrl = `local://podcasts/${notebookId}/${outputId}.mp3`;
    }

    // Update output record
    await db
      .update(outputs)
      .set({
        fileUrl,
        status: "ready",
        content: {
          segments: segments.map((s) => ({ speaker: s.speaker, text: s.text })),
          duration: Math.round(combinedAudio.length / 16000), // rough estimate
          scriptWordCount: segments.reduce(
            (sum, s) => sum + s.text.split(/\s+/).length,
            0
          ),
          language,
        },
        updatedAt: new Date(),
      })
      .where(eq(outputs.id, outputId));
  } catch (error) {
    console.error("Podcast generation failed:", error);
    await db
      .update(outputs)
      .set({
        status: "error",
        content: {
          error: error instanceof Error ? error.message : "Generation failed",
        },
        updatedAt: new Date(),
      })
      .where(eq(outputs.id, outputId));
  }
};
