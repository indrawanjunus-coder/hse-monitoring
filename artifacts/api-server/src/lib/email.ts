import nodemailer from "nodemailer";
import { db, smtpSettingsTable } from "@workspace/db";
export { workPermitEmailHtml } from "./work-permit-email";

// [SECURITY H6] Escape all user-supplied values before embedding in HTML email templates
// Prevents HTML/script injection via incident details, names, categories, etc.
function e(value: unknown): string {
  if (value === null || value === undefined) return "-";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

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
          <tr><td style="padding:8px;color:#6b7280;width:40%">Tanggal Kejadian</td><td style="padding:8px;font-weight:600">${e(incident.incidentDate)}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Kategori</td><td style="padding:8px;font-weight:600">${e(incident.categoryName)}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Plant</td><td style="padding:8px;font-weight:600">${e(incident.plantName)}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Dilaporkan Oleh</td><td style="padding:8px;font-weight:600">${e(incident.reporterName)}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Ditugaskan ke Group</td><td style="padding:8px;font-weight:600;color:#1e3a5f">${e(incident.assignedGroupName)}</td></tr>
        </table>
        <div style="margin-top:16px;padding:12px;background:white;border-radius:6px;border-left:4px solid #ef4444">
          <p style="margin:0;color:#374151"><strong>Detail:</strong></p>
          <p style="margin:8px 0 0;color:#4b5563">${e(incident.detail)}</p>
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
        <p style="color:#374151">Halo <strong>${e(user.name)}</strong>, akun Anda telah dibuat. Berikut adalah informasi login Anda:</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0">
          <tr><td style="padding:8px;color:#6b7280;width:40%">Nama</td><td style="padding:8px;font-weight:600">${e(user.name)}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">NIK (Username)</td><td style="padding:8px;font-weight:700;font-size:16px;color:#1e3a5f">${e(user.nik)}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Password</td><td style="padding:8px;font-weight:700;font-size:16px;color:#1e3a5f">${e(user.password)}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Role</td><td style="padding:8px">${e(roleLabel[user.role] ?? user.role)}</td></tr>
        </table>
        <div style="margin-top:12px;padding:12px;background:#fef3c7;border-radius:6px;border-left:4px solid #f59e0b">
          <p style="margin:0;color:#92400e;font-size:13px">⚠️ Harap simpan informasi ini dengan aman dan segera ganti password Anda setelah login pertama.</p>
        </div>
        <p style="margin-top:20px;color:#9ca3af;font-size:12px">Email ini dikirim secara otomatis oleh Sistem HSE.</p>
      </div>
    </div>
  `;
}

export function companyActivationEmailHtml(data: {
  companyName: string; contactName: string; portalUrl: string; nik: string; password: string;
}) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1e3a5f;color:white;padding:24px 20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">🎉 Akun Perusahaan Anda Telah Diaktifkan</h2>
        <p style="margin:8px 0 0;opacity:0.8;font-size:14px">H&A Monitoring System</p>
      </div>
      <div style="background:#f9fafb;padding:24px 20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
        <p style="color:#374151;margin-top:0">Halo <strong>${e(data.contactName)}</strong>,</p>
        <p style="color:#374151">Selamat! Akun perusahaan <strong>${e(data.companyName)}</strong> telah berhasil diaktifkan di H&A Monitoring System.</p>
        <p style="color:#374151;font-weight:600">Berikut adalah informasi login admin portal Anda:</p>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:16px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:10px 8px;color:#6b7280;width:40%;border-bottom:1px solid #f3f4f6">URL Portal</td>
              <td style="padding:10px 8px;font-weight:600;color:#1d4ed8;border-bottom:1px solid #f3f4f6">
                <a href="${e(data.portalUrl)}" style="color:#1d4ed8">${e(data.portalUrl)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 8px;color:#6b7280;border-bottom:1px solid #f3f4f6">NIK (Username)</td>
              <td style="padding:10px 8px;font-weight:700;font-size:18px;color:#1e3a5f;border-bottom:1px solid #f3f4f6;letter-spacing:1px">${e(data.nik)}</td>
            </tr>
            <tr>
              <td style="padding:10px 8px;color:#6b7280">Password</td>
              <td style="padding:10px 8px;font-weight:700;font-size:18px;color:#1e3a5f;letter-spacing:2px">${e(data.password)}</td>
            </tr>
          </table>
        </div>
        <div style="padding:14px;background:#fef3c7;border-radius:6px;border-left:4px solid #f59e0b;margin:16px 0">
          <p style="margin:0;color:#92400e;font-size:13px">⚠️ <strong>Penting:</strong> Simpan informasi ini dengan aman. Segera ganti password Anda setelah login pertama kali.</p>
        </div>
        <div style="padding:14px;background:#eff6ff;border-radius:6px;border-left:4px solid #3b82f6;margin:16px 0">
          <p style="margin:0;color:#1e40af;font-size:13px">💡 Setelah login, Anda dapat menambahkan pengguna lain, mengatur inspeksi, dan mengelola insiden HSE perusahaan Anda.</p>
        </div>
        <p style="margin-top:20px;color:#9ca3af;font-size:12px">Email ini dikirim secara otomatis oleh Sistem H&A Monitoring. Jika Anda tidak merasa mendaftar, abaikan email ini.</p>
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
        <p style="color:#374151">Halo <strong>${e(user.name)}</strong>, password akun Anda telah direset oleh administrator (<strong>${e(user.resetBy)}</strong>).</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0">
          <tr><td style="padding:8px;color:#6b7280;width:40%">NIK (Username)</td><td style="padding:8px;font-weight:700;font-size:16px;color:#1e3a5f">${e(user.nik)}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Password Baru</td><td style="padding:8px;font-weight:700;font-size:16px;color:#1e3a5f">${e(user.newPassword)}</td></tr>
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
        <p style="color:#374151">Jadwal inspeksi berikut jatuh tempo besok (<strong>${e(schedule.dueDate)}</strong>):</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;color:#6b7280;width:40%">Template</td><td style="padding:8px;font-weight:600">${e(schedule.templateName)}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Plant</td><td style="padding:8px;font-weight:600">${e(schedule.plantName)}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Frekuensi</td><td style="padding:8px">${e(freqLabel[schedule.frequency] ?? schedule.frequency)}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Group Bertugas</td><td style="padding:8px;font-weight:600">${e(schedule.groupName ?? schedule.supervisorName)}</td></tr>
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
          <tr><td style="padding:8px;color:#6b7280;width:40%">Target Penyelesaian</td><td style="padding:8px;font-weight:700;color:${headerColor}">${e(incident.targetDate)}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Kategori</td><td style="padding:8px;font-weight:600">${e(incident.categoryName)}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Plant</td><td style="padding:8px;font-weight:600">${e(incident.plantName)}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Dilaporkan Oleh</td><td style="padding:8px;font-weight:600">${e(incident.reporterName)}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">PIC Group</td><td style="padding:8px;font-weight:600;color:#1e3a5f">${e(incident.assignedGroupName)}</td></tr>
        </table>
        <div style="margin-top:16px;padding:12px;background:white;border-radius:6px;border-left:4px solid ${headerColor}">
          <p style="margin:0;color:#374151"><strong>Detail Incident:</strong></p>
          <p style="margin:8px 0 0;color:#4b5563">${e(incident.detail)}</p>
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
          <tr><td style="padding:8px;color:#6b7280;width:40%">Dibuat Pada</td><td style="padding:8px;font-weight:600">${e(incident.createdAt)}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Sudah Terbuka</td><td style="padding:8px;font-weight:700;color:${color}">${Math.floor(incident.hoursOpen)} jam</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Kategori</td><td style="padding:8px;font-weight:600">${e(incident.categoryName)}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">Plant</td><td style="padding:8px;font-weight:600">${e(incident.plantName)}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Dilaporkan Oleh</td><td style="padding:8px;font-weight:600">${e(incident.reporterName)}</td></tr>
          <tr style="background:white"><td style="padding:8px;color:#6b7280">PIC Group</td><td style="padding:8px;font-weight:600;color:#1e3a5f">${e(incident.assignedGroupName)}</td></tr>
        </table>
        <div style="margin-top:16px;padding:12px;background:white;border-radius:6px;border-left:4px solid ${color}">
          <p style="margin:0;color:#374151"><strong>Detail Incident:</strong></p>
          <p style="margin:8px 0 0;color:#4b5563">${e(incident.detail)}</p>
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

export function subscriptionExpiryEmailHtml(params: {
  companyName: string;
  contactName: string;
  daysLeft: number;
  subscriptionEndsAt: string;
  planLabel: string;
  portalUrl: string;
  paymentMethod: "qris" | "transfer";
  qrisImageUrl?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  priceMonthly: number;
  priceYearly: number;
}): string {
  const {
    companyName, contactName, daysLeft, subscriptionEndsAt, planLabel,
    portalUrl, paymentMethod, qrisImageUrl, bankName, bankAccountNumber, bankAccountName,
    priceMonthly, priceYearly,
  } = params;

  const isUrgent = daysLeft <= 2;
  const urgencyColor = isUrgent ? "#dc2626" : daysLeft <= 15 ? "#d97706" : "#2563eb";
  const urgencyBg = isUrgent ? "#fef2f2" : daysLeft <= 15 ? "#fffbeb" : "#eff6ff";
  const urgencyLabel = isUrgent ? `⚠️ SEGERA — ${daysLeft} hari lagi` : `📅 ${daysLeft} hari lagi`;

  const fmtRp = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

  const paymentSection = paymentMethod === "qris" && qrisImageUrl ? `
    <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;text-align:center">
      <p style="margin:0 0 12px;font-size:14px;color:#374151;font-weight:600">Scan QRIS untuk membayar:</p>
      <img src="${e(qrisImageUrl)}" alt="QRIS" style="max-width:200px;border-radius:8px;border:1px solid #e5e7eb" />
    </div>
  ` : paymentMethod === "transfer" && bankAccountNumber ? `
    <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px">
      <p style="margin:0 0 12px;font-size:14px;color:#374151;font-weight:600">Transfer ke rekening:</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        ${bankName ? `<tr><td style="color:#6b7280;padding:4px 0">Bank</td><td style="font-weight:600;color:#111827;text-align:right">${e(bankName)}</td></tr>` : ""}
        ${bankAccountNumber ? `<tr><td style="color:#6b7280;padding:4px 0">No. Rekening</td><td style="font-weight:700;color:#111827;text-align:right;letter-spacing:1px">${e(bankAccountNumber)}</td></tr>` : ""}
        ${bankAccountName ? `<tr><td style="color:#6b7280;padding:4px 0">Atas Nama</td><td style="font-weight:600;color:#111827;text-align:right">${e(bankAccountName)}</td></tr>` : ""}
      </table>
    </div>
  ` : `<p style="font-size:14px;color:#6b7280;margin-top:12px">Hubungi admin untuk informasi pembayaran.</p>`;

  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px">
      <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#1d4ed8;padding:20px 24px">
          <h1 style="margin:0;color:white;font-size:18px;font-weight:700">H&A Monitoring System</h1>
          <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px">Notifikasi Perpanjangan Langganan</p>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 16px;font-size:15px;color:#374151">Yth. <strong>${e(contactName)}</strong>,</p>

          <div style="padding:14px 16px;background:${urgencyBg};border-radius:8px;border-left:4px solid ${urgencyColor};margin-bottom:20px">
            <p style="margin:0;color:${urgencyColor};font-weight:700;font-size:15px">${e(urgencyLabel)}</p>
            <p style="margin:6px 0 0;color:#374151;font-size:14px">
              Langganan <strong>${e(companyName)}</strong> (${e(planLabel)}) akan berakhir pada <strong>${e(subscriptionEndsAt)}</strong>.
            </p>
          </div>

          <p style="font-size:14px;color:#374151;margin:0 0 8px">Segera perpanjang langganan agar akses sistem HSE Anda tidak terganggu.</p>
          <p style="font-size:14px;color:#374151;margin:0 0 16px">
            <strong>Harga perpanjangan:</strong> Bulanan ${fmtRp(priceMonthly)} · Tahunan ${fmtRp(priceYearly)}
          </p>

          ${paymentSection}

          <div style="margin-top:20px;text-align:center">
            <a href="${e(portalUrl)}" style="display:inline-block;background:#1d4ed8;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
              Upload Bukti Bayar →
            </a>
          </div>

          <p style="margin-top:20px;font-size:13px;color:#6b7280">
            Setelah pembayaran dikonfirmasi oleh admin, akses Anda akan diperpanjang otomatis.<br/>
            Jika sudah melakukan pembayaran, abaikan email ini.
          </p>
        </div>
        <div style="padding:16px 24px;border-top:1px solid #f3f4f6;background:#f9fafb">
          <p style="margin:0;font-size:12px;color:#9ca3af">Notifikasi otomatis dari H&A Monitoring System · <a href="${e(portalUrl)}" style="color:#6b7280">${e(portalUrl)}</a></p>
        </div>
      </div>
    </div>
  `;
}
