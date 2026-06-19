import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  FileText, Building2, ClipboardList, CheckCircle2, XCircle, ShieldCheck,
  AlertCircle, Target, TrendingUp, ChevronRight, ChevronDown, User, Loader2,
  FileSpreadsheet, Calendar,
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

// ── Types ──────────────────────────────────────────────────────────────────────
interface TemplateListRow {
  id: number; name: string; description: string | null;
  isActive: boolean; createdAt: string;
  questionCount: number; scheduleCount: number; inspectionCount: number;
}
interface TemplateListResponse {
  rows: TemplateListRow[];
  summary: { total: number; active: number; inactive: number; totalInspections: number; totalSchedules: number; totalQuestions: number };
}

interface DeptDetailRow {
  departmentId: number | null; departmentName: string;
  expected: number; actual: number;
  achievement: number | null; status: "compliant" | "partial" | "none" | "no_target";
}
interface TemplateDetailResponse {
  template: { id: number; name: string; description: string | null; isActive: boolean };
  period: { from: string; to: string };
  scheduleCount: number;
  rows: DeptDetailRow[];
  summary: {
    totalDepts: number; totalExpected: number; totalActual: number;
    compliant: number; partial: number; none: number; avgAchievement: number | null;
  };
}

interface DeptUserRow {
  userId: number; userName: string; userNik: string;
  departmentId: number | null; departmentName: string;
  inspectionCount: number; lastInspectedAt: string;
}
interface DeptUserResponse {
  users: DeptUserRow[];
  totalInspections: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_META = {
  compliant:  { label: "Sesuai",    icon: CheckCircle2, cls: "text-green-600 bg-green-50 border-green-200" },
  partial:    { label: "Sebagian",  icon: AlertCircle,  cls: "text-amber-600 bg-amber-50 border-amber-200" },
  none:       { label: "Nihil",     icon: XCircle,      cls: "text-red-600 bg-red-50 border-red-200" },
  no_target:  { label: "—",         icon: Target,       cls: "text-slate-400 bg-slate-50 border-slate-200" },
};

function AchievementBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-slate-400">—</span>;
  const w = Math.min(100, pct);
  const color = pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 min-w-[130px]">
      <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-sm font-bold tabular-nums w-12 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

// ── Template List View (initial screen) ────────────────────────────────────────
function TemplateListView({ onSelect }: { onSelect: (id: number) => void }) {
  const { data, isLoading } = useQuery<TemplateListResponse>({
    queryKey: ["report-templates-overview"],
    queryFn: () => api.get(`/reports/templates?from=2020-01-01&to=${new Date().toISOString().slice(0, 10)}`),
    staleTime: 60_000,
  });

  const rows = data?.rows ?? [];
  const maxInsp = Math.max(1, ...rows.map(r => r.inspectionCount));

  return (
    <div className="space-y-4">
      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-5 text-center">
            <FileText className="w-5 h-5 mx-auto mb-1 text-slate-500" />
            <div className="text-3xl font-black text-slate-800">{data.summary.total}</div>
            <div className="text-xs text-slate-500 mt-0.5">Total Template</div>
          </CardContent></Card>
          <Card><CardContent className="pt-5 text-center">
            <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <div className="text-3xl font-black text-green-700">{data.summary.active}</div>
            <div className="text-xs text-slate-500 mt-0.5">Aktif</div>
          </CardContent></Card>
          <Card><CardContent className="pt-5 text-center">
            <ClipboardList className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <div className="text-3xl font-black text-blue-700">{data.summary.totalSchedules}</div>
            <div className="text-xs text-slate-500 mt-0.5">Total Jadwal</div>
          </CardContent></Card>
          <Card><CardContent className="pt-5 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
            <div className="text-3xl font-black text-indigo-700">{data.summary.totalInspections}</div>
            <div className="text-xs text-slate-500 mt-0.5">Total Inspeksi (YTD)</div>
          </CardContent></Card>
        </div>
      )}

