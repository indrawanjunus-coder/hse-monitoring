import { Router } from "express";
import { db, smtpSettingsTable, groupsTable, groupMembersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { getSmtpTransporter } from "../lib/email";

const router = Router();
router.use(authMiddleware);

// GET current SMTP settings (password masked)
router.get("/", async (_req, res) => {
  const [settings] = await db.select().from(smtpSettingsTable);
  if (!settings) {
    res.json({ id: null, host: "", port: 587, protocol: "STARTTLS", username: "", fromName: "HSE System", fromEmail: "", passwordSet: false });
    return;
  }
  res.json({
    id: settings.id,
    host: settings.host,
    port: settings.port,
    protocol: settings.protocol,
    username: settings.username,
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
    passwordSet: !!settings.password,
    updatedAt: settings.updatedAt.toISOString(),
  });
});

// PUT upsert SMTP settings
router.put("/", async (req, res) => {
  const { host, port, protocol, username, password, fromName, fromEmail } = req.body;
  const [existing] = await db.select().from(smtpSettingsTable);

  if (existing) {
    const updates: Record<string, unknown> = { host, port, protocol, username, fromName, fromEmail, updatedAt: new Date() };
    if (password) updates.password = password;
    const [updated] = await db.update(smtpSettingsTable).set(updates).where(eq(smtpSettingsTable.id, existing.id)).returning();
    res.json({ ...updated, passwordSet: !!updated?.password, password: undefined });
  } else {
    const [created] = await db.insert(smtpSettingsTable).values({
      host, port: port ?? 587, protocol: protocol ?? "STARTTLS",
      username, password: password ?? "", fromName: fromName ?? "HSE System", fromEmail: fromEmail ?? "",
    }).returning();
    res.status(201).json({ ...created, passwordSet: !!created?.password, password: undefined });
  }
});

// POST test SMTP connection
router.post("/test", async (req, res) => {
  const { testEmail } = req.body;
  if (!testEmail) { res.status(400).json({ message: "testEmail required" }); return; }
  const transporter = await getSmtpTransporter();
  if (!transporter) { res.status(400).json({ message: "SMTP not configured. Please save settings first." }); return; }
  try {
    await transporter.verify();
    const [settings] = await db.select().from(smtpSettingsTable);
    await transporter.sendMail({
      from: `"${settings?.fromName ?? "HSE System"}" <${settings?.fromEmail || settings?.username}>`,
      to: testEmail,
      subject: "Test Email HSE System",
      html: "<p>Email SMTP berhasil dikonfigurasi! Sistem notifikasi HSE siap digunakan.</p>",
    });
    res.json({ success: true, message: "Test email berhasil dikirim" });
  } catch (err) {
    res.status(400).json({ success: false, message: String(err) });
  }
});

export default router;
