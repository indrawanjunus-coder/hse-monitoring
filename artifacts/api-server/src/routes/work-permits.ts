import { Router } from "express";
import multer from "multer";
import {
  db, workPermitsTable, workPermitTypesTable, workPermitScansTable,
  workPermitTypeApproversTable, workPermitApprovalsTable,
  companiesTable, usersTable,
} from "@workspace/db";
import { eq, and, desc, inArray, lt } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { uploadToDrive } from "../lib/gdrive";
import {
  sendEmail, workPermitEmailHtml,
  workPermitApprovalRequestHtml, workPermitRejectedHtml,
} from "../lib/email";
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

// GET /work-permits — list (auth required), auto-expires active permits past workEnd
router.get("/", authMiddleware, async (req, res) => {
  const cid = req.user!.companyId;
  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

  // Auto-expire: set status=expired for active permits where workEnd < today
  await db
    .update(workPermitsTable)
    .set({ status: "expired" })
    .where(and(
      cid ? eq(workPermitsTable.companyId, cid) : undefined,
      eq(workPermitsTable.status, "active"),
      lt(workPermitsTable.workEnd, today),
    ));

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

// GET /work-permits/full-report — all permits with approval chain + scan count (auth required)
router.get("/full-report", authMiddleware, async (req, res) => {
  try {
    const cid = req.user!.companyId;
    const permits = await db
      .select({
        id: workPermitsTable.id,
        permitCode: workPermitsTable.permitCode,
        name: workPermitsTable.name,
        phone: workPermitsTable.phone,
        email: workPermitsTable.email,
        workStart: workPermitsTable.workStart,
        workEnd: workPermitsTable.workEnd,
        supervisorName: workPermitsTable.supervisorName,
        notes: workPermitsTable.notes,
        status: workPermitsTable.status,
        createdAt: workPermitsTable.createdAt,
        typeId: workPermitsTable.typeId,
        typeName: workPermitTypesTable.type,
      })
      .from(workPermitsTable)
      .leftJoin(workPermitTypesTable, eq(workPermitsTable.typeId, workPermitTypesTable.id))
      .where(cid ? eq(workPermitsTable.companyId, cid) : undefined)
      .orderBy(desc(workPermitsTable.createdAt));

    if (permits.length === 0) { res.json([]); return; }

    const permitIds = permits.map(p => p.id);

    // Fetch all approvals for all permits in one query
    const allApprovals = await db
      .select({
        workPermitId: workPermitApprovalsTable.workPermitId,
        userId: workPermitApprovalsTable.userId,
        status: workPermitApprovalsTable.status,
        approvedAt: workPermitApprovalsTable.approvedAt,
        notes: workPermitApprovalsTable.notes,
        userName: usersTable.name,
      })
      .from(workPermitApprovalsTable)
      .innerJoin(usersTable, eq(workPermitApprovalsTable.userId, usersTable.id))
      .where(inArray(workPermitApprovalsTable.workPermitId, permitIds))
      .orderBy(workPermitApprovalsTable.id);

    // Fetch scan counts per permit in one query
    const scanCounts = await db
      .select({
        workPermitId: workPermitScansTable.workPermitId,
      })
      .from(workPermitScansTable)
      .where(inArray(workPermitScansTable.workPermitId, permitIds));

    const approvalMap = new Map<number, typeof allApprovals>();
    allApprovals.forEach(a => {
      if (!approvalMap.has(a.workPermitId)) approvalMap.set(a.workPermitId, []);
      approvalMap.get(a.workPermitId)!.push(a);
    });

    const scanCountMap = new Map<number, number>();
    scanCounts.forEach(s => {
      scanCountMap.set(s.workPermitId, (scanCountMap.get(s.workPermitId) ?? 0) + 1);
    });

    const result = permits.map(p => ({
      ...p,
      approvals: approvalMap.get(p.id) ?? [],
      scanCount: scanCountMap.get(p.id) ?? 0,
    }));

    res.json(result);
  } catch (err: any) {
    logger.error({ err }, "full-report error");
    res.status(500).json({ error: err.message ?? "Gagal mengambil laporan" });
  }
});

// GET /work-permits/my-approvals — permits pending current user's approval
router.get("/my-approvals", authMiddleware, async (req, res) => {
  try {
    const uid = req.user!.id;
    const cid = req.user!.companyId;
    const pendingApprovals = await db
      .select({
        approvalId: workPermitApprovalsTable.id,
        workPermitId: workPermitApprovalsTable.workPermitId,
        approvalStatus: workPermitApprovalsTable.status,
      })
      .from(workPermitApprovalsTable)
      .where(and(
        eq(workPermitApprovalsTable.userId, uid),
        eq(workPermitApprovalsTable.status, "pending"),
      ));

    if (pendingApprovals.length === 0) { res.json([]); return; }

    const permitIds = pendingApprovals.map(a => a.workPermitId);
    const permits = await db
      .select({
        id: workPermitsTable.id,
        permitCode: workPermitsTable.permitCode,
        name: workPermitsTable.name,
        phone: workPermitsTable.phone,
        email: workPermitsTable.email,
        workStart: workPermitsTable.workStart,
        workEnd: workPermitsTable.workEnd,
        supervisorName: workPermitsTable.supervisorName,
        notes: workPermitsTable.notes,
        status: workPermitsTable.status,
        createdAt: workPermitsTable.createdAt,
        typeId: workPermitsTable.typeId,
        typeName: workPermitTypesTable.type,
        companyId: workPermitsTable.companyId,
      })
      .from(workPermitsTable)
      .leftJoin(workPermitTypesTable, eq(workPermitsTable.typeId, workPermitTypesTable.id))
      .where(and(
        inArray(workPermitsTable.id, permitIds),
        cid ? eq(workPermitsTable.companyId, cid) : undefined,
        eq(workPermitsTable.status, "pending"),
      ));

    res.json(permits);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data approval" });
  }
});

// GET /work-permits/:id/approvals — get approval chain for a permit
router.get("/:id/approvals", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cid = req.user!.companyId;
    const [permit] = await db.select({ id: workPermitsTable.id })
      .from(workPermitsTable)
      .where(and(eq(workPermitsTable.id, id), cid ? eq(workPermitsTable.companyId, cid) : undefined));
    if (!permit) { res.status(404).json({ error: "Tidak ditemukan" }); return; }

    const approvals = await db
      .select({
        id: workPermitApprovalsTable.id,
        userId: workPermitApprovalsTable.userId,
        status: workPermitApprovalsTable.status,
        approvedAt: workPermitApprovalsTable.approvedAt,
        notes: workPermitApprovalsTable.notes,
        userName: usersTable.name,
        userRole: usersTable.role,
      })
      .from(workPermitApprovalsTable)
      .innerJoin(usersTable, eq(workPermitApprovalsTable.userId, usersTable.id))
      .where(eq(workPermitApprovalsTable.workPermitId, id))
      .orderBy(workPermitApprovalsTable.id);

    res.json(approvals);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil approval chain" });
  }
});

