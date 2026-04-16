import { Queue } from "bullmq";
import IORedis from "ioredis";

const getRedisConnection = (): IORedis => {
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
};

let _connection: IORedis | null = null;

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
