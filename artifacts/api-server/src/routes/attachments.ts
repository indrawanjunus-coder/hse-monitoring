import { Router } from "express";
import multer from "multer";
import { db, incidentAttachmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { uploadToStorage, downloadFromStorage, deleteFromStorage } from "../lib/storage";
import { authMiddleware } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"];
    cb(null, allowed.includes(file.mimetype) ? true : new Error("Hanya file foto (JPG/PNG/WEBP) atau PDF yang diizinkan") as any);
  },
});

router.get("/", authMiddleware, async (req, res) => {
  const incidentId = Number(req.query.incidentId);
  if (!incidentId) { res.status(400).json({ error: "incidentId diperlukan" }); return; }
  const rows = await db
    .select()
    .from(incidentAttachmentsTable)
    .where(eq(incidentAttachmentsTable.incidentId, incidentId))
    .orderBy(incidentAttachmentsTable.uploadedAt);
  res.json(rows);
});

router.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "File tidak ditemukan" }); return; }
  const incidentId = Number(req.body.incidentId);
  if (!incidentId) { res.status(400).json({ error: "incidentId diperlukan" }); return; }

  try {
    const { objectPath } = await uploadToStorage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      incidentId,
    );

    const [saved] = await db.insert(incidentAttachmentsTable).values({
      incidentId,
      driveFileId: objectPath,         // reuse column: now stores GCS object path
      fileName: req.file.originalname,
      storedName: req.file.originalname,
      viewUrl: "pending",              // filled after insert (needs ID)
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      sequence: 0,
      uploadedById: req.user?.id ?? null,
    }).returning();

    // Update viewUrl to use the DB record ID for serving
    const serveUrl = `/api/attachments/serve/${saved.id}`;
    await db
      .update(incidentAttachmentsTable)
      .set({ viewUrl: serveUrl })
      .where(eq(incidentAttachmentsTable.id, saved.id));

    res.json({ success: true, attachment: { ...saved, viewUrl: serveUrl } });
  } catch (err: any) {
    logger.error({ err }, "Upload to Object Storage failed");
    res.status(500).json({ error: err.message ?? "Upload gagal" });
  }
});

// Serve attachment — no auth required so browser can load images/PDFs directly
router.get("/serve/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(incidentAttachmentsTable).where(eq(incidentAttachmentsTable.id, id));
  if (!row) { res.status(404).json({ error: "File tidak ditemukan" }); return; }

  try {
    const { stream, contentType } = await downloadFromStorage(row.driveFileId);
    const isInline = contentType.startsWith("image/") || contentType === "application/pdf";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `${isInline ? "inline" : "attachment"}; filename="${encodeURIComponent(row.fileName)}"`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    stream.pipe(res);
  } catch (err: any) {
    logger.error({ err, id }, "Failed to serve attachment");
    res.status(500).json({ error: "Gagal membaca file" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(incidentAttachmentsTable).where(eq(incidentAttachmentsTable.id, id));
  if (!row) { res.status(404).json({ error: "Attachment tidak ditemukan" }); return; }

  await deleteFromStorage(row.driveFileId);
  await db.delete(incidentAttachmentsTable).where(eq(incidentAttachmentsTable.id, id));
  res.json({ success: true });
});

export default router;
