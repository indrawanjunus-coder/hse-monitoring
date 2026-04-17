import { Router } from "express";
import multer from "multer";
import { db, incidentAttachmentsTable, incidentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { uploadToDrive, deleteFromDrive } from "../lib/gdrive";
import { authMiddleware } from "../lib/auth";
import { logger } from "../lib/logger";

// [SECURITY H10-H12] Verify that an incident belongs to the caller's company.
// Returns the incident row or sends 403/404 and returns null.
async function requireOwnedIncident(incidentId: number, req: Parameters<typeof authMiddleware>[0], res: any): Promise<typeof incidentsTable.$inferSelect | null> {
  const [incident] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, incidentId));
  if (!incident) { res.status(404).json({ error: "Incident tidak ditemukan" }); return null; }
  const user = req.user!;
  if (user.role !== "sysadmin" && user.companyId && incident.companyId !== user.companyId) {
    res.status(403).json({ error: "Akses ditolak" }); return null;
  }
  return incident;
}

const router = Router();
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file foto (JPG/PNG/WEBP) atau PDF yang diizinkan") as any);
    }
  },
});

router.get("/", async (req, res) => {
  const incidentId = Number(req.query.incidentId);
  if (!incidentId) { res.status(400).json({ error: "incidentId diperlukan" }); return; }
  // [SECURITY H10] Verify incident belongs to caller's company before listing attachments
  if (!await requireOwnedIncident(incidentId, req, res)) return;
  const rows = await db
    .select()
    .from(incidentAttachmentsTable)
    .where(eq(incidentAttachmentsTable.incidentId, incidentId))
    .orderBy(incidentAttachmentsTable.uploadedAt);
  res.json(rows);
});

router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "File tidak ditemukan" }); return; }
  const incidentId = Number(req.body.incidentId);
  if (!incidentId) { res.status(400).json({ error: "incidentId diperlukan" }); return; }
  // [SECURITY H11] Verify incident belongs to caller's company before uploading attachment
  if (!await requireOwnedIncident(incidentId, req, res)) return;
  const userId = req.user?.id ?? null;

  try {
    const { driveFileId, storedName, viewUrl, sequence } = await uploadToDrive(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      incidentId,
      userId,
    );

    const [saved] = await db.insert(incidentAttachmentsTable).values({
      incidentId,
      driveFileId,
      fileName: req.file.originalname,
      storedName,
      viewUrl,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      sequence,
      uploadedById: userId,
    }).returning();

    res.json({ success: true, attachment: saved });
  } catch (err: any) {
    logger.error({ err }, "Upload to GDrive failed");
    let message = err.message ?? "Upload gagal";
    if (message.includes("SERVICE_DISABLED") || message.includes("has not been used") || message.includes("is disabled")) {
      message = "Google Drive API belum diaktifkan. Buka Google Cloud Console → APIs & Services → aktifkan 'Google Drive API' untuk project Anda, lalu coba lagi.";
    } else if (message.includes("invalid_grant") || message.includes("Invalid JWT")) {
      message = "Autentikasi Google Drive gagal. Pastikan client_email dan private_key di pengaturan sudah benar.";
    } else if (message.includes("insufficientPermissions") || message.includes("403")) {
      message = "Service account tidak memiliki akses ke folder Google Drive. Pastikan folder sudah di-share ke email service account dengan izin 'Editor'.";
    }
    res.status(500).json({ error: message });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(incidentAttachmentsTable).where(eq(incidentAttachmentsTable.id, id));
  if (!row) { res.status(404).json({ error: "Attachment tidak ditemukan" }); return; }
  // [SECURITY H12] Verify attachment's parent incident belongs to caller's company before deleting
  if (!await requireOwnedIncident(row.incidentId, req, res)) return;

  await deleteFromDrive(row.driveFileId);
  await db.delete(incidentAttachmentsTable).where(eq(incidentAttachmentsTable.id, id));
  res.json({ success: true });
});

export default router;
