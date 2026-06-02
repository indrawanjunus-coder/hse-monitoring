import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { RotateCcw, Save, ShieldAlert } from "lucide-react";

interface LaggingData {
  year: number;
  fatality: number;
  lti: number;
  mti: number;
  firstAid: number;
  nearMisses: number;
  hazardId: number;
  nonLtiDays: number;
  safeHours: number;
  resetDate: number | null;
  baseValue: number;
}

const CURRENT_YEAR = new Date().getFullYear();

export default function LaggingIndicatorsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isSupervisorOrAdmin = user?.role === "supervisor" || user?.role === "admin";

  const [year, setYear] = useState(CURRENT_YEAR);
  const [form, setForm] = useState({
    fatality: 0, lti: 0, mti: 0, firstAid: 0, nearMisses: 0, hazardId: 0,
  });
  const [resetForm, setResetForm] = useState({ baseValue: 0, resetDate: "" });
  const [showResetModal, setShowResetModal] = useState(false);

  const { data, isLoading } = useQuery<LaggingData>({
    queryKey: ["lagging-indicators", year],
    queryFn: () => api.get(`/lagging-indicators?year=${year}`),
  });

  useEffect(() => {
    if (data) {
      setForm({
        fatality: data.fatality,
        lti: data.lti,
        mti: data.mti,
        firstAid: data.firstAid,
        nearMisses: data.nearMisses,
        hazardId: data.hazardId,
      });
      setResetForm({
        baseValue: data.baseValue,
        resetDate: data.resetDate
          ? new Date(data.resetDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.put("/lagging-indicators", { ...form, year }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lagging-indicators"] });
      toast({ title: "Berhasil disimpan", description: "Data lagging indicator diperbarui." });
    },
    onError: () => toast({ title: "Gagal menyimpan", variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      api.put("/lagging-indicators/non-lti-reset", {
        baseValue: resetForm.baseValue,
        resetDate: resetForm.resetDate,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lagging-indicators"] });
      setShowResetModal(false);
      toast({ title: "Counter direset", description: "Non LTI Days berhasil diperbarui." });
    },
    onError: () => toast({ title: "Gagal reset", variant: "destructive" }),
  });

  const field = (label: string, key: keyof typeof form, color: string) => (
    <div className="flex items-center gap-4">
      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${color}`} />
      <Label className="w-60 text-sm font-medium">{label}</Label>
      <Input
        type="number"
        min={0}
        className="w-28 text-center"
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value) || 0 }))}
        disabled={!isSupervisorOrAdmin}
      />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Lagging Indicator"
        subtitle="Piramida insiden keselamatan dan statistik Non LTI Days"
      />

      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium">Tahun</Label>
        <select
          className="border rounded-md px-3 py-1.5 text-sm bg-background"
          value={year}
          onChange={e => setYear(parseInt(e.target.value))}
        >
          {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Data Insiden {year}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Memuat data...</p>
            ) : (
              <>
                {field("Fatality", "fatality", "bg-red-700")}
                {field("Lost Time Incident (LTI)", "lti", "bg-red-500")}
                {field("Medical Treatment Incident (MTI)", "mti", "bg-orange-500")}
                {field("First Aid", "firstAid", "bg-yellow-400")}
                {field("Near Misses", "nearMisses", "bg-blue-400")}
                {field("Unsafe Conditions & Acts (Hazard ID)", "hazardId", "bg-blue-600")}

                {isSupervisorOrAdmin && (
                  <div className="pt-2">
                    <Button
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                      className="w-full"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {saveMutation.isPending ? "Menyimpan..." : "Simpan Data"}
                    </Button>
                  </div>
                )}
                {!isSupervisorOrAdmin && (
                  <p className="text-xs text-muted-foreground pt-2">
                    Hanya supervisor/admin yang dapat mengubah data ini.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Non LTI Days Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Non LTI Days &amp; Safe Hours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-slate-50 rounded-xl border">
                <div className="text-5xl font-black text-slate-800 tracking-tight">
                  {isLoading ? "—" : (data?.nonLtiDays ?? 0).toLocaleString()}
                </div>
                <div className="text-sm font-semibold text-slate-600 mt-1">Non LTI Days</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-xl border">
                <div className="text-5xl font-black text-slate-800 tracking-tight">
                  {isLoading ? "—" : (data?.safeHours ?? 0).toLocaleString()}
                </div>
                <div className="text-sm font-semibold text-slate-600 mt-1">Safe Hours</div>
              </div>
            </div>

            {data?.resetDate && (
              <p className="text-xs text-muted-foreground text-center">
                Dihitung dari:{" "}
                <span className="font-medium">
                  {new Date(data.resetDate).toLocaleDateString("id-ID", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </span>
                {" "}+ {data.baseValue} hari basis
              </p>
            )}

            {isSupervisorOrAdmin && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowResetModal(true)}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset / Ubah Non LTI Days
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold">Reset Non LTI Days</h3>
            <p className="text-sm text-muted-foreground">
              Counter akan dihitung ulang dari tanggal reset + nilai basis yang ditentukan.
              Safe Hours = Non LTI Days × 24.
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Tanggal Reset</Label>
                <Input
                  type="date"
                  value={resetForm.resetDate}
                  onChange={e => setResetForm(f => ({ ...f, resetDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Nilai Basis (hari awal)</Label>
                <Input
                  type="number"
                  min={0}
                  value={resetForm.baseValue}
                  onChange={e => setResetForm(f => ({ ...f, baseValue: parseInt(e.target.value) || 0 }))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Contoh: isi 0 untuk mulai dari 0, atau isi angka tertentu jika sudah ada hari sebelumnya.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowResetModal(false)}>
                Batal
              </Button>
              <Button
                className="flex-1"
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? "Menyimpan..." : "Konfirmasi Reset"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
