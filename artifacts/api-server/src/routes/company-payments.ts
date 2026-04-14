import { Router } from "express";
import { db, paymentsTable, systemSettingsTable, companiesTable, plansTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { uploadToGdrive } from "../lib/gdrive";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Get public payment info (QRIS/transfer, pricing) — needs auth
router.get("/info", authMiddleware, async (_req, res) => {
  const [settingsRows, plans] = await Promise.all([
    db.select().from(systemSettingsTable),
    db.select().from(plansTable),
  ]);
  const obj: Record<string, string> = {};
  settingsRows.forEach(r => { obj[r.key] = r.value; });

  const findPrice = (slug: string) => {
    const plan = plans.find(p => p.slug === slug);
    return plan ? Number(plan.priceMonthly ?? 0) : 0;
  };

  res.json({
    paymentMethod: obj["payment_method"] ?? "qris",
    qrisImageUrl: obj["qris_image_url"] ?? "",
    bankName: obj["bank_name"] ?? "",
    bankAccountNumber: obj["bank_account_number"] ?? "",
    bankAccountName: obj["bank_account_name"] ?? "",
    bankNote: obj["bank_note"] ?? "",
    priceMonthly: findPrice("monthly"),
    priceYearly: findPrice("yearly"),
  });
});

// Get company payment history
router.get("/history", authMiddleware, async (req, res) => {
  const user = req.user!;
  if (!user.companyId) { res.status(403).json({ error: "Bukan user company" }); return; }
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.companyId, user.companyId)).orderBy(desc(paymentsTable.submittedAt));
  res.json(payments.map(p => ({ ...p, submittedAt: p.submittedAt.toISOString(), reviewedAt: p.reviewedAt?.toISOString() ?? null })));
});

// Submit payment proof
router.post("/submit", authMiddleware, upload.single("proof"), async (req, res) => {
  const user = req.user!;
  if (!user.companyId) { res.status(403).json({ error: "Bukan user company" }); return; }

  const { plan, periodMonths } = req.body as { plan: string; periodMonths: string };
  if (!plan || !req.file) { res.status(400).json({ error: "Plan dan bukti transfer diperlukan" }); return; }

  const months = parseInt(periodMonths ?? "1");
  const plans = await db.select().from(plansTable);
  const planRecord = plans.find(p => p.slug === plan);
  const amount = planRecord ? Number(planRecord.priceMonthly ?? 0) * months : 0;

  try {
    const { fileId, viewUrl } = await uploadToGdrive(req.file.buffer, `bukti-${user.companyId}-${Date.now()}-${req.file.originalname}`, req.file.mimetype);

    const now = new Date();
    const [payment] = await db.insert(paymentsTable).values({
      companyId: user.companyId,
      plan: plan as any,
      amount,
      periodMonths: months,
      status: "pending",
      proofDriveFileId: fileId,
      proofFileName: req.file.originalname,
      proofViewUrl: viewUrl,
      periodStart: now.toISOString().slice(0, 10),
    }).returning();

    res.json({ success: true, payment });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Gagal upload bukti" });
  }
});

export default router;
