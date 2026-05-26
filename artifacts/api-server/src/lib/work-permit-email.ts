function e(v: unknown): string {
  if (v === null || v === undefined) return "-";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function workPermitEmailHtml(p: {
  name: string; phone: string; email: string;
  emergencyName: string; emergencyPhone: string;
  workStart: string; workEnd: string;
  supervisorName: string; supervisorPhone: string;
  typeName: string; typeDescription: string;
  notes: string | null; permitCode: string;
  qrDataUrl: string; scanUrl: string;
}): string {
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:24px">
  <div style="background:#1e293b;border-radius:12px;padding:24px 28px;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <div style="background:#2563eb;width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center">
        <span style="color:white;font-weight:bold;font-size:16px">H</span>
      </div>
      <div>
        <div style="color:white;font-weight:700;font-size:15px">H&amp;A Monitoring System</div>
        <div style="color:#94a3b8;font-size:12px">Work Permit</div>
      </div>
    </div>
    <h1 style="color:white;font-size:22px;font-weight:700;margin:0">Work Permit Diterbitkan</h1>
    <p style="color:#94a3b8;font-size:13px;margin:6px 0 0">Permit Anda telah berhasil diterbitkan. Tunjukkan QR code ini kepada petugas keamanan.</p>
  </div>

  <div style="background:white;border-radius:12px;padding:24px;margin-bottom:16px;border:1px solid #e2e8f0">
    <h2 style="font-size:14px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 16px">Data Pemegang Permit</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:170px">Nama</td><td style="padding:6px 0;font-weight:600;color:#1e293b;font-size:13px">${e(p.name)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">No. HP</td><td style="padding:6px 0;color:#1e293b;font-size:13px">${e(p.phone)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Email</td><td style="padding:6px 0;color:#1e293b;font-size:13px">${e(p.email)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Kontak Darurat</td><td style="padding:6px 0;color:#1e293b;font-size:13px">${e(p.emergencyName)} · ${e(p.emergencyPhone)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Atasan</td><td style="padding:6px 0;color:#1e293b;font-size:13px">${e(p.supervisorName)} · ${e(p.supervisorPhone)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Tipe Pekerjaan</td><td style="padding:6px 0;color:#1e293b;font-size:13px">${e(p.typeName)} — ${e(p.typeDescription)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Tanggal Kerja</td><td style="padding:6px 0;font-weight:600;color:#1e293b;font-size:13px">${e(p.workStart)} s/d ${e(p.workEnd)}</td></tr>
      ${p.notes ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">Catatan</td><td style="padding:6px 0;color:#1e293b;font-size:13px">${e(p.notes)}</td></tr>` : ""}
    </table>
  </div>

  <div style="background:white;border-radius:12px;padding:24px;border:1px solid #e2e8f0;text-align:center">
    <h2 style="font-size:14px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 16px">QR Code — Scan untuk Verifikasi</h2>
    <img src="${e(p.qrDataUrl)}" alt="QR Code Work Permit" style="width:180px;height:180px;border:1px solid #e2e8f0;border-radius:8px;padding:8px" />
    <p style="font-size:12px;color:#94a3b8;margin:12px 0 4px">Atau buka link berikut:</p>
    <a href="${e(p.scanUrl)}" style="font-size:12px;color:#2563eb;word-break:break-all">${e(p.scanUrl)}</a>
    <div style="margin-top:14px;background:#f1f5f9;border-radius:6px;padding:10px">
      <p style="font-size:11px;color:#94a3b8;margin:0">Kode Permit</p>
      <p style="font-size:12px;font-family:monospace;color:#475569;margin:4px 0 0;word-break:break-all">${e(p.permitCode)}</p>
    </div>
  </div>

  <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:20px">
    © ${new Date().getFullYear()} H&amp;A Monitoring System · Pesan ini dikirim otomatis, harap tidak membalas.
  </p>
</div>`;
}
