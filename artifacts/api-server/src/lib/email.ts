import nodemailer from "nodemailer";
import { db, smtpSettingsTable } from "@workspace/db";

export async function getSmtpTransporter() {
  const [settings] = await db.select().from(smtpSettingsTable);
  if (!settings || !settings.host || !settings.username) return null;

  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.protocol === "TLS",
    requireTLS: settings.protocol === "STARTTLS",
    auth: { user: settings.username, pass: settings.password },
  });
}

export async function sendEmail(to: string | string[], subject: string, html: string) {
  const [settings] = await db.select().from(smtpSettingsTable);
  if (!settings?.host) return { success: false, error: "SMTP not configured" };

  const transporter = await getSmtpTransporter();
  if (!transporter) return { success: false, error: "Cannot create transporter" };

  const from = `"${settings.fromName}" <${settings.fromEmail || settings.username}>`;
  try {
    await transporter.sendMail({ from, to, subject, html });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: String(err) };
  }
}

export function incidentEmailHtml(incident: {
  id: number; detail: string; categoryName?: string; plantName?: string;
  incidentDate: string; reporterName?: string; assignedGroupName?: string;
}) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1e3a5f;color:white;padding:20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">🚨 Hazard & Incident Baru #${incident.id}</h2>
      </div>
      <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;color:#6b7280;width:40%">Tanggal Kejadian</td><td style="padding:8px;font-weight:600">${incident.incidentDate}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Kategori</td><td style="padding:8px;font-weight:600">${incident.categoryName ?? "-"}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Plant</td><td style="padding:8px;font-weight:600">${incident.plantName ?? "-"}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Dilaporkan Oleh</td><td style="padding:8px;font-weight:600">${incident.reporterName ?? "-"}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Ditugaskan ke Group</td><td style="padding:8px;font-weight:600;color:#1e3a5f">${incident.assignedGroupName ?? "-"}</td></tr>
        </table>
        <div style="margin-top:16px;padding:12px;background:white;border-radius:6px;border-left:4px solid #ef4444">
          <p style="margin:0;color:#374151"><strong>Detail:</strong></p>
          <p style="margin:8px 0 0;color:#4b5563">${incident.detail}</p>
        </div>
        <p style="margin-top:20px;color:#9ca3af;font-size:12px">Harap segera tindak lanjuti incident ini di Sistem HSE.</p>
      </div>
    </div>
  `;
}

export function newUserEmailHtml(user: {
  name: string; nik: string; email: string; password: string; role: string;
}) {
  const roleLabel: Record<string, string> = { admin: "Admin", supervisor: "Supervisor", employee: "Employee" };
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1e3a5f;color:white;padding:20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">👋 Selamat Datang di Sistem HSE</h2>
      </div>
      <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
        <p style="color:#374151">Halo <strong>${user.name}</strong>, akun Anda telah dibuat. Berikut adalah informasi login Anda:</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0">
          <tr><td style="padding:8px;color:#6b7280;width:40%">Nama</td><td style="padding:8px;font-weight:600">${user.name}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">NIK (Username)</td><td style="padding:8px;font-weight:700;font-size:16px;color:#1e3a5f">${user.nik}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Password</td><td style="padding:8px;font-weight:700;font-size:16px;color:#1e3a5f">${user.password}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Role</td><td style="padding:8px">${roleLabel[user.role] ?? user.role}</td></tr>
        </table>
        <div style="margin-top:12px;padding:12px;background:#fef3c7;border-radius:6px;border-left:4px solid #f59e0b">
          <p style="margin:0;color:#92400e;font-size:13px">⚠️ Harap simpan informasi ini dengan aman dan segera ganti password Anda setelah login pertama.</p>
        </div>
        <p style="margin-top:20px;color:#9ca3af;font-size:12px">Email ini dikirim secara otomatis oleh Sistem HSE.</p>
      </div>
    </div>
  `;
}

