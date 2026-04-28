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
import type {
  DocumentJobData,
  PodcastJobData,
  QueueJobData,
  VideoJobData,
} from "../lib/queue";

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

    // Download file — downloadFile transparently handles both R2 (when
    // configured) and the local public/uploads/ fallback. No base64 fallback
    // needed: we no longer stuff file bytes into the DB metadata column.
    const buffer: Buffer = await downloadFile(fileKey);

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

/** Describe a job in logs without assuming its shape. */
const describeJob = (data: QueueJobData): string => {
  if ("type" in data && data.type === "video") return `video ${data.outputId}`;
  if ("type" in data && data.type === "podcast")
    return `podcast ${data.outputId}`;
  return `source ${(data as DocumentJobData).sourceId}`;
};

/** Per-job hard deadlines. Keeps stuck upstreams from pinning a worker
 *  slot indefinitely; BullMQ's default lockDuration (30s) is way too short
 *  for media work, so we set a generous deadline at the application layer.
 *
 *  Document: parsing + embeddings ~ minutes for big PDFs.
 *  Video:    LLM script + N×fal images + N×TTS — 6–7 minutes typical.
 *  Podcast:  LLM script + 15–25 ElevenLabs synth calls — 4–5 min typical. */
const JOB_DEADLINES: Record<string, number> = {
  document: 8 * 60_000,
  video: 9 * 60_000,
  podcast: 6 * 60_000,
};

const dispatchJob = async (job: Job<QueueJobData>): Promise<void> => {
  const data = job.data;
  if ("type" in data && data.type === "video") {
    const v = data as VideoJobData;
    console.log(`[Worker] Processing video ${v.outputId}`);
    const { generateVideo } = await import("../lib/video/generate-video");
    type VideoStyle = Parameters<typeof generateVideo>[2] extends infer O
      ? O extends { style?: infer S }
        ? S
        : never
      : never;
    type VideoDetail = Parameters<typeof generateVideo>[2] extends infer O
      ? O extends { detailLevel?: infer D }
        ? D
        : never
      : never;
    await generateVideo(v.notebookId, v.outputId, {
      language: v.language,
      style: v.style as VideoStyle,
      detailLevel: v.detailLevel as VideoDetail,
      customPrompt: v.customPrompt,
      extraSourceContent: v.extraSourceContent,
    });
    return;
  }
  if ("type" in data && data.type === "podcast") {
    const p = data as PodcastJobData;
    console.log(`[Worker] Processing podcast ${p.outputId}`);
    const { generatePodcast } = await import("../lib/podcast/generate-podcast");
    await generatePodcast(p.notebookId, p.outputId, p.language ?? "en");
    return;
  }
  await processDocument(job as Job<DocumentJobData>);
};

const processJob = async (job: Job<QueueJobData>): Promise<void> => {
  const kind =
    "type" in job.data && job.data.type ? job.data.type : "document";
  const deadlineMs = JOB_DEADLINES[kind] ?? 8 * 60_000;
  const { withDeadline } = await import("../lib/utils/fetch-timeout");
  await withDeadline(dispatchJob(job), deadlineMs, `${kind} job ${job.id}`);
};

const worker = new Worker<QueueJobData>(
  "document-processing",
  processJob,
  {
    connection,
    concurrency: 3,
    // BullMQ default lockDuration is 30s — far too short for AI work.
    // The application-layer deadline above is the real ceiling; lockDuration
    // just keeps a worker holding the lock between Redis renewals (every
    // lockRenewTime = lockDuration / 2 = 60s here). 2 minutes is safe even
    // when the event loop is briefly busy with sharp/ffmpeg work.
    lockDuration: 120_000,
    stalledInterval: 60_000,
  },
);

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed for ${describeJob(job.data)}`);
});

worker.on("failed", (job, error) => {
  console.error(
    `[Worker] Job ${job?.id} failed for ${job ? describeJob(job.data) : "?"}:`,
    error.message,
  );
});

worker.on("ready", () => {
  console.log("[Worker] Queue worker ready (document / video / podcast)");
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
