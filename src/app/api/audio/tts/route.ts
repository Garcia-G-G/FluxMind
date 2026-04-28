import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const TTS_MAX_CHARS = 5000;

export const POST = async (request: NextRequest): Promise<Response> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const limited = await checkRateLimit({
      userId: session.user.id,
      bucket: "tts",
      ...RATE_LIMITS.ttsStream,
    });
    if (limited) return limited;

    const { text, voiceId } = await request.json();

    if (!text) {
      return new Response("text is required", { status: 400 });
    }
    if (typeof text !== "string" || text.length > TTS_MAX_CHARS) {
      return new Response(
        `text must be a string up to ${TTS_MAX_CHARS} characters`,
        { status: 400 },
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return new Response("ElevenLabs API key not configured", { status: 503 });
    }

    // Voice fallback chain matches the rest of the audio pipeline:
    //   user-provided voiceId → ELEVENLABS_NARRATOR_VOICE → Matilda
    // (Rachel was deprecated on new accounts — see generate-narration.ts.)
    const voice =
      voiceId ??
      process.env.ELEVENLABS_NARRATOR_VOICE ??
      "XrExE9yKIg1WjnnlVkGX";

    // Forward client disconnect (request.signal) so the upstream
    // ElevenLabs connection is closed when the user navigates away.
    // Plus a 60s wall-clock cap so a stuck stream can't pin the route.
    const { fetchWithTimeout } = await import("@/lib/utils/fetch-timeout");
    const ttsResponse = await fetchWithTimeout(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream`,
      {
        method: "POST",
        timeoutMs: 60_000,
        signal: request.signal,
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
          },
        }),
      },
    );

    if (!ttsResponse.ok) {
      // Log the provider's message server-side, return a generic error so
      // raw ElevenLabs internals don't leak to the client.
      const upstreamError = await ttsResponse.text();
      console.error("ElevenLabs TTS failed:", ttsResponse.status, upstreamError.slice(0, 500));
      return new Response("TTS generation failed", { status: 502 });
    }

    // Stream the audio response directly to the client
    return new Response(ttsResponse.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("TTS streaming failed:", error);
    return new Response("Internal server error", { status: 500 });
  }
};