// POST /work-permits/:id/approve
router.post("/:id/approve", authMiddleware, async (req, res) => {
  try {
    const uid = req.user!.id;
    const id = Number(req.params.id);
    const cid = req.user!.companyId;

    const [permit] = await db
      .select()
      .from(workPermitsTable)
      .leftJoin(workPermitTypesTable, eq(workPermitsTable.typeId, workPermitTypesTable.id))
      .where(and(eq(workPermitsTable.id, id), cid ? eq(workPermitsTable.companyId, cid) : undefined));
    if (!permit) { res.status(404).json({ error: "Work permit tidak ditemukan" }); return; }
    if (permit.work_permits.status !== "pending") {
      res.status(400).json({ error: "Work permit ini tidak sedang menunggu persetujuan" }); return;
    }

    // Find this user's approval record
    const [approval] = await db
      .select()
      .from(workPermitApprovalsTable)
      .where(and(
        eq(workPermitApprovalsTable.workPermitId, id),
        eq(workPermitApprovalsTable.userId, uid),
        eq(workPermitApprovalsTable.status, "pending"),
      ));
    if (!approval) {
      res.status(403).json({ error: "Anda tidak memiliki hak untuk menyetujui work permit ini" }); return;
    }

    // Mark as approved
    await db.update(workPermitApprovalsTable)
      .set({ status: "approved", approvedAt: new Date() })
      .where(eq(workPermitApprovalsTable.id, approval.id));

    // Check if all approvers have approved
    const allApprovals = await db
      .select()
      .from(workPermitApprovalsTable)
      .where(eq(workPermitApprovalsTable.workPermitId, id));

    const allApproved = allApprovals.every(a => a.id === approval.id ? true : a.status === "approved");
    if (allApproved) {
      // All approved → activate permit
      await db.update(workPermitsTable).set({ status: "active" }).where(eq(workPermitsTable.id, id));

      // Send email to permit holder
      try {
        const [company] = cid
          ? await db.select({ slug: companiesTable.slug }).from(companiesTable).where(eq(companiesTable.id, cid))
          : [null];
        const wp = permit.work_permits;
        const scanUrl = `${req.get("x-forwarded-proto") ?? req.protocol ?? "https"}://${req.get("host") ?? "localhost"}/c/${company?.slug ?? ""}/scan?code=${wp.permitCode}`;
        const qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 250, margin: 1 });
        const typeName = permit.work_permit_types?.type ?? "-";
        const typeDescription = permit.work_permit_types?.description ?? "-";

        await sendEmail(
          wp.email,
          "Work Permit Anda Telah Disetujui & Diterbitkan",
          workPermitEmailHtml({
            name: wp.name, phone: wp.phone, email: wp.email,
            emergencyName: wp.emergencyName, emergencyPhone: wp.emergencyPhone,
            workStart: wp.workStart, workEnd: wp.workEnd,
            supervisorName: wp.supervisorName, supervisorPhone: wp.supervisorPhone,
            notes: wp.notes,
            typeName, typeDescription,
            permitCode: wp.permitCode,
            qrDataUrl, scanUrl,
          }),
        ).catch(e => logger.warn({ e }, "Approved email send failed"));
      } catch (e) {
        logger.warn({ e }, "Error sending approval completion email");
      }

      res.json({ ok: true, fullyApproved: true });
    } else {
      res.json({ ok: true, fullyApproved: false });
    }
  } catch (err: any) {
    logger.error({ err }, "Approve work permit error");
    res.status(500).json({ error: err.message ?? "Gagal menyetujui work permit" });
  }
});

