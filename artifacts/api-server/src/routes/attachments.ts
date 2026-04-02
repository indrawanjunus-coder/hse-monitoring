import { Router } from "express";
import multer from "multer";
import { db, incidentAttachmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { uploadToDrive, deleteFromDrive } from "../lib/gdrive";
import { authMiddleware } from "../lib/auth";
import { logger } from "../lib/logger";

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
    res.status(500).json({ error: err.message ?? "Upload gagal" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(incidentAttachmentsTable).where(eq(incidentAttachmentsTable.id, id));
  if (!row) { res.status(404).json({ error: "Attachment tidak ditemukan" }); return; }

  await deleteFromDrive(row.driveFileId);
  await db.delete(incidentAttachmentsTable).where(eq(incidentAttachmentsTable.id, id));
  res.json({ success: true });
});

export default router;
