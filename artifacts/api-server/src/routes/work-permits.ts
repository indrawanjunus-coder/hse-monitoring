import { Router } from "express";
import multer from "multer";
import { db, workPermitsTable, workPermitTypesTable, workPermitScansTable, companiesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { uploadToDrive } from "../lib/gdrive";
import { sendEmail } from "../lib/email";
import { workPermitEmailHtml } from "../lib/email";
import { logger } from "../lib/logger";
import QRCode from "qrcode";
import { randomUUID } from "crypto";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Hanya file foto (JPG/PNG/WEBP) yang diizinkan") as any);
  },
});

// GET /work-permits — list (auth required)
router.get("/", authMiddleware, async (req, res) => {
  const cid = req.user!.companyId;
  const rows = await db
    .select({
      id: workPermitsTable.id,
      permitCode: workPermitsTable.permitCode,
      name: workPermitsTable.name,
      phone: workPermitsTable.phone,
      email: workPermitsTable.email,
      emergencyName: workPermitsTable.emergencyName,
      emergencyPhone: workPermitsTable.emergencyPhone,
      workStart: workPermitsTable.workStart,
      workEnd: workPermitsTable.workEnd,
      supervisorName: workPermitsTable.supervisorName,
      supervisorPhone: workPermitsTable.supervisorPhone,
      ktpUrl: workPermitsTable.ktpUrl,
      photoUrl: workPermitsTable.photoUrl,
      notes: workPermitsTable.notes,
      status: workPermitsTable.status,
      createdAt: workPermitsTable.createdAt,
      typeId: workPermitsTable.typeId,
      typeName: workPermitTypesTable.type,
      typeDescription: workPermitTypesTable.description,
    })
    .from(workPermitsTable)
    .leftJoin(workPermitTypesTable, eq(workPermitsTable.typeId, workPermitTypesTable.id))
    .where(cid ? eq(workPermitsTable.companyId, cid) : undefined)
    .orderBy(desc(workPermitsTable.createdAt));
  res.json(rows);
});

// GET /work-permits/report — scan report (auth required)
router.get("/report", authMiddleware, async (req, res) => {
  const cid = req.user!.companyId;
  const rows = await db
    .select({
      scanId: workPermitScansTable.id,
      scannedAt: workPermitScansTable.scannedAt,
      permitId: workPermitsTable.id,
      permitCode: workPermitsTable.permitCode,
      permitName: workPermitsTable.name,
      permitStatus: workPermitsTable.status,
      workStart: workPermitsTable.workStart,
      workEnd: workPermitsTable.workEnd,
      typeName: workPermitTypesTable.type,
    })
    .from(workPermitScansTable)
    .innerJoin(workPermitsTable, eq(workPermitScansTable.workPermitId, workPermitsTable.id))
    .leftJoin(workPermitTypesTable, eq(workPermitsTable.typeId, workPermitTypesTable.id))
    .where(cid ? eq(workPermitsTable.companyId, cid) : undefined)
    .orderBy(desc(workPermitScansTable.scannedAt));
  res.json(rows);
});

// GET /work-permits/scan/:code — PUBLIC: get permit by code + record scan
router.get("/scan/:code", async (req, res) => {
  const { code } = req.params;
  const [row] = await db
    .select({
      id: workPermitsTable.id,
      permitCode: workPermitsTable.permitCode,
      name: workPermitsTable.name,
      phone: workPermitsTable.phone,
      email: workPermitsTable.email,
      emergencyName: workPermitsTable.emergencyName,
      emergencyPhone: workPermitsTable.emergencyPhone,
      workStart: workPermitsTable.workStart,
      workEnd: workPermitsTable.workEnd,
      supervisorName: workPermitsTable.supervisorName,
      supervisorPhone: workPermitsTable.supervisorPhone,
      photoUrl: workPermitsTable.photoUrl,
      status: workPermitsTable.status,
      notes: workPermitsTable.notes,
      typeName: workPermitTypesTable.type,
      typeDescription: workPermitTypesTable.description,
    })
    .from(workPermitsTable)
    .leftJoin(workPermitTypesTable, eq(workPermitsTable.typeId, workPermitTypesTable.id))
    .where(eq(workPermitsTable.permitCode, code));

  if (!row) { res.status(404).json({ error: "Work permit tidak ditemukan" }); return; }

  // Auto-check expiry
  const today = new Date().toISOString().slice(0, 10);
  if (row.status === "active" && row.workEnd < today) {
    await db.update(workPermitsTable).set({ status: "expired" }).where(eq(workPermitsTable.permitCode, code)).catch(() => {});
    row.status = "expired";
  }

  // Record scan
  await db.insert(workPermitScansTable).values({ workPermitId: row.id }).catch(() => {});

  res.json(row);
});

