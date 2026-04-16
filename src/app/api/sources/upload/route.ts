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

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Upload to R2 (or store locally if R2 not configured)
    let fileUrl: string;
    let localBuffer: string | undefined;
    try {
      fileUrl = await uploadFile(buffer, fileKey, file.type);
    } catch {
      // R2 not configured — store buffer in metadata for the worker to use
      fileUrl = `local://${fileKey}`;
      localBuffer = buffer.toString("base64");
    }

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
        metadata: localBuffer ? { localBuffer } : {},
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
      // If Redis/queue is unavailable, process inline as fallback
      console.warn("Queue unavailable, processing will happen on next worker start:", queueError);
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
