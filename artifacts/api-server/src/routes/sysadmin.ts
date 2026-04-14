import { Router } from "express";
import { db, companiesTable, paymentsTable, usersTable, systemSettingsTable, testimonialsTable, plansTable, auditLogsTable, gdriveSettingsTable } from "@workspace/db";
import { eq, desc, and, gte, lte, sql, isNull } from "drizzle-orm";
import { sysadminMiddleware, hashPassword } from "../lib/auth";
import { uploadToGdrive } from "../lib/gdrive";
import { enforcePlanLimits } from "../lib/plan-limits";
import { writeAuditLog } from "../lib/audit-log";
import { sendEmail, companyActivationEmailHtml } from "../lib/email";
import multer from "multer";

function generatePassword(length = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let pw = "";
  for (let i = 0; i < length; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

async function provisionCompanyAdmin(company: { id: number; slug: string; name: string; contactName: string; contactEmail: string }) {
  const existing = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.companyId, company.id), eq(usersTable.role, "admin")));
  if (existing.length > 0) return { alreadyExists: true, nik: null, password: null };

  const nikSuffix = company.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nik = `admin${nikSuffix}`;
  const password = generatePassword();
  const pwHash = await hashPassword(password);
  await db.insert(usersTable).values({
    companyId: company.id,
    nik,
    name: company.contactName,
    email: company.contactEmail,
    passwordHash: pwHash,
    role: "admin",
  });

  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "https://app.ha-monitoring.com";
  const portalUrl = `${baseUrl}/c/${company.slug}/`;

  await sendEmail(
    company.contactEmail,
    `[H&A Monitoring] Akun Admin ${company.name} Telah Diaktifkan`,
    companyActivationEmailHtml({
      companyName: company.name,
      contactName: company.contactName,
      portalUrl,
      nik,
      password,
    }),
  );

  return { alreadyExists: false, nik, password };
}

const router = Router();
router.use(sysadminMiddleware);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// --- Companies ---
router.get("/companies", async (_req, res) => {
  const companies = await db.select().from(companiesTable).orderBy(desc(companiesTable.createdAt));
  const result = await Promise.all(companies.map(async c => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.companyId, c.id));
    const pendingPayments = await db.select().from(paymentsTable).where(and(eq(paymentsTable.companyId, c.id), eq(paymentsTable.status, "pending")));
    return { ...c, userCount: Number(count), pendingPaymentCount: pendingPayments.length };
  }));
  res.json(result);
});

router.get("/companies/:id", async (req, res) => {
  const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, Number(req.params.id)));
  if (!co) { res.status(404).json({ error: "Tidak ditemukan" }); return; }
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.companyId, co.id)).orderBy(desc(paymentsTable.createdAt));
  const users = await db.select({ id: usersTable.id, nik: usersTable.nik, name: usersTable.name, email: usersTable.email, role: usersTable.role }).from(usersTable).where(eq(usersTable.companyId, co.id));
  res.json({ ...co, payments, users });
});

router.put("/companies/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { status, plan, subscriptionEndsAt, activatedByNote } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status) updates.status = status;
  if (plan) updates.plan = plan;
  if (activatedByNote !== undefined) updates.activatedByNote = activatedByNote;
  if (subscriptionEndsAt) {
    updates.subscriptionEndsAt = new Date(subscriptionEndsAt);
    updates.activatedAt = new Date();
  }

  const [updated] = await db.update(companiesTable).set(updates as any).where(eq(companiesTable.id, id)).returning();
  res.json(updated);
});

