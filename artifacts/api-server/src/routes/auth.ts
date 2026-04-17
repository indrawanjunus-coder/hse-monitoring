import { Router } from "express";
import { db, usersTable, departmentsTable, companiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, createToken, hashPassword, verifyPassword } from "../lib/auth";

const router = Router();

router.post("/login", async (req, res) => {
  const { nik, password, companySlug } = req.body;
  if (!nik || !password) {
    res.status(400).json({ message: "NIK dan password diperlukan" }); return;
  }

  let users;
  if (companySlug) {
    // Company portal login: find user by NIK + companySlug
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.slug, companySlug));
    if (!company) {
      res.status(404).json({ message: "Company tidak ditemukan" }); return;
    }
    users = await db.select().from(usersTable).where(
      and(eq(usersTable.nik, nik), eq(usersTable.companyId, company.id))
    );
  } else {
    // Direct login (sysadmin)
    users = await db.select().from(usersTable).where(eq(usersTable.nik, nik));
    if (users.length > 0 && users[0]!.role !== "sysadmin") {
      // Non-sysadmin must login via company portal
      res.status(400).json({ message: "Gunakan portal company Anda untuk login" }); return;
    }
  }

  if (users.length === 0) {
    res.status(401).json({ message: "NIK atau password salah" }); return;
  }
  const user = users[0]!;
  // [SECURITY H2] Pass userId so legacy SHA-256 hashes auto-migrate to bcrypt on login
  const valid = await verifyPassword(password, user.passwordHash, user.id);
  if (!valid) {
    res.status(401).json({ message: "NIK atau password salah" }); return;
  }
  // Check if user account is active (may be auto-deactivated due to plan limit)
  if (!user.isActive) {
    res.status(403).json({ message: "Akun Anda telah dinonaktifkan karena keterbatasan paket langganan. Hubungi admin perusahaan Anda.", code: "ACCOUNT_DEACTIVATED" });
    return;
  }

  // Check subscription for company users
  if (user.companyId && user.role !== "sysadmin") {
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, user.companyId));
    if (company) {
      const now = new Date();
      if (company.status === "pending") {
        res.status(402).json({ message: "Akun company Anda menunggu aktivasi oleh admin sistem.", code: "PENDING_ACTIVATION", company: { id: company.id, slug: company.slug, name: company.name, plan: company.plan, status: company.status } });
        return;
      }
      if (company.status === "suspended") {
        res.status(402).json({ message: "Akun company Anda ditangguhkan. Hubungi admin sistem.", code: "SUSPENDED", company: { id: company.id, slug: company.slug, name: company.name, plan: company.plan, status: company.status } });
        return;
      }
      // Check expiry
      const endsAt = company.subscriptionEndsAt ?? company.trialEndsAt;
      if (endsAt && endsAt < now) {
        res.status(402).json({
          message: "Langganan Anda telah berakhir. Lakukan pembayaran untuk melanjutkan.",
          code: "SUBSCRIPTION_EXPIRED",
          company: { id: company.id, slug: company.slug, name: company.name, plan: company.plan, status: company.status, subscriptionEndsAt: endsAt.toISOString() }
        });
        return;
      }
    }
  }

  const tokenUser = { id: user.id, nik: user.nik, name: user.name, email: user.email ?? null, role: user.role, companyId: user.companyId ?? null };
  const token = createToken(tokenUser);

  let companyInfo = null;
  if (user.companyId) {
    const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, user.companyId));
    if (co) companyInfo = { id: co.id, slug: co.slug, name: co.name, plan: co.plan, status: co.status, subscriptionEndsAt: co.subscriptionEndsAt?.toISOString() ?? null };
  }

  res.json({ token, user: { ...tokenUser, departmentId: user.departmentId, isHead: user.isHead, groupIds: [], createdAt: user.createdAt.toISOString(), company: companyInfo } });
});

router.get("/me", authMiddleware, async (req, res) => {
  const user = req.user!;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  if (users.length === 0) { res.status(404).json({ message: "User not found" }); return; }
  const u = users[0]!;
  const { groupMembersTable } = await import("@workspace/db");
  const groupMembers = await db.select().from(groupMembersTable).where(eq(groupMembersTable.userId, u.id));
  const groupIds = groupMembers.map((gm) => gm.groupId);

  let departmentName: string | undefined;
  if (u.departmentId) {
    const depts = await db.select().from(departmentsTable).where(eq(departmentsTable.id, u.departmentId));
    departmentName = depts[0]?.name;
  }

  let companyInfo = null;
  if (u.companyId) {
    const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, u.companyId));
    if (co) companyInfo = { id: co.id, slug: co.slug, name: co.name, plan: co.plan, status: co.status, subscriptionEndsAt: co.subscriptionEndsAt?.toISOString() ?? null };
  }

  res.json({ id: u.id, nik: u.nik, name: u.name, email: u.email, role: u.role, departmentId: u.departmentId, departmentName, isHead: u.isHead, groupIds, createdAt: u.createdAt.toISOString(), companyId: u.companyId, company: companyInfo });
});

// Public: resolve company by slug
router.get("/company/:slug", async (req, res) => {
  const [co] = await db.select({
    id: companiesTable.id, slug: companiesTable.slug, name: companiesTable.name, plan: companiesTable.plan, status: companiesTable.status,
  }).from(companiesTable).where(eq(companiesTable.slug, req.params.slug));
  if (!co) { res.status(404).json({ message: "Company tidak ditemukan" }); return; }
  res.json(co);
});

// Public: register new company (no admin created here — created on activation)
router.post("/register", async (req, res) => {
  const { companyName, companySlug, contactName, contactEmail, contactPhone, plan } = req.body;
  if (!companyName || !companySlug || !contactName || !contactEmail || !plan) {
    res.status(400).json({ message: "Semua field harus diisi" }); return;
  }
  const slug = companySlug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const [existing] = await db.select({ id: companiesTable.id }).from(companiesTable).where(eq(companiesTable.slug, slug));
  if (existing) { res.status(409).json({ message: "Slug company sudah digunakan" }); return; }

  const trialEndsAt = new Date();
  trialEndsAt.setMonth(trialEndsAt.getMonth() + 1);

  const [company] = await db.insert(companiesTable).values({
    slug, name: companyName, contactName, contactEmail, contactPhone: contactPhone ?? null,
    plan, status: "pending", trialEndsAt: plan === "free" ? trialEndsAt : null,
  }).returning();

  if (!company) { res.status(500).json({ message: "Gagal membuat company" }); return; }

  res.json({ success: true, company: { id: company.id, slug: company.slug, name: company.name, plan: company.plan, status: company.status } });
});

export default router;
