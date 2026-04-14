import { useState } from "react";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Download, Database, FileText, FileCode2, Loader2 } from "lucide-react";

interface BackupFormat {
  key: "postgresql" | "mysql" | "csv";
  label: string;
  description: string;
  icon: React.ReactNode;
  ext: string;
  mime: string;
}

const FORMATS: BackupFormat[] = [
  {
    key: "postgresql",
    label: "PostgreSQL SQL",
    description: "INSERT statements yang kompatibel dengan PostgreSQL. Gunakan untuk restore ke database PostgreSQL.",
    icon: <Database className="w-6 h-6 text-blue-600" />,
    ext: "sql",
    mime: "text/plain",
  },
  {
    key: "mysql",
    label: "MySQL SQL",
    description: "INSERT statements yang kompatibel dengan MySQL/MariaDB. Gunakan untuk migrasi ke MySQL.",
    icon: <FileCode2 className="w-6 h-6 text-orange-500" />,
    ext: "sql",
    mime: "text/plain",
  },
  {
    key: "csv",
    label: "CSV (Multi-tabel)",
    description: "Semua data dalam format CSV, terpisah per tabel. Bisa dibuka di Excel atau Google Sheets.",
    icon: <FileText className="w-6 h-6 text-green-600" />,
    ext: "csv",
    mime: "text/csv",
  },
];

export default function BackupPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleBackup = async (format: BackupFormat) => {
    setLoading(format.key);
    try {
      const token = localStorage.getItem("hse_token") ?? "";

      const response = await fetch(`/api/backup?format=${format.key}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Backup gagal" }));
        throw new Error(err.error ?? "Backup gagal");
      }

      const blob = await response.blob();
      const now = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      const filename = `hse-backup-${format.key}-${now}.${format.ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Backup berhasil diunduh", description: filename });
    } catch (err: unknown) {
      toast({
        title: "Backup gagal",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader
        title="Backup Database"
        subtitle="Export seluruh data ke format pilihan untuk keperluan backup atau migrasi"
      />

      <div className="space-y-4 mt-4">
        <Card className="border-blue-100 bg-blue-50">
          <CardContent className="p-4">
            <p className="text-sm text-blue-800">
              <strong>Catatan:</strong> Backup akan mengekspor data perusahaan Anda (filtered by company).
              Data sensitif seperti password sudah ter-hash dan aman untuk dieksport.
              Simpan file backup di lokasi yang aman.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {FORMATS.map(fmt => (
            <Card key={fmt.key} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      {fmt.icon}
                    </div>
                    <div>
                      <CardTitle className="text-base">{fmt.label}</CardTitle>
                      <CardDescription className="mt-0.5 text-xs">{fmt.description}</CardDescription>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleBackup(fmt)}
                    disabled={loading !== null}
                    className="flex-shrink-0"
                  >
                    {loading === fmt.key ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Memproses...</>
                    ) : (
                      <><Download className="w-4 h-4 mr-2" />Unduh {fmt.label.split(" ")[0]}</>
                    )}
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Backup mencakup tabel: users, incidents, inspections, schedules, categories, plants, groups, actions, preventive actions, incident types, templates, indicators, dan pengaturan sistem.
        </p>
      </div>
    </div>
  );
}
