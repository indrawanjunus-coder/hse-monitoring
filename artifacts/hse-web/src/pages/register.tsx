import { useState } from "react";
import { Shield, Building2, ChevronRight, CheckCircle, Mail, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";

const PLANS = [
  { id: "free", label: "Gratis", price: "Rp 0", period: "/bulan", desc: "1 bulan trial, fitur dasar" },
  { id: "monthly", label: "Bulanan", price: "Rp 250.000", period: "/bulan", desc: "Semua fitur, bayar bulanan", recommended: true },
  { id: "yearly", label: "Tahunan", price: "Rp 2.250.000", period: "/tahun", desc: "Hemat 25%, bayar tahunan" },
];

export default function RegisterPage() {
  const urlPlan = new URLSearchParams(window.location.search).get("plan");
  const validPlanIds = PLANS.map(p => p.id);
  const initialPlan = urlPlan && validPlanIds.includes(urlPlan) ? urlPlan : "monthly";
  const [step, setStep] = useState<"plan" | "form" | "success">(urlPlan && validPlanIds.includes(urlPlan) ? "form" : "plan");
  const [selectedPlan, setSelectedPlan] = useState(initialPlan);
  const [form, setForm] = useState({
    companyName: "", companySlug: "", contactName: "", contactEmail: "", contactPhone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ slug: string; name: string; contactEmail?: string } | null>(null);

  const handleSlugAuto = (name: string) => {
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 30);
    setForm(f => ({ ...f, companyName: name, companySlug: slug }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ company: { slug: string; name: string } }>("/auth/register", {
        companyName: form.companyName,
        companySlug: form.companySlug,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        plan: selectedPlan,
      });
      setResult({ ...res.company, contactEmail: form.contactEmail });
      setStep("success");
    } catch (err: any) {
      setError(err.message ?? "Gagal mendaftar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-12 px-4">
        {/* Header */}
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
            <p className="text-gray-500 mb-6">Lengkapi informasi perusahaan. Akun admin akan dikirim ke email Anda setelah diaktivasi.</p>

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
                  <div className="text-sm font-medium text-gray-900">Paket dipilih: {PLANS.find(p => p.id === selectedPlan)?.label}</div>
                  <div className="text-sm text-gray-500">{PLANS.find(p => p.id === selectedPlan)?.price} {PLANS.find(p => p.id === selectedPlan)?.period}</div>
                </div>
                <button type="button" onClick={() => setStep("plan")} className="text-xs text-blue-600 hover:underline">Ubah</button>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium">
                {loading ? "Mendaftarkan..." : "Daftar Sekarang"}
              </Button>
            </form>
          </div>
        )}

        {/* Step: success */}
        {step === "success" && result && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Pendaftaran Berhasil!</h1>
            <p className="text-gray-600 mb-2">
              Perusahaan <strong>{result.name}</strong> telah terdaftar.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Pendaftaran Anda sedang dalam proses verifikasi oleh admin sistem.
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
