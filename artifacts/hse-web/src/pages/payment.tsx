import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Upload, AlertCircle, CreditCard, Building2 } from "lucide-react";

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

const PLANS = [
  { id: "monthly", label: "Bulanan", months: 1, getPrice: (info: PaymentInfo) => info.priceMonthly },
  { id: "yearly", label: "Tahunan (12 bulan)", months: 12, getPrice: (info: PaymentInfo) => info.priceYearly },
];

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

export default function PaymentPage() {
  const { user, logout } = useAuth();
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<PaymentInfo>("/payments/info").then(setPaymentInfo).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError("Pilih file bukti transfer"); return; }
    setError("");
    setLoading(true);
    const plan = PLANS.find(p => p.id === selectedPlan)!;
    const fd = new FormData();
    fd.append("proof", file);
    fd.append("plan", selectedPlan);
    fd.append("periodMonths", String(plan.months));
    try {
      await api.upload("/payments/submit", fd);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? "Gagal mengirim bukti");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Bukti Terkirim!</h1>
          <p className="text-gray-500 mb-6">Pembayaran Anda sedang diverifikasi oleh admin. Akun Anda akan diaktifkan dalam 1×24 jam.</p>
          <button onClick={logout} className="text-sm text-blue-600 hover:underline">Kembali ke Login</button>
        </div>
      </div>
    );
  }

  const selectedPlanData = PLANS.find(p => p.id === selectedPlan)!;
  const selectedAmount = paymentInfo ? formatRp(selectedPlanData.getPrice(paymentInfo)) : "...";
  const isQris = !paymentInfo || paymentInfo.paymentMethod === "qris";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto py-10 px-4">
        <div className="flex items-center gap-2 mb-8">
          <CreditCard className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Pembayaran Langganan</h1>
        </div>

        {user && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-amber-900">Langganan Berakhir</div>
              <div className="text-sm text-amber-700">Lakukan pembayaran untuk mengaktifkan kembali akses.</div>
            </div>
          </div>
        )}

        {/* Plan selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">Pilih Paket</h2>
          <div className="space-y-3">
            {PLANS.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedPlan === plan.id ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{plan.label}</span>
                  <span className="font-bold text-gray-900">
                    {paymentInfo ? formatRp(plan.getPrice(paymentInfo)) : "..."}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* QRIS section */}
        {isQris && paymentInfo?.qrisImageUrl && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <h2 className="font-semibold text-gray-900 mb-3">Scan QRIS</h2>
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

        {/* Transfer Rekening section */}
        {!isQris && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Transfer Rekening Bank</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Transfer <span className="font-semibold text-gray-800">{selectedAmount}</span> ke rekening berikut:
            </p>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100">
              {paymentInfo?.bankName && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Bank</span>
                  <span className="font-semibold text-gray-900">{paymentInfo.bankName}</span>
                </div>
              )}
              {paymentInfo?.bankAccountNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">No. Rekening</span>
                  <span className="font-semibold text-gray-900 tracking-wider">{paymentInfo.bankAccountNumber}</span>
                </div>
              )}
              {paymentInfo?.bankAccountName && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Atas Nama</span>
                  <span className="font-semibold text-gray-900">{paymentInfo.bankAccountName}</span>
                </div>
              )}
            </div>
            {paymentInfo?.bankNote && (
              <p className="mt-3 text-sm text-gray-500 italic">{paymentInfo.bankNote}</p>
            )}
          </div>
        )}

        {/* No payment method configured */}
        {isQris && paymentInfo && !paymentInfo.qrisImageUrl && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
            <p className="text-sm text-blue-700">Hubungi admin untuk informasi pembayaran.</p>
          </div>
        )}

        {/* Upload proof */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Upload Bukti Transfer</h2>
          {error && (
            <Alert variant="destructive" className="mb-4 py-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center mb-4">
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <label className="cursor-pointer">
              <span className="text-sm font-medium text-blue-600 hover:underline">Pilih file</span>
              <span className="text-sm text-gray-500"> atau drag & drop</span>
              <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {file && <p className="text-sm text-gray-600 mt-2 font-medium">{file.name}</p>}
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF · Maks. 10MB</p>
          </div>

          <Button type="submit" disabled={loading || !file} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium">
            {loading ? "Mengirim..." : "Kirim Bukti Transfer"}
          </Button>
        </form>

        <div className="text-center mt-4">
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">Keluar</button>
        </div>
      </div>
    </div>
  );
}
