import { useState, useEffect } from "react";
import { Shield, Building2, ChevronRight, CheckCircle, Mail, ExternalLink, Upload, CreditCard, QrCode, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_BASE = "/api";

interface Plan {
  id: number;
  slug: string;
  name: string;
  description: string;
  features: string;
  priceMonthly: number;
  priceYearly: number;
  durationMonths: number;
  sortOrder: number;
}

interface PublicInfo {
  paymentMethod: "qris" | "transfer";
  qrisImageUrl: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  bankNote: string;
  plans: Plan[];
}

type PlanView = "monthly" | "yearly";
type Step = "plan" | "form" | "payment" | "success";

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function getPlanBillingType(plan: Plan): "free" | "monthly" | "yearly" {
  if (plan.priceMonthly === 0 && plan.priceYearly === 0) return "free";
  if (plan.durationMonths >= 12) return "yearly";
  return "monthly";
}

function isFree(plan: Plan): boolean {
  return getPlanBillingType(plan) === "free";
}

function getPlanPrice(plan: Plan): number {
  const bt = getPlanBillingType(plan);
  if (bt === "free") return 0;
  if (bt === "yearly") return plan.priceYearly;
  return plan.priceMonthly;
}

function getPlanPeriodMonths(plan: Plan): number {
  return plan.durationMonths >= 12 ? 12 : 1;
}

export default function RegisterPage() {
  const urlPlan = new URLSearchParams(window.location.search).get("plan");
  const urlView = new URLSearchParams(window.location.search).get("view") as PlanView | null;

  const [plans, setPlans] = useState<Plan[]>([]);
  const [publicInfo, setPublicInfo] = useState<PublicInfo | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);

  const [step, setStep] = useState<Step>("plan");
  const [planView, setPlanView] = useState<PlanView>(urlView === "yearly" ? "yearly" : "monthly");
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string>("");
  const [form, setForm] = useState({
    companyName: "", companySlug: "", contactName: "", contactEmail: "", contactPhone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ slug: string; name: string; contactEmail?: string; id?: number } | null>(null);

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/payments/public-info`)
      .then(r => r.json())
      .then((data: PublicInfo) => {
        setPublicInfo(data);
        const activePlans: Plan[] = data.plans ?? [];
        setPlans(activePlans);

        if (urlPlan) {
          const found = activePlans.find(p => p.slug === urlPlan);
          if (found) {
            setSelectedPlanSlug(urlPlan);
            const bt = getPlanBillingType(found);
            if (bt === "yearly") setPlanView("yearly");
            setStep("form");
            return;
          }
        }

        const defaultMonthly = activePlans.find(p => getPlanBillingType(p) === "monthly");
        setSelectedPlanSlug(defaultMonthly?.slug ?? activePlans[0]?.slug ?? "");
      })
      .catch(() => {})
      .finally(() => setPlansLoading(false));
  }, []);

  const freePlans = plans.filter(p => getPlanBillingType(p) === "free");
  const visiblePlans = plans.filter(p => {
    const bt = getPlanBillingType(p);
    if (bt === "free") return true;
    return planView === "yearly" ? bt === "yearly" : bt === "monthly";
  });

  const selectedPlan = plans.find(p => p.slug === selectedPlanSlug) ?? null;

  const handlePlanViewSwitch = (view: PlanView) => {
    setPlanView(view);
    const newVisible = plans.filter(p => {
      const bt = getPlanBillingType(p);
      if (bt === "free") return true;
      return view === "yearly" ? bt === "yearly" : bt === "monthly";
    });
    const currentStillVisible = newVisible.some(p => p.slug === selectedPlanSlug);
    if (!currentStillVisible && newVisible.length > 0) {
      const preferred = newVisible.find(p => getPlanBillingType(p) !== "free") ?? newVisible[0];
      setSelectedPlanSlug(preferred?.slug ?? "");
    }
  };

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
          plan: selectedPlanSlug,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Gagal mendaftar");
      const company = data.company;
      setResult({ ...company, contactEmail: form.contactEmail });
      if (!selectedPlan || isFree(selectedPlan)) {
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
      fd.append("plan", selectedPlanSlug);
      fd.append("periodMonths", String(selectedPlan ? getPlanPeriodMonths(selectedPlan) : 1));
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

  const isQris = !publicInfo || publicInfo.paymentMethod === "qris";
  const selectedAmount = selectedPlan ? formatRp(getPlanPrice(selectedPlan)) : "...";

  const monthlyPlanCount = plans.filter(p => getPlanBillingType(p) === "monthly").length;
  const yearlyPlanCount = plans.filter(p => getPlanBillingType(p) === "yearly").length;

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
            <p className="text-gray-500 mb-6">Mulai kelola HSE perusahaan Anda dengan mudah</p>

            {/* Billing period filter toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6 max-w-xs">
              <button
                onClick={() => handlePlanViewSwitch("monthly")}
                className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all ${
                  planView === "monthly" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Bulanan
                {monthlyPlanCount > 0 && (
                  <span className="ml-1.5 text-xs text-gray-400 font-normal">({monthlyPlanCount})</span>
                )}
              </button>
              <button
                onClick={() => handlePlanViewSwitch("yearly")}
                className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  planView === "yearly" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Tahunan
                {yearlyPlanCount > 0 && (
                  <span className="text-xs text-gray-400 font-normal">({yearlyPlanCount})</span>
                )}
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Hemat</span>
              </button>
            </div>

            {plansLoading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" /> Memuat paket...
              </div>
            ) : (
              <div className="grid gap-4 mb-8">
                {visiblePlans.map((plan) => {
                  const bt = getPlanBillingType(plan);
                  const price = getPlanPrice(plan);
                  const isSelected = selectedPlanSlug === plan.slug;
                  const isRecommended = plan.slug === "monthly" || (planView === "yearly" && plan.slug === "yearly");

                  return (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlanSlug(plan.slug)}
                      className={`text-left p-5 rounded-xl border-2 transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-gray-900">{plan.name}</span>
                            {isRecommended && !isFree(plan) && (
                              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full shrink-0">Rekomendasi</span>
                            )}
                            {bt === "free" ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">Trial Gratis</span>
                            ) : bt === "yearly" ? (
                              <span className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-2 py-0.5 rounded-full shrink-0">Tahunan</span>
                            ) : (
                              <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full shrink-0">Bulanan</span>
                            )}
                          </div>
                          {plan.description && (
                            <p className="text-sm text-gray-500">{plan.description}</p>
                          )}
                        </div>

                        {/* Price */}
                        <div className="text-right shrink-0 min-w-[110px]">
                          {bt === "free" ? (
                            <div>
                              <div className="font-bold text-gray-900 text-xl">Gratis</div>
                              <div className="text-xs text-gray-400">{plan.durationMonths} bulan trial</div>
                            </div>
                          ) : (
                            <div>
                              <div className={`font-bold text-xl ${isSelected ? "text-blue-700" : "text-gray-900"}`}>
                                {formatRp(price)}
                              </div>
                              <div className={`text-xs font-medium ${isSelected ? "text-blue-500" : "text-gray-400"}`}>
                                {bt === "yearly" ? "/tahun" : "/bulan"}
                              </div>
                              {bt === "yearly" && (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  ≈ {formatRp(Math.round(price / 12))}/bulan
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* No plans in this view */}
                {visiblePlans.filter(p => !isFree(p)).length === 0 && !plansLoading && (
                  <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                    <p className="text-sm">Tidak ada paket {planView === "yearly" ? "tahunan" : "bulanan"} tersedia</p>
                    <button
                      onClick={() => handlePlanViewSwitch(planView === "yearly" ? "monthly" : "yearly")}
                      className="text-sm text-blue-600 hover:underline mt-1"
                    >
                      Lihat paket {planView === "yearly" ? "bulanan" : "tahunan"}
                    </button>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={() => setStep("form")}
              disabled={!selectedPlanSlug || plansLoading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
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
              {selectedPlan && isFree(selectedPlan)
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
                <strong>Informasi penting:</strong> Setelah pendaftaran disetujui, kredensial login admin perusahaan Anda akan otomatis dikirimkan ke email kontak yang Anda daftarkan.
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

              {selectedPlan && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-sm font-semibold text-gray-900">Paket Dipilih</div>
                    <button type="button" onClick={() => setStep("plan")} className="text-xs text-blue-600 hover:underline">Ubah</button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-800">{selectedPlan.name}</div>
                      <div className="text-xs text-gray-500">
                        {isFree(selectedPlan)
                          ? `Trial ${selectedPlan.durationMonths} bulan`
                          : getPlanBillingType(selectedPlan) === "yearly"
                          ? "Berlangganan Tahunan (12 bulan)"
                          : "Berlangganan Bulanan (1 bulan)"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-700">
                        {isFree(selectedPlan) ? "Gratis" : selectedAmount}
                      </div>
                      {!isFree(selectedPlan) && (
                        <div className="text-xs text-gray-400">
                          {getPlanBillingType(selectedPlan) === "yearly" ? "/tahun" : "/bulan"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium">
                {loading ? "Mendaftarkan..." : selectedPlan && isFree(selectedPlan) ? "Daftar Sekarang" : "Lanjutkan ke Pembayaran →"}
              </Button>
            </form>
          </div>
        )}

        {/* Step: payment */}
        {step === "payment" && result && selectedPlan && (
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

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{selectedPlan.name}</div>
                  <div className="text-xs text-gray-500">
                    {getPlanBillingType(selectedPlan) === "yearly"
                      ? "Berlangganan Tahunan — masa aktif 12 bulan"
                      : "Berlangganan Bulanan — masa aktif 1 bulan"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-blue-700 text-lg">{selectedAmount}</div>
                  <div className="text-xs text-gray-400">
                    {getPlanBillingType(selectedPlan) === "yearly" ? "/tahun" : "/bulan"}
                  </div>
                </div>
              </div>
            </div>

            {isQris && publicInfo?.qrisImageUrl && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
                <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-blue-600" /> Scan QRIS
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  Transfer <span className="font-semibold text-gray-800">{selectedAmount}</span> ke QRIS berikut:
                </p>
                <div className="flex justify-center">
                  <img
                    src={publicInfo.qrisImageUrl}
                    alt="QRIS"
                    className="max-w-xs w-full rounded-lg border border-gray-100"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              </div>
            )}

            {!isQris && publicInfo && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
                <h2 className="font-semibold text-gray-900 mb-3">Transfer Rekening Bank</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Transfer <span className="font-semibold text-gray-800">{selectedAmount}</span> ke rekening berikut:
                </p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100">
                  {publicInfo.bankName && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Bank</span>
                      <span className="font-semibold text-gray-900">{publicInfo.bankName}</span>
                    </div>
                  )}
                  {publicInfo.bankAccountNumber && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">No. Rekening</span>
                      <span className="font-semibold text-gray-900 tracking-wider">{publicInfo.bankAccountNumber}</span>
                    </div>
                  )}
                  {publicInfo.bankAccountName && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Atas Nama</span>
                      <span className="font-semibold text-gray-900">{publicInfo.bankAccountName}</span>
                    </div>
                  )}
                </div>
                {publicInfo.bankNote && <p className="mt-3 text-sm text-gray-500 italic">{publicInfo.bankNote}</p>}
              </div>
            )}

            {isQris && publicInfo && !publicInfo.qrisImageUrl && (
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
              <button onClick={() => setStep("success")} className="text-sm text-gray-400 hover:text-gray-600">
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
              {selectedPlan && !isFree(selectedPlan) ? "Bukti Terkirim!" : "Pendaftaran Berhasil!"}
            </h1>
            <p className="text-gray-600 mb-2">
              Perusahaan <strong>{result.name}</strong> telah terdaftar.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              {selectedPlan && !isFree(selectedPlan)
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
