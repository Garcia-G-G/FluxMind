import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { notebooks } from "@/db/schema/notebooks";
import { getStudioContext, isError } from "@/lib/studio/generate";
import { getDocumentQueue } from "@/lib/queue";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notebookId = request.nextUrl.searchParams.get("notebookId");
    if (!notebookId) {
      return NextResponse.json({ error: "notebookId required" }, { status: 400 });
    }

    // Verify ownership — notebookId alone is not a capability.
    const [notebook] = await db
      .select({ userId: notebooks.userId })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));
    if (!notebook || notebook.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    const language: "en" | "es" = body?.language === "es" ? "es" : "en";

    const ctx = await getStudioContext(notebookId, undefined, "studioPodcast");
    if (isError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const outputId = createId();
    const title =
      language === "es"
        ? `Resumen en audio: ${ctx.notebookTitle}`
        : `Audio Overview: ${ctx.notebookTitle}`;
    await db.insert(outputs).values({
      id: outputId,
      notebookId,
      userId: ctx.userId,
      type: "podcast",
      title,
      status: "pending",
      content: { language },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Enqueue generation job — worker reads `language` from job data so the
    // pipeline picks Spanish summary/script/voices when the user toggled ES.
    try {
      const queue = getDocumentQueue();
      await queue.add(`podcast-${outputId}`, {
        type: "podcast",
        notebookId,
        outputId,
        language,
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