// Quick activate
router.post("/companies/:id/activate", async (req, res) => {
  const id = Number(req.params.id);
  const { plan, months, note } = req.body as { plan: string; months: number; note?: string };
  

  const endDate = new Date();
  if (plan === "free") endDate.setMonth(endDate.getMonth() + 1);
  else if (plan === "monthly") endDate.setMonth(endDate.getMonth() + (months ?? 1));
  else if (plan === "yearly") endDate.setFullYear(endDate.getFullYear() + 1);

  const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  const [updated] = await db.update(companiesTable).set({
    status: "active",
    plan: plan as any,
    activatedAt: new Date(),
    subscriptionEndsAt: endDate,
    activatedByNote: note ?? null,
    updatedAt: new Date(),
  }).where(eq(companiesTable.id, id)).returning();

  // Enforce plan limits after plan change (auto-deactivate excess users/templates)
  const enforced = await enforcePlanLimits(id);

  // Auto-create admin user and send email credentials if not yet exists
  const adminResult = co ? await provisionCompanyAdmin(co) : null;

  await writeAuditLog({
    action: "ACTIVATE_COMPANY",
    performedByNik: req.user?.nik ?? "sysadmin",
    performedByName: req.user?.name ?? "Sysadmin",
    companyId: id,
    companyName: co?.name ?? String(id),
    details: `Paket: ${plan}, Durasi: ${months ?? 1} bulan, Berakhir: ${endDate.toLocaleDateString("id-ID")}${note ? `, Catatan: ${note}` : ""}. Deactivated: ${enforced.deactivatedUsers} users, ${enforced.deactivatedTemplates} templates.${adminResult && !adminResult.alreadyExists ? ` Admin dibuat: NIK=${adminResult.nik}, email dikirim ke ${co?.contactEmail}.` : ""}`,
    req,
  });

  res.json({ success: true, company: updated, enforced, adminProvisioned: adminResult });
});

router.post("/companies/:id/resend-credentials", async (req, res) => {
  const id = Number(req.params.id);
  const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!co) { res.status(404).json({ error: "Perusahaan tidak ditemukan" }); return; }

  const admins = await db.select().from(usersTable)
    .where(and(eq(usersTable.companyId, id), eq(usersTable.role, "admin")));
  
  if (admins.length === 0) {
    const result = await provisionCompanyAdmin(co);
    res.json({ success: true, created: true, nik: result.nik, emailSentTo: co.contactEmail });
    return;
  }

  const admin = admins[0];
  const newPassword = generatePassword();
  const pwHash = await hashPassword(newPassword);
  await db.update(usersTable).set({ passwordHash: pwHash }).where(eq(usersTable.id, admin.id));

  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "https://app.ha-monitoring.com";
  const portalUrl = `${baseUrl}/c/${co.slug}/`;

  await sendEmail(
    co.contactEmail,
    `[H&A Monitoring] Reset Kredensial Admin ${co.name}`,
    companyActivationEmailHtml({
      companyName: co.name,
      contactName: co.contactName,
      portalUrl,
      nik: admin.nik,
      password: newPassword,
    }),
  );

  await writeAuditLog({
    action: "RESEND_CREDENTIALS",
    performedByNik: req.user?.nik ?? "sysadmin",
    performedByName: req.user?.name ?? "Sysadmin",
    companyId: id,
    companyName: co.name,
    details: `Kredensial admin (NIK: ${admin.nik}) dikirim ulang ke ${co.contactEmail}`,
    req,
  });

  res.json({ success: true, created: false, nik: admin.nik, emailSentTo: co.contactEmail });
});

router.post("/companies/:id/suspend", async (req, res) => {
  const id = Number(req.params.id);
  
  const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  const [updated] = await db.update(companiesTable).set({ status: "suspended", updatedAt: new Date() }).where(eq(companiesTable.id, id)).returning();

  await writeAuditLog({
    action: "SUSPEND_COMPANY",
    performedByNik: req.user?.nik ?? "sysadmin",
    performedByName: req.user?.name ?? "Sysadmin",
    companyId: id,
    companyName: co?.name ?? String(id),
    details: `Perusahaan ditangguhkan`,
    req,
  });

  res.json({ success: true, company: updated });
});

// Edit expiry date manually
router.post("/companies/:id/edit-expiry", async (req, res) => {
  const id = Number(req.params.id);
  const { subscriptionEndsAt, note } = req.body as { subscriptionEndsAt: string; note?: string };
  

  if (!subscriptionEndsAt) { res.status(400).json({ error: "Tanggal berakhir wajib diisi" }); return; }

  const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!co) { res.status(404).json({ error: "Perusahaan tidak ditemukan" }); return; }

  const newEnd = new Date(subscriptionEndsAt);
  const [updated] = await db.update(companiesTable).set({
    subscriptionEndsAt: newEnd,
    updatedAt: new Date(),
  }).where(eq(companiesTable.id, id)).returning();

  await writeAuditLog({
    action: "EDIT_EXPIRY",
    performedByNik: req.user?.nik ?? "sysadmin",
    performedByName: req.user?.name ?? "Sysadmin",
    companyId: id,
    companyName: co.name,
    details: `Tanggal berakhir diubah ke ${newEnd.toLocaleDateString("id-ID")}${note ? `. Catatan: ${note}` : ""}`,
    req,
  });

  res.json({ success: true, company: updated });
});

