import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getStudioContext, isError } from "@/lib/studio/generate";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const notebookId = request.nextUrl.searchParams.get("notebookId");
    if (!notebookId) {
      return NextResponse.json({ error: "notebookId required" }, { status: 400 });
    }

    const [latest] = await db
      .select()
      .from(outputs)
      .where(and(eq(outputs.notebookId, notebookId), eq(outputs.type, "video")))
      .orderBy(desc(outputs.createdAt))
      .limit(1);

    return NextResponse.json(latest ?? null);
  } catch (error) {
    console.error("Failed to fetch video:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body = await request.json();
    const { notebookId } = body;

    const ctx = await getStudioContext(notebookId);
    if (isError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId,
      notebookId,
      userId: ctx.userId,
      type: "video",
      title: `Video Overview: ${ctx.notebookTitle}`,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Enqueue job (or process inline for script-only mode)
    try {
      const { generateVideo } = await import("@/lib/video/generate-video");
      // Process async without blocking response
      generateVideo(notebookId, outputId).catch(console.error);
    } catch {
      console.warn("Video generation module unavailable");
    }

    return NextResponse.json({ id: outputId, status: "pending" }, { status: 201 });
  } catch (error) {
    console.error("Video creation failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};
