import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LayoutDashboard, Save, ShieldAlert } from "lucide-react";

interface TemplateItem { id: number; name: string; }

interface LaggingSettings {
  walkTalkTemplateId: number | null;
  hazardTemplateId: number | null;
  monthlyHazardAllowance: number;
}

export default function DashboardSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: templateList = [], isLoading: tplLoading } = useQuery<TemplateItem[]>({
    queryKey: ["dashboard-templates"],
    queryFn: () => api.get("/dashboard/templates"),
  });

  const { data: saved } = useQuery<LaggingSettings>({
    queryKey: ["lagging-indicators"],
    queryFn: () => api.get("/lagging-indicators"),
    select: (d: any) => ({
      walkTalkTemplateId: d.walkTalkTemplateId ?? null,
      hazardTemplateId: d.hazardTemplateId ?? null,
      monthlyHazardAllowance: d.monthlyHazardAllowance ?? 0,
    }),
  });

  const [walkTalkId, setWalkTalkId] = useState<string>("");
  const [hazardId, setHazardId]     = useState<string>("");
  const [monthlyHazardAllowance, setMonthlyHazardAllowance] = useState(0);

  useEffect(() => {
    if (saved) {
      setWalkTalkId(saved.walkTalkTemplateId ? String(saved.walkTalkTemplateId) : "");
      setHazardId(saved.hazardTemplateId ? String(saved.hazardTemplateId) : "");
      setMonthlyHazardAllowance(saved.monthlyHazardAllowance);
    }
  }, [saved]);

  const saveTplMutation = useMutation({
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

  const saveHazardMutation = useMutation({
    mutationFn: () =>
      api.put("/lagging-indicators/safe-hours-settings", { monthlyHazardAllowance }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lagging-indicators"] });
      toast({ title: "Batas hazard disimpan", description: "Batas hazard per bulan berhasil diperbarui." });
    },
    onError: () => toast({ title: "Gagal menyimpan", variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Pengaturan Dashboard"
        subtitle="Konfigurasi template kartu dan batas hazard bulanan"
      />

      {/* Template Report */}
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
                  <SelectTrigger><SelectValue placeholder="— Pilih template —" /></SelectTrigger>
                  <SelectContent>
                    {templateList.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Kartu "Hazard Identification Report vs Target" (Walk &amp; Talk kanan)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Template inspeksi untuk kartu ketiga baris template dashboard.
                </p>
                <Select value={hazardId} onValueChange={setHazardId}>
                  <SelectTrigger><SelectValue placeholder="— Pilih template —" /></SelectTrigger>
                  <SelectContent>
                    {templateList.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={() => saveTplMutation.mutate()}
                disabled={saveTplMutation.isPending}
                className="w-full"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveTplMutation.isPending ? "Menyimpan..." : "Simpan Template"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Hazard Allowance */}
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-500" />
            Batas Hazard per Bulan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Batas Hazard Ditemukan per Bulan (MTD)</Label>
            <Input
              type="number"
              min={0}
              value={monthlyHazardAllowance}
              onChange={e => setMonthlyHazardAllowance(parseInt(e.target.value) || 0)}
              placeholder="0 = belum dikonfigurasi"
            />
            <p className="text-xs text-muted-foreground">
              Jumlah hazard maksimal yang diperbolehkan dalam sebulan. Tampil di kartu dashboard sebagai pembanding terhadap hazard MTD.
            </p>
          </div>

          <Button
            onClick={() => saveHazardMutation.mutate()}
            disabled={saveHazardMutation.isPending}
            className="w-full"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveHazardMutation.isPending ? "Menyimpan..." : "Simpan Batas Hazard"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
