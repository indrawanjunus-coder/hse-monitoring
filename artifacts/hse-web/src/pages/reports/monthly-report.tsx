import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { TrendingUp, CheckCircle, AlertTriangle, Clock, Printer, FileBarChart } from "lucide-react";

interface MonthlyData {
  period: { from: string; to: string };
  summary: {
    total: number; closed: number; inProgress: number; open: number;
    withAction: number; resolutionRate: number;
  };
  byCategory: { categoryId: number; categoryName: string; total: number; closed: number; open: number; inProgress: number }[];
  byPlant: { plantId: number; plantName: string; total: number; closed: number }[];
  timeBuckets: { label: string; key: string; count: number; pct: number }[];
  incidents: {
    id: number; incidentDate: string; reportedDate: string; status: string;
    categoryName: string; plantName: string; reporterName: string;
    assignedGroupName?: string | null; actionName?: string | null;
    followupNote?: string | null; detail: string; closedAt?: string | null;
  }[];
}

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];
const STATUS_STYLES: Record<string, string> = {
  open: "bg-red-100 text-red-700 border-red-200",
  in_progress: "bg-yellow-100 text-yellow-700 border-yellow-200",
  closed: "bg-green-100 text-green-700 border-green-200",
};
const STATUS_LABELS: Record<string, string> = { open: "Open", in_progress: "Proses", closed: "Selesai" };

function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MonthlyReportPage() {
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultTo = now.toISOString().slice(0, 10);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [applied, setApplied] = useState({ from: defaultFrom, to: defaultTo });

  const { data, isLoading } = useQuery<MonthlyData>({
    queryKey: ["reports", "monthly", applied.from, applied.to],
    queryFn: () => api.get(`/reports/monthly?from=${applied.from}&to=${applied.to}`),
    enabled: !!applied.from && !!applied.to,
  });

  const categoryChartData = (data?.byCategory ?? []).map((c, i) => ({
    name: c.categoryName,
    total: c.total,
    closed: c.closed,
    open: c.open,
    color: COLORS[i % COLORS.length]!,
  }));

  const timeBucketPie = (data?.timeBuckets ?? []).map((b, i) => ({
    name: b.label,
    value: b.count,
    fill: COLORS[i % COLORS.length]!,
  }));

  return (
    <div className="p-6">
      <PageHeader
        title="Laporan Bulanan"
        subtitle="Analisis incident per periode waktu"
        action={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />Cetak
          </Button>
        }
      />

      {/* Filter */}
      <Card className="mb-5 print:hidden">
        <CardContent className="p-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">Dari Tanggal</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-sm w-36" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sampai Tanggal</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-sm w-36" />
            </div>
            <Button size="sm" onClick={() => setApplied({ from, to })}>
              <FileBarChart className="w-4 h-4 mr-1.5" />Buat Laporan
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Periode: {applied.from} s/d {applied.to}</p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Memuat laporan...</div>
      ) : !data ? null : (
        <>
          {/* Print header */}
          <div className="hidden print:block text-center mb-6">
            <h1 className="text-xl font-bold">Laporan HSE — Hazard & Incident</h1>
            <p className="text-sm text-gray-500">Periode: {applied.from} s/d {applied.to}</p>
            <p className="text-sm text-gray-400">Dicetak pada {new Date().toLocaleDateString("id-ID", { dateStyle: "full" })}</p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <SummaryCard label="Total Incident" value={data.summary.total} color="bg-gray-100 text-gray-600" />
            <SummaryCard label="Open" value={data.summary.open} color="bg-red-100 text-red-600" />
            <SummaryCard label="Dalam Proses" value={data.summary.inProgress} color="bg-amber-100 text-amber-600" />
            <SummaryCard label="Selesai" value={data.summary.closed} color="bg-green-100 text-green-600" />
            <SummaryCard label="Rate Penyelesaian" value={`${data.summary.resolutionRate}%`} color="bg-blue-100 text-blue-600" />
            <SummaryCard label="Dgn Tindakan" value={data.summary.withAction} color="bg-purple-100 text-purple-600" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            {/* Category chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Incident per Kategori</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={categoryChartData} barSize={30}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" name="Total" radius={[3, 3, 0, 0]}>
                      {categoryChartData.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Time bucket pie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribusi Waktu Tindak Lanjut</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={timeBucketPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, pct }: { name: string; pct: number }) => `${name}: ${pct ?? ""}%`}>
                      {timeBucketPie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [`${v} incident`, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {data.timeBuckets.map((b, i) => (
                    <div key={b.key} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        {b.label}
                      </span>
                      <span className="font-bold text-gray-700">{b.count} ({b.pct}%)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* By category table */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Rekapitulasi per Kategori</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Kategori</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-600">Total</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-600">Open</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-600">Proses</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-600">Selesai</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-600">% Selesai</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCategory.map((c, i) => (
                    <tr key={c.categoryId} className={`border-b ${i % 2 === 0 ? "bg-gray-50" : ""}`}>
                      <td className="py-2 px-3 font-medium">{c.categoryName}</td>
                      <td className="py-2 px-3 text-center font-bold">{c.total}</td>
                      <td className="py-2 px-3 text-center text-red-600">{c.open}</td>
                      <td className="py-2 px-3 text-center text-amber-600">{c.inProgress}</td>
                      <td className="py-2 px-3 text-center text-green-600">{c.closed}</td>
                      <td className="py-2 px-3 text-center">
                        {c.total > 0 ? Math.round((c.closed / c.total) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                  {data.byCategory.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-4 text-gray-400">Tidak ada data</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Incident list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Daftar Incident ({data.incidents.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">#</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Tgl Kejadian</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Kategori</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Plant</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Pelapor</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Group PIC</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Tindakan</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.incidents.map((inc, i) => (
                      <tr key={inc.id} className={`border-b ${i % 2 === 0 ? "bg-gray-50" : ""}`}>
                        <td className="py-2 px-3 text-gray-400 font-mono">#{inc.id}</td>
                        <td className="py-2 px-3">{inc.incidentDate}</td>
                        <td className="py-2 px-3">{inc.categoryName}</td>
                        <td className="py-2 px-3">{inc.plantName}</td>
                        <td className="py-2 px-3">{inc.reporterName}</td>
                        <td className="py-2 px-3">{inc.assignedGroupName ?? "—"}</td>
                        <td className="py-2 px-3">{inc.actionName ?? "—"}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[inc.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {STATUS_LABELS[inc.status] ?? inc.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {data.incidents.length === 0 && (
                      <tr><td colSpan={8} className="text-center py-4 text-gray-400">Tidak ada incident dalam periode ini</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
