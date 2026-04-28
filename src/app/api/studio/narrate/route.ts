import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { generateNarration } from "@/lib/media/generate-narration";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const maxDuration = 90;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const limited = await checkRateLimit({
      userId: session.user.id,
      bucket: "studio.narrate",
      ...RATE_LIMITS.studioNarrate,
    });
    if (limited) return limited;

    const body = await request.json();
    const outputId: string | undefined = body?.outputId;
    const rawLanguage: unknown = body?.language;
    const language: "en" | "es" = rawLanguage === "es" ? "es" : "en";
    if (!outputId) {
      return NextResponse.json(
        { error: "outputId required" },
        { status: 400 },
      );
    }

    const [row] = await db
      .select()
      .from(outputs)
      .where(eq(outputs.id, outputId));

    if (!row) {
      return NextResponse.json({ error: "Output not found" }, { status: 404 });
    }
    if (row.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = (row.content ?? {}) as Record<string, unknown>;
    // Only serve cache if the cached audio matches the requested language.
    const cachedLanguage = existing.audioLanguage === "es" ? "es" : "en";
    if (
      typeof existing.audioUrl === "string" &&
      existing.audioUrl.length > 0 &&
      cachedLanguage === language
    ) {
      return NextResponse.json({
        audioUrl: existing.audioUrl,
        script: (existing.audioScript as string) ?? "",
        duration: (existing.audioDuration as number) ?? 0,
        cached: true,
      });
    }

    const result = await generateNarration(
      outputId,
      row.content,
      row.type,
      row.notebookId,
      language,
    );

    const merged: Record<string, unknown> = {
      ...existing,
      audioUrl: result.audioUrl,
      audioScript: result.script,
      audioDuration: result.duration,
      audioLanguage: language,
    };
    await db
      .update(outputs)
      .set({ content: merged, updatedAt: new Date() })
      .where(eq(outputs.id, outputId));

    return NextResponse.json({
      audioUrl: result.audioUrl,
      script: result.script,
      duration: result.duration,
      cached: false,
    });
  } catch (error) {
    console.error("Narration failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Narration failed",
      },
      { status: 500 },
    );
  }
};
