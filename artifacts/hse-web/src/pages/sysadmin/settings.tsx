import { useState, useEffect } from "react";
import { Settings, Upload, CheckCircle, CreditCard, Building2, QrCode, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_BASE = "/api";

function sysApi(token: string) {
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  return {
    get: async <T,>(path: string): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { headers: h });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    put: async <T,>(path: string, body: unknown): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { method: "PUT", headers: h, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    upload: async <T,>(path: string, formData: FormData): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  };
}

type PaymentMethod = "qris" | "transfer";

export default function SysadminSettings({ token }: { token: string }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("qris");

  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankNote, setBankNote] = useState("");

  const [qrisFile, setQrisFile] = useState<File | null>(null);
  const [qrisPreview, setQrisPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    sysApi(token).get<Record<string, string>>("/sysadmin/settings").then(s => {
      setSettings(s);
      setPaymentMethod((s["payment_method"] as PaymentMethod) ?? "qris");
      setBankName(s["bank_name"] ?? "");
      setBankAccountNumber(s["bank_account_number"] ?? "");
      setBankAccountName(s["bank_account_name"] ?? "");
      setBankNote(s["bank_note"] ?? "");
    }).catch(() => {});
  }, [token]);

  const showMsg = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(""); }
    else { setSuccess(msg); setError(""); }
    setTimeout(() => { setSuccess(""); setError(""); }, 4000);
  };

  const savePaymentMethod = async () => {
    setLoading(true);
    try {
      await sysApi(token).put("/sysadmin/settings", {
        paymentMethod,
        bankName, bankAccountNumber, bankAccountName, bankNote,
      });
      showMsg("Metode pembayaran berhasil disimpan");
    } catch (e: any) { showMsg(e.message, true); }
    finally { setLoading(false); }
  };

  const uploadQris = async () => {
    if (!qrisFile) return;
    setUploadLoading(true);
    const fd = new FormData();
    fd.append("file", qrisFile);
    try {
      const res = await sysApi(token).upload<{ viewUrl: string }>("/sysadmin/settings/qris", fd);
      setSettings(s => ({ ...s, qris_image_url: res.viewUrl }));
      setQrisFile(null); setQrisPreview(null);
      showMsg("Gambar QRIS berhasil diupload");
    } catch (e: any) { showMsg(e.message, true); }
    finally { setUploadLoading(false); }
  };

  const handleQrisFile = (file: File | null) => {
    setQrisFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = e => setQrisPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else { setQrisPreview(null); }
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-blue-600" /> Pengaturan Sistem
      </h1>

      {success && (
        <Alert className="mb-4 bg-green-50 border-green-200">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Payment Method Toggle */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-blue-600" /> Metode Pembayaran
        </h2>
        <p className="text-sm text-gray-500 mb-4">Pilih cara pengguna melakukan pembayaran berlangganan</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setPaymentMethod("qris")}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
              paymentMethod === "qris"
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${paymentMethod === "qris" ? "bg-blue-600" : "bg-gray-100"}`}>
              <QrCode className={`w-5 h-5 ${paymentMethod === "qris" ? "text-white" : "text-gray-500"}`} />
            </div>
            <div>
              <div className={`font-semibold text-sm ${paymentMethod === "qris" ? "text-blue-900" : "text-gray-700"}`}>QRIS</div>
              <div className="text-xs text-gray-500">Scan QR Code untuk bayar</div>
            </div>
          </button>

          <button
            onClick={() => setPaymentMethod("transfer")}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
              paymentMethod === "transfer"
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${paymentMethod === "transfer" ? "bg-blue-600" : "bg-gray-100"}`}>
              <Building2 className={`w-5 h-5 ${paymentMethod === "transfer" ? "text-white" : "text-gray-500"}`} />
            </div>
            <div>
              <div className={`font-semibold text-sm ${paymentMethod === "transfer" ? "text-blue-900" : "text-gray-700"}`}>Transfer Rekening</div>
              <div className="text-xs text-gray-500">Transfer ke rekening bank</div>
            </div>
          </button>
        </div>

        {/* QRIS section */}
        {paymentMethod === "qris" && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Gambar QRIS</p>
            {settings["qris_image_url"] && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2">QRIS saat ini:</p>
                <img
                  src={settings["qris_image_url"]}
                  alt="QRIS"
                  className="max-w-[180px] rounded-lg border border-gray-200"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-5 text-center mb-3">
              <Upload className="w-7 h-7 text-gray-400 mx-auto mb-2" />
              <label className="cursor-pointer">
                <span className="text-sm font-medium text-blue-600 hover:underline">Pilih gambar QRIS baru</span>
                <input
                  type="file" className="hidden" accept="image/*"
                  onChange={e => handleQrisFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {qrisFile && <p className="text-sm text-gray-600 mt-1.5 font-medium">{qrisFile.name}</p>}
              <p className="text-xs text-gray-400 mt-1">JPG, PNG · Maks. 10MB</p>
            </div>
            {qrisPreview && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1">Preview:</p>
                <img src={qrisPreview} alt="Preview" className="max-w-[180px] rounded-lg border border-gray-200" />
              </div>
            )}
            <Button onClick={uploadQris} disabled={uploadLoading || !qrisFile} size="sm">
              {uploadLoading ? "Mengupload..." : "Upload QRIS"}
            </Button>
          </div>
        )}

        {/* Transfer Rekening section */}
        {paymentMethod === "transfer" && (
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <p className="text-sm font-medium text-gray-700">Detail Rekening Bank</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nama Bank <span className="text-red-500">*</span></Label>
                <Input
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="BCA, Mandiri, BNI, BRI..."
                />
              </div>
              <div>
                <Label>Nomor Rekening <span className="text-red-500">*</span></Label>
                <Input
                  value={bankAccountNumber}
                  onChange={e => setBankAccountNumber(e.target.value)}
                  placeholder="1234567890"
                />
              </div>
            </div>
            <div>
              <Label>Atas Nama <span className="text-red-500">*</span></Label>
              <Input
                value={bankAccountName}
                onChange={e => setBankAccountName(e.target.value)}
                placeholder="PT. Nama Perusahaan / Nama Pemilik"
              />
            </div>
            <div>
              <Label>Catatan / Instruksi Tambahan</Label>
              <Textarea
                value={bankNote}
                onChange={e => setBankNote(e.target.value)}
                placeholder="Contoh: Mohon kirim bukti transfer ke email admin@hse.co.id setelah melakukan pembayaran."
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-gray-100">
          <Button onClick={savePaymentMethod} disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan Pengaturan Pembayaran"}
          </Button>
        </div>
      </div>
    </div>
  );
}
