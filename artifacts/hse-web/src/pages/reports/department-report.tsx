import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Building2, AlertTriangle, ShieldCheck, ShieldAlert, TrendingUp, Printer, Target,
} from "lucide-react";

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
    totalDepts: number;
    totalHazards: number;
    totalIncidents: number;
    compliant: number;
    partial: number;
    none: number;
    avgAchievement: number | null;
  };
}

const now = new Date();
const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
const today = now.toISOString().slice(0, 10);

const STATUS_META = {
  compliant:  { label: "Sesuai Target",   cls: "bg-green-100 text-green-700 border-green-200" },
  partial:    { label: "Sebagian",         cls: "bg-amber-100 text-amber-700 border-amber-200" },
  none:       { label: "Tidak Ada",        cls: "bg-red-100 text-red-700 border-red-200" },
  no_target:  { label: "—",               cls: "bg-slate-100 text-slate-500 border-slate-200" },
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

export default function DepartmentReportPage() {
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo]     = useState(today);
  const [applied, setApplied] = useState({ from: firstOfMonth, to: today });

  const { data, isLoading } = useQuery<DeptReport>({
    queryKey: ["report-department", applied.from, applied.to],
    queryFn: () => api.get(`/reports/department-summary?from=${applied.from}&to=${applied.to}`),
  });

  const chartData = (data?.rows ?? []).map(r => ({
    name: r.departmentName.length > 16 ? r.departmentName.slice(0, 14) + "…" : r.departmentName,
    fullName: r.departmentName,
    Hazard: r.hazards,
    Insiden: r.incidents,
    Target: data?.deptTarget ?? 0,
  }));

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
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Dari Tanggal</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sampai Tanggal</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40 text-sm" />
            </div>
            <Button onClick={() => setApplied({ from, to })} disabled={isLoading}>
              Terapkan
            </Button>
            <Button variant="outline" onClick={() => window.print()} className="ml-auto">
              <Printer className="w-4 h-4 mr-2" /> Cetak
            </Button>
          </div>
          {data && (
            <p className="mt-3 text-xs text-muted-foreground">
              Periode: <strong>{data.period.days} hari</strong> ({data.period.weeks.toFixed(1)} minggu) ·
              Target mingguan hazard (total): <strong>{data.weeklyTarget > 0 ? data.weeklyTarget : "—"}</strong> ·
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

      {/* Summary Cards */}
      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-12">Memuat data...</div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card className="col-span-2 md:col-span-1">
              <CardContent className="pt-5 text-center">
                <Building2 className="w-5 h-5 mx-auto mb-1 text-slate-500" />
                <div className="text-3xl font-black text-slate-800">{sum?.totalDepts ?? 0}</div>
                <div className="text-xs text-slate-500 mt-0.5">Departemen</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <ShieldAlert className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                <div className="text-3xl font-black text-blue-700">{sum?.totalHazards ?? 0}</div>
                <div className="text-xs text-slate-500 mt-0.5">Total Hazard</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-red-500" />
                <div className="text-3xl font-black text-red-700">{sum?.totalIncidents ?? 0}</div>
                <div className="text-xs text-slate-500 mt-0.5">Total Insiden</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <ShieldCheck className="w-5 h-5 mx-auto mb-1 text-green-500" />
                <div className="text-3xl font-black text-green-700">{sum?.compliant ?? 0}</div>
                <div className="text-xs text-slate-500 mt-0.5">Sesuai Target</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <Target className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                <div className="text-3xl font-black text-amber-700">{sum?.partial ?? 0}</div>
                <div className="text-xs text-slate-500 mt-0.5">Sebagian</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <TrendingUp className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
                <div className="text-3xl font-black text-indigo-700">
                  {sum?.avgAchievement != null ? `${sum.avgAchievement.toFixed(0)}%` : "—"}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Rata-rata Pencapaian</div>
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
                      <ReferenceLine y={data.deptTarget} stroke="#f59e0b" strokeDasharray="5 4" label={{ value: `Target: ${data.deptTarget}`, fontSize: 10, fill: "#b45309", position: "right" }} />
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
                      <th className="text-center px-4 py-3 text-xs font-semibold text-blue-600">Hazard Submit</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-red-600">Insiden Submit</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600">Total Submit</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-amber-600">Target Hazard</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600">Target/Minggu</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Pencapaian</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rows.map((row, i) => {
                      const meta = STATUS_META[row.status];
                      return (
                        <tr key={row.departmentId ?? "no-dept"} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                          <td className="px-4 py-3 font-medium text-slate-800">{row.departmentName}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-bold text-blue-700">{row.hazards}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-bold ${row.incidents > 0 ? "text-red-600" : "text-slate-300"}`}>{row.incidents}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-700">{row.hazards + row.incidents}</td>
                          <td className="px-4 py-3 text-center text-amber-700 font-medium">
                            {row.deptTarget > 0 ? row.deptTarget.toFixed(1) : "—"}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500 text-xs">
                            {data.weeklyTarget > 0 ? (data.weeklyTarget / Math.max(1, data.rows.length)).toFixed(1) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <AchievementBar pct={row.achievement} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.cls}`}>
                              {meta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Total row */}
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                    <tr className="font-bold">
                      <td className="px-4 py-3 text-slate-700">TOTAL</td>
                      <td className="px-4 py-3 text-center text-blue-700">{sum?.totalHazards ?? 0}</td>
                      <td className="px-4 py-3 text-center text-red-600">{sum?.totalIncidents ?? 0}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{(sum?.totalHazards ?? 0) + (sum?.totalIncidents ?? 0)}</td>
                      <td className="px-4 py-3 text-center text-amber-700">
                        {data.periodTarget > 0 ? data.periodTarget.toFixed(1) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 text-xs">
                        {data.weeklyTarget > 0 ? data.weeklyTarget.toFixed(1) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {sum?.avgAchievement != null && (
                          <AchievementBar pct={sum.avgAchievement} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 text-xs">
                        {sum && `${sum.compliant}/${sum.totalDepts} sesuai`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {data.rows.length === 0 && (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  Tidak ada data di periode ini.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
