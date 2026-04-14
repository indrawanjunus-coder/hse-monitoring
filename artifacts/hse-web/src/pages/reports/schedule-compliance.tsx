import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, AlertCircle, Printer, Users, User, Calendar, TrendingUp, FileSpreadsheet, ChevronLeft, ChevronRight, BarChart2 } from "lucide-react";

interface AssignedMember { type: "user" | "group"; name: string; nik?: string }
interface ScheduleCompliance {
  scheduleId: number;
  title: string;
  frequency: string;
  frequencyLabel: string;
  plantName: string;
  templateName: string;
  createdAt: string;
  isActive: boolean;
  assignedTo: AssignedMember[];
  expectedCount: number;
  actualCount: number;
  complianceRate: number;
  reporterRate: number;
  uniqueReporterCount: number;
  assignedUserCount: number;
  lastInspectedAt: string | null;
  status: "compliant" | "partial" | "none";
}
interface ComplianceReport {
  rows: ScheduleCompliance[];
  summary: { total: number; compliant: number; partial: number; none: number; avgRate: number };
}

type ChartGroupBy = "template" | "plant" | "frequency";

function buildChartData(rows: ScheduleCompliance[], groupBy: ChartGroupBy) {
  const groups: Record<string, { complianceRates: number[]; reporterRates: number[] }> = {};
  for (const r of rows) {
    const key = groupBy === "template" ? r.templateName
      : groupBy === "plant" ? r.plantName
      : r.frequencyLabel;
    if (!groups[key]) groups[key] = { complianceRates: [], reporterRates: [] };
    groups[key].complianceRates.push(r.complianceRate);
    groups[key].reporterRates.push(r.reporterRate ?? 0);
  }
  return Object.entries(groups)
    .map(([name, { complianceRates, reporterRates }]) => ({
      name: name.length > 22 ? name.slice(0, 20) + "…" : name,
      fullName: name,
      laporan: parseFloat((complianceRates.reduce((a, b) => a + b, 0) / complianceRates.length).toFixed(1)),
      pelapor: parseFloat((reporterRates.reduce((a, b) => a + b, 0) / reporterRates.length).toFixed(1)),
      count: complianceRates.length,
    }))
    .sort((a, b) => b.laporan - a.laporan);
}

const FREQ_COLORS: Record<string, string> = {
  daily: "bg-blue-100 text-blue-700",
  weekly: "bg-indigo-100 text-indigo-700",
  biweekly: "bg-violet-100 text-violet-700",
  monthly: "bg-purple-100 text-purple-700",
  custom: "bg-pink-100 text-pink-700",
};
const STATUS_META = {
  compliant: { label: "Sesuai", icon: CheckCircle2, cls: "text-green-600 bg-green-50 border-green-200" },
  partial: { label: "Sebagian", icon: AlertCircle, cls: "text-amber-600 bg-amber-50 border-amber-200" },
  none: { label: "Tidak Ada", icon: XCircle, cls: "text-red-600 bg-red-50 border-red-200" },
};
const MONTHS = [
  { v: "all", l: "Semua Bulan (Per Tahun)" },
  { v: "01", l: "Januari" }, { v: "02", l: "Februari" }, { v: "03", l: "Maret" },
  { v: "04", l: "April" }, { v: "05", l: "Mei" }, { v: "06", l: "Juni" },
  { v: "07", l: "Juli" }, { v: "08", l: "Agustus" }, { v: "09", l: "September" },
  { v: "10", l: "Oktober" }, { v: "11", l: "November" }, { v: "12", l: "Desember" },
];

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return d.toISOString().slice(0, 10);
}

