import { google } from "googleapis";
import { db, gdriveSettingsTable, incidentAttachmentsTable } from "@workspace/db";
import { and, eq, gte, lt, count } from "drizzle-orm";
import { logger } from "./logger";

const INDONESIAN_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  key = key.replace(/\\n/g, "\n");
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

async function getGdriveSettings() {
  const [settings] = await db.select().from(gdriveSettingsTable);
  if (!settings || !settings.privateKey || !settings.clientEmail) {
    throw new Error("Google Drive belum dikonfigurasi. Silakan isi pengaturan GDrive terlebih dahulu.");
  }
  return settings;
}

async function getGdriveAuth() {
  const settings = await getGdriveSettings();
  const privateKey = normalizePrivateKey(settings.privateKey);

  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      client_email: settings.clientEmail,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return { auth, rootFolderId: settings.rootFolderId };
}

async function getOrCreateFolder(drive: ReturnType<typeof google.drive>, parentId: string, name: string): Promise<string> {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }
  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
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
    .where(
      and(
        gte(incidentAttachmentsTable.uploadedAt, startOfMonth),
        lt(incidentAttachmentsTable.uploadedAt, startOfNextMonth)
      )
    );
  return (result?.total ?? 0) + 1;
}

export async function uploadToDrive(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  incidentId: number,
  uploadedById: number | null,
): Promise<{
  driveFileId: string;
  storedName: string;
  viewUrl: string;
  sequence: number;
}> {
  const { auth, rootFolderId } = await getGdriveAuth();
  const drive = google.drive({ version: "v3", auth });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = String(now.getDate()).padStart(2, "0");
  const monthStr = String(month).padStart(2, "0");

  logger.info({ rootFolderId, year, month }, "Creating/finding year folder on GDrive");
  const yearFolder = await getOrCreateFolder(drive, rootFolderId, String(year));
  const monthFolderName = `${monthStr} - ${INDONESIAN_MONTHS[month - 1]}`;
  logger.info({ yearFolder, monthFolderName }, "Creating/finding month folder on GDrive");
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
    requestBody: {
      name: storedName,
      parents: [monthFolder],
    },
    media: {
      mimeType,
      body: stream,
    },
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
    const { auth } = await getGdriveAuth();
    const drive = google.drive({ version: "v3", auth });
    await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true });
    logger.info({ driveFileId }, "File deleted from Google Drive");
  } catch (err) {
    logger.warn({ err, driveFileId }, "Failed to delete file from Google Drive");
  }
}

export async function getGdriveConfigured(): Promise<boolean> {
  const [s] = await db.select({ pk: gdriveSettingsTable.privateKey }).from(gdriveSettingsTable);
  return !!(s?.pk);
}
