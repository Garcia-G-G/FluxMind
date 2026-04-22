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
    const {
      notebookId,
      language: rawLanguage = "en",
      style: rawStyle = "auto",
      detailLevel: rawDetail = "standard",
      customPrompt: rawCustom = "",
      selectedSourceIds: rawSelectedSourceIds,
      extraSourceContent: rawExtraSourceContent,
    } = body as {
      notebookId: string;
      language?: string;
      style?: string;
      detailLevel?: string;
      customPrompt?: string;
      selectedSourceIds?: string[];
      extraSourceContent?: string;
    };
    const selectedSourceIds: string[] = Array.isArray(rawSelectedSourceIds)
      ? rawSelectedSourceIds.filter((s): s is string => typeof s === "string")
      : [];
    const extraSourceContent: string =
      typeof rawExtraSourceContent === "string"
        ? rawExtraSourceContent.slice(0, 80_000)
        : "";
    const language: "en" | "es" = rawLanguage === "es" ? "es" : "en";
    const ALLOWED_STYLES = [
      "auto",
      "sketch",
      "kawaii",
      "professional",
      "scientific",
      "minimalist",
    ] as const;
    const style: (typeof ALLOWED_STYLES)[number] =
      ALLOWED_STYLES.includes(rawStyle as (typeof ALLOWED_STYLES)[number])
        ? (rawStyle as (typeof ALLOWED_STYLES)[number])
        : "auto";
    const ALLOWED_DETAIL = ["concise", "standard", "detailed"] as const;
    const detailLevel: (typeof ALLOWED_DETAIL)[number] =
      ALLOWED_DETAIL.includes(rawDetail as (typeof ALLOWED_DETAIL)[number])
        ? (rawDetail as (typeof ALLOWED_DETAIL)[number])
        : "standard";
    const customPrompt = typeof rawCustom === "string" ? rawCustom : "";

    const ctx = await getStudioContext(
      notebookId,
      selectedSourceIds,
      "studioVideo",
    );
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

    // Enqueue via BullMQ instead of a fire-and-forget Promise. On serverless
    // runtimes, the route process dies after the response returns — a
    // detached promise would leave the output row stuck "pending" forever.
    // The worker (src/workers/document-processor.ts) picks up the job and
    // runs the full pipeline with retries.
    try {
      const queue = getDocumentQueue();
      await queue.add(`video-${outputId}`, {
        type: "video",
        notebookId,
        outputId,
        language,
        style,
        detailLevel,
        customPrompt,
        extraSourceContent,
      });
    } catch (queueErr) {
      console.error("Failed to enqueue video job:", queueErr);
      await db
        .update(outputs)
        .set({
          status: "error",
          content: { error: "Queue unavailable — try again later" },
          updatedAt: new Date(),
        })
        .where(eq(outputs.id, outputId));
      return NextResponse.json(
        { error: "Queue unavailable" },
        { status: 503 },
      );
    }

    return NextResponse.json({ id: outputId, status: "pending" }, { status: 201 });
  } catch (error) {
    console.error("Video creation failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};