      {/* Template list */}
      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-12">Memuat daftar template...</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Template</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-indigo-600">Pertanyaan</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-purple-600">Jadwal</th>
                  <th className="px-4 py-3 text-xs font-semibold text-blue-600">Inspeksi (YTD)</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer hover:bg-blue-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                    onClick={() => onSelect(row.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{row.name}</div>
                      {row.description && <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{row.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${row.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                        {row.isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {row.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-indigo-700">{row.questionCount}</td>
                    <td className="px-4 py-3 text-center font-semibold text-purple-700">{row.scheduleCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${(row.inspectionCount / maxInsp) * 100}%` }} />
                        </div>
                        <span className={`font-bold tabular-nums ${row.inspectionCount > 0 ? "text-blue-700" : "text-slate-300"}`}>{row.inspectionCount}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-slate-400">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">Belum ada template.</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Expandable dept row with user list ────────────────────────────────────────
function DeptExpandRow({
  row, templateId, applied, index,
}: {
  row: DeptDetailRow; templateId: number; applied: { from: string; to: string }; index: number;
}) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[row.status];
  const Icon = meta.icon;
  const deptKey = row.departmentId === null ? "null" : String(row.departmentId);

  const { data: usersData, isLoading: usersLoading } = useQuery<DeptUserResponse>({
    queryKey: ["template-dept-users", templateId, deptKey, applied.from, applied.to],
    queryFn: () => api.get(
      `/reports/template-dept-users?templateId=${templateId}&departmentId=${deptKey}&from=${applied.from}&to=${applied.to}`
    ),
    enabled: open,
    staleTime: 60_000,
  });

  const fmtDate = (s: string) => s
    ? new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  const rowBg = index % 2 === 0 ? "bg-white" : "bg-slate-50/50";
  const hasActual = row.actual > 0;

  return (
    <>
      <tr
        className={`${rowBg} cursor-pointer hover:bg-blue-50/60 transition-colors group`}
        onClick={() => setOpen(v => !v)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors`}>
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
            <span className="font-medium text-slate-800">{row.departmentName}</span>
            {hasActual && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <User className="w-3 h-3" /> klik untuk detail
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-center font-semibold text-indigo-700">{row.expected}</td>
        <td className="px-4 py-3 text-center font-bold text-blue-700">{row.actual}</td>
        <td className="px-4 py-3"><AchievementBar pct={row.achievement} /></td>
        <td className="px-4 py-3 text-center">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium ${meta.cls}`}>
            <Icon className="w-3 h-3" />{meta.label}
          </span>
        </td>
      </tr>

      {open && (
        <tr className={rowBg}>
          <td colSpan={5} className="px-0 py-0">
            <div className="mx-4 mb-3 rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
              {usersLoading ? (
                <div className="flex items-center justify-center gap-2 py-5 text-sm text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Memuat data user...
                </div>
              ) : !usersData || usersData.users.length === 0 ? (
                <div className="py-5 text-center text-sm text-slate-400">
                  Tidak ada inspeksi yang tercatat di departemen ini pada periode ini.
                </div>
              ) : (
                <>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-semibold text-slate-600">
                      {usersData.users.length} user · {usersData.totalInspections} total inspeksi
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50/50">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Nama</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">NIK</th>
                        <th className="text-center px-4 py-2 text-xs font-semibold text-blue-500">Inspeksi</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Terakhir Submit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {usersData.users.map((u, ui) => (
                        <tr key={u.userId} className={ui % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                          <td className="px-4 py-2.5 font-medium text-slate-800">{u.userName}</td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{u.userNik}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-6 bg-blue-100 text-blue-700 font-bold text-sm rounded-md">
                              {u.inspectionCount}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-slate-500">{fmtDate(u.lastInspectedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Template Detail View (after selecting a template) ─────────────────────────
function TemplateDetailView({ templateId, onBack }: { templateId: number; onBack: () => void }) {
  const nowD = new Date();
  const [mode, setMode] = useState<PeriodMode>("monthly");
  const [month, setMonth] = useState(nowD.getMonth() + 1);
  const [year, setYear]   = useState(nowD.getFullYear());
  const [applied, setApplied] = useState(() => getPeriod("monthly", nowD.getMonth() + 1, nowD.getFullYear()));

  const { data, isLoading } = useQuery<TemplateDetailResponse>({
    queryKey: ["report-template-detail", templateId, applied.from, applied.to],
    queryFn: () => api.get(`/reports/template-detail?templateId=${templateId}&from=${applied.from}&to=${applied.to}`),
    enabled: !!templateId,
  });

  const exportExcel = () => {
    if (!data) return;
    const header = ["Departemen", "Ekspektasi", "Realisasi", "Pencapaian (%)", "Status"];
    const rows = (data.rows ?? []).map(r => [
      r.departmentName,
      r.expected,
      r.actual,
      r.achievement != null ? r.achievement.toFixed(1) + "%" : "—",
      r.status === "compliant" ? "Sesuai" : r.status === "partial" ? "Sebagian" : r.status === "none" ? "Nihil" : "—",
    ]);
    const sum = data.summary;
    const footer = [
      "TOTAL",
      sum?.totalExpected ?? "",
      sum?.totalActual ?? "",
      sum?.avgAchievement != null ? sum.avgAchievement.toFixed(1) + "%" : "—",
      `${sum?.compliant ?? 0}/${sum?.totalDepts ?? 0} sesuai`,
    ];
    const metaRows = [
      [`Template: ${data.template.name}`],
      [`Periode: ${applied.label}`],
      [`Jadwal aktif: ${data.scheduleCount}`],
      [],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...metaRows, header, ...rows, footer]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template per Dept");
    XLSX.writeFile(wb, `laporan-template-${templateId}-${applied.label.replace(/ /g, "-")}.xlsx`);
  };

  const chartData = (data?.rows ?? []).map(r => ({
    name: r.departmentName.length > 14 ? r.departmentName.slice(0, 12) + "…" : r.departmentName,
    fullName: r.departmentName,
    "Realisasi": r.actual,
    "Ekspektasi": r.expected,
  }));

  const sum = data?.summary;

  return (
    <div className="space-y-5">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>← Kembali</Button>
        {data && (
          <div>
            <span className="font-bold text-slate-800 text-base">{data.template.name}</span>
            {!data.template.isActive && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Nonaktif</span>
            )}
            {data.template.description && (
              <span className="ml-2 text-sm text-slate-500">{data.template.description}</span>
            )}
          </div>
        )}
      </div>

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
            <div className="ml-auto">
              <Button variant="outline" onClick={exportExcel} disabled={!data || (data.rows ?? []).length === 0}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
              </Button>
            </div>
          </div>
          {data && (
            <p className="mt-3 text-xs text-muted-foreground">
              Periode: <strong>{applied.label}</strong> ·
              Jadwal aktif: <strong>{data.scheduleCount}</strong> jadwal
            </p>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-12">Memuat detail...</div>
      ) : data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card><CardContent className="pt-5 text-center">
              <Building2 className="w-5 h-5 mx-auto mb-1 text-slate-500" />
              <div className="text-3xl font-black text-slate-800">{sum?.totalDepts ?? 0}</div>
              <div className="text-xs text-slate-500 mt-0.5">Departemen</div>
            </CardContent></Card>
            <Card><CardContent className="pt-5 text-center">
              <ClipboardList className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
              <div className="text-3xl font-black text-indigo-700">{sum?.totalExpected ?? 0}</div>
              <div className="text-xs text-slate-500 mt-0.5">Total Ekspektasi</div>
            </CardContent></Card>
            <Card><CardContent className="pt-5 text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <div className="text-3xl font-black text-blue-700">{sum?.totalActual ?? 0}</div>
              <div className="text-xs text-slate-500 mt-0.5">Total Realisasi</div>
            </CardContent></Card>
            <Card><CardContent className="pt-5 text-center">
              <ShieldCheck className="w-5 h-5 mx-auto mb-1 text-green-500" />
              <div className="text-3xl font-black text-green-700">{sum?.compliant ?? 0}</div>
              <div className="text-xs text-slate-500 mt-0.5">Sesuai</div>
            </CardContent></Card>
            <Card><CardContent className="pt-5 text-center">
              <AlertCircle className="w-5 h-5 mx-auto mb-1 text-amber-500" />
              <div className="text-3xl font-black text-amber-700">{sum?.partial ?? 0}</div>
              <div className="text-xs text-slate-500 mt-0.5">Sebagian</div>
            </CardContent></Card>
            <Card><CardContent className="pt-5 text-center">
              <Target className="w-5 h-5 mx-auto mb-1 text-slate-500" />
              <div className="text-3xl font-black text-slate-700">
                {sum?.avgAchievement != null ? `${sum.avgAchievement.toFixed(0)}%` : "—"}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Rata-rata</div>
            </CardContent></Card>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="text-sm font-semibold mb-4 text-slate-700">Realisasi vs Ekspektasi per Departemen</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.fullName ?? ""} />
                    <Legend verticalAlign="top" />
                    <Bar dataKey="Ekspektasi" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Realisasi"  fill="#3b82f6" radius={[3, 3, 0, 0]} />
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
                      <th className="text-center px-4 py-3 text-xs font-semibold text-indigo-600">Ekspektasi</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-blue-600">Realisasi</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Pencapaian</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rows.map((row, i) => (
                      <DeptExpandRow
                        key={String(row.departmentId ?? "null")}
                        row={row}
                        templateId={templateId}
                        applied={applied}
                        index={i}
                      />
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                    <tr>
                      <td className="px-4 py-3 text-slate-700">TOTAL</td>
                      <td className="px-4 py-3 text-center text-indigo-700">{sum?.totalExpected ?? 0}</td>
                      <td className="px-4 py-3 text-center text-blue-700">{sum?.totalActual ?? 0}</td>
                      <td className="px-4 py-3">
                        {sum?.avgAchievement != null && <AchievementBar pct={sum.avgAchievement} />}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 text-xs">
                        {`${sum?.compliant ?? 0}/${sum?.totalDepts ?? 0} sesuai`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {data.rows.length === 0 && (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  Tidak ada data departemen untuk template ini di periode ini.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TemplateReportPage() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Laporan Template"
        subtitle={selectedTemplateId
          ? "Detail pencapaian inspeksi per departemen untuk template ini"
          : "Pilih template untuk melihat rincian pencapaian per departemen"
        }
      />

      {selectedTemplateId === null ? (
        <TemplateListView onSelect={setSelectedTemplateId} />
      ) : (
        <TemplateDetailView
          templateId={selectedTemplateId}
          onBack={() => setSelectedTemplateId(null)}
        />
      )}
    </div>
  );
}