// --- Payments ---
router.get("/payments", async (req, res) => {
  const { month, year, status } = req.query as Record<string, string>;
  let query = db.select({
    id: paymentsTable.id, companyId: paymentsTable.companyId, companyName: companiesTable.name, companySlug: companiesTable.slug,
    plan: paymentsTable.plan, amount: paymentsTable.amount, periodMonths: paymentsTable.periodMonths,
    status: paymentsTable.status, proofViewUrl: paymentsTable.proofViewUrl, proofFileName: paymentsTable.proofFileName,
    submittedAt: paymentsTable.submittedAt, reviewedAt: paymentsTable.reviewedAt, reviewedByNote: paymentsTable.reviewedByNote,
    periodStart: paymentsTable.periodStart, periodEnd: paymentsTable.periodEnd,
  }).from(paymentsTable).leftJoin(companiesTable, eq(paymentsTable.companyId, companiesTable.id));

  const payments = await query.orderBy(desc(paymentsTable.submittedAt));
  let filtered = payments;
  if (status) filtered = filtered.filter(p => p.status === status);
  if (year) filtered = filtered.filter(p => new Date(p.submittedAt).getFullYear() === Number(year));
  if (month) filtered = filtered.filter(p => new Date(p.submittedAt).getMonth() + 1 === Number(month));
  res.json(filtered.map(p => ({ ...p, submittedAt: p.submittedAt.toISOString(), reviewedAt: p.reviewedAt?.toISOString() ?? null })));
});

router.put("/payments/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  const { note } = req.body;
  
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id));
  if (!payment) { res.status(404).json({ error: "Tidak ditemukan" }); return; }

  await db.update(paymentsTable).set({ status: "approved", reviewedAt: new Date(), reviewedByNote: note ?? null }).where(eq(paymentsTable.id, id));

  // Extend company subscription
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, payment.companyId));
  if (company) {
    const baseDate = company.subscriptionEndsAt && company.subscriptionEndsAt > new Date() ? company.subscriptionEndsAt : new Date();
    const newEnd = new Date(baseDate);
    if (payment.plan === "monthly") newEnd.setMonth(newEnd.getMonth() + payment.periodMonths);
    else if (payment.plan === "yearly") newEnd.setFullYear(newEnd.getFullYear() + payment.periodMonths);
    await db.update(companiesTable).set({ status: "active", plan: payment.plan as any, subscriptionEndsAt: newEnd, activatedAt: new Date(), updatedAt: new Date() }).where(eq(companiesTable.id, company.id));
    // Enforce plan limits after plan change
    await enforcePlanLimits(company.id);
    // Auto-create admin user and send email credentials if not yet exists
    const adminResult = await provisionCompanyAdmin(company);

    await writeAuditLog({
      action: "APPROVE_PAYMENT",
      performedByNik: req.user?.nik ?? "sysadmin",
      performedByName: req.user?.name ?? "Sysadmin",
      companyId: company.id,
      companyName: company.name,
      details: `Payment #${id} disetujui. Paket: ${payment.plan}, ${payment.periodMonths} bulan, Rp ${payment.amount.toLocaleString()}${note ? `. Catatan: ${note}` : ""}${!adminResult.alreadyExists ? `. Admin dibuat: NIK=${adminResult.nik}, email dikirim ke ${company.contactEmail}.` : ""}`,
      req,
    });
  }

  res.json({ success: true });
});

