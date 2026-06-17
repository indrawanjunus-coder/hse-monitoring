import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LayoutDashboard, Save } from "lucide-react";

interface TemplateItem { id: number; name: string; }

interface DashboardTemplateSettings {
  walkTalkTemplateId: number | null;
  hazardTemplateId: number | null;
}

export default function DashboardSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: templateList = [], isLoading: tplLoading } = useQuery<TemplateItem[]>({
    queryKey: ["dashboard-templates"],
    queryFn: () => api.get("/dashboard/templates"),
  });

  const { data: saved } = useQuery<DashboardTemplateSettings>({
    queryKey: ["lagging-indicators"],
    queryFn: () => api.get("/lagging-indicators"),
    select: (d: any) => ({
      walkTalkTemplateId: d.walkTalkTemplateId ?? null,
      hazardTemplateId: d.hazardTemplateId ?? null,
    }),
  });

  const [walkTalkId, setWalkTalkId] = useState<string>("");
  const [hazardId, setHazardId]     = useState<string>("");

  useEffect(() => {
    if (saved) {
      setWalkTalkId(saved.walkTalkTemplateId ? String(saved.walkTalkTemplateId) : "");
      setHazardId(saved.hazardTemplateId ? String(saved.hazardTemplateId) : "");
    }
  }, [saved]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put("/lagging-indicators/dashboard-templates", {
        walkTalkTemplateId: walkTalkId ? parseInt(walkTalkId) : null,
        hazardTemplateId: hazardId ? parseInt(hazardId) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lagging-indicators"] });
      toast({ title: "Pengaturan disimpan", description: "Template default dashboard berhasil diperbarui." });
    },
    onError: () => toast({ title: "Gagal menyimpan", variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Pengaturan Dashboard"
        subtitle="Pilih report yang tampil secara default di kartu-kartu dashboard"
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-violet-500" />
            Template Report Default
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {tplLoading ? (
            <p className="text-sm text-muted-foreground">Memuat daftar template...</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Kartu "Total Walk &amp; Talk" &amp; "Walk &amp; Talk vs Target"
                </Label>
                <p className="text-xs text-muted-foreground">
                  Template inspeksi yang ditampilkan di 2 kartu pertama baris bawah dashboard.
                </p>
                <Select value={walkTalkId} onValueChange={setWalkTalkId}>
                  <SelectTrigger>
                    <SelectValue placeholder="— Pilih template —" />
                  </SelectTrigger>
                  <SelectContent>
                    {templateList.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Kartu "Hazard Identification Report vs Target"
                </Label>
                <p className="text-xs text-muted-foreground">
                  Template inspeksi yang ditampilkan di kartu ketiga baris bawah dashboard.
                </p>
                <Select value={hazardId} onValueChange={setHazardId}>
                  <SelectTrigger>
                    <SelectValue placeholder="— Pilih template —" />
                  </SelectTrigger>
                  <SelectContent>
                    {templateList.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="w-full"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Perubahan langsung berlaku di dashboard. User dapat tetap mengganti template secara manual dari dashboard tanpa mengubah setting ini.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
