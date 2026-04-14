import { useState, useEffect } from "react";
import { Settings, Upload, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_BASE = "/api";

function sysApi(token: string) {
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  return {
    get: async <T>(path: string): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { headers: h });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    put: async <T>(path: string, body: unknown): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { method: "PUT", headers: h, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    upload: async <T>(path: string, formData: FormData): Promise<T> => {
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

export default function SysadminSettings({ token }: { token: string }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [priceMonthly, setPriceMonthly] = useState("");
  const [priceYearly, setPriceYearly] = useState("");
  const [qrisFile, setQrisFile] = useState<File | null>(null);
  const [qrisPreview, setQrisPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    sysApi(token).get<Record<string, string>>("/sysadmin/settings").then(s => {
      setSettings(s);
      setPriceMonthly(s["price_monthly"] ?? "250000");
      setPriceYearly(s["price_yearly"] ?? "2250000");
    }).catch(() => {});
  }, [token]);

  const savePrices = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      await sysApi(token).put("/sysadmin/settings", { priceMonthly: Number(priceMonthly), priceYearly: Number(priceYearly) });
      setSuccess("Harga berhasil disimpan");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadQris = async () => {
    if (!qrisFile) return;
    setError(""); setSuccess(""); setUploadLoading(true);
    const fd = new FormData();
    fd.append("file", qrisFile);
    try {
      const res = await sysApi(token).upload<{ viewUrl: string }>("/sysadmin/settings/qris", fd);
      setSettings(s => ({ ...s, qris_image_url: res.viewUrl }));
      setQrisFile(null);
      setQrisPreview(null);
      setSuccess("QRIS berhasil diupload");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleQrisFile = (file: File | null) => {
    setQrisFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = e => setQrisPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setQrisPreview(null);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-blue-600" /> Pengaturan Sistem
      </h1>

      {success && (
        <Alert className="mb-4 bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Pricing */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Harga Langganan</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <Label>Harga Bulanan (Rp)</Label>
            <Input
              type="number"
              value={priceMonthly}
              onChange={e => setPriceMonthly(e.target.value)}
              placeholder="250000"
            />
            <p className="text-xs text-gray-400">Saat ini: Rp {Number(settings["price_monthly"] ?? 250000).toLocaleString("id-ID")}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Harga Tahunan (Rp)</Label>
            <Input
              type="number"
              value={priceYearly}
              onChange={e => setPriceYearly(e.target.value)}
              placeholder="2250000"
            />
            <p className="text-xs text-gray-400">Saat ini: Rp {Number(settings["price_yearly"] ?? 2250000).toLocaleString("id-ID")}</p>
          </div>
        </div>
        <Button onClick={savePrices} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
          {loading ? "Menyimpan..." : "Simpan Harga"}
        </Button>
      </div>

      {/* QRIS */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Gambar QRIS Pembayaran</h2>

        {settings["qris_image_url"] && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">QRIS saat ini:</p>
            <img
              src={settings["qris_image_url"]}
              alt="QRIS"
              className="max-w-xs rounded-lg border border-gray-200"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center mb-4">
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <label className="cursor-pointer">
            <span className="text-sm font-medium text-blue-600 hover:underline">Pilih gambar QRIS baru</span>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={e => handleQrisFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {qrisFile && <p className="text-sm text-gray-600 mt-2 font-medium">{qrisFile.name}</p>}
          <p className="text-xs text-gray-400 mt-1">JPG, PNG · Maks. 10MB</p>
        </div>

        {qrisPreview && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">Preview:</p>
            <img src={qrisPreview} alt="Preview" className="max-w-xs rounded-lg border border-gray-200" />
          </div>
        )}

        <Button
          onClick={uploadQris}
          disabled={uploadLoading || !qrisFile}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {uploadLoading ? "Mengupload..." : "Upload QRIS"}
        </Button>
      </div>
    </div>
  );
}