export function passwordResetEmailHtml(user: {
  name: string; nik: string; newPassword: string; resetBy: string;
}) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1e3a5f;color:white;padding:20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">🔑 Password Anda Telah Direset</h2>
      </div>
      <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
        <p style="color:#374151">Halo <strong>${user.name}</strong>, password akun Anda telah direset oleh administrator (<strong>${user.resetBy}</strong>).</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0">
          <tr><td style="padding:8px;color:#6b7280;width:40%">NIK (Username)</td><td style="padding:8px;font-weight:700;font-size:16px;color:#1e3a5f">${user.nik}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Password Baru</td><td style="padding:8px;font-weight:700;font-size:16px;color:#1e3a5f">${user.newPassword}</td></tr>
        </table>
        <div style="margin-top:12px;padding:12px;background:#fef3c7;border-radius:6px;border-left:4px solid #f59e0b">
          <p style="margin:0;color:#92400e;font-size:13px">⚠️ Harap segera login dan ganti password Anda ke password yang lebih aman.</p>
        </div>
        <p style="margin-top:20px;color:#9ca3af;font-size:12px">Jika Anda tidak merasa mereset password, segera hubungi administrator.</p>
      </div>
    </div>
  `;
}

export function scheduleReminderHtml(schedule: {
  id: number; templateName?: string; plantName?: string;
  frequency: string; groupName?: string; supervisorName?: string;
  dueDate: string;
}) {
  const freqLabel: Record<string, string> = { daily: "Harian", weekly: "Mingguan", monthly: "Bulanan" };
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1e3a5f;color:white;padding:20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">📋 Pengingat Jadwal Inspeksi</h2>
      </div>
      <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
        <p style="color:#374151">Jadwal inspeksi berikut jatuh tempo besok (<strong>${schedule.dueDate}</strong>):</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;color:#6b7280;width:40%">Template</td><td style="padding:8px;font-weight:600">${schedule.templateName ?? "-"}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Plant</td><td style="padding:8px;font-weight:600">${schedule.plantName ?? "-"}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Frekuensi</td><td style="padding:8px">${freqLabel[schedule.frequency] ?? schedule.frequency}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Group Bertugas</td><td style="padding:8px;font-weight:600">${schedule.groupName ?? schedule.supervisorName ?? "-"}</td></tr>
        </table>
        <p style="margin-top:20px;color:#9ca3af;font-size:12px">Harap lakukan inspeksi sesuai jadwal yang telah ditetapkan.</p>
      </div>
    </div>
  `;
}

