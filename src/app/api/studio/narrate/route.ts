import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { generateNarration } from "@/lib/media/generate-narration";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const outputId: string | undefined = body?.outputId;
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
    if (
      typeof existing.audioUrl === "string" &&
      existing.audioUrl.length > 0
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
    );

    const merged: Record<string, unknown> = {
      ...existing,
      audioUrl: result.audioUrl,
      audioScript: result.script,
      audioDuration: result.duration,
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
