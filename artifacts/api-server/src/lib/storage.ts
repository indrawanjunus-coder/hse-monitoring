import { Storage } from "@google-cloud/storage";
import { logger } from "./logger";

const storage = new Storage(); // Replit sidecar auth — no credentials needed
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";

export async function uploadToStorage(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  incidentId: number,
): Promise<{ objectPath: string }> {
  if (!BUCKET_ID) throw new Error("Object storage belum dikonfigurasi (DEFAULT_OBJECT_STORAGE_BUCKET_ID kosong).");

  const ext = originalName.split(".").pop()?.toLowerCase() || "bin";
  const rand = Math.random().toString(36).slice(2, 8);
  const objectPath = `attachments/${incidentId}/${Date.now()}-${rand}.${ext}`;

  const bucket = storage.bucket(BUCKET_ID);
  const file = bucket.file(objectPath);

  await file.save(fileBuffer, { metadata: { contentType: mimeType } });
  logger.info({ objectPath, incidentId, mimeType }, "File uploaded to Object Storage");

  return { objectPath };
}

export async function downloadFromStorage(objectPath: string): Promise<{ stream: NodeJS.ReadableStream; contentType: string }> {
  if (!BUCKET_ID) throw new Error("Object storage belum dikonfigurasi.");

  const file = storage.bucket(BUCKET_ID).file(objectPath);
  const [metadata] = await file.getMetadata();
  const contentType = (metadata.contentType as string) || "application/octet-stream";
  const stream = file.createReadStream();

  return { stream, contentType };
}

export async function deleteFromStorage(objectPath: string): Promise<void> {
  if (!BUCKET_ID) return;
  try {
    await storage.bucket(BUCKET_ID).file(objectPath).delete();
    logger.info({ objectPath }, "File deleted from Object Storage");
  } catch (err) {
    logger.warn({ err, objectPath }, "Failed to delete file from Object Storage");
  }
}
