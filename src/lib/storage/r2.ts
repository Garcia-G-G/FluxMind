import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

const BUCKET = process.env.R2_BUCKET_NAME ?? "fluxmind";
const PUBLIC_URL = process.env.R2_PUBLIC_URL ?? "";

export const uploadFile = async (
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> => {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return getFileUrl(key);
};

export const deleteFile = async (key: string): Promise<void> => {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
};

export const downloadFile = async (key: string): Promise<Buffer> => {
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
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
  if (PUBLIC_URL) return `${PUBLIC_URL}/${key}`;
  return `https://${BUCKET}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
};

export const getStorageKey = (
  notebookId: string,
  sourceId: string,
  filename: string
): string => {
  return `notebooks/${notebookId}/sources/${sourceId}/${filename}`;
};
