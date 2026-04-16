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
const client = postgres(connectionString, { max: 5 });
const db = drizzle(client);

const connection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null }
);

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
    await updateSourceStatus(sourceId, "processing");

    // Download file — try R2 first, fall back to base64 in metadata
    let buffer: Buffer;
    try {
      buffer = await downloadFile(fileKey);
    } catch (downloadError) {
      console.warn(`[Worker] R2 download failed, trying local fallback:`, downloadError instanceof Error ? downloadError.message : downloadError);
      const [source] = await db
        .select({ metadata: sources.metadata })
        .from(sources)
        .where(eq(sources.id, sourceId));
      if (
        source?.metadata &&
        typeof source.metadata === "object" &&
        "localBuffer" in source.metadata
      ) {
        buffer = Buffer.from(
          source.metadata.localBuffer as string,
          "base64"
        );
      } else {
        throw new Error(
          "File not accessible: R2 not configured and no local fallback"
        );
      }
    }

    console.log(`[Worker] Downloaded ${buffer.length} bytes for ${filename}`);

    // Parse document
    const parseResult = await parseDocument(buffer, sourceType);
    const rawText = parseResult.text;

    if (!rawText.trim()) {
      throw new Error("Document produced no text content");
    }

    const tokenCount = estimateTokenCount(rawText);
    console.log(`[Worker] Parsed ${tokenCount} tokens from ${filename}`);

    // Update source with raw text — also clear localBuffer from metadata
    await db
      .update(sources)
      .set({
        rawText,
        tokenCount,
        metadata: parseResult.metadata ?? {},
        updatedAt: new Date(),
      })
      .where(eq(sources.id, sourceId));

    // Chunk the text
    const chunks = chunkText(rawText);
    console.log(`[Worker] Created ${chunks.length} chunks from ${filename}`);

    if (chunks.length === 0) {
      await updateSourceStatus(sourceId, "ready");
      return;
    }

    // Generate embeddings in batches with error recovery
    const chunkTexts = chunks.map((c) => c.content);
    let embeddings: number[][];
    try {
      embeddings = await generateEmbeddings(chunkTexts);
    } catch (embeddingError) {
      console.error(`[Worker] Batch embedding failed, retrying individually...`, embeddingError);
      // Fall back to individual embedding generation
      const { generateEmbedding } = await import("../lib/ai/embeddings");
      embeddings = [];
      for (const text of chunkTexts) {
        try {
          embeddings.push(await generateEmbedding(text));
        } catch {
          // Use zero vector as placeholder for failed embeddings
          embeddings.push(new Array(1536).fill(0));
        }
      }
    }

    console.log(
      `[Worker] Generated ${embeddings.length} embeddings for ${filename}`
    );

    // Store chunks with embeddings in batches
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

    for (let i = 0; i < chunkRecords.length; i += 50) {
      const batch = chunkRecords.slice(i, i + 50);
      await db.insert(sourceChunks).values(batch);
    }

    await updateSourceStatus(sourceId, "ready");
    console.log(
      `[Worker] Source ${sourceId} (${filename}) processing complete`
    );
  } catch (error) {
    console.error(`[Worker] Failed to process source ${sourceId}:`, error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await updateSourceStatus(sourceId, "error", {
      metadata: { error: errorMessage },
    });
    throw error;
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
  console.log(
    `[Worker] Job ${job.id} completed for source ${job.data.sourceId}`
  );
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

// Graceful shutdown
const shutdown = async (): Promise<void> => {
  console.log("[Worker] Shutting down...");
  await worker.close();
  connection.disconnect();
  await client.end();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("[Worker] Starting document processing worker...");