router.put("/payments/:id/reject", async (req, res) => {
  const id = Number(req.params.id);
  const { note } = req.body;
  
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id));
  const [company] = payment ? await db.select().from(companiesTable).where(eq(companiesTable.id, payment.companyId)) : [];
  await db.update(paymentsTable).set({ status: "rejected", reviewedAt: new Date(), reviewedByNote: note ?? null }).where(eq(paymentsTable.id, id));

  await writeAuditLog({
    action: "REJECT_PAYMENT",
    performedByNik: req.user?.nik ?? "sysadmin",
    performedByName: req.user?.name ?? "Sysadmin",
    companyId: payment?.companyId ?? null,
    companyName: company?.name ?? null,
    details: `Payment #${id} ditolak${note ? `. Alasan: ${note}` : ""}`,
    req,
  });

  res.json({ success: true });
});

// --- Audit Logs ---
router.get("/audit-logs", async (req, res) => {
  const { limit = "100", offset = "0", companyId } = req.query as Record<string, string>;
  let rows = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(Number(limit)).offset(Number(offset));
  if (companyId) rows = rows.filter(r => r.companyId === Number(companyId));
  res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// --- Reports ---
router.get("/reports/companies", async (req, res) => {
  const { month, year } = req.query as Record<string, string>;
  const companies = await db.select().from(companiesTable).orderBy(desc(companiesTable.createdAt));
  let filtered = companies;
  if (year) filtered = filtered.filter(c => new Date(c.createdAt).getFullYear() === Number(year));
  if (month) filtered = filtered.filter(c => new Date(c.createdAt).getMonth() + 1 === Number(month));

  const now = new Date();
  const summary = { total: companies.length, active: companies.filter(c => c.status === "active").length, pending: companies.filter(c => c.status === "pending").length, suspended: companies.filter(c => c.status === "suspended").length, expired: companies.filter(c => c.status === "active" && c.subscriptionEndsAt && c.subscriptionEndsAt < now).length, free: companies.filter(c => c.plan === "free").length, monthly: companies.filter(c => c.plan === "monthly").length, yearly: companies.filter(c => c.plan === "yearly").length };
  res.json({ summary, companies: filtered.map(c => ({ ...c, createdAt: c.createdAt.toISOString(), activatedAt: c.activatedAt?.toISOString() ?? null, subscriptionEndsAt: c.subscriptionEndsAt?.toISOString() ?? null, trialEndsAt: c.trialEndsAt?.toISOString() ?? null })) });
});

router.get("/reports/payments", async (req, res) => {
  const { month, year } = req.query as Record<string, string>;
  const payments = await db.select({ id: paymentsTable.id, companyId: paymentsTable.companyId, companyName: companiesTable.name, plan: paymentsTable.plan, amount: paymentsTable.amount, periodMonths: paymentsTable.periodMonths, status: paymentsTable.status, submittedAt: paymentsTable.submittedAt, reviewedAt: paymentsTable.reviewedAt }).from(paymentsTable).leftJoin(companiesTable, eq(paymentsTable.companyId, companiesTable.id)).orderBy(desc(paymentsTable.submittedAt));
  let filtered = payments;
  if (year) filtered = filtered.filter(p => new Date(p.submittedAt).getFullYear() === Number(year));
  if (month) filtered = filtered.filter(p => new Date(p.submittedAt).getMonth() + 1 === Number(month));
  const totalApproved = filtered.filter(p => p.status === "approved").reduce((s, p) => s + p.amount, 0);
  const totalPending = filtered.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  res.json({ summary: { totalApproved, totalPending, countApproved: filtered.filter(p => p.status === "approved").length, countPending: filtered.filter(p => p.status === "pending").length, countRejected: filtered.filter(p => p.status === "rejected").length }, payments: filtered.map(p => ({ ...p, submittedAt: p.submittedAt.toISOString(), reviewedAt: p.reviewedAt?.toISOString() ?? null })) });
});

// --- System Settings (QRIS, pricing) ---
router.get("/settings", async (_req, res) => {
  const rows = await db.select().from(systemSettingsTable);
  const obj: Record<string, string> = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  res.json(obj);
});

router.put("/settings", async (req, res) => {
  const { qrisImageUrl, priceMonthly, priceYearly, paymentMethod, bankName, bankAccountNumber, bankAccountName, bankNote } = req.body;
  const updates: { key: string; value: string }[] = [];
  if (qrisImageUrl !== undefined) updates.push({ key: "qris_image_url", value: qrisImageUrl });
  if (priceMonthly !== undefined) updates.push({ key: "price_monthly", value: String(priceMonthly) });
  if (priceYearly !== undefined) updates.push({ key: "price_yearly", value: String(priceYearly) });
  if (paymentMethod !== undefined) updates.push({ key: "payment_method", value: paymentMethod });
  if (bankName !== undefined) updates.push({ key: "bank_name", value: bankName });
  if (bankAccountNumber !== undefined) updates.push({ key: "bank_account_number", value: bankAccountNumber });
  if (bankAccountName !== undefined) updates.push({ key: "bank_account_name", value: bankAccountName });
  if (bankNote !== undefined) updates.push({ key: "bank_note", value: bankNote });
  for (const u of updates) {
    const [existing] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, u.key));
    if (existing) await db.update(systemSettingsTable).set({ value: u.value, updatedAt: new Date() }).where(eq(systemSettingsTable.key, u.key));
    else await db.insert(systemSettingsTable).values({ key: u.key, value: u.value });
  }
  res.json({ success: true });
});

