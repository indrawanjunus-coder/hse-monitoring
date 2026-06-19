import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Building2, AlertTriangle, ShieldCheck, ShieldAlert, TrendingUp, Printer,
  Target, FileSpreadsheet, ChevronDown, Check, Calendar,
} from "lucide-react";

// ── Period helpers ─────────────────────────────────────────────────────────────
const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const YEARS = [2023, 2024, 2025, 2026, 2027];
type PeriodMode = "monthly" | "yearly";

function getPeriod(mode: PeriodMode, month: number, year: number) {
  if (mode === "yearly") {
    return { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) };
  }
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
    label: `${MONTHS_ID[month - 1]} ${year}`,
  };
}

interface DeptRow {
  departmentId: number | null;
  departmentName: string;
  hazards: number;
  incidents: number;
  deptTarget: number;
  achievement: number | null;
  status: "compliant" | "partial" | "none" | "no_target";
}
interface DeptReport {
  period: { from: string; to: string; days: number; weeks: number };
  weeklyTarget: number;
  periodTarget: number;
  deptTarget: number;
  rows: DeptRow[];
  summary: {
    totalDepts: number; totalHazards: number; totalIncidents: number;
    compliant: number; partial: number; none: number; avgAchievement: number | null;
  };
}


const STATUS_META = {
  compliant:  { label: "Sesuai Target", cls: "bg-green-100 text-green-700 border-green-200" },
  partial:    { label: "Sebagian",       cls: "bg-amber-100 text-amber-700 border-amber-200" },
  none:       { label: "Tidak Ada",      cls: "bg-red-100 text-red-700 border-red-200" },
  no_target:  { label: "—",             cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

function AchievementBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-slate-400">—</span>;
  const w = Math.min(100, pct);
  const color = pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

// Multi-select department dropdown
function DeptMultiSelect({
  departments, selected, onChange,
}: { departments: DeptRow[]; selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allKeys = departments.map(d => String(d.departmentId ?? "null"));
  const allSelected = selected.size === 0 || selected.size === allKeys.length;

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(next);
  };
  const toggleAll = () => onChange(allSelected ? new Set() : new Set(allKeys));

  const label = allSelected
    ? "Semua Departemen"
    : selected.size === 1
      ? departments.find(d => selected.has(String(d.departmentId ?? "null")))?.departmentName ?? "1 dipilih"
      : `${selected.size} departemen dipilih`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 border rounded-md px-3 py-1.5 text-sm bg-background min-w-[200px] max-w-[280px] truncate"
      >
        <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="flex-1 text-left truncate">{label}</span>
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white border rounded-lg shadow-lg min-w-[220px] max-h-64 overflow-y-auto">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-slate-50 border-b"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${allSelected ? "bg-primary border-primary" : "border-slate-300"}`}>
              {allSelected && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="font-medium">Semua Departemen</span>
          </button>
          {departments.map(d => {
            const key = String(d.departmentId ?? "null");
            const checked = selected.size === 0 ? true : selected.has(key);
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-slate-50"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? "bg-primary border-primary" : "border-slate-300"}`}>
                  {checked && <Check className="w-3 h-3 text-white" />}
                </div>
                <span>{d.departmentName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DepartmentReportPage() {
  const nowD = new Date();
  const [mode, setMode] = useState<PeriodMode>("monthly");
  const [month, setMonth] = useState(nowD.getMonth() + 1);
  const [year, setYear]   = useState(nowD.getFullYear());
  const [applied, setApplied] = useState(() => getPeriod("monthly", nowD.getMonth() + 1, nowD.getFullYear()));
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<DeptReport>({
    queryKey: ["report-department", applied.from, applied.to],
    queryFn: () => api.get(`/reports/department-summary?from=${applied.from}&to=${applied.to}`),
  });

  // Reset filter when new data arrives
  useEffect(() => { setSelectedDepts(new Set()); }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (selectedDepts.size === 0) return data.rows;
    return data.rows.filter(r => selectedDepts.has(String(r.departmentId ?? "null")));
  }, [data, selectedDepts]);

  const chartData = filteredRows.map(r => ({
    name: r.departmentName.length > 16 ? r.departmentName.slice(0, 14) + "…" : r.departmentName,
    fullName: r.departmentName,
    Hazard: r.hazards,
    Insiden: r.incidents,
    Target: data?.deptTarget ?? 0,
  }));

  const filteredHazards   = filteredRows.reduce((s, r) => s + r.hazards, 0);
  const filteredIncidents = filteredRows.reduce((s, r) => s + r.incidents, 0);

  const exportExcel = () => {
    if (!data) return;
    const header = ["Departemen", "Hazard Submit", "Insiden Submit", "Total Submit", "Pencapaian (%)", "Status"];
    const rows = filteredRows.map(r => [
      r.departmentName,
      r.hazards,
      r.incidents,
      r.hazards + r.incidents,
      r.achievement != null ? r.achievement.toFixed(1) + "%" : "—",
      STATUS_META[r.status].label,
    ]);
    const footer = [
      "TOTAL",
      filteredHazards,
      filteredIncidents,
      filteredHazards + filteredIncidents,
      data.summary.avgAchievement != null ? data.summary.avgAchievement.toFixed(1) + "%" : "—",
      `${data.summary.compliant}/${data.rows.length} sesuai`,
    ];
    const metaRows = [
      [`Periode: ${applied.label}`],
      [`Minggu dalam periode: ${data.period.weeks.toFixed(1)}`],
      [`Target Hazard Global (Periode): ${data.periodTarget > 0 ? data.periodTarget.toFixed(0) : "—"}`],
      [`Target Hazard Global (Per Minggu): ${data.weeklyTarget > 0 ? data.weeklyTarget.toFixed(0) : "—"}`],
      [`Realisasi Hazard Total: ${filteredHazards}`],
      [],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...metaRows, header, ...rows, footer]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hazard & Insiden per Dept");
    XLSX.writeFile(wb, `laporan-dept-${applied.label.replace(/ /g, "-")}.xlsx`);
  };

  const sum = data?.summary;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Laporan Hazard & Insiden per Departemen"
        subtitle="Rekapitulasi submit hazard dan insiden berdasarkan departemen, beserta target dan pencapaian"
      />

      {/* Filter */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-end gap-3">
            {/* Mode toggle */}
            <div className="space-y-1">
              <Label className="text-xs">Tampilkan Per</Label>
              <div className="flex rounded-md border overflow-hidden text-sm">
                <button
                  onClick={() => setMode("monthly")}
                  className={`px-3 py-1.5 transition-colors ${mode === "monthly" ? "bg-primary text-primary-foreground font-medium" : "bg-background hover:bg-slate-50"}`}
                >Bulan</button>
                <button
                  onClick={() => setMode("yearly")}
                  className={`px-3 py-1.5 transition-colors border-l ${mode === "yearly" ? "bg-primary text-primary-foreground font-medium" : "bg-background hover:bg-slate-50"}`}
                >Tahun</button>
              </div>
            </div>
            {/* Month (only for monthly mode) */}
            {mode === "monthly" && (
              <div className="space-y-1">
                <Label className="text-xs">Bulan</Label>
                <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
                  <SelectTrigger className="w-36 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS_ID.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Year */}
            <div className="space-y-1">
              <Label className="text-xs">Tahun</Label>
              <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                <SelectTrigger className="w-24 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => setApplied(getPeriod(mode, month, year))}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" /> Terapkan
            </Button>
            {data && data.rows.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Filter Departemen</Label>
                <DeptMultiSelect
                  departments={data.rows}
                  selected={selectedDepts}
                  onChange={setSelectedDepts}
                />
              </div>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={exportExcel} disabled={!data || filteredRows.length === 0}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" /> Cetak
              </Button>
            </div>
          </div>
          {data && (
            <p className="mt-3 text-xs text-muted-foreground">
              Periode: <strong>{data.period.days} hari</strong> ({data.period.weeks.toFixed(1)} minggu) ·
              Target mingguan hazard: <strong>{data.weeklyTarget > 0 ? data.weeklyTarget : "—"}</strong> ·
              Target per dept: <strong>{data.deptTarget > 0 ? data.deptTarget : "—"}</strong>
              {data.weeklyTarget === 0 && (
                <span className="ml-2 text-amber-600">
                  ⚠ Atur batas hazard bulanan di halaman Lagging Indicator untuk menampilkan target
                </span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-12">Memuat data...</div>
      ) : data && (
        <>
          {/* Global Target Banner */}
          {(data.weeklyTarget > 0 || data.periodTarget > 0) && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-800">Target Hazard Global ({applied.label})</span>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-black text-amber-700">
                        {data.periodTarget > 0 ? data.periodTarget.toFixed(0) : "—"}
                      </div>
                      <div className="text-xs text-amber-600">Target Periode</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-amber-700">
                        {data.weeklyTarget > 0 ? data.weeklyTarget.toFixed(0) : "—"}
                      </div>
                      <div className="text-xs text-amber-600">Target/Minggu</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-blue-700">{filteredHazards}</div>
                      <div className="text-xs text-blue-600">Realisasi Hazard</div>
                    </div>
                    <div className="text-center">
                      {data.periodTarget > 0 ? (
                        <>
                          <div className={`text-2xl font-black ${filteredHazards >= data.periodTarget ? "text-green-600" : "text-red-600"}`}>
                            {((filteredHazards / data.periodTarget) * 100).toFixed(0)}%
                          </div>
                          <div className="text-xs text-slate-500">Pencapaian</div>
                        </>
                      ) : (
                        <>
                          <div className="text-2xl font-black text-slate-400">—</div>
                          <div className="text-xs text-slate-400">Pencapaian</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-5 text-center">
                <Building2 className="w-5 h-5 mx-auto mb-1 text-slate-500" />
                <div className="text-3xl font-black text-slate-800">{filteredRows.length}</div>
                <div className="text-xs text-slate-500 mt-0.5">Departemen</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <ShieldAlert className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                <div className="text-3xl font-black text-blue-700">{filteredHazards}</div>
                <div className="text-xs text-slate-500 mt-0.5">Total Hazard</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-red-500" />
                <div className="text-3xl font-black text-red-700">{filteredIncidents}</div>
                <div className="text-xs text-slate-500 mt-0.5">Total Insiden</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <ShieldCheck className="w-5 h-5 mx-auto mb-1 text-green-500" />
                <div className="text-3xl font-black text-green-700">
                  {filteredRows.filter(r => r.status === "compliant").length}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Sesuai Target</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <TrendingUp className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
                <div className="text-3xl font-black text-indigo-700">
                  {sum?.avgAchievement != null ? `${sum.avgAchievement.toFixed(0)}%` : "—"}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Rata-rata</div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="text-sm font-semibold mb-4 text-slate-700">Hazard & Insiden per Departemen</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(val, name) => [val, name]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                    />
                    <Legend verticalAlign="top" />
                    <Bar dataKey="Hazard" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Insiden" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    {data.deptTarget > 0 && (
                      <ReferenceLine y={data.deptTarget} stroke="#f59e0b" strokeDasharray="5 4"
                        label={{ value: `Target: ${data.deptTarget}`, fontSize: 10, fill: "#b45309", position: "insideTopRight" }}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Detail Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Departemen</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-blue-600">Hazard</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-red-600">Insiden</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600">Total</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Pencapaian</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((row, i) => {
                      const meta = STATUS_META[row.status];
                      return (
                        <tr key={String(row.departmentId ?? "null")} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                          <td className="px-4 py-3 font-medium text-slate-800">{row.departmentName}</td>
                          <td className="px-4 py-3 text-center font-bold text-blue-700">{row.hazards}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-bold ${row.incidents > 0 ? "text-red-600" : "text-slate-300"}`}>{row.incidents}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-700">{row.hazards + row.incidents}</td>
                          <td className="px-4 py-3"><AchievementBar pct={row.achievement} /></td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.cls}`}>
                              {meta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                    <tr>
                      <td className="px-4 py-3 text-slate-700">TOTAL ({filteredRows.length} dept)</td>
                      <td className="px-4 py-3 text-center text-blue-700">{filteredHazards}</td>
                      <td className="px-4 py-3 text-center text-red-600">{filteredIncidents}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{filteredHazards + filteredIncidents}</td>
                      <td className="px-4 py-3">
                        {sum?.avgAchievement != null && <AchievementBar pct={sum.avgAchievement} />}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 text-xs">
                        {`${filteredRows.filter(r => r.status === "compliant").length}/${filteredRows.length} sesuai`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {filteredRows.length === 0 && (
                <div className="p-10 text-center text-sm text-muted-foreground">Tidak ada data di periode ini.</div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
