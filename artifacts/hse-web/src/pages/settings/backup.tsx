import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  Download, Database, FileText, FileCode2, Loader2,
  Github, PackageOpen, Check, Eye, EyeOff, Save, RefreshCw,
  FolderOpen, GitBranch, KeyRound, BookOpen, XCircle,
} from "lucide-react";

interface BackupFormat {
  key: "postgresql" | "mysql" | "csv";
  label: string;
  description: string;
  icon: React.ReactNode;
  ext: string;
}

const FORMATS: BackupFormat[] = [
  {
    key: "postgresql",
    label: "PostgreSQL SQL",
    description: "INSERT statements yang kompatibel dengan PostgreSQL. Gunakan untuk restore ke database PostgreSQL.",
    icon: <Database className="w-5 h-5 text-blue-600" />,
    ext: "sql",
  },
  {
    key: "mysql",
    label: "MySQL SQL",
    description: "INSERT statements yang kompatibel dengan MySQL/MariaDB. Gunakan untuk migrasi ke MySQL.",
    icon: <FileCode2 className="w-5 h-5 text-orange-500" />,
    ext: "sql",
  },
  {
    key: "csv",
    label: "CSV (Multi-tabel)",
    description: "Semua data dalam format CSV, terpisah per tabel. Bisa dibuka di Excel atau Google Sheets.",
    icon: <FileText className="w-5 h-5 text-green-600" />,
    ext: "csv",
  },
];

interface GithubConfig {
  repo: string;
  branch: string;
  hasToken: boolean;
  hasEnvToken: boolean;
  path: string;
}

interface PushResult {
  ok: boolean;
  pushed: string[];
  repo: string;
  branch: string;
  message: string;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function doDownload(endpoint: string, filename: string, token: string): Promise<void> {
  const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unduhan gagal" }));
    throw new Error((err as { error?: string }).error ?? "Unduhan gagal");
  }
  const blob = await res.blob();
  downloadBlob(blob, filename);
}