async function exportToExcel(rows: ScheduleCompliance[], label: string) {
  const XLSX = await import("xlsx");

  const compliant = rows.filter(r => r.status === "compliant").length;
  const partial = rows.filter(r => r.status === "partial").length;
  const none = rows.filter(r => r.status === "none").length;
  const avgRate = rows.length > 0 ? rows.reduce((s, r) => s + r.complianceRate, 0) / rows.length : 0;

  // Sheet 1: Ringkasan
  const summaryData: (string | number)[][] = [
    ["Laporan Kepatuhan Jadwal Inspeksi", ""],
    ["Periode", label],
    ["Dicetak", new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })],
    ["", ""],
    ["RINGKASAN", ""],
    ["Total Jadwal", rows.length],
    ["Sesuai Target", compliant],
    ["Sebagian", partial],
    ["Tidak Ada / Belum", none],
    ["Rata-rata Kepatuhan (%)", parseFloat(avgRate.toFixed(1))],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 28 }, { wch: 30 }];

  // Sheet 2: Data detail
  const headers = [
    "No", "Jadwal Inspeksi", "Template", "Frekuensi", "Plant",
    "PIC / Group", "Dibuat Tgl", "Seharusnya (kali)", "Terlaksana (kali)",
    "Kepatuhan (%)", "Terakhir Dikerjakan", "Status",
  ];
  const dataRows = rows.map((r, i) => [
    i + 1,
    r.title,
    r.templateName,
    r.frequencyLabel,
    r.plantName,
    r.assignedTo.map(a => `${a.name}${a.nik ? ` (${a.nik})` : ""}`).join("; "),
    new Date(r.createdAt).toLocaleDateString("id-ID"),
    r.expectedCount,
    r.actualCount,
    parseFloat(r.complianceRate.toFixed(1)),
    r.lastInspectedAt ? new Date(r.lastInspectedAt).toLocaleDateString("id-ID") : "Belum pernah",
    STATUS_META[r.status].label,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  ws["!cols"] = [
    { wch: 5 }, { wch: 38 }, { wch: 30 }, { wch: 13 }, { wch: 22 },
    { wch: 35 }, { wch: 14 }, { wch: 17 }, { wch: 16 }, { wch: 14 },
    { wch: 22 }, { wch: 13 },
  ];
  // Freeze header row
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");
  XLSX.utils.book_append_sheet(wb, ws, "Data Kepatuhan");

  XLSX.writeFile(wb, `kepatuhan-jadwal-${label}.xlsx`);
}

export default function ScheduleCompliancePage() {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = String(now.getMonth() + 1).padStart(2, "0");

  const [selMonth, setSelMonth] = useState(curMonth);
  const [selYear, setSelYear] = useState(String(curYear));
  const [appliedTo, setAppliedTo] = useState(() => lastDayOfMonth(curYear, now.getMonth() + 1));
  const [appliedLabel, setAppliedLabel] = useState(() => `${MONTHS.find(m => m.v === curMonth)?.l}-${curYear}`);

  const [filterStatus, setFilterStatus] = useState<"all" | "compliant" | "partial" | "none">("all");
  const [filterFreq, setFilterFreq] = useState("all");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [chartGroupBy, setChartGroupBy] = useState<ChartGroupBy>("template");

  const years = Array.from({ length: 5 }, (_, i) => String(curYear - i));

  const { data, isLoading } = useQuery<ComplianceReport>({
    queryKey: ["reports", "schedule-compliance", appliedTo],
    queryFn: () => api.get(`/reports/schedule-compliance?to=${appliedTo}`),
  });

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    return data.rows.filter(r => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterFreq !== "all" && r.frequency !== filterFreq) return false;
      if (q) {
        const inTitle = r.title.toLowerCase().includes(q);
        const inPlant = r.plantName.toLowerCase().includes(q);
        const inPic = r.assignedTo.some(a => a.name.toLowerCase().includes(q) || (a.nik ?? "").toLowerCase().includes(q));
        if (!inTitle && !inPlant && !inPic) return false;
      }
      return true;
    });
  }, [data, filterStatus, filterFreq, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const chartData = useMemo(() => buildChartData(filteredRows, chartGroupBy), [filteredRows, chartGroupBy]);

  const handleApply = () => {
    const yr = parseInt(selYear);
    let to: string;
    let label: string;
    if (selMonth === "all") {
      to = `${yr}-12-31`;
      label = `Tahun-${selYear}`;
    } else {
      const mo = parseInt(selMonth);
      to = lastDayOfMonth(yr, mo);
      label = `${MONTHS.find(m => m.v === selMonth)?.l}-${selYear}`;
    }
    setAppliedTo(to);
    setAppliedLabel(label);
    setPage(1);
  };

  const handleExport = () => exportToExcel(filteredRows, appliedLabel);

  const s = data?.summary;

  return (
    <div className="p-6 print:p-4">
      <PageHeader
        title="Laporan Kepatuhan Jadwal Inspeksi"
        subtitle="Rekap pelaksanaan vs target inspeksi per jadwal, dihitung dari tanggal jadwal dibuat"
        action={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={handleExport} disabled={!data || filteredRows.length === 0}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Cetak
            </Button>
          </div>
        }
      />

      {/* Filter */}
      <div className="bg-white border rounded-lg p-3 mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">Bulan</p>
          <Select value={selMonth} onValueChange={v => { setSelMonth(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">Tahun</p>
          <Select value={selYear} onValueChange={v => { setSelYear(v); setPage(1); }}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleApply} size="sm">Tampilkan</Button>

        <div className="w-px h-8 bg-gray-200 mx-1" />

        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">Status</p>
          <Select value={filterStatus} onValueChange={v => { setFilterStatus(v as typeof filterStatus); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="compliant">Sesuai</SelectItem>
              <SelectItem value="partial">Sebagian</SelectItem>
              <SelectItem value="none">Tidak Ada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">Frekuensi</p>
          <Select value={filterFreq} onValueChange={v => { setFilterFreq(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="daily">Harian</SelectItem>
              <SelectItem value="weekly">Mingguan</SelectItem>
              <SelectItem value="biweekly">2 Mingguan</SelectItem>
              <SelectItem value="monthly">Bulanan</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[180px]">
          <p className="text-xs font-medium text-gray-500">Cari Jadwal / Plant / Nama PIC / Group</p>
          <Input
            placeholder="Ketik nama jadwal, plant, PIC, atau group..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Summary Cards */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">{s.total}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Jadwal</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{s.compliant}</p>
              <p className="text-xs text-green-600 mt-0.5">Sesuai Target</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{s.partial}</p>
              <p className="text-xs text-amber-600 mt-0.5">Sebagian</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{s.none}</p>
              <p className="text-xs text-red-600 mt-0.5">Tidak Ada</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4 text-center flex items-center justify-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-700">{s.avgRate.toFixed(0)}%</p>
                <p className="text-xs text-blue-600 mt-0.5">Rata-rata</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bar Chart: % Pelapor vs % Laporan Masuk */}
      {filteredRows.length > 0 && (
        <div className="bg-white border rounded-lg p-4 mb-4 print:break-inside-avoid">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Grafik % Pelapor vs % Laporan Masuk</h2>
              <span className="text-xs text-gray-400">— rata-rata per kelompok</span>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <span className="text-xs text-gray-500">Kelompokkan per:</span>
              <div className="flex rounded-lg border overflow-hidden text-xs font-medium">
                {(["template", "plant", "frequency"] as ChartGroupBy[]).map(v => (
                  <button
                    key={v}
                    onClick={() => setChartGroupBy(v)}
                    className={`px-3 py-1.5 transition-colors ${chartGroupBy === v ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                  >
                    {v === "template" ? "Template" : v === "plant" ? "Plant" : "Frekuensi"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Tidak ada data untuk ditampilkan</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={chartData.length > 6 ? 360 : 260}>
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 24, left: 0, bottom: chartData.length > 4 ? 60 : 20 }}
                  barCategoryGap="25%"
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickLine={false}
                    axisLine={false}
                    angle={chartData.length > 4 ? -30 : 0}
                    textAnchor={chartData.length > 4 ? "end" : "middle"}
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={v => `${v}%`}
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickLine={false}
                    axisLine={false}
                    width={42}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)}%`,
                      name === "laporan" ? "% Laporan Masuk" : "% Pelapor",
                    ]}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload;
                      return `${item?.fullName ?? label} (${item?.count ?? ""} jadwal)`;
                    }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                  <Legend
                    formatter={name => name === "laporan" ? "% Laporan Masuk" : "% Pelapor"}
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  />
                  <Bar dataKey="laporan" name="laporan" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.laporan >= 80 ? "#22c55e" : entry.laporan >= 50 ? "#f59e0b" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                  <Bar dataKey="pelapor" name="pelapor" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>

              {/* Legend description */}
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500 justify-center">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />
                  <span>% Laporan Masuk ≥ 80% (Sesuai)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
                  <span>% Laporan Masuk 50–79% (Sebagian)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
                  <span>% Laporan Masuk &lt;50% (Kurang)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-violet-500 inline-block" />
                  <span>% Pelapor (unik)</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Memuat data...</div>
      ) : filteredRows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Tidak ada data jadwal yang ditemukan</div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 w-8">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 min-w-[200px]">Jadwal Inspeksi</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Frekuensi</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 min-w-[140px]">PIC / Group</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Plant</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Seharusnya</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Terlaksana</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700 min-w-[110px]">Kepatuhan</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Terakhir Dikerjakan</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedRows.map((r, idx) => {
                  const sm = STATUS_META[r.status];
                  const StatusIcon = sm.icon;
                  const barPct = Math.min(100, r.complianceRate);
                  const rowNum = (safePage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={r.scheduleId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-400">{rowNum}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{r.title}</p>
                        <p className="text-xs text-gray-400">{r.templateName}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-0.5">
                          <Calendar className="w-3 h-3" />
                          Dibuat {new Date(r.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                        {!r.isActive && <span className="text-xs text-gray-400 italic">(nonaktif)</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${FREQ_COLORS[r.frequency] ?? "bg-gray-100 text-gray-600"}`}>
                          {r.frequencyLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {r.assignedTo.length === 0 && <span className="text-xs text-gray-400 italic">Tidak ada</span>}
                          {r.assignedTo.map((a, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs text-gray-700">
                              {a.type === "group"
                                ? <Users className="w-3 h-3 text-blue-500 shrink-0" />
                                : <User className="w-3 h-3 text-gray-400 shrink-0" />}
                              <span>{a.name}{a.nik ? ` (${a.nik})` : ""}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{r.plantName}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-gray-800 text-base">{r.expectedCount}</span>
                        <p className="text-xs text-gray-400">kali</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-base ${r.actualCount === 0 ? "text-red-600" : r.actualCount >= r.expectedCount ? "text-green-600" : "text-amber-600"}`}>
                          {r.actualCount}
                        </span>
                        <p className="text-xs text-gray-400">kali</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`font-bold text-base ${barPct >= 100 ? "text-green-600" : barPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                            {r.complianceRate.toFixed(0)}%
                          </span>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${barPct >= 100 ? "bg-green-500" : barPct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {r.lastInspectedAt
                          ? new Date(r.lastInspectedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
                          : <span className="italic text-red-400">Belum pernah</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${sm.cls}`}>
                          <StatusIcon className="w-3 h-3" />
                          {sm.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer: pagination + page size */}
          <div className="border-t px-4 py-3 bg-gray-50 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Tampilkan</span>
              <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <span>baris per halaman · {filteredRows.length} total · Periode: {appliedLabel}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .reduce<(number | "...")[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-400">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant={safePage === p ? "default" : "outline"}
                      size="sm"
                      className="h-7 w-7 p-0 text-xs"
                      onClick={() => setPage(p as number)}
                    >
                      {p}
                    </Button>
                  )
                )}
              <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Print footer (no pagination) */}
          <div className="border-t px-4 py-2 bg-gray-50 text-xs text-gray-500 hidden print:block">
            {filteredRows.length} jadwal · Periode: {appliedLabel} · Dicetak {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
          </div>
        </div>
      )}
    </div>
  );
}
