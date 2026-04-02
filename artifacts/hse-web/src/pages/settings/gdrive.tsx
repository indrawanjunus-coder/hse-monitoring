import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Cloud, Save, CheckCircle2, AlertTriangle, FolderOpen, Key, Mail } from "lucide-react";
import { toast } from "sonner";

interface GdriveSettings {
  clientEmail: string;
  privateKeySet: boolean;
  rootFolderId: string;
  updatedAt: string | null;
}

export default function GdriveSettingsPage() {
  const [settings, setSettings] = useState<GdriveSettings | null>(null);
  const [clientEmail, setClientEmail] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [rootFolderId, setRootFolderId] = useState("0AIi51ZRCyt6JUk9PVA");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<GdriveSettings>("/settings/gdrive").then(s => {
      setSettings(s);
      setClientEmail(s.clientEmail || "");
      setRootFolderId(s.rootFolderId || "0AIi51ZRCyt6JUk9PVA");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, string> = { clientEmail, rootFolderId };
      if (privateKey.trim()) body.privateKey = privateKey.trim();
      await api.put("/settings/gdrive", body);
      toast.success("Pengaturan Google Drive berhasil disimpan");
      setPrivateKey("");
      const refreshed = await api.get<GdriveSettings>("/settings/gdrive");
      setSettings(refreshed);
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Memuat...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-blue-100 rounded-xl p-2">
          <Cloud className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pengaturan Google Drive</h1>
          <p className="text-sm text-gray-500">Konfigurasi akun layanan untuk upload lampiran ke Google Drive</p>
        </div>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <FolderOpen className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-blue-800 text-sm">
          <p className="font-semibold mb-1">Struktur folder otomatis:</p>
          <p className="font-mono text-xs bg-blue-100 rounded p-1.5">
            📁 Root Folder<br />
            &nbsp;&nbsp;└─ 📁 2026 (Tahun)<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ 📁 01 - Januari (Bulan)<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ 📄 {"{No.Incident}"}-2026-01-02-00001.pdf
          </p>
          <p className="mt-1.5 text-xs">Urutan increment (00001, 00002, ...) reset setiap awal bulan.</p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4" />Service Account
          </CardTitle>
          <CardDescription>
            Informasi akun layanan Google (Service Account) untuk autentikasi Drive API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="client-email" className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-gray-400" />Client Email
            </Label>
            <Input
              id="client-email"
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
              placeholder="hse-820@analog-crossing-492107-v9.iam.gserviceaccount.com"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="private-key" className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-gray-400" />
              Private Key
              {settings?.privateKeySet && (
                <Badge variant="secondary" className="ml-1 text-xs bg-green-100 text-green-700 border-green-200">
                  <CheckCircle2 className="w-3 h-3 mr-1" />Sudah dikonfigurasi
                </Badge>
              )}
            </Label>
            <Textarea
              id="private-key"
              value={privateKey}
              onChange={e => setPrivateKey(e.target.value)}
              placeholder={settings?.privateKeySet
                ? "Kosongkan jika tidak ingin mengubah private key yang ada..."
                : "Tempel private key dari file JSON Service Account\n-----BEGIN RSA PRIVATE KEY-----\n..."}
              rows={6}
              className="font-mono text-xs resize-none"
            />
            {!settings?.privateKeySet && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Private key belum dikonfigurasi — upload file tidak akan berfungsi
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="root-folder" className="flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-gray-400" />Root Folder ID
            </Label>
            <Input
              id="root-folder"
              value={rootFolderId}
              onChange={e => setRootFolderId(e.target.value)}
              placeholder="0AIi51ZRCyt6JUk9PVA"
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-400">
              ID folder Google Drive tempat semua lampiran disimpan. Pastikan Service Account sudah diberikan akses ke folder ini.
            </p>
          </div>
        </CardContent>
      </Card>

      {settings?.updatedAt && (
        <p className="text-xs text-gray-400 text-right">
          Terakhir diperbarui: {new Date(settings.updatedAt).toLocaleString("id-ID")}
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4" />
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>
    </div>
  );
}
