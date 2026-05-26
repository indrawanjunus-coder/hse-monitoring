import { Router } from "express";
import multer from "multer";
import { db, mapsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { uploadMapToDrive, deleteFromDrive } from "../lib/gdrive";

const router = Router();
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (allowed.includes(file.mimetype) || /\.(pdf|jpe?g|jpg)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file PDF, JPEG, atau JPG yang diizinkan"));
    }
  },
});

router.get("/", async (req, res) => {
  try {
    const user = req.user!;
    const cid = user.companyId;
    if (!cid && user.role !== "sysadmin") {
      res.status(403).json({ error: "Akses ditolak" });
      return;
    }
    const maps = cid
      ? await db.select().from(mapsTable).where(eq(mapsTable.companyId, cid))
      : await db.select().from(mapsTable);
    res.json(maps);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil daftar map" });
  }
});

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const cid = req.user!.companyId;
    const { name } = req.body as { name?: string };
    if (!name?.trim()) { res.status(400).json({ error: "Nama map wajib diisi" }); return; }
    if (!req.file) { res.status(400).json({ error: "File map wajib diupload" }); return; }
    if (!cid) { res.status(400).json({ error: "Company tidak ditemukan" }); return; }

    const ext = (req.file.originalname.split(".").pop() ?? "bin").toLowerCase();
    const fileType = ext === "pdf" ? "pdf" : "jpeg";

    const { driveFileId, viewUrl } = await uploadMapToDrive(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      cid,
    );

    const [map] = await db.insert(mapsTable).values({
      companyId: cid,
      name: name.trim(),
      driveFileId,
      viewUrl,
      fileType,
    }).returning();

    res.json(map);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Gagal mengupload map" });
  }
});

router.get("/:id/file", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = req.user!;
    const cid = user.companyId;

    const where = cid
      ? and(eq(mapsTable.id, id), eq(mapsTable.companyId, cid))
      : eq(mapsTable.id, id);

    const [map] = await db.select().from(mapsTable).where(where);
    if (!map) { res.status(404).json({ error: "Map tidak ditemukan" }); return; }
    if (!map.driveFileId) { res.status(404).json({ error: "File map belum tersedia" }); return; }

    const redirectUrl = map.fileType === "pdf"
      ? `https://drive.google.com/file/d/${map.driveFileId}/preview`
      : `https://drive.google.com/uc?export=view&id=${map.driveFileId}`;

    res.redirect(redirectUrl);
  } catch (err: any) {
    res.status(500).json({ error: "Gagal mengambil file map" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (req.user!.role !== "admin") { res.status(403).json({ error: "Hanya admin yang dapat menghapus map" }); return; }
    const id = parseInt(req.params.id);
    const cid = req.user!.companyId;

    const where = cid
      ? and(eq(mapsTable.id, id), eq(mapsTable.companyId, cid))
      : eq(mapsTable.id, id);

    const [map] = await db.select().from(mapsTable).where(where);
    if (!map) { res.status(404).json({ error: "Map tidak ditemukan" }); return; }

    if (map.driveFileId) {
      await deleteFromDrive(map.driveFileId).catch(() => {});
    }
    await db.delete(mapsTable).where(eq(mapsTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "Gagal menghapus map" });
  }
});

export default router;
