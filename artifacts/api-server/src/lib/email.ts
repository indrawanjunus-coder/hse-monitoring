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
