import { Queue } from "bullmq";
import IORedis from "ioredis";

/**
 * Singleton IORedis connection shared between BullMQ and the rate limiter.
 * Previously had no error listener — any Redis outage surfaced as an
 * unhandled event and the process would silently run with a stale socket.
 * Now: we attach an error handler, and if the connection is flagged as
 * permanently dead we drop the singleton so the next caller builds a fresh
 * one. IORedis itself handles reconnection on transient failures.
 */

let _connection: IORedis | null = null;

const wireConnection = (conn: IORedis): IORedis => {
  conn.on("error", (err) => {
    console.error("[redis] connection error:", err.message);
  });
  conn.on("end", () => {
    console.warn("[redis] connection ended — next caller will reconnect");
    // Drop the singleton so the next getConnection() creates a fresh client.
    if (_connection === conn) _connection = null;
    if (_documentQueue) _documentQueue = null;
  });
  return conn;
};

const getRedisConnection = (): IORedis => {
  const conn = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times) => {
      // Exponential-ish backoff, capped at 10s. Returning null would stop
      // trying — we always want to retry until the process exits.
      return Math.min(times * 200, 10_000);
    },
  });
  return wireConnection(conn);
};

export const getConnection = (): IORedis => {
  if (!_connection) {
    _connection = getRedisConnection();
  }
  return _connection;
};

let _documentQueue: Queue | null = null;

export const getDocumentQueue = (): Queue => {
  if (!_documentQueue) {
    _documentQueue = new Queue("document-processing", {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return _documentQueue;
};

export type DocumentJobData = {
  sourceId: string;
  notebookId: string;
  fileKey: string;
  sourceType: string;
  filename: string;
};
