import { Router } from "express";
import { db, paymentsTable, systemSettingsTable, companiesTable, plansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { uploadPaymentProof } from "../lib/gdrive";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// [SECURITY M2] In-memory IP rate limiter: max 5 submissions per IP per hour
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;
const ipRateMap = new Map<string, { count: number; resetAt: number }>();

function publicSubmitRateLimit(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction): void {
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const entry = ipRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    next(); return;
  }
  if (entry.count >= RATE_MAX) {
    res.status(429).json({ error: "Terlalu banyak permintaan. Coba lagi dalam 1 jam." });
    return;
  }
  entry.count++;
  next();
}

async function getPaymentInfo() {
  const [settingsRows, plans] = await Promise.all([
    db.select().from(systemSettingsTable),
    db.select().from(plansTable),
  ]);
  const obj: Record<string, string> = {};
  settingsRows.forEach(r => { obj[r.key] = r.value; });

  const getPrice = (slug: string, field: "priceMonthly" | "priceYearly") => {
    const plan = plans.find(p => p.slug === slug);
    return plan ? Number(plan[field] ?? 0) : 0;
  };

  return {
    paymentMethod: (obj["payment_method"] ?? "qris") as "qris" | "transfer",
    qrisImageUrl: obj["qris_image_url"] ?? "",
    bankName: obj["bank_name"] ?? "",
    bankAccountNumber: obj["bank_account_number"] ?? "",
    bankAccountName: obj["bank_account_name"] ?? "",
    bankNote: obj["bank_note"] ?? "",
    priceMonthly: getPrice("monthly", "priceMonthly"),
    priceYearly: getPrice("yearly", "priceYearly"),
  };
}

// Public: get payment info + all active plans (for new registration page)
router.get("/public-info", async (_req, res) => {
  try {
    const [info, plans] = await Promise.all([
      getPaymentInfo(),
      db.select().from(plansTable).where(eq(plansTable.isActive, true)),
    ]);
    res.json({ ...info, plans });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Public: submit payment proof for new registration (no auth — uses companyId)
// [SECURITY M2] Rate limited: 5 requests/hour/IP. Only pending companies may submit.
router.post("/public-submit", publicSubmitRateLimit, upload.single("proof"), async (req, res) => {
  const { companyId, plan, periodMonths } = req.body as { companyId: string; plan: string; periodMonths: string };
  if (!companyId || !plan || !req.file) { res.status(400).json({ error: "Data tidak lengkap" }); return; }

  const cid = parseInt(companyId);
  if (isNaN(cid) || cid <= 0) { res.status(400).json({ error: "companyId tidak valid" }); return; }

  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, cid));
  if (!company) { res.status(404).json({ error: "Perusahaan tidak ditemukan" }); return; }

  // [SECURITY M2] Only companies with status='pending' may submit payment proof via the public endpoint
  // Active/suspended companies must use the authenticated /submit route instead
  if (company.status !== "pending") {
    res.status(403).json({ error: "Endpoint ini hanya untuk perusahaan yang menunggu aktivasi awal. Perusahaan aktif silakan login dan bayar melalui portal." });
    return;
  }

  const months = parseInt(periodMonths ?? "1");
  const plans = await db.select().from(plansTable);
  const planRecord = plans.find(p => p.slug === plan);
  let amount = 0;
  if (planRecord) {
    amount = months >= 12
      ? Number(planRecord.priceYearly ?? 0)
      : Number(planRecord.priceMonthly ?? 0) * months;
  }
  const planLabel = planRecord?.name ?? plan;

  try {
    const { fileId, viewUrl, storedName } = await uploadPaymentProof(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      company.name,
      planLabel,
    );

    const [payment] = await db.insert(paymentsTable).values({
      companyId: cid,
      plan: plan as any,
      amount,
      periodMonths: months,
      status: "pending",
      proofDriveFileId: fileId,
      proofFileName: storedName,
      proofViewUrl: viewUrl,
      periodStart: new Date().toISOString().slice(0, 10),
    }).returning();

    res.json({ success: true, payment });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Gagal upload bukti" });
  }
});

// Auth-required: get payment info for logged-in user
router.get("/info", authMiddleware, async (_req, res) => {
  try {
    res.json(await getPaymentInfo());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Auth-required: company payment history
router.get("/history", authMiddleware, async (req, res) => {
  const user = req.user!;
  if (!user.companyId) { res.status(403).json({ error: "Bukan user company" }); return; }
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.companyId, user.companyId)).orderBy(desc(paymentsTable.submittedAt));
  res.json(payments.map(p => ({ ...p, submittedAt: p.submittedAt.toISOString(), reviewedAt: p.reviewedAt?.toISOString() ?? null })));
});

// Auth-required: submit payment proof (for existing logged-in company user)
router.post("/submit", authMiddleware, upload.single("proof"), async (req, res) => {
  const user = req.user!;
  if (!user.companyId) { res.status(403).json({ error: "Bukan user company" }); return; }

  const { plan, periodMonths } = req.body as { plan: string; periodMonths: string };
  if (!plan || !req.file) { res.status(400).json({ error: "Plan dan bukti transfer diperlukan" }); return; }

  const months = parseInt(periodMonths ?? "1");
  const [company, plans] = await Promise.all([
    db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, user.companyId!)),
    db.select().from(plansTable),
  ]);

  const planRecord = plans.find(p => p.slug === plan);
  let amount = 0;
  if (planRecord) {
    amount = months >= 12
      ? Number(planRecord.priceYearly ?? 0)
      : Number(planRecord.priceMonthly ?? 0) * months;
  }
  const planLabel = planRecord?.name ?? plan;
  const companyName = company[0]?.name ?? `company-${user.companyId}`;

  try {
    const { fileId, viewUrl, storedName } = await uploadPaymentProof(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      companyName,
      planLabel,
    );

    const [payment] = await db.insert(paymentsTable).values({
      companyId: user.companyId,
      plan: plan as any,
      amount,
      periodMonths: months,
      status: "pending",
      proofDriveFileId: fileId,
      proofFileName: storedName,
      proofViewUrl: viewUrl,
      periodStart: new Date().toISOString().slice(0, 10),
    }).returning();

    res.json({ success: true, payment });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Gagal upload bukti" });
  }
});

export default router;
