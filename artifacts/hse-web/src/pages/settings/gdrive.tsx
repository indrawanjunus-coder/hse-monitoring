import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Cloud, Save, CheckCircle2, AlertTriangle, FolderOpen, Key, Mail, FileJson, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GdriveSettings {
  clientEmail: string;
  privateKeySet: boolean;
  rootFolderId: string;
  updatedAt: string | null;
}

export default function GdriveSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<GdriveSettings | null>(null);
  const [clientEmail, setClientEmail] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [rootFolderId, setRootFolderId] = useState("0AIi51ZRCyt6JUk9PVA");
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState("");
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

  function parseJsonInput() {
    setJsonError("");
    try {
      const parsed = JSON.parse(jsonInput.trim());
      if (!parsed.client_email) { setJsonError("Field 'client_email' tidak ditemukan"); return; }
      if (!parsed.private_key) { setJsonError("Field 'private_key' tidak ditemukan"); return; }
      if (parsed.type !== "service_account") { setJsonError("Bukan service account JSON"); return; }
      setClientEmail(parsed.client_email);
      setPrivateKey(parsed.private_key);
      setJsonInput("");
      toast({ title: "JSON berhasil diparsing — silakan simpan pengaturan" });
    } catch {
      setJsonError("JSON tidak valid. Pastikan Anda copy seluruh isi file JSON service account.");
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, string> = { clientEmail, rootFolderId };
      if (privateKey.trim()) body.privateKey = privateKey.trim();
      await api.put("/settings/gdrive", body);
      toast({ title: "Pengaturan Google Drive berhasil disimpan" });
      setPrivateKey("");
      const refreshed = await api.get<GdriveSettings>("/settings/gdrive");
      setSettings(refreshed);
      setClientEmail(refreshed.clientEmail || "");
    } catch (e: any) {
      toast({ title: "Gagal menyimpan", description: e.message, variant: "destructive" });
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
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ 📁 04 - April (Bulan)<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ 📄 5-2026-04-02-00001.pdf
          </p>
          <p className="mt-2 text-xs font-semibold">Prasyarat:</p>
          <p className="text-xs">Pastikan folder Google Drive sudah di-share ke service account dengan role <strong>Editor</strong>.</p>
        </AlertDescription>
      </Alert>

      {settings && (
        <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${settings.privateKeySet && settings.clientEmail ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
          {settings.privateKeySet && settings.clientEmail ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <div className="text-sm text-green-800">
                <p className="font-semibold">Google Drive aktif</p>
                <p className="text-xs text-green-700">{settings.clientEmail}</p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 font-medium">Service account belum dikonfigurasi — upload file tidak akan berfungsi</p>
            </>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4" />Service Account Credentials
          </CardTitle>
          <CardDescription>
            Ada dua cara untuk mengisi kredensial: paste JSON langsung atau isi manual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="json">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="json" className="flex-1 gap-1.5"><FileJson className="w-3.5 h-3.5" />Paste JSON File (disarankan)</TabsTrigger>
              <TabsTrigger value="manual" className="flex-1 gap-1.5"><Key className="w-3.5 h-3.5" />Isi Manual</TabsTrigger>
            </TabsList>

            <TabsContent value="json" className="space-y-3">
              <p className="text-xs text-gray-500">
                Download file JSON dari Google Cloud Console → IAM & Admin → Service Accounts → pilih akun → Keys → Add Key → Create new key → JSON.
                Lalu copy seluruh isi file dan paste di bawah ini.
              </p>
              <Textarea
                value={jsonInput}
                onChange={e => { setJsonInput(e.target.value); setJsonError(""); }}
                placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",\n  "client_email": "hse-820@...iam.gserviceaccount.com",\n  ...\n}'}
                rows={8}
                className="font-mono text-xs resize-none"
              />
              {jsonError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />{jsonError}
                </p>
              )}
              <Button
                variant="outline"
                onClick={parseJsonInput}
                disabled={!jsonInput.trim()}
                className="gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Parse JSON
              </Button>
              {clientEmail && settings?.privateKeySet && !privateKey && (
                <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2 text-xs text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sudah dikonfigurasi: <strong>{clientEmail}</strong>
                </div>
              )}
              {clientEmail && privateKey && (
                <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-xs text-blue-700 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  JSON berhasil diparsing untuk: <strong>{clientEmail}</strong> — klik Simpan untuk menyimpan
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
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
                  {settings?.privateKeySet && !privateKey && (
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
                    : "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"}
                  rows={6}
                  className="font-mono text-xs resize-none"
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />Folder Tujuan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="root-folder">Root Folder ID</Label>
          <Input
            id="root-folder"
            value={rootFolderId}
            onChange={e => setRootFolderId(e.target.value)}
            placeholder="0AIi51ZRCyt6JUk9PVA"
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-400">
            ID folder Google Drive. Bisa dilihat dari URL folder: <code>https://drive.google.com/drive/folders/<strong>[ID-FOLDER]</strong></code>
          </p>
        </CardContent>
      </Card>

      {settings?.updatedAt && (
        <p className="text-xs text-gray-400 text-right">
          Terakhir diperbarui: {new Date(settings.updatedAt).toLocaleString("id-ID")}
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || (!clientEmail && !settings?.clientEmail)} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4" />
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>
    </div>
  );
}
