import { google } from "googleapis";
import { createPrivateKey, sign as cryptoSign } from "node:crypto";
import { db, gdriveSettingsTable, incidentAttachmentsTable } from "@workspace/db";
import { and, eq, gte, lt, count } from "drizzle-orm";
import { logger } from "./logger";

const INDONESIAN_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function normalizePrivateKey(raw: string): string {
  let key = raw.trim()
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\n/g, "\n");

  if (!key.includes("\n") && key.includes("-----")) {
    const begin = "-----BEGIN PRIVATE KEY-----";
    const end = "-----END PRIVATE KEY-----";
    const bi = key.indexOf(begin);
    const ei = key.indexOf(end);
    if (bi !== -1 && ei !== -1) {
      const body = key.slice(bi + begin.length, ei).replace(/\s+/g, "");
      const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
      key = `${begin}\n${wrapped}\n${end}\n`;
    }
  }
  return key;
}

/**
 * Signs a JWT using RSA-SHA256.
 * Bypasses OpenSSL 3 PEM decoder issues by extracting the DER binary from the
 * PEM base64 body and passing it directly to createPrivateKey({ format: "der" }).
 * This avoids the "DECODER routines::unsupported" error in Node.js 24 / OpenSSL 3.
 */
function signJwt(payload: object, pemPrivateKey: string): string {
  // Extract base64 body, decode to DER binary — no PEM decoder involved
  const pemBody = pemPrivateKey
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s/g, "");
  const derBuffer = Buffer.from(pemBody, "base64");

  let keyObject: ReturnType<typeof createPrivateKey>;
  try {
    keyObject = createPrivateKey({ key: derBuffer, format: "der", type: "pkcs8" });
  } catch (e: any) {
    throw new Error(
      `Private key tidak dapat diparse: ${e.message}. ` +
      "Pastikan private_key dari file JSON service account sudah disalin lengkap dan benar.",
    );
  }

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const toSign = `${header}.${claim}`;

  const sig = cryptoSign("RSA-SHA256", Buffer.from(toSign), keyObject).toString("base64url");
  return `${toSign}.${sig}`;
}

async function getAccessToken(clientEmail: string, rawPrivateKey: string): Promise<string> {
  const privateKey = normalizePrivateKey(rawPrivateKey);
  const now = Math.floor(Date.now() / 1000);

  const jwt = signJwt({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }, privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gagal mendapatkan token Google Drive: ${body}`);
  }

  const data = await res.json() as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`Token tidak diterima: ${data.error_description ?? data.error ?? JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function getGdriveSettings() {
  const [settings] = await db.select().from(gdriveSettingsTable);
  if (!settings || !settings.privateKey || !settings.clientEmail) {
    throw new Error("Google Drive belum dikonfigurasi. Silakan isi pengaturan GDrive di Pengaturan → Google Drive.");
  }
  return settings;
}

async function getGdriveClient() {
  const settings = await getGdriveSettings();
  const accessToken = await getAccessToken(settings.clientEmail, settings.privateKey);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return { drive: google.drive({ version: "v3", auth }), rootFolderId: settings.rootFolderId };
}

async function getOrCreateFolder(drive: ReturnType<typeof google.drive>, parentId: string, name: string): Promise<string> {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  if (res.data.files && res.data.files.length > 0) return res.data.files[0].id!;

  const folder = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
    supportsAllDrives: true,
  });
  return folder.data.id!;
}

async function getNextMonthlySequence(year: number, month: number): Promise<number> {
  const startOfMonth = new Date(year, month - 1, 1);
  const startOfNextMonth = new Date(year, month, 1);
  const [result] = await db
    .select({ total: count() })
    .from(incidentAttachmentsTable)
    .where(and(
      gte(incidentAttachmentsTable.uploadedAt, startOfMonth),
      lt(incidentAttachmentsTable.uploadedAt, startOfNextMonth),
    ));
  return (result?.total ?? 0) + 1;
}

export async function uploadToDrive(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  incidentId: number,
  uploadedById: number | null,
): Promise<{ driveFileId: string; storedName: string; viewUrl: string; sequence: number }> {
  const { drive, rootFolderId } = await getGdriveClient();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = String(now.getDate()).padStart(2, "0");
  const monthStr = String(month).padStart(2, "0");

  logger.info({ rootFolderId, year, month }, "Creating/finding year folder on GDrive");
  const yearFolder = await getOrCreateFolder(drive, rootFolderId, String(year));
  const monthFolderName = `${monthStr} - ${INDONESIAN_MONTHS[month - 1]}`;
  const monthFolder = await getOrCreateFolder(drive, yearFolder, monthFolderName);

  const sequence = await getNextMonthlySequence(year, month);
  const seqStr = String(sequence).padStart(5, "0");
  const ext = originalName.includes(".") ? originalName.split(".").pop()! : "bin";
  const storedName = `${incidentId}-${year}-${monthStr}-${day}-${seqStr}.${ext}`;

  const { Readable } = await import("stream");
  const stream = new Readable();
  stream.push(fileBuffer);
  stream.push(null);

  logger.info({ storedName, monthFolder }, "Uploading file to GDrive");
  const uploaded = await drive.files.create({
    requestBody: { name: storedName, parents: [monthFolder] },
    media: { mimeType, body: stream },
    fields: "id,webViewLink",
    supportsAllDrives: true,
  });

  const fileId = uploaded.data.id!;
  const webViewLink = uploaded.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
    supportsAllDrives: true,
  });

  logger.info({ fileId, storedName, incidentId }, "File uploaded to Google Drive");
  return { driveFileId: fileId, storedName, viewUrl: webViewLink, sequence };
}

export async function deleteFromDrive(driveFileId: string): Promise<void> {
  try {
    const { drive } = await getGdriveClient();
    await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true });
    logger.info({ driveFileId }, "File deleted from Google Drive");
  } catch (err) {
    logger.warn({ err, driveFileId }, "Failed to delete from Google Drive");
  }
}

export async function getGdriveConfigured(): Promise<boolean> {
  const [s] = await db.select({ pk: gdriveSettingsTable.privateKey }).from(gdriveSettingsTable);
  return !!(s?.pk);
}

/**
 * Simple upload for general files (QRIS images, payment proofs, etc.)
 * Uploads to the root GDrive folder directly without date-based folder structure.
 */
export async function uploadToGdrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ fileId: string; viewUrl: string }> {
  const { drive, rootFolderId } = await getGdriveClient();
  const { Readable } = await import("stream");
  const stream = new Readable();
  stream.push(fileBuffer);
  stream.push(null);

  const uploaded = await drive.files.create({
    requestBody: { name: fileName, parents: [rootFolderId] },
    media: { mimeType, body: stream },
    fields: "id,webViewLink",
    supportsAllDrives: true,
  });

  const fileId = uploaded.data.id!;
  const viewUrl = uploaded.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
    supportsAllDrives: true,
  });

  logger.info({ fileId, fileName }, "General file uploaded to Google Drive");
  return { fileId, viewUrl };
}
