import { Router } from "express";
import { db, paymentsTable, systemSettingsTable, companiesTable, plansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { uploadToGdrive } from "../lib/gdrive";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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

// Public: get payment info (QRIS/bank + pricing) — no auth needed (for new registration)
router.get("/public-info", async (_req, res) => {
  try {
    res.json(await getPaymentInfo());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Public: submit payment proof for new registration (no auth — uses companyId)
router.post("/public-submit", upload.single("proof"), async (req, res) => {
  const { companyId, plan, periodMonths } = req.body as { companyId: string; plan: string; periodMonths: string };
  if (!companyId || !plan || !req.file) { res.status(400).json({ error: "Data tidak lengkap" }); return; }

  const cid = parseInt(companyId);
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, cid));
  if (!company) { res.status(404).json({ error: "Perusahaan tidak ditemukan" }); return; }

  const months = parseInt(periodMonths ?? "1");
  const plans = await db.select().from(plansTable);
  const planRecord = plans.find(p => p.slug === plan);
  let amount = 0;
  if (planRecord) {
    amount = plan === "yearly" ? Number(planRecord.priceYearly ?? 0) : Number(planRecord.priceMonthly ?? 0) * months;
  }

  try {
    const { fileId, viewUrl } = await uploadToGdrive(
      req.file.buffer,
      `bukti-reg-${cid}-${Date.now()}-${req.file.originalname}`,
      req.file.mimetype,
    );

    const [payment] = await db.insert(paymentsTable).values({
      companyId: cid,
      plan: plan as any,
      amount,
      periodMonths: months,
      status: "pending",
      proofDriveFileId: fileId,
      proofFileName: req.file.originalname,
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
  const plans = await db.select().from(plansTable);
  const planRecord = plans.find(p => p.slug === plan);
  let amount = 0;
  if (planRecord) {
    amount = plan === "yearly" ? Number(planRecord.priceYearly ?? 0) : Number(planRecord.priceMonthly ?? 0) * months;
  }

  try {
    const { fileId, viewUrl } = await uploadToGdrive(
      req.file.buffer,
      `bukti-${user.companyId}-${Date.now()}-${req.file.originalname}`,
      req.file.mimetype,
    );

    const [payment] = await db.insert(paymentsTable).values({
      companyId: user.companyId,
      plan: plan as any,
      amount,
      periodMonths: months,
      status: "pending",
      proofDriveFileId: fileId,
      proofFileName: req.file.originalname,
      proofViewUrl: viewUrl,
      periodStart: new Date().toISOString().slice(0, 10),
    }).returning();

    res.json({ success: true, payment });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Gagal upload bukti" });
  }
});

export default router;
