import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sources } from "@/db/schema/sources";
import { notebooks } from "@/db/schema/notebooks";
import { uploadFile, getStorageKey } from "@/lib/storage/r2";
import { validateFile } from "@/lib/processing/parsers";
import { getDocumentQueue, type DocumentJobData } from "@/lib/queue";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await checkRateLimit({
      userId: session.user.id,
      bucket: "upload",
      ...RATE_LIMITS.uploadFile,
    });
    if (limited) return limited;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const notebookId = formData.get("notebookId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!notebookId) {
      return NextResponse.json(
        { error: "notebookId is required" },
        { status: 400 }
      );
    }

    // Verify notebook ownership
    const [notebook] = await db
      .select({ userId: notebooks.userId })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));

    if (!notebook || notebook.userId !== session.user.id) {
      return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
    }

    // Validate file
    const validation = validateFile({
      size: file.size,
      type: file.type,
      name: file.name,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const sourceId = createId();
    const sourceType = validation.sourceType!;
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileKey = getStorageKey(notebookId, sourceId, file.name);

    // Upload via the storage helper — it transparently falls back to local
    // disk (public/uploads/) when R2 isn't configured. Never store the raw
    // bytes inside Postgres: it bloats rows and breaks large PDFs.
    const fileUrl = await uploadFile(buffer, fileKey, file.type);

    // Create source record
    const now = new Date();
    const [source] = await db
      .insert(sources)
      .values({
        id: sourceId,
        notebookId,
        type: sourceType as "pdf" | "docx" | "txt" | "csv" | "image" | "url" | "youtube",
        title: file.name,
        fileUrl,
        status: "pending",
        metadata: {},
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Enqueue processing job
    const jobData: DocumentJobData = {
      sourceId,
      notebookId,
      fileKey,
      sourceType,
      filename: file.name,
    };

    try {
      const queue = getDocumentQueue();
      await queue.add(`process-${sourceId}`, jobData);
    } catch (queueError) {
      // If the queue is down we can't process — surface it as an errored
      // source so the UI shows something actionable instead of a forever-
      // pending row. Old behavior just logged a warning.
      console.error("Queue unavailable — marking source errored:", queueError);
      await db
        .update(sources)
        .set({
          status: "error",
          metadata: {
            error:
              queueError instanceof Error
                ? queueError.message
                : "Queue unavailable",
          },
          updatedAt: new Date(),
        })
        .where(eq(sources.id, sourceId));
      return NextResponse.json(
        { ...source, status: "error", error: "Queue unavailable" },
        { status: 201 },
      );
    }

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
};