export default function BackupPage() {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const token = localStorage.getItem("hse_token") ?? "";
  const now = new Date().toISOString().slice(0, 19).replace(/:/g, "-");

  const { data: ghConfig, isLoading: ghLoading } = useQuery<GithubConfig>({
    queryKey: ["backup-github-config"],
    queryFn: () => api.get("/backup/github-config"),
  });

  const [ghForm, setGhForm] = useState({ repo: "", branch: "main", path: "backups/" });
  const [ghFormReady, setGhFormReady] = useState(false);

  useEffect(() => {
    if (ghConfig && !ghFormReady) {
      setGhForm({
        repo: ghConfig.repo || "",
        branch: ghConfig.branch || "main",
        path: ghConfig.path || "backups/",
      });
      setGhFormReady(true);
    }
  }, [ghConfig, ghFormReady]);

  const saveConfig = useMutation({
    mutationFn: (data: { repo: string; branch: string; path: string; token?: string }) =>
      api.put("/backup/github-config", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backup-github-config"] });
      toast({ title: "Konfigurasi GitHub disimpan" });
    },
    onError: (e: Error) => toast({ title: "Gagal simpan konfigurasi", description: e.message, variant: "destructive" }),
  });

  const pushMutation = useMutation({
    mutationFn: () => api.post("/backup/github-push", {}),
    onSuccess: (data: PushResult) => {
      setPushResult(data);
      setPushError(null);
      toast({ title: "Push ke GitHub berhasil!", description: data.message });
    },
    onError: (e: Error) => {
      setPushError(e.message);
      setPushResult(null);
      toast({
        title: "Push ke GitHub gagal",
        description: e.message,
        variant: "destructive",
        duration: 10000,
      });
    },
  });

  const handleDownload = async (fmt: BackupFormat) => {
    setLoadingKey(fmt.key);
    try {
      await doDownload(
        `/api/backup?format=${fmt.key}`,
        `hse-backup-${fmt.key}-${now}.${fmt.ext}`,
        token
      );
      toast({ title: "Berhasil diunduh", description: `hse-backup-${fmt.key}-${now}.${fmt.ext}` });
    } catch (e: unknown) {
      toast({ title: "Unduhan gagal", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setLoadingKey(null);
    }
  };

  const handleZipDownload = async () => {
    setLoadingKey("zip");
    try {
      await doDownload(
        `/api/backup/zip`,
        `hse-backup-${now}.zip`,
        token
      );
      toast({ title: "ZIP berhasil diunduh", description: `hse-backup-${now}.zip` });
    } catch (e: unknown) {
      toast({ title: "Unduhan ZIP gagal", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setLoadingKey(null);
    }
  };

  const handleSaveConfig = () => {
    const payload: { repo: string; branch: string; path: string; token?: string } = {
      repo: ghForm.repo,
      branch: ghForm.branch,
      path: ghForm.path,
    };
    if (tokenInput.trim()) payload.token = tokenInput.trim();
    saveConfig.mutate(payload);
    setTokenInput("");
  };

  const isAnyLoading = loadingKey !== null || pushMutation.isPending;

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="Backup Aplikasi"
        subtitle="Export data, download ZIP, atau push ke GitHub secara otomatis"
      />

      {/* ZIP Download — featured */}
      <Card className="mb-6 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                <PackageOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Download ZIP</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Unduh semua format backup (PostgreSQL, MySQL, CSV) dalam satu file ZIP.
                </p>
              </div>
            </div>
            <Button
              size="lg"
              onClick={handleZipDownload}
              disabled={isAnyLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
            >
              {loadingKey === "zip" ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Memproses…</>
              ) : (
                <><Download className="w-4 h-4 mr-2" />Unduh ZIP</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Push to GitHub */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Github className="w-5 h-5 text-gray-800" />
            <CardTitle className="text-base">Push ke GitHub</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Simpan backup data otomatis ke repository GitHub Anda. Memerlukan Personal Access Token (PAT) dengan izin <strong>repo</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ghLoading ? (
            <div className="h-16 flex items-center justify-center text-gray-400 text-sm">Memuat konfigurasi…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />Repository
                  </Label>
                  <Input
                    placeholder="owner/repo-name"
                    value={ghForm.repo}
                    onChange={e => setGhForm(f => ({ ...f, repo: e.target.value }))}
                    className="text-sm h-9"
                  />
                  <p className="text-xs text-gray-400">Contoh: johndoe/hse-backups</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" />Branch
                  </Label>
                  <Input
                    placeholder="main"
                    value={ghForm.branch}
                    onChange={e => setGhForm(f => ({ ...f, branch: e.target.value }))}
                    className="text-sm h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5" />Folder di Repo <span className="text-gray-400">(opsional)</span>
                  </Label>
                  <Input
                    placeholder="backups"
                    value={ghForm.path}
                    onChange={e => setGhForm(f => ({ ...f, path: e.target.value }))}
                    className="text-sm h-9"
                  />
                  <p className="text-xs text-gray-400">
                    Nama folder di dalam repo (contoh: <code className="bg-gray-100 px-1 rounded">backups</code>). Kosongkan untuk simpan di root. Bukan "/tree/main".
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />Personal Access Token (PAT)
                  </Label>
                  {ghConfig?.hasEnvToken ? (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>Token otomatis digunakan dari konfigurasi server (<code className="bg-green-100 px-1 rounded">GITHUB_PERSONAL_ACCESS_TOKEN</code>). Tidak perlu diisi.</span>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Input
                          type={showToken ? "text" : "password"}
                          placeholder={ghConfig?.hasToken ? "••••••••••••• (tersimpan)" : "ghp_xxxxxxxxxxxx"}
                          value={tokenInput}
                          onChange={e => setTokenInput(e.target.value)}
                          className="text-sm h-9 pr-9"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          onClick={() => setShowToken(s => !s)}
                        >
                          {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {ghConfig?.hasToken && !tokenInput && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <Check className="w-3 h-3" />Token sudah tersimpan. Kosongkan untuk tidak mengubah.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveConfig}
                  disabled={saveConfig.isPending}
                  className="gap-1.5"
                >
                  {saveConfig.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Simpan Konfigurasi
                </Button>
                <Button
                  size="sm"
                  onClick={() => { setPushResult(null); pushMutation.mutate(); }}
                  disabled={isAnyLoading || (!ghConfig?.hasToken && !ghConfig?.hasEnvToken && !tokenInput.trim()) || !ghForm.repo}
                  className="gap-1.5 bg-gray-900 hover:bg-gray-800 text-white"
                >
                  {pushMutation.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />Mendorong ke GitHub…</>
                  ) : (
                    <><RefreshCw className="w-3.5 h-3.5" />Push Backup ke GitHub</>
                  )}
                </Button>
              </div>

              {pushResult && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  <p className="font-medium flex items-center gap-1.5 mb-1">
                    <Check className="w-4 h-4" />Push berhasil!
                  </p>
                  <p className="text-xs text-green-700 mb-1">Repository: <strong>{pushResult.repo}</strong> · Branch: <strong>{pushResult.branch}</strong></p>
                  <ul className="text-xs text-green-700 space-y-0.5">
                    {pushResult.pushed.map(f => (
                      <li key={f}>✓ {f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {pushError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm">
                  <p className="font-medium flex items-center gap-1.5 text-red-800 mb-1">
                    <XCircle className="w-4 h-4 flex-shrink-0" />Gagal push ke GitHub
                  </p>
                  <p className="text-xs text-red-700 break-words">{pushError}</p>
                </div>
              )}

              <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-800">
                <strong>Cara membuat PAT:</strong> Buka GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token. Pilih scope <strong>repo</strong>. Repository harus sudah ada di GitHub sebelum push pertama.
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Individual format downloads */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Unduh Format Terpisah</CardTitle>
          <CardDescription className="text-xs">Unduh data dalam format tertentu saja</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {FORMATS.map(fmt => (
              <div key={fmt.key} className="flex items-center justify-between gap-4 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {fmt.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{fmt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{fmt.description}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(fmt)}
                  disabled={isAnyLoading}
                  className="flex-shrink-0"
                >
                  {loadingKey === fmt.key ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Memproses…</>
                  ) : (
                    <><Download className="w-3.5 h-3.5 mr-1.5" />Unduh</>
                  )}
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Backup mencakup: users, incidents, inspections, schedules, categories, plants, groups, actions, preventive actions, incident types, templates, indicators, dan pengaturan sistem.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
