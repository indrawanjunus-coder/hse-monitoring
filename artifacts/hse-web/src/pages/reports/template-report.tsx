import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  FileText, Layers, ClipboardList, CheckCircle2, XCircle, Printer, HelpCircle, Calendar,
} from "lucide-react";

interface TemplateRow {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  questionCount: number;
  scheduleCount: number;
  inspectionCount: number;
}
interface TemplateReport {
  period: { from: string; to: string };
  rows: TemplateRow[];
  summary: {
    total: number;
    active: number;
    inactive: number;
    totalInspections: number;
    totalSchedules: number;
    totalQuestions: number;
  };
}

const now = new Date();
const defaultFrom = `${now.getFullYear()}-01-01`;
const defaultTo   = now.toISOString().slice(0, 10);

export default function TemplateReportPage() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo]     = useState(defaultTo);
  const [applied, setApplied] = useState({ from: defaultFrom, to: defaultTo });
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

  const { data, isLoading } = useQuery<TemplateReport>({
    queryKey: ["report-templates", applied.from, applied.to],
    queryFn: () => api.get(`/reports/templates?from=${applied.from}&to=${applied.to}`),
  });

  const rows = (data?.rows ?? []).filter(r =>
    filterActive === "all" ? true : filterActive === "active" ? r.isActive : !r.isActive
  );

  const chartData = rows
    .slice()
    .sort((a, b) => b.inspectionCount - a.inspectionCount)
    .slice(0, 12)
    .map(r => ({
      name: r.name.length > 18 ? r.name.slice(0, 16) + "…" : r.name,
      fullName: r.name,
      Inspeksi: r.inspectionCount,
      Jadwal: r.scheduleCount,
    }));

  const sum = data?.summary;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Laporan Template"
        subtitle="Rekapitulasi template checklist yang dibuat, jadwal, dan hasil inspeksi dalam periode"
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
            <div className="space-y-1">
              <Label className="text-xs">Status Template</Label>
              <div className="flex rounded-lg border overflow-hidden text-sm">
                {(["all", "active", "inactive"] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setFilterActive(v)}
                    className={`px-3 py-1.5 font-medium transition-colors ${filterActive === v ? "bg-primary text-primary-foreground" : "bg-background text-slate-600 hover:bg-slate-50"}`}
                  >
                    {v === "all" ? "Semua" : v === "active" ? "Aktif" : "Tidak Aktif"}
                  </button>
                ))}
              </div>
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
              Jumlah inspeksi dihitung untuk periode: <strong>{data.period.from}</strong> s/d <strong>{data.period.to}</strong>
            </p>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-12">Memuat data...</div>
      ) : data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-5 text-center">
                <FileText className="w-5 h-5 mx-auto mb-1 text-slate-500" />
                <div className="text-3xl font-black text-slate-800">{sum?.total ?? 0}</div>
                <div className="text-xs text-slate-500 mt-0.5">Total Template</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-500" />
                <div className="text-3xl font-black text-green-700">{sum?.active ?? 0}</div>
                <div className="text-xs text-slate-500 mt-0.5">Aktif</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <XCircle className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                <div className="text-3xl font-black text-slate-600">{sum?.inactive ?? 0}</div>
                <div className="text-xs text-slate-500 mt-0.5">Tidak Aktif</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <HelpCircle className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
                <div className="text-3xl font-black text-indigo-700">{sum?.totalQuestions ?? 0}</div>
                <div className="text-xs text-slate-500 mt-0.5">Total Pertanyaan</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <Calendar className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                <div className="text-3xl font-black text-purple-700">{sum?.totalSchedules ?? 0}</div>
                <div className="text-xs text-slate-500 mt-0.5">Total Jadwal</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <ClipboardList className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                <div className="text-3xl font-black text-blue-700">{sum?.totalInspections ?? 0}</div>
                <div className="text-xs text-slate-500 mt-0.5">Total Inspeksi</div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="text-sm font-semibold mb-4 text-slate-700">
                  Inspeksi & Jadwal per Template {chartData.length < rows.length && `(top ${chartData.length})`}
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                    />
                    <Bar dataKey="Inspeksi" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Jadwal" fill="#a855f7" radius={[3, 3, 0, 0]} />
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
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 w-8">#</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Nama Template</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600">Status</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-indigo-600">Pertanyaan</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-purple-600">Jadwal</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-blue-600">Inspeksi (Periode)</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Dibuat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, i) => (
                      <tr key={row.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="px-4 py-3 text-xs text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{row.name}</div>
                          {row.description && (
                            <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{row.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${row.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                            {row.isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {row.isActive ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold text-indigo-700">{row.questionCount}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${row.scheduleCount > 0 ? "text-purple-700" : "text-slate-300"}`}>{row.scheduleCount}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{ width: `${Math.min(100, (row.inspectionCount / Math.max(1, ...rows.map(r => r.inspectionCount))) * 100)}%` }}
                              />
                            </div>
                            <span className={`font-bold tabular-nums ${row.inspectionCount > 0 ? "text-blue-700" : "text-slate-300"}`}>{row.inspectionCount}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {new Date(row.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                    <tr>
                      <td className="px-4 py-3" colSpan={2}>TOTAL ({rows.length} template)</td>
                      <td />
                      <td className="px-4 py-3 text-center text-indigo-700">
                        {rows.reduce((s, r) => s + r.questionCount, 0)}
                      </td>
                      <td className="px-4 py-3 text-center text-purple-700">
                        {rows.reduce((s, r) => s + r.scheduleCount, 0)}
                      </td>
                      <td className="px-4 py-3 text-center text-blue-700">
                        {rows.reduce((s, r) => s + r.inspectionCount, 0)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {rows.length === 0 && (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  Tidak ada template ditemukan.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
