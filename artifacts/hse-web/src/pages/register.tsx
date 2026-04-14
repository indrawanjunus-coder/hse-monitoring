import { useState, useEffect } from "react";
import { Shield, Building2, ChevronRight, CheckCircle, Mail, ExternalLink, Upload, CreditCard, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_BASE = "/api";

const PLANS = [
  { id: "free", label: "Gratis", price: "Rp 0", period: "/bulan", desc: "1 bulan trial, fitur dasar" },
  { id: "monthly", label: "Bulanan", price: "Rp 250.000", period: "/bulan", desc: "Semua fitur, bayar bulanan", recommended: true },
  { id: "yearly", label: "Tahunan", price: "Rp 2.250.000", period: "/tahun", desc: "Hemat 25%, bayar tahunan" },
];

const PLAN_MONTHS: Record<string, number> = { monthly: 1, yearly: 12, free: 1 };

interface PaymentInfo {
  paymentMethod: "qris" | "transfer";
  qrisImageUrl: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  bankNote: string;
  priceMonthly: number;
  priceYearly: number;
}

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

type Step = "plan" | "form" | "payment" | "success";

export default function RegisterPage() {
  const urlPlan = new URLSearchParams(window.location.search).get("plan");
  const validPlanIds = PLANS.map(p => p.id);
  const initialPlan = urlPlan && validPlanIds.includes(urlPlan) ? urlPlan : "monthly";
  const [step, setStep] = useState<Step>(urlPlan && validPlanIds.includes(urlPlan) ? "form" : "plan");
  const [selectedPlan, setSelectedPlan] = useState(initialPlan);
  const [form, setForm] = useState({
    companyName: "", companySlug: "", contactName: "", contactEmail: "", contactPhone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ slug: string; name: string; contactEmail?: string; id?: number } | null>(null);

  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    if (step === "payment") {
      fetch(`${API_BASE}/payments/public-info`)
        .then(r => r.json())
        .then(setPaymentInfo)
        .catch(() => {});
    }
  }, [step]);

  const handleSlugAuto = (name: string) => {
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 30);
    setForm(f => ({ ...f, companyName: name, companySlug: slug }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          companySlug: form.companySlug,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          plan: selectedPlan,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Gagal mendaftar");
      const company = data.company;
      setResult({ ...company, contactEmail: form.contactEmail });
      if (selectedPlan === "free") {
        setStep("success");
      } else {
        setStep("payment");
      }
    } catch (err: any) {
      setError(err.message ?? "Gagal mendaftar");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofFile) { setPaymentError("Pilih file bukti transfer"); return; }
    if (!result?.id) { setPaymentError("Data perusahaan tidak ditemukan"); return; }
    setPaymentError("");
    setPaymentLoading(true);
    try {
      const fd = new FormData();
      fd.append("proof", proofFile);
      fd.append("companyId", String(result.id));
      fd.append("plan", selectedPlan);
      fd.append("periodMonths", String(PLAN_MONTHS[selectedPlan] ?? 1));
      const r = await fetch(`${API_BASE}/payments/public-submit`, { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Gagal mengirim bukti");
      setStep("success");
    } catch (err: any) {
      setPaymentError(err.message ?? "Gagal mengirim bukti");
    } finally {
      setPaymentLoading(false);
    }
  };

  const planData = PLANS.find(p => p.id === selectedPlan);
  const isQris = !paymentInfo || paymentInfo.paymentMethod === "qris";
  const selectedAmount = paymentInfo
    ? selectedPlan === "yearly" ? formatRp(paymentInfo.priceYearly) : formatRp(paymentInfo.priceMonthly)
    : "...";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">H&A Monitoring System</span>
          <span className="text-gray-300 mx-2">·</span>
          <span className="text-gray-500 text-sm">Daftar Perusahaan</span>
        </div>

        {/* Step: plan selection */}
        {step === "plan" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Pilih Paket Langganan</h1>
            <p className="text-gray-500 mb-8">Mulai kelola HSE perusahaan Anda dengan mudah</p>

            <div className="grid gap-4 mb-8">
              {PLANS.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`text-left p-5 rounded-xl border-2 transition-all ${
                    selectedPlan === plan.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{plan.label}</span>
                        {plan.recommended && (
                          <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Rekomendasi</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{plan.desc}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="font-bold text-gray-900">{plan.price}</div>
                      <div className="text-xs text-gray-400">{plan.period}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <Button
              onClick={() => setStep("form")}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Lanjutkan <ChevronRight className="w-4 h-4 ml-1" />
            </Button>

            <p className="text-center text-sm text-gray-500 mt-4">
              Sudah punya akun?{" "}
              <a href="/c/login" className="text-blue-600 hover:underline">Masuk di sini</a>
            </p>
          </div>
        )}

        {/* Step: form */}
        {step === "form" && (
          <div>
            <button onClick={() => setStep("plan")} className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1">
              ← Kembali
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Data Perusahaan</h1>
            <p className="text-gray-500 mb-6">
              {selectedPlan === "free"
                ? "Lengkapi informasi perusahaan. Akun admin akan dikirim ke email Anda setelah diaktivasi."
                : "Lengkapi informasi perusahaan, lalu lanjutkan ke pembayaran."}
            </p>

            {error && (
              <Alert variant="destructive" className="mb-5 py-3">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mb-6 flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800">
                <strong>Informasi penting:</strong> Setelah pendaftaran disetujui oleh admin sistem, kredensial login admin perusahaan Anda akan otomatis dikirimkan ke email kontak yang Anda daftarkan.
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="p-5 bg-white rounded-xl border border-gray-200 space-y-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" /> Informasi Perusahaan
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Nama Perusahaan *</Label>
                    <Input value={form.companyName} onChange={e => handleSlugAuto(e.target.value)} placeholder="PT Contoh Industri" required />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Slug Portal *</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400 whitespace-nowrap">/c/</span>
                      <Input value={form.companySlug} onChange={e => setForm(f => ({ ...f, companySlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} placeholder="pt-contoh" required />
                    </div>
                    <p className="text-xs text-gray-400">URL portal: /c/{form.companySlug || "slug-anda"}/</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nama Kontak *</Label>
                    <Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Nama PIC" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email Kontak *</Label>
                    <Input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="pic@perusahaan.com" required />
                    <p className="text-xs text-gray-400">Kredensial admin akan dikirim ke email ini</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>No. HP Kontak</Label>
                    <Input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="08xxxxxxxxxx" />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">Paket dipilih: {planData?.label}</div>
                  <div className="text-sm text-gray-500">{planData?.price} {planData?.period}</div>
                </div>
                <button type="button" onClick={() => setStep("plan")} className="text-xs text-blue-600 hover:underline">Ubah</button>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium">
                {loading ? "Mendaftarkan..." : selectedPlan === "free" ? "Daftar Sekarang" : "Lanjutkan ke Pembayaran →"}
              </Button>
            </form>
          </div>
        )}

        {/* Step: payment */}
        {step === "payment" && result && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Pembayaran Langganan</h1>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-xl mb-6 flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <div className="text-sm text-green-800">
                <strong>{result.name}</strong> berhasil terdaftar! Selesaikan pembayaran untuk mengaktifkan akun Anda lebih cepat.
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6 text-sm text-blue-800">
              <strong>Paket:</strong> {planData?.label} — {selectedAmount}
            </div>

            {isQris && paymentInfo?.qrisImageUrl && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
                <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-blue-600" /> Scan QRIS
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  Transfer <span className="font-semibold text-gray-800">{selectedAmount}</span> ke QRIS berikut:
                </p>
                <div className="flex justify-center">
                  <img
                    src={paymentInfo.qrisImageUrl}
                    alt="QRIS"
                    className="max-w-xs w-full rounded-lg border border-gray-100"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              </div>
            )}

            {!isQris && paymentInfo && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
                <h2 className="font-semibold text-gray-900 mb-3">Transfer Rekening Bank</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Transfer <span className="font-semibold text-gray-800">{selectedAmount}</span> ke rekening berikut:
                </p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100">
                  {paymentInfo.bankName && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Bank</span>
                      <span className="font-semibold text-gray-900">{paymentInfo.bankName}</span>
                    </div>
                  )}
                  {paymentInfo.bankAccountNumber && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">No. Rekening</span>
                      <span className="font-semibold text-gray-900 tracking-wider">{paymentInfo.bankAccountNumber}</span>
                    </div>
                  )}
                  {paymentInfo.bankAccountName && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Atas Nama</span>
                      <span className="font-semibold text-gray-900">{paymentInfo.bankAccountName}</span>
                    </div>
                  )}
                </div>
                {paymentInfo.bankNote && <p className="mt-3 text-sm text-gray-500 italic">{paymentInfo.bankNote}</p>}
              </div>
            )}

            {isQris && paymentInfo && !paymentInfo.qrisImageUrl && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
                <p className="text-sm text-blue-700">Hubungi admin untuk informasi pembayaran.</p>
              </div>
            )}

            <form onSubmit={handlePaymentSubmit} className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h2 className="font-semibold text-gray-900 mb-3">Upload Bukti Transfer</h2>
              {paymentError && (
                <Alert variant="destructive" className="mb-4 py-3">
                  <AlertDescription>{paymentError}</AlertDescription>
                </Alert>
              )}
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center mb-4">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <label className="cursor-pointer">
                  <span className="text-sm font-medium text-blue-600 hover:underline">Pilih file</span>
                  <span className="text-sm text-gray-500"> atau drag & drop</span>
                  <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => setProofFile(e.target.files?.[0] ?? null)} />
                </label>
                {proofFile && <p className="text-sm text-gray-600 mt-2 font-medium">{proofFile.name}</p>}
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF · Maks. 10MB</p>
              </div>
              <Button type="submit" disabled={paymentLoading || !proofFile} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium">
                {paymentLoading ? "Mengirim..." : "Kirim Bukti Transfer"}
              </Button>
            </form>

            <div className="text-center">
              <button
                onClick={() => setStep("success")}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Lewati — bayar nanti
              </button>
            </div>
          </div>
        )}

        {/* Step: success */}
        {step === "success" && result && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              {selectedPlan !== "free" ? "Bukti Terkirim!" : "Pendaftaran Berhasil!"}
            </h1>
            <p className="text-gray-600 mb-2">
              Perusahaan <strong>{result.name}</strong> telah terdaftar.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              {selectedPlan !== "free"
                ? "Pembayaran Anda sedang diverifikasi. Akun akan diaktifkan setelah pembayaran dikonfirmasi."
                : "Pendaftaran Anda sedang dalam proses verifikasi oleh admin sistem."}
            </p>

            <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-left mb-6">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-amber-900 mb-1">Cek Email Anda</div>
                  <p className="text-sm text-amber-800">
                    Setelah akun diaktivasi, kredensial login admin akan otomatis dikirimkan ke:<br />
                    <strong>{result.contactEmail}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 bg-white border border-gray-200 rounded-xl text-left mb-4">
              <div className="text-sm font-semibold text-gray-700 mb-3">Link Portal Perusahaan Anda</div>
              <a
                href={`/c/${result.slug}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors group"
              >
                <span className="flex-1 font-mono text-sm break-all">{window.location.origin}/c/{result.slug}/</span>
                <ExternalLink className="w-4 h-4 shrink-0 opacity-60 group-hover:opacity-100" />
              </a>
              <p className="text-xs text-gray-400 mt-2">Bookmark link ini untuk akses mudah ke portal Anda.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
