import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { sources, sourceChunks } from "../db/schema/sources";
import { parseDocument } from "../lib/processing/parsers";
import { chunkText, estimateTokenCount } from "../lib/processing/chunker";
import { generateEmbeddings } from "../lib/ai/embeddings";
import { downloadFile } from "../lib/storage/r2";
import type { DocumentJobData } from "../lib/queue";

// Direct DB connection (worker runs standalone, not via Next.js)
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const updateSourceStatus = async (
  sourceId: string,
  status: "processing" | "ready" | "error",
  extra: Record<string, unknown> = {}
): Promise<void> => {
  await db
    .update(sources)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(sources.id, sourceId));
};

const processDocument = async (job: Job<DocumentJobData>): Promise<void> => {
  const { sourceId, fileKey, sourceType, filename } = job.data;

  console.log(`[Worker] Processing source ${sourceId} (${filename})`);

  try {
    // Step 1: Update status to processing
    await updateSourceStatus(sourceId, "processing");

    // Step 2: Download file
    let buffer: Buffer;
    try {
      buffer = await downloadFile(fileKey);
    } catch {
      // If R2 is not configured, check for local file data in metadata
      const [source] = await db
        .select()
        .from(sources)
        .where(eq(sources.id, sourceId));
      if (source?.metadata && typeof source.metadata === "object" && "localBuffer" in source.metadata) {
        buffer = Buffer.from(source.metadata.localBuffer as string, "base64");
      } else {
        throw new Error("Failed to download file and no local fallback available");
      }
    }

    console.log(`[Worker] Downloaded ${buffer.length} bytes for ${filename}`);

    // Step 3: Parse document
    const parseResult = await parseDocument(buffer, sourceType);
    const rawText = parseResult.text;

    if (!rawText.trim()) {
      throw new Error("Document produced no text content");
    }

    const tokenCount = estimateTokenCount(rawText);
    console.log(`[Worker] Parsed ${tokenCount} tokens from ${filename}`);

    // Step 4: Update source with raw text
    await db
      .update(sources)
      .set({
        rawText,
        tokenCount,
        metadata: parseResult.metadata ?? {},
        updatedAt: new Date(),
      })
      .where(eq(sources.id, sourceId));

    // Step 5: Chunk the text
    const chunks = chunkText(rawText);
    console.log(`[Worker] Created ${chunks.length} chunks from ${filename}`);

    if (chunks.length === 0) {
      await updateSourceStatus(sourceId, "ready");
      return;
    }

    // Step 6: Generate embeddings
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(chunkTexts);
    console.log(`[Worker] Generated ${embeddings.length} embeddings for ${filename}`);

    // Step 7: Store chunks with embeddings
    const chunkRecords = chunks.map((chunk, i) => ({
      id: createId(),
      sourceId,
      content: chunk.content,
      embedding: embeddings[i],
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      metadata: chunk.metadata,
      createdAt: new Date(),
    }));

    // Insert in batches of 50 to avoid query size limits
    for (let i = 0; i < chunkRecords.length; i += 50) {
      const batch = chunkRecords.slice(i, i + 50);
      await db.insert(sourceChunks).values(batch);
    }

    // Step 8: Mark as ready
    await updateSourceStatus(sourceId, "ready");
    console.log(`[Worker] Source ${sourceId} (${filename}) processing complete`);
  } catch (error) {
    console.error(`[Worker] Failed to process source ${sourceId}:`, error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await updateSourceStatus(sourceId, "error", {
      metadata: { error: errorMessage },
    });
    throw error; // Re-throw so BullMQ handles retries
  }
};

const worker = new Worker<DocumentJobData>(
  "document-processing",
  processDocument,
  {
    connection,
    concurrency: 3,
  }
);

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed for source ${job.data.sourceId}`);
});

worker.on("failed", (job, error) => {
  console.error(
    `[Worker] Job ${job?.id} failed for source ${job?.data.sourceId}:`,
    error.message
  );
});

worker.on("ready", () => {
  console.log("[Worker] Document processing worker is ready");
});

console.log("[Worker] Starting document processing worker...");