// Upload QRIS image to GDrive
router.post("/settings/qris", upload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "File diperlukan" }); return; }
  try {
    const { fileId, viewUrl } = await uploadToGdrive(req.file.buffer, req.file.originalname, req.file.mimetype);
    await db.update(systemSettingsTable).set({ value: viewUrl, updatedAt: new Date() }).where(eq(systemSettingsTable.key, "qris_image_url"));
    const [existing] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "qris_drive_file_id"));
    if (existing) await db.update(systemSettingsTable).set({ value: fileId, updatedAt: new Date() }).where(eq(systemSettingsTable.key, "qris_drive_file_id"));
    else await db.insert(systemSettingsTable).values({ key: "qris_drive_file_id", value: fileId });
    res.json({ success: true, viewUrl });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- Payment GDrive Settings ---

// GET: return current payment GDrive config (private key masked)
router.get("/settings/payment-gdrive", async (_req, res) => {
  const [sysGdrive] = await db.select().from(gdriveSettingsTable).where(isNull(gdriveSettingsTable.companyId));
  if (sysGdrive) {
    res.json({
      clientEmail: sysGdrive.clientEmail,
      rootFolderId: sysGdrive.rootFolderId,
      hasPrivateKey: !!sysGdrive.privateKey,
      source: "custom",
    });
    return;
  }
  // Not configured yet — show KCI settings as preview
  const [kci] = await db.select().from(gdriveSettingsTable).where(eq(gdriveSettingsTable.companyId, 1));
  res.json({
    clientEmail: kci?.clientEmail ?? "",
    rootFolderId: kci?.rootFolderId ?? "",
    hasPrivateKey: !!(kci?.privateKey),
    source: "kci_preview",
  });
});

// PUT: save payment GDrive settings
router.put("/settings/payment-gdrive", async (req, res) => {
  const { clientEmail, privateKey, rootFolderId } = req.body as { clientEmail?: string; privateKey?: string; rootFolderId?: string };
  const [existing] = await db.select().from(gdriveSettingsTable).where(isNull(gdriveSettingsTable.companyId));
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (clientEmail !== undefined) updates.clientEmail = clientEmail;
  if (rootFolderId !== undefined) updates.rootFolderId = rootFolderId;
  if (privateKey && privateKey.trim() !== "") updates.privateKey = privateKey;

  if (existing) {
    await db.update(gdriveSettingsTable).set(updates as any).where(eq(gdriveSettingsTable.id, existing.id));
  } else {
    await db.insert(gdriveSettingsTable).values({
      companyId: null,
      clientEmail: (clientEmail ?? "") as string,
      privateKey: (privateKey ?? "") as string,
      rootFolderId: (rootFolderId ?? "") as string,
    });
  }
  res.json({ success: true });
});

