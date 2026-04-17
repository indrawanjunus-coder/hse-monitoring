import { useState, useEffect } from "react";
import { Settings, Upload, CheckCircle, CreditCard, Building2, QrCode, AlertCircle, HardDrive, Copy, Key, FolderOpen, Info, Layout, Globe } from "lucide-react";
import arenaLogo from "../../assets/arena-logo.png";
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
    post: async <T,>(path: string, body?: unknown): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: h,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
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

interface PaymentGdrive {
  clientEmail: string;
  rootFolderId: string;
  hasPrivateKey: boolean;
  source: "custom" | "kci_preview";
}

type PaymentMethod = "qris" | "transfer";

export default function SysadminSettings({ token }: { token: string }) {
  const api = sysApi(token);

  // Landing theme state
  const [landingTheme, setLandingTheme] = useState<"default" | "arena">("default");
  const [landingThemeLoading, setLandingThemeLoading] = useState(false);

  // Payment method state
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("qris");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankNote, setBankNote] = useState("");
  const [qrisFile, setQrisFile] = useState<File | null>(null);
  const [qrisPreview, setQrisPreview] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  // GDrive payment state
  const [gdrive, setGdrive] = useState<PaymentGdrive | null>(null);
  const [gClientEmail, setGClientEmail] = useState("");
  const [gRootFolderId, setGRootFolderId] = useState("");
  const [gPrivateKey, setGPrivateKey] = useState("");
  const [gdriveLoading, setGdriveLoading] = useState(false);
  const [gdriveCopyLoading, setGdriveCopyLoading] = useState(false);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Record<string, string>>("/sysadmin/settings").then(s => {
      setSettings(s);
      setPaymentMethod((s["payment_method"] as PaymentMethod) ?? "qris");
      setBankName(s["bank_name"] ?? "");
      setBankAccountNumber(s["bank_account_number"] ?? "");
      setBankAccountName(s["bank_account_name"] ?? "");
      setBankNote(s["bank_note"] ?? "");
      setLandingTheme((s["landing_theme"] as "default" | "arena") ?? "default");
    }).catch(() => {});

    api.get<PaymentGdrive>("/sysadmin/settings/payment-gdrive").then(g => {
      setGdrive(g);
      setGClientEmail(g.clientEmail);
      setGRootFolderId(g.rootFolderId);
    }).catch(() => {});
  }, [token]);

  const showMsg = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(""); }
    else { setSuccess(msg); setError(""); }
    setTimeout(() => { setSuccess(""); setError(""); }, 5000);
  };

  const saveLandingTheme = async (theme: "default" | "arena") => {
    setLandingTheme(theme);
    setLandingThemeLoading(true);
    try {
      await api.put("/sysadmin/settings", { landingTheme: theme });
      showMsg(`Landing page diubah ke: ${theme === "arena" ? "ARENA CORPORATION" : "Default"}`);
    } catch (e: any) { showMsg(e.message, true); }
    finally { setLandingThemeLoading(false); }
  };

  const savePaymentMethod = async () => {
    setPaymentLoading(true);
    try {
      await api.put("/sysadmin/settings", { paymentMethod, bankName, bankAccountNumber, bankAccountName, bankNote });
      showMsg("Metode pembayaran berhasil disimpan");
    } catch (e: any) { showMsg(e.message, true); }
    finally { setPaymentLoading(false); }
  };

  const uploadQris = async () => {
    if (!qrisFile) return;
    setUploadLoading(true);
    const fd = new FormData();
    fd.append("file", qrisFile);
    try {
      const res = await api.upload<{ viewUrl: string }>("/sysadmin/settings/qris", fd);
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

  const saveGdrive = async () => {
    setGdriveLoading(true);
    try {
      await api.put("/sysadmin/settings/payment-gdrive", {
        clientEmail: gClientEmail,
        rootFolderId: gRootFolderId,
        ...(gPrivateKey.trim() ? { privateKey: gPrivateKey } : {}),
      });
      const updated = await api.get<PaymentGdrive>("/sysadmin/settings/payment-gdrive");
      setGdrive(updated);
      setGPrivateKey("");
      showMsg("Pengaturan GDrive Pembayaran berhasil disimpan");
    } catch (e: any) { showMsg(e.message, true); }
    finally { setGdriveLoading(false); }
  };

  const copyFromKci = async () => {
    setGdriveCopyLoading(true);
    try {
      await api.post("/sysadmin/settings/payment-gdrive/copy-kci");
      const updated = await api.get<PaymentGdrive>("/sysadmin/settings/payment-gdrive");
      setGdrive(updated);
      setGClientEmail(updated.clientEmail);
      setGRootFolderId(updated.rootFolderId);
      setGPrivateKey("");
      showMsg("Pengaturan GDrive berhasil disalin dari KCI");
    } catch (e: any) { showMsg(e.message, true); }
    finally { setGdriveCopyLoading(false); }
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

      {/* Landing Page Theme */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Layout className="w-4 h-4 text-blue-600" /> Tampilan Landing Page
        </h2>
        <p className="text-sm text-gray-500 mb-5">Pilih tampilan halaman utama yang ditampilkan ke pengunjung</p>
        {landingThemeLoading && (
          <div className="text-xs text-blue-600 mb-3">Menyimpan...</div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {/* Default Theme Card */}
          <button
            onClick={() => saveLandingTheme("default")}
            className={`relative flex flex-col gap-3 p-4 rounded-xl border-2 transition-all text-left ${
              landingTheme === "default" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            {landingTheme === "default" && (
              <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                <CheckCircle className="w-3 h-3 text-white" />
              </div>
            )}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${landingTheme === "default" ? "bg-blue-600" : "bg-gray-100"}`}>
              <Globe className={`w-5 h-5 ${landingTheme === "default" ? "text-white" : "text-gray-500"}`} />
            </div>
            <div>
              <div className={`font-semibold text-sm mb-0.5 ${landingTheme === "default" ? "text-blue-900" : "text-gray-700"}`}>Default</div>
              <div className="text-xs text-gray-500 leading-relaxed">H&A Monitoring System — lengkap dengan fitur, paket harga, dan testimoni</div>
            </div>
          </button>

          {/* Arena Theme Card */}
          <button
            onClick={() => saveLandingTheme("arena")}
            className={`relative flex flex-col gap-3 p-4 rounded-xl border-2 transition-all text-left ${
              landingTheme === "arena" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            {landingTheme === "arena" && (
              <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                <CheckCircle className="w-3 h-3 text-white" />
              </div>
            )}
            <img src={arenaLogo} alt="Arena" className="h-10 w-auto object-contain" />
            <div>
              <div className={`font-semibold text-sm mb-0.5 ${landingTheme === "arena" ? "text-blue-900" : "text-gray-700"}`}>ARENA CORPORATION</div>
              <div className="text-xs text-gray-500 leading-relaxed">Halaman khusus Arena Corporation — tampilan premium, hanya form pendaftaran perusahaan</div>
            </div>
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Perubahan langsung aktif saat disimpan. Buka <a href="/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">halaman utama</a> untuk melihat hasilnya.
        </p>
      </div>

      {/* Payment Method */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-blue-600" /> Metode Pembayaran
        </h2>
        <p className="text-sm text-gray-500 mb-4">Pilih cara pengguna melakukan pembayaran berlangganan</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setPaymentMethod("qris")}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
              paymentMethod === "qris" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"
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
              paymentMethod === "transfer" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"
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

        {paymentMethod === "qris" && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Gambar QRIS</p>
            {settings["qris_image_url"] && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2">QRIS saat ini:</p>
                <img src={settings["qris_image_url"]} alt="QRIS" className="max-w-[180px] rounded-lg border border-gray-200"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-5 text-center mb-3">
              <Upload className="w-7 h-7 text-gray-400 mx-auto mb-2" />
              <label className="cursor-pointer">
                <span className="text-sm font-medium text-blue-600 hover:underline">Pilih gambar QRIS baru</span>
                <input type="file" className="hidden" accept="image/*" onChange={e => handleQrisFile(e.target.files?.[0] ?? null)} />
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

        {paymentMethod === "transfer" && (
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <p className="text-sm font-medium text-gray-700">Detail Rekening Bank</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nama Bank <span className="text-red-500">*</span></Label>
                <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="BCA, Mandiri, BNI, BRI..." />
              </div>
              <div>
                <Label>Nomor Rekening <span className="text-red-500">*</span></Label>
                <Input value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} placeholder="1234567890" />
              </div>
            </div>
            <div>
              <Label>Atas Nama <span className="text-red-500">*</span></Label>
              <Input value={bankAccountName} onChange={e => setBankAccountName(e.target.value)} placeholder="PT. Nama Perusahaan / Nama Pemilik" />
            </div>
            <div>
              <Label>Catatan / Instruksi Tambahan</Label>
              <Textarea value={bankNote} onChange={e => setBankNote(e.target.value)}
                placeholder="Contoh: Mohon kirim bukti transfer ke email admin@hse.co.id setelah melakukan pembayaran."
                rows={3} className="resize-none text-sm" />
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-gray-100">
          <Button onClick={savePaymentMethod} disabled={paymentLoading}>
            {paymentLoading ? "Menyimpan..." : "Simpan Pengaturan Pembayaran"}
          </Button>
        </div>
      </div>

      {/* Google Drive Pembayaran */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-blue-600" /> Google Drive Bukti Pembayaran
          </h2>
          {gdrive?.source === "kci_preview" && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Belum dikonfigurasi</span>
          )}
          {gdrive?.source === "custom" && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Aktif</span>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Bukti bayar dari pendaftar baru akan disimpan di Google Drive ini dalam folder{" "}
          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">Pembayaran / Tahun / Bulan</code>.
        </p>

        {gdrive?.source === "kci_preview" && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-5 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <strong>Belum dikonfigurasi.</strong> Saat ini menggunakan GDrive dari PT KCI sebagai fallback.
              Klik <strong>"Salin dari KCI"</strong> untuk menggunakan pengaturan yang sama, atau isi manual di bawah.
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5">
              <Key className="w-3.5 h-3.5 text-gray-400" /> Service Account Email
            </Label>
            <Input
              value={gClientEmail}
              onChange={e => setGClientEmail(e.target.value)}
              placeholder="nama@project.iam.gserviceaccount.com"
              className="font-mono text-sm"
            />
          </div>

          <div>
            <Label className="flex items-center gap-1.5 mb-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-gray-400" /> Root Folder ID
            </Label>
            <Input
              value={gRootFolderId}
              onChange={e => setGRootFolderId(e.target.value)}
              placeholder="ID folder Google Drive (dari URL)"
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Contoh: dari URL <code>drive.google.com/drive/folders/<strong>1AbCd...</strong></code>, ambil ID-nya
            </p>
          </div>

          <div>
            <Label className="flex items-center gap-1.5 mb-1.5">
              <Key className="w-3.5 h-3.5 text-gray-400" /> Private Key (JSON)
              {gdrive?.hasPrivateKey && (
                <span className="text-xs text-green-600 font-normal">(tersimpan — kosongkan jika tidak ingin mengubah)</span>
              )}
            </Label>
            <Textarea
              value={gPrivateKey}
              onChange={e => setGPrivateKey(e.target.value)}
              placeholder={gdrive?.hasPrivateKey ? "•••••• Kosongkan jika tidak ingin mengubah private key" : "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
              rows={4}
              className="resize-none text-xs font-mono"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button onClick={saveGdrive} disabled={gdriveLoading}>
              {gdriveLoading ? "Menyimpan..." : "Simpan Pengaturan GDrive"}
            </Button>
            <Button
              variant="outline"
              onClick={copyFromKci}
              disabled={gdriveCopyLoading}
              className="flex items-center gap-2"
            >
              <Copy className="w-3.5 h-3.5" />
              {gdriveCopyLoading ? "Menyalin..." : "Salin dari KCI"}
            </Button>
          </div>

          {gdrive?.source === "custom" && gdrive.clientEmail && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-500 space-y-1">
              <div><span className="font-medium text-gray-700">Email aktif:</span> {gdrive.clientEmail}</div>
              <div><span className="font-medium text-gray-700">Root Folder ID:</span> <code className="bg-white px-1 rounded">{gdrive.rootFolderId}</code></div>
              <div><span className="font-medium text-gray-700">Private Key:</span> {gdrive.hasPrivateKey ? "✓ Tersimpan" : "✗ Belum ada"}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
