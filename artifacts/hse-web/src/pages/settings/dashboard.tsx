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
import { LayoutDashboard, Save, Clock, ShieldAlert, Info } from "lucide-react";

interface TemplateItem { id: number; name: string; }

interface LaggingSettings {
  walkTalkTemplateId: number | null;
  hazardTemplateId: number | null;
  workHoursManual: number;
  numShifts: number;
  numEmployees: number;
  numOutsource: number;
  contractorHours: number;
  monthlyHazardAllowance: number;
  nonLtiDays: number;
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
      workHoursManual: d.workHoursManual ?? 0,
      numShifts: d.numShifts ?? 1,
      numEmployees: d.numEmployees ?? 0,
      numOutsource: d.numOutsource ?? 0,
      contractorHours: d.contractorHours ?? 0,
      monthlyHazardAllowance: d.monthlyHazardAllowance ?? 0,
      nonLtiDays: d.nonLtiDays ?? 0,
    }),
  });

  const [walkTalkId, setWalkTalkId] = useState<string>("");
  const [hazardId, setHazardId]     = useState<string>("");

  const [safeHoursForm, setSafeHoursForm] = useState({
    workHoursManual: 0,
    numShifts: 1,
    numEmployees: 0,
    numOutsource: 0,
    contractorHours: 0,
    monthlyHazardAllowance: 0,
  });

  useEffect(() => {
    if (saved) {
      setWalkTalkId(saved.walkTalkTemplateId ? String(saved.walkTalkTemplateId) : "");
      setHazardId(saved.hazardTemplateId ? String(saved.hazardTemplateId) : "");
      setSafeHoursForm({
        workHoursManual: saved.workHoursManual,
        numShifts: saved.numShifts,
        numEmployees: saved.numEmployees,
        numOutsource: saved.numOutsource,
        contractorHours: saved.contractorHours,
        monthlyHazardAllowance: saved.monthlyHazardAllowance,
      });
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

  const saveSafeHoursMutation = useMutation({
    mutationFn: () =>
      api.put("/lagging-indicators/safe-hours-settings", safeHoursForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lagging-indicators"] });
      toast({ title: "Parameter disimpan", description: "Parameter safe hours & batas hazard berhasil diperbarui." });
    },
    onError: () => toast({ title: "Gagal menyimpan", variant: "destructive" }),
  });

  const setField = (key: keyof typeof safeHoursForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSafeHoursForm(f => ({ ...f, [key]: parseInt(e.target.value) || 0 }));

  // Computed safe hours preview
  const jamKerja = safeHoursForm.workHoursManual > 0
    ? safeHoursForm.workHoursManual
    : (saved?.nonLtiDays ?? 0) * 24;
  const previewSafeHours =
    ((jamKerja * safeHoursForm.numShifts * (safeHoursForm.numEmployees + safeHoursForm.numOutsource))
      + safeHoursForm.contractorHours).toLocaleString();

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Pengaturan Dashboard"
        subtitle="Konfigurasi template kartu, parameter safe hours, dan batas hazard bulanan"
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

      {/* Safe Hours Parameters */}
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Parameter Safe Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 flex gap-2 text-xs text-blue-700">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Rumus:</strong> (Jam Kerja × Jumlah Shift × (Karyawan + Outsource)) + Jam Kerja Kontraktor
              <br />Jam Kerja = isian manual, atau otomatis dari <strong>Non LTI Days × 24</strong> jika dikosongkan (0).
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Jam Kerja (hours)</Label>
              <Input
                type="number" min={0}
                value={safeHoursForm.workHoursManual}
                onChange={setField("workHoursManual")}
                placeholder="0 = auto dari Non LTI Days × 24"
              />
              <p className="text-xs text-muted-foreground">
                {safeHoursForm.workHoursManual > 0
                  ? `Manual: ${safeHoursForm.workHoursManual.toLocaleString()} jam`
                  : `Auto: ${((saved?.nonLtiDays ?? 0) * 24).toLocaleString()} jam (Non LTI Days × 24)`}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Jumlah Shift</Label>
              <Input
                type="number" min={1}
                value={safeHoursForm.numShifts}
                onChange={setField("numShifts")}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Jumlah Karyawan</Label>
              <Input
                type="number" min={0}
                value={safeHoursForm.numEmployees}
                onChange={setField("numEmployees")}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Jumlah Karyawan Outsource</Label>
              <Input
                type="number" min={0}
                value={safeHoursForm.numOutsource}
                onChange={setField("numOutsource")}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Jam Kerja Kontraktor (hours)</Label>
              <Input
                type="number" min={0}
                value={safeHoursForm.contractorHours}
                onChange={setField("contractorHours")}
              />
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 border px-4 py-3 text-sm">
            <span className="text-slate-500">Preview Safe Hours: </span>
            <strong className="text-slate-800">{previewSafeHours} jam</strong>
          </div>

          <div className="border-t pt-4 space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-orange-500" />
              Batas Hazard Ditemukan per Bulan
            </Label>
            <Input
              type="number" min={0}
              value={safeHoursForm.monthlyHazardAllowance}
              onChange={setField("monthlyHazardAllowance")}
              placeholder="0 = belum dikonfigurasi"
            />
            <p className="text-xs text-muted-foreground">
              Jumlah hazard maksimal yang diperbolehkan dalam sebulan (MTD). Tampil di kartu dashboard sebagai pembanding.
            </p>
          </div>

          <Button
            onClick={() => saveSafeHoursMutation.mutate()}
            disabled={saveSafeHoursMutation.isPending}
            className="w-full"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveSafeHoursMutation.isPending ? "Menyimpan..." : "Simpan Parameter"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
