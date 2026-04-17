import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getStudioContext, isError } from "@/lib/studio/generate";
import { getDocumentQueue } from "@/lib/queue";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const notebookId = request.nextUrl.searchParams.get("notebookId");
    if (!notebookId) {
      return NextResponse.json({ error: "notebookId required" }, { status: 400 });
    }

    const [latest] = await db
      .select()
      .from(outputs)
      .where(
        and(eq(outputs.notebookId, notebookId), eq(outputs.type, "podcast"))
      )
      .orderBy(desc(outputs.createdAt))
      .limit(1);

    return NextResponse.json(latest ?? null);
  } catch (error) {
    console.error("Failed to fetch podcast:", error);
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
      type: "podcast",
      title: `Audio Overview: ${ctx.notebookTitle}`,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Enqueue generation job
    try {
      const queue = getDocumentQueue();
      await queue.add(`podcast-${outputId}`, {
        type: "podcast",
        notebookId,
        outputId,
      });
    } catch {
      // Queue unavailable — generation will need to be triggered manually
      console.warn("Queue unavailable for podcast generation");
    }

    return NextResponse.json({ id: outputId, status: "pending" }, { status: 201 });
  } catch (error) {
    console.error("Podcast creation failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};
