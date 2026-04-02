import { google } from "googleapis";
import { db, gdriveSettingsTable, incidentAttachmentsTable } from "@workspace/db";
import { and, eq, gte, lt, count } from "drizzle-orm";
import { logger } from "./logger";

const INDONESIAN_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

async function getGdriveAuth() {
  const [settings] = await db.select().from(gdriveSettingsTable);
  if (!settings || !settings.privateKey || !settings.clientEmail) {
    throw new Error("Google Drive belum dikonfigurasi. Silakan isi pengaturan GDrive terlebih dahulu.");
  }
  const auth = new google.auth.JWT({
    email: settings.clientEmail,
    key: settings.privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return { auth, rootFolderId: settings.rootFolderId };
}

async function getOrCreateFolder(drive: ReturnType<typeof google.drive>, parentId: string, name: string): Promise<string> {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name)",
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
  });

  const fileId = uploaded.data.id!;
  const webViewLink = uploaded.data.webViewLink!;

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  logger.info({ fileId, storedName, incidentId }, "File uploaded to Google Drive");
  return { driveFileId: fileId, storedName, viewUrl: webViewLink, sequence };
}

export async function deleteFromDrive(driveFileId: string): Promise<void> {
  try {
    const { auth } = await getGdriveAuth();
    const drive = google.drive({ version: "v3", auth });
    await drive.files.delete({ fileId: driveFileId });
    logger.info({ driveFileId }, "File deleted from Google Drive");
  } catch (err) {
    logger.warn({ err, driveFileId }, "Failed to delete file from Google Drive");
  }
}

export async function getGdriveConfigured(): Promise<boolean> {
  const [s] = await db.select({ pk: gdriveSettingsTable.privateKey }).from(gdriveSettingsTable);
  return !!(s?.pk);
}