// POST: copy GDrive settings from KCI to sysadmin payment GDrive
router.post("/settings/payment-gdrive/copy-kci", async (_req, res) => {
  const [kci] = await db.select().from(gdriveSettingsTable).where(eq(gdriveSettingsTable.companyId, 1));
  if (!kci || !kci.clientEmail) {
    res.status(404).json({ error: "Pengaturan GDrive KCI tidak ditemukan" });
    return;
  }
  const [existing] = await db.select().from(gdriveSettingsTable).where(isNull(gdriveSettingsTable.companyId));
  if (existing) {
    await db.update(gdriveSettingsTable).set({
      clientEmail: kci.clientEmail,
      privateKey: kci.privateKey,
      rootFolderId: kci.rootFolderId,
      updatedAt: new Date(),
    }).where(eq(gdriveSettingsTable.id, existing.id));
  } else {
    await db.insert(gdriveSettingsTable).values({
      companyId: null,
      clientEmail: kci.clientEmail,
      privateKey: kci.privateKey,
      rootFolderId: kci.rootFolderId,
    });
  }
  res.json({ success: true });
});

// --- Testimonials ---
router.get("/testimonials", async (_req, res) => {
  const rows = await db.select().from(testimonialsTable).orderBy(desc(testimonialsTable.createdAt));
  res.json(rows);
});

router.put("/testimonials/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { content, authorName, authorRole, authorCompany, rating, isActive } = req.body;
  const updates: Record<string, unknown> = {};
  if (content !== undefined) updates.content = content;
  if (authorName !== undefined) updates.authorName = authorName;
  if (authorRole !== undefined) updates.authorRole = authorRole;
  if (authorCompany !== undefined) updates.authorCompany = authorCompany;
  if (rating !== undefined) updates.rating = Number(rating);
  if (isActive !== undefined) updates.isActive = Boolean(isActive);
  const [updated] = await db.update(testimonialsTable).set(updates as any).where(eq(testimonialsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Tidak ditemukan" }); return; }
  res.json(updated);
});

router.delete("/testimonials/:id", async (req, res) => {
  await db.delete(testimonialsTable).where(eq(testimonialsTable.id, Number(req.params.id)));
  res.json({ success: true });
});

// --- Plans (Layanan) ---
router.get("/plans", async (_req, res) => {
  const rows = await db.select().from(plansTable).orderBy(plansTable.sortOrder, plansTable.id);
  res.json(rows);
});

router.post("/plans", async (req, res) => {
  const { name, slug, description, features, priceMonthly, priceYearly, maxUsers, durationMonths, maxTemplates, isActive, sortOrder } = req.body;
  const [plan] = await db.insert(plansTable).values({
    name, slug, description: description ?? "", features: features ?? "",
    priceMonthly: Number(priceMonthly ?? 0),
    priceYearly: Number(priceYearly ?? 0),
    maxUsers: maxUsers != null ? Number(maxUsers) : null,
    durationMonths: Number(durationMonths ?? 1),
    maxTemplates: maxTemplates != null ? Number(maxTemplates) : null,
    isActive: isActive !== false,
    sortOrder: Number(sortOrder ?? 0),
  }).returning();
  res.status(201).json(plan);
});

router.put("/plans/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, slug, description, features, priceMonthly, priceYearly, maxUsers, durationMonths, maxTemplates, isActive, sortOrder } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (slug !== undefined) updates.slug = slug;
  if (description !== undefined) updates.description = description;
  if (features !== undefined) updates.features = features;
  if (priceMonthly !== undefined) updates.priceMonthly = Number(priceMonthly);
  if (priceYearly !== undefined) updates.priceYearly = Number(priceYearly);
  if ("maxUsers" in req.body) updates.maxUsers = maxUsers != null ? Number(maxUsers) : null;
  if (durationMonths !== undefined) updates.durationMonths = Number(durationMonths);
  if ("maxTemplates" in req.body) updates.maxTemplates = maxTemplates != null ? Number(maxTemplates) : null;
  if (isActive !== undefined) updates.isActive = Boolean(isActive);
  if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);
  const [updated] = await db.update(plansTable).set(updates as any).where(eq(plansTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Tidak ditemukan" }); return; }
  res.json(updated);
});

router.delete("/plans/:id", async (req, res) => {
  await db.delete(plansTable).where(eq(plansTable.id, Number(req.params.id)));
  res.json({ success: true });
});

export default router;