// POST /work-permits/:id/reject
router.post("/:id/reject", authMiddleware, async (req, res) => {
  try {
    const uid = req.user!.id;
    const id = Number(req.params.id);
    const cid = req.user!.companyId;
    const { notes } = req.body as { notes?: string };

    const [permit] = await db
      .select()
      .from(workPermitsTable)
      .leftJoin(workPermitTypesTable, eq(workPermitsTable.typeId, workPermitTypesTable.id))
      .where(and(eq(workPermitsTable.id, id), cid ? eq(workPermitsTable.companyId, cid) : undefined));
    if (!permit) { res.status(404).json({ error: "Work permit tidak ditemukan" }); return; }
    if (permit.work_permits.status !== "pending") {
      res.status(400).json({ error: "Work permit ini tidak sedang menunggu persetujuan" }); return;
    }

    const [approval] = await db
      .select()
      .from(workPermitApprovalsTable)
      .where(and(
        eq(workPermitApprovalsTable.workPermitId, id),
        eq(workPermitApprovalsTable.userId, uid),
        eq(workPermitApprovalsTable.status, "pending"),
      ));
    if (!approval) {
      res.status(403).json({ error: "Anda tidak memiliki hak untuk menolak work permit ini" }); return;
    }

    // Mark approval as rejected
    await db.update(workPermitApprovalsTable)
      .set({ status: "rejected", approvedAt: new Date(), notes: notes ?? null })
      .where(eq(workPermitApprovalsTable.id, approval.id));

    // Update permit status to rejected
    await db.update(workPermitsTable).set({ status: "rejected" }).where(eq(workPermitsTable.id, id));

    // Notify admin who created the permit (find first admin of company)
    try {
      const rejecter = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, uid));
      const admins = cid
        ? await db.select({ name: usersTable.name, email: usersTable.email })
            .from(usersTable)
            .where(and(eq(usersTable.companyId, cid), eq(usersTable.role, "admin")))
        : [];
      const adminEmails = admins.filter(a => a.email).map(a => a.email as string);
      if (adminEmails.length > 0) {
        const host = req.get("host") ?? "localhost";
        const protocol = req.get("x-forwarded-proto") ?? req.protocol ?? "https";
        const [company] = cid ? await db.select({ slug: companiesTable.slug }).from(companiesTable).where(eq(companiesTable.id, cid)) : [null];
        const appUrl = `${protocol}://${host}/c/${company?.slug ?? ""}/work-permits`;

        await sendEmail(
          adminEmails,
          `Work Permit Ditolak — ${permit.work_permits.name}`,
          workPermitRejectedHtml({
            creatorName: admins[0]?.name ?? "Admin",
            permitHolderName: permit.work_permits.name,
            typeName: permit.work_permit_types?.type ?? "-",
            rejecterName: rejecter[0]?.name ?? "Approver",
            notes: notes ?? null,
            appUrl,
          }),
        ).catch(e => logger.warn({ e }, "Rejection email send failed"));
      }
    } catch (e) {
      logger.warn({ e }, "Error sending rejection email");
    }

    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "Reject work permit error");
    res.status(500).json({ error: err.message ?? "Gagal menolak work permit" });
  }
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

  // Auto-check expiry (only if already active)
  const today = new Date().toISOString().slice(0, 10);
  if (row.status === "active" && row.workEnd < today) {
    await db.update(workPermitsTable).set({ status: "expired" }).where(eq(workPermitsTable.permitCode, code)).catch(() => {});
    row.status = "expired";
  }

  // Record scan only for active/expired permits
  if (row.status !== "pending" && row.status !== "rejected") {
    await db.insert(workPermitScansTable).values({ workPermitId: row.id }).catch(() => {});
  }

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
      // Check if this type has approvers
      const typeIdNum = typeId ? Number(typeId) : null;
      let approverUsers: { id: number; name: string; email: string | null }[] = [];
      if (typeIdNum && cid) {
        const approverRows = await db
          .select({ userId: workPermitTypeApproversTable.userId })
          .from(workPermitTypeApproversTable)
          .where(and(
            eq(workPermitTypeApproversTable.workPermitTypeId, typeIdNum),
            eq(workPermitTypeApproversTable.companyId, cid),
          ));

        if (approverRows.length > 0) {
          const userIds = approverRows.map(r => r.userId);
          approverUsers = await db
            .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
            .from(usersTable)
            .where(inArray(usersTable.id, userIds));
        }
      }

      const hasApprovers = approverUsers.length > 0;
      const initialStatus = hasApprovers ? "pending" : "active";

      // Insert permit
      const [permit] = await db.insert(workPermitsTable).values({
        permitCode,
        companyId: cid,
        typeId: typeIdNum,
        name, phone, email,
        emergencyName, emergencyPhone,
        workStart, workEnd,
        supervisorName, supervisorPhone,
        notes: notes || null,
        status: initialStatus,
      }).returning();

      // Create approval records if needed
      if (hasApprovers) {
        await db.insert(workPermitApprovalsTable).values(
          approverUsers.map(u => ({
            workPermitId: permit.id,
            userId: u.id,
            status: "pending" as const,
          }))
        );
      }

      let ktpUrl: string | null = null;
      let photoUrl: string | null = null;

      if (files?.ktp?.[0]) {
        const f = files.ktp[0];
        try {
          const r = await uploadToDrive(f.buffer, `ktp-${permit.id}.${f.originalname.split(".").pop() || "jpg"}`, f.mimetype, permit.id, req.user!.id);
          ktpUrl = r.viewUrl;
        } catch (e) { logger.warn({ e }, "KTP upload to GDrive failed"); }
      }

      if (files?.photo?.[0]) {
        const f = files.photo[0];
        try {
          const r = await uploadToDrive(f.buffer, `photo-${permit.id}.${f.originalname.split(".").pop() || "jpg"}`, f.mimetype, permit.id, req.user!.id);
          photoUrl = r.viewUrl;
        } catch (e) { logger.warn({ e }, "Photo upload to GDrive failed"); }
      }

      if (ktpUrl !== null || photoUrl !== null) {
        await db.update(workPermitsTable).set({ ktpUrl, photoUrl }).where(eq(workPermitsTable.id, permit.id));
      }

      const [company] = cid
        ? await db.select({ slug: companiesTable.slug }).from(companiesTable).where(eq(companiesTable.id, cid))
        : [null];
      const host = req.get("host") ?? "localhost";
      const protocol = req.get("x-forwarded-proto") ?? req.protocol ?? "https";

      const [typeRow] = typeIdNum
        ? await db.select({ type: workPermitTypesTable.type, description: workPermitTypesTable.description })
            .from(workPermitTypesTable).where(eq(workPermitTypesTable.id, typeIdNum))
        : [null];

      if (hasApprovers) {
        // Send notification to each approver
        const appUrl = `${protocol}://${host}/c/${company?.slug ?? ""}/work-permits`;
        for (const approver of approverUsers) {
          if (!approver.email) continue;
          await sendEmail(
            approver.email,
            `Permintaan Persetujuan Work Permit — ${name}`,
            workPermitApprovalRequestHtml({
              approverName: approver.name,
              permitHolderName: name,
              typeName: typeRow?.type ?? "-",
              workStart, workEnd,
              supervisorName,
              notes: notes || null,
              appUrl,
            }),
          ).catch(e => logger.warn({ e }, "Approver notification email failed"));
        }
        res.json({ success: true, permit: { ...permit, ktpUrl, photoUrl, permitCode }, requiresApproval: true, approverCount: approverUsers.length });
      } else {
        // No approvers — send directly to permit holder
        const scanUrl = `${protocol}://${host}/c/${company?.slug ?? ""}/scan?code=${permitCode}`;
        const qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 250, margin: 1 });

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
            permitCode, qrDataUrl, scanUrl,
          }),
        ).catch(e => logger.warn({ e }, "Work permit email send failed"));

        res.json({ success: true, permit: { ...permit, ktpUrl, photoUrl, permitCode }, requiresApproval: false });
      }
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
