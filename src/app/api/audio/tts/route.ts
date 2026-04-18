import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const POST = async (request: NextRequest): Promise<Response> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { text, voiceId } = await request.json();

    if (!text) {
      return new Response("text is required", { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return new Response("ElevenLabs API key not configured", { status: 503 });
    }

    const voice = voiceId ?? "21m00Tcm4TlvDq8ikWAM";

    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream`,
      {
        method: "POST",
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
      }
    );

    if (!ttsResponse.ok) {
      const error = await ttsResponse.text();
      return new Response(`TTS failed: ${error}`, { status: ttsResponse.status });
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