export function incidentTargetReminderHtml(incident: {
  id: number;
  detail: string;
  categoryName?: string;
  plantName?: string;
  targetDate: string;
  reporterName?: string;
  assignedGroupName?: string;
  type: "H-1" | "H";
}) {
  const isH = incident.type === "H";
  const headerColor = isH ? "#dc2626" : "#d97706";
  const icon = isH ? "🔴" : "⏰";
  const title = isH
    ? `${icon} Hari Ini Batas Penyelesaian Incident #${incident.id}`
    : `${icon} Pengingat H-1: Besok Batas Penyelesaian Incident #${incident.id}`;
  const subtitle = isH
    ? `Incident berikut harus diselesaikan <strong>hari ini</strong> (${incident.targetDate}):`
    : `Incident berikut harus diselesaikan <strong>besok</strong> (${incident.targetDate}):`;

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:${headerColor};color:white;padding:20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">${title}</h2>
      </div>
      <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
        <p style="color:#374151">${subtitle}</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;color:#6b7280;width:40%">Target Penyelesaian</td><td style="padding:8px;font-weight:700;color:${headerColor}">${incident.targetDate}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Kategori</td><td style="padding:8px;font-weight:600">${incident.categoryName ?? "-"}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Plant</td><td style="padding:8px;font-weight:600">${incident.plantName ?? "-"}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Dilaporkan Oleh</td><td style="padding:8px;font-weight:600">${incident.reporterName ?? "-"}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">PIC Group</td><td style="padding:8px;font-weight:600;color:#1e3a5f">${incident.assignedGroupName ?? "-"}</td></tr>
        </table>
        <div style="margin-top:16px;padding:12px;background:white;border-radius:6px;border-left:4px solid ${headerColor}">
          <p style="margin:0;color:#374151"><strong>Detail Incident:</strong></p>
          <p style="margin:8px 0 0;color:#4b5563">${incident.detail}</p>
        </div>
        <div style="margin-top:16px;padding:12px;background:${isH ? "#fee2e2" : "#fef3c7"};border-radius:6px">
          <p style="margin:0;color:${isH ? "#991b1b" : "#92400e"};font-weight:600;font-size:13px">
            ${isH ? "⚠️ Harap segera selesaikan dan tutup incident ini hari ini." : "⚠️ Harap persiapkan penyelesaian incident ini sebelum batas waktu besok."}
          </p>
        </div>
        <p style="margin-top:20px;color:#9ca3af;font-size:12px">Notifikasi otomatis dari Sistem HSE.</p>
      </div>
    </div>
  `;
}

export function incidentEscalationHtml(incident: {
  id: number;
  detail: string;
  categoryName?: string;
  plantName?: string;
  reporterName?: string;
  assignedGroupName?: string;
  createdAt: string;
  hoursOpen: number;
}) {
  const h = incident.hoursOpen;
  const level = h >= 72 ? 3 : h >= 48 ? 2 : 1;
  const colors: Record<number, string> = { 1: "#d97706", 2: "#dc2626", 3: "#7f1d1d" };
  const color = colors[level]!;
  const labels: Record<number, string> = { 1: "24 Jam", 2: "48 Jam", 3: "72 Jam" };
  const urgency = level === 3 ? "🚨 KRITIS" : level === 2 ? "🔴 Mendesak" : "⚠️ Perhatian";
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:${color};color:white;padding:20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">${urgency} Incident Belum Ditindak — ${labels[level]}</h2>
        <p style="margin:6px 0 0;opacity:0.9;font-size:14px">Incident #${incident.id} telah terbuka selama lebih dari ${labels[level]} tanpa penyelesaian</p>
      </div>
      <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;color:#6b7280;width:40%">Dibuat Pada</td><td style="padding:8px;font-weight:600">${incident.createdAt}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Sudah Terbuka</td><td style="padding:8px;font-weight:700;color:${color}">${Math.floor(incident.hoursOpen)} jam</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Kategori</td><td style="padding:8px;font-weight:600">${incident.categoryName ?? "-"}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Plant</td><td style="padding:8px;font-weight:600">${incident.plantName ?? "-"}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Dilaporkan Oleh</td><td style="padding:8px;font-weight:600">${incident.reporterName ?? "-"}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">PIC Group</td><td style="padding:8px;font-weight:600;color:#1e3a5f">${incident.assignedGroupName ?? "-"}</td></tr>
        </table>
        <div style="margin-top:16px;padding:12px;background:white;border-radius:6px;border-left:4px solid ${color}">
          <p style="margin:0;color:#374151"><strong>Detail Incident:</strong></p>
          <p style="margin:8px 0 0;color:#4b5563">${incident.detail}</p>
        </div>
        <div style="margin-top:16px;padding:12px;background:#fef2f2;border-radius:6px">
          <p style="margin:0;color:#991b1b;font-weight:700;font-size:14px">
            🚫 Harap segera tindak lanjuti dan selesaikan incident ini. Incident yang dibiarkan terlalu lama dapat berdampak pada keselamatan kerja.
          </p>
        </div>
        <p style="margin-top:20px;color:#9ca3af;font-size:12px">Notifikasi eskalasi otomatis dari Sistem HSE.</p>
      </div>
    </div>
  `;
}
