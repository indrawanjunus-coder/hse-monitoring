import { Router } from "express";
import { db, plansTable, systemSettingsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const rows = await db.select().from(plansTable)
    .where(eq(plansTable.isActive, true))
    .orderBy(asc(plansTable.sortOrder), asc(plansTable.id));
  res.json(rows);
});

router.get("/payment-info", async (_req, res) => {
  const rows = await db.select().from(systemSettingsTable);
  const s: Record<string, string> = {};
  rows.forEach(r => { s[r.key] = r.value; });
  res.json({
    paymentMethod: s["payment_method"] ?? "qris",
    qrisImageUrl: s["qris_image_url"] ?? "",
    bankName: s["bank_name"] ?? "",
    bankAccountNumber: s["bank_account_number"] ?? "",
    bankAccountName: s["bank_account_name"] ?? "",
    bankNote: s["bank_note"] ?? "",
  });
});

// Public settings — only non-sensitive keys exposed to the landing page
router.get("/public-settings", async (_req, res) => {
  const rows = await db.select().from(systemSettingsTable);
  const s: Record<string, string> = {};
  rows.forEach(r => { s[r.key] = r.value; });
  res.json({ landingTheme: s["landing_theme"] ?? "default" });
});

export default router;
