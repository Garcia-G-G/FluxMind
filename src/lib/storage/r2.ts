/**
 * Storage module — uses Cloudflare R2 when configured, otherwise falls back
 * to local disk under `public/uploads/` (served by Next at `/uploads/*`).
 *
 * Production: set R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY
 *             (and optionally R2_PUBLIC_URL / R2_BUCKET_NAME).
 * Local dev:  leave R2_* empty — files are written to public/uploads/ and
 *             served directly via Next.js static file handling.
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { promises as fs } from "fs";
import path from "path";

const BUCKET = process.env.R2_BUCKET_NAME ?? "fluxmind";
const PUBLIC_URL = process.env.R2_PUBLIC_URL ?? "";

const hasR2Config = (): boolean =>
  !!process.env.R2_ACCOUNT_ID &&
  !!process.env.R2_ACCESS_KEY_ID &&
  !!process.env.R2_SECRET_ACCESS_KEY;

const LOCAL_ROOT = path.join(process.cwd(), "public", "uploads");
const LOCAL_URL_PREFIX = "/uploads";

let r2Client: S3Client | null = null;
const getR2Client = (): S3Client => {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return r2Client;
};

const localPath = (key: string): string => path.join(LOCAL_ROOT, key);

export const uploadFile = async (
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> => {
  if (!hasR2Config()) {
    const full = localPath(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer);
    return `${LOCAL_URL_PREFIX}/${key}`;
  }

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return getFileUrl(key);
};

export const deleteFile = async (key: string): Promise<void> => {
  if (!hasR2Config()) {
    await fs.unlink(localPath(key)).catch(() => {
      // ignore missing file
    });
    return;
  }

  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: BUCKET, Key: key }),
  );
};

export const downloadFile = async (key: string): Promise<Buffer> => {
  if (!hasR2Config()) {
    return fs.readFile(localPath(key));
  }

  const response = await getR2Client().send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
  );
  const stream = response.Body;
  if (!stream) throw new Error("Empty response body");
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

export const getFileUrl = (key: string): string => {
  if (!hasR2Config()) return `${LOCAL_URL_PREFIX}/${key}`;
  if (PUBLIC_URL) return `${PUBLIC_URL}/${key}`;
  return `https://${BUCKET}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
};

export const getStorageKey = (
  notebookId: string,
  sourceId: string,
  filename: string,
): string => {
  return `notebooks/${notebookId}/sources/${sourceId}/${filename}`;
};