// POST /work-permits — create (auth required, multipart)
router.post(
  "/",
  authMiddleware,
  upload.fields([{ name: "ktp", maxCount: 1 }, { name: "photo", maxCount: 1 }]),
  async (req, res) => {
    const cid = req.user!.companyId;
    const {
      name, phone, email, emergencyName, emergencyPhone,
      workStart, workEnd, supervisorName, supervisorPhone,
      notes, typeId,
    } = req.body;

    if (!name || !phone || !email || !emergencyName || !emergencyPhone || !workStart || !workEnd || !supervisorName || !supervisorPhone) {
      res.status(400).json({ error: "Semua field wajib diisi" }); return;
    }

    const permitCode = randomUUID();
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;

    try {
      // Insert permit first to get ID
      const [permit] = await db.insert(workPermitsTable).values({
        permitCode,
        companyId: cid,
        typeId: typeId ? Number(typeId) : null,
        name, phone, email,
        emergencyName, emergencyPhone,
        workStart, workEnd,
        supervisorName, supervisorPhone,
        notes: notes || null,
      }).returning();

      let ktpUrl: string | null = null;
      let photoUrl: string | null = null;

      // Upload KTP to GDrive
      if (files?.ktp?.[0]) {
        const f = files.ktp[0];
        try {
          const r = await uploadToDrive(f.buffer, `ktp-${permit.id}.${f.originalname.split(".").pop() || "jpg"}`, f.mimetype, permit.id, req.user!.id);
          ktpUrl = r.viewUrl;
        } catch (e) {
          logger.warn({ e }, "KTP upload to GDrive failed, continuing");
        }
      }

      // Upload photo to GDrive
      if (files?.photo?.[0]) {
        const f = files.photo[0];
        try {
          const r = await uploadToDrive(f.buffer, `photo-${permit.id}.${f.originalname.split(".").pop() || "jpg"}`, f.mimetype, permit.id, req.user!.id);
          photoUrl = r.viewUrl;
        } catch (e) {
          logger.warn({ e }, "Photo upload to GDrive failed, continuing");
        }
      }

      // Update URLs
      if (ktpUrl !== null || photoUrl !== null) {
        await db.update(workPermitsTable).set({ ktpUrl, photoUrl }).where(eq(workPermitsTable.id, permit.id));
      }

      // Build QR scan URL
      const [company] = cid
        ? await db.select({ slug: companiesTable.slug }).from(companiesTable).where(eq(companiesTable.id, cid))
        : [null];

      const host = req.get("host") ?? "localhost";
      const protocol = req.get("x-forwarded-proto") ?? req.protocol ?? "https";
      const scanUrl = `${protocol}://${host}/c/${company?.slug ?? ""}/scan?code=${permitCode}`;

      const qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 250, margin: 1 });

      // Send email
      const [typeRow] = typeId
        ? await db.select({ type: workPermitTypesTable.type, description: workPermitTypesTable.description })
            .from(workPermitTypesTable).where(eq(workPermitTypesTable.id, Number(typeId)))
        : [null];

      await sendEmail(
        email,
        "Work Permit Anda Telah Diterbitkan",
        workPermitEmailHtml({
          name, phone, email,
          emergencyName, emergencyPhone,
          workStart, workEnd,
          supervisorName, supervisorPhone,
          notes: notes || null,
          typeName: typeRow?.type ?? "-",
          typeDescription: typeRow?.description ?? "-",
          permitCode,
          qrDataUrl,
          scanUrl,
        }),
      ).catch((e) => logger.warn({ e }, "Work permit email send failed"));

      res.json({ success: true, permit: { ...permit, ktpUrl, photoUrl, permitCode } });
    } catch (err: any) {
      logger.error({ err }, "Failed to create work permit");
      res.status(500).json({ error: err.message ?? "Gagal membuat work permit" });
    }
  },
);

// PUT /work-permits/:id/status — revoke / reactivate (admin only)
router.put("/:id/status", authMiddleware, async (req, res) => {
  if (req.user!.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  const id = Number(req.params.id);
  const cid = req.user!.companyId;
  const { status } = req.body;
  if (!["active", "expired", "revoked"].includes(status)) { res.status(400).json({ error: "Status tidak valid" }); return; }
  const where = cid ? and(eq(workPermitsTable.id, id), eq(workPermitsTable.companyId, cid)) : eq(workPermitsTable.id, id);
  const [row] = await db.update(workPermitsTable).set({ status }).where(where).returning();
  if (!row) { res.status(404).json({ error: "Tidak ditemukan" }); return; }
  res.json(row);
});

export default router;
