import { useState, useEffect } from "react";
import { Shield, CheckCircle2, XCircle, AlertCircle, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface PermitData {
  id: number;
  permitCode: string;
  name: string;
  phone: string;
  email: string;
  emergencyName: string;
  emergencyPhone: string;
  workStart: string;
  workEnd: string;
  supervisorName: string;
  supervisorPhone: string;
  photoUrl: string | null;
  status: "active" | "expired" | "revoked";
  typeName: string | null;
  typeDescription: string | null;
  notes: string | null;
}

function statusInfo(status: string, workEnd: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (status === "revoked") return { color: "red", icon: <XCircle className="w-10 h-10" />, label: "Permit Dicabut", sub: "Work permit ini telah dicabut." };
  if (status === "expired" || workEnd < today) return { color: "orange", icon: <AlertCircle className="w-10 h-10" />, label: "Permit Kadaluarsa", sub: "Work permit ini sudah melewati tanggal berakhir." };
  return { color: "green", icon: <CheckCircle2 className="w-10 h-10" />, label: "Permit Valid", sub: "Work permit ini masih berlaku." };
}

export default function WorkPermitScanPage() {
  const [code, setCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [permit, setPermit] = useState<PermitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Extract slug and code from URL
  const slug = window.location.pathname.match(/^\/c\/([^/]+)/)?.[1] ?? "";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("code");
    if (c) {
      setCode(c);
      setInputCode(c);
      lookupCode(c);
    }
  }, []);

  async function lookupCode(c: string) {
    if (!c.trim()) return;
    setLoading(true);
    setError("");
    setPermit(null);
    try {
      const resp = await fetch(`${API_BASE}/work-permits/scan/${encodeURIComponent(c.trim())}`);
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error ?? "Work permit tidak ditemukan");
      }
      const data = await resp.json();
      setPermit(data);
    } catch (e: any) {
      setError(e.message ?? "Gagal memuat work permit");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    lookupCode(inputCode);
  }

  const info = permit ? statusInfo(permit.status, permit.workEnd) : null;
  const colorMap = {
    green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", icon: "text-green-600" },
    orange: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", icon: "text-orange-500" },
    red: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: "text-red-600" },
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 py-4 px-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm">H&A Monitoring System</p>
          {slug && <p className="text-slate-400 text-xs uppercase">{slug}</p>}
        </div>
        <a href={`/c/${slug}/`} className="ml-auto text-xs text-slate-400 hover:text-slate-200">← Login Portal</a>
      </div>

      <div className="flex-1 flex items-start justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Scan form */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <QrCode className="w-5 h-5 text-blue-600" />
              <h1 className="text-lg font-bold text-gray-900">Verifikasi Work Permit</h1>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Scan QR code dari work permit, atau masukkan kode permit secara manual.
            </p>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={inputCode}
                onChange={e => setInputCode(e.target.value)}
                placeholder="Masukkan kode permit..."
                className="flex-1 font-mono text-sm"
                autoFocus
              />
              <Button type="submit" disabled={loading || !inputCode.trim()} className="bg-blue-600 hover:bg-blue-700 text-white px-4">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cek"}
              </Button>
            </form>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 items-start">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Permit result */}
          {permit && info && (() => {
            const c = colorMap[info.color as keyof typeof colorMap];
            return (
              <div className="space-y-4">
                {/* Status banner */}
                <div className={`rounded-xl border p-5 flex gap-4 items-center ${c.bg} ${c.border}`}>
                  <span className={c.icon}>{info.icon}</span>
                  <div>
                    <p className={`font-bold text-lg ${c.text}`}>{info.label}</p>
                    <p className={`text-sm ${c.text} opacity-80`}>{info.sub}</p>
                  </div>
                </div>

                {/* Permit details */}
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                  {permit.photoUrl && (
                    <div className="relative h-40 bg-gray-100 overflow-hidden">
                      <img src={permit.photoUrl} alt="Foto" className="w-full h-full object-cover object-top" />
                    </div>
                  )}
                  <div className="p-5 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Nama Pemegang Permit</p>
                      <p className="text-lg font-bold text-gray-900">{permit.name}</p>
                    </div>
                    {permit.typeName && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Jenis Pekerjaan</p>
                        <p className="text-sm text-gray-800">{permit.typeName} — {permit.typeDescription}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tanggal Mulai</p>
                        <p className="text-sm font-medium text-gray-800">{permit.workStart}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tanggal Selesai</p>
                        <p className="text-sm font-medium text-gray-800">{permit.workEnd}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">No. HP</p>
                      <p className="text-sm text-gray-800">{permit.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Atasan</p>
                      <p className="text-sm text-gray-800">{permit.supervisorName} · {permit.supervisorPhone}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Kontak Darurat</p>
                      <p className="text-sm text-gray-800">{permit.emergencyName} · {permit.emergencyPhone}</p>
                    </div>
                    {permit.notes && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Catatan</p>
                        <p className="text-sm text-gray-700">{permit.notes}</p>
                      </div>
                    )}
                  </div>
                  <div className="border-t px-5 py-3 bg-gray-50">
                    <p className="text-xs text-gray-400 font-mono">{permit.permitCode}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Scan tercatat otomatis pada {new Date().toLocaleString("id-ID")}</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
