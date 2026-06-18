import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import {
  AlertTriangle, TrendingUp, ChevronLeft, ChevronRight,
  ClipboardList, ClipboardCheck, FileBarChart, Link as LinkIcon,
} from "lucide-react";
import { Link } from "wouter";

// ---- Types ----
interface DashboardSummary {
  totalIncidents: number;
  openIncidents: number;
  closedIncidents: number;
  dailyStatus: { date: string; open: number; closed: number }[];
}

interface YtdSummary {
  year: number;
  months: { month: number; open: number; closed: number; total: number }[];
  totalOpen: number;
  totalClosed: number;
  totalIncidents: number;
  totalAllTime: number;
}

interface TemplateSummary {
  totalReports: number;
  targetReports: number;
  targetYearly: number;
  templateName: string | null;
}

interface TemplateItem { id: number; name: string; }

interface LaggingData {
  fatality: number; lti: number; mti: number;
  firstAid: number; nearMisses: number; hazardId: number;
  nonLtiDays: number; safeHours: number;
  walkTalkTemplateId: number | null;
  hazardTemplateId: number | null;
  monthlyHazardAllowance: number;
}

interface IncidentBreakdown {
  year: number;
  month: number;
  total: number;
  byCategory: { name: string; value: number }[];
  byPlant:    { name: string; value: number }[];
}

interface HeatmapCell { count: number; incidentIds: number[] }
interface RiskHeatmap {
  year: number; month: number; total: number; plotted: number;
  missingType: number;
  missingProbability: number;
  missingImpact: number;
  probLabels: string[];
  impactLabels: string[];
  matrix: HeatmapCell[][];
}

const PROB_LABELS: Record<string, string> = {
  rare:          "Rare",
  unlikely:      "Unlikely",
  possible:      "Possible",
  likely:        "Likely",
  almost_certain:"Almost Certain",
};
const IMPACT_LABELS: Record<string, string> = {
  insignificant: "Insignificant",
  minor:         "Minor",
  moderate:      "Moderate",
  major:         "Major",
  catastrophic:  "Catastrophic",
};

// Standard AS/NZS 4360 Risk Matrix zone lookup
// rows = prob index 0..4 (Rare→Almost Certain), cols = impact index 0..4 (Insignificant→Catastrophic)
const RISK_ZONE: Array<Array<"low"|"medium"|"high"|"critical">> = [
  ["low",    "low",    "low",    "medium", "medium"],  // Rare
  ["low",    "low",    "medium", "medium", "high"  ],  // Unlikely
  ["low",    "medium", "medium", "high",   "high"  ],  // Possible
  ["medium", "medium", "high",   "high",   "critical"],// Likely
  ["medium", "high",   "high",   "critical","critical"],// Almost Certain
];

const ZONE_STYLE = {
  low:      { bg: "bg-green-100",  border: "border-green-300",  text: "text-green-800",  dot: "bg-green-400",  label: "Low"      },
  medium:   { bg: "bg-yellow-100", border: "border-yellow-300", text: "text-yellow-800", dot: "bg-yellow-400", label: "Medium"   },
  high:     { bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800", dot: "bg-orange-400", label: "High"     },
  critical: { bg: "bg-red-100",    border: "border-red-300",    text: "text-red-800",    dot: "bg-red-500",    label: "Critical" },
};

interface CellIncident {
  id: number;
  detail: string;
  incidentDate: string;
  incidentType: string | null;
  status: string;
  categoryName: string | null;
  plantName: string | null;
}

interface SelectedCell {
  prob: string;
  impact: string;
  zone: "low" | "medium" | "high" | "critical";
  incidentIds: number[];
}

const PIE_COLORS = [
  "#3b82f6","#ef4444","#f59e0b","#10b981","#8b5cf6",
  "#06b6d4","#f97316","#84cc16","#e879f9","#14b8a6",
];

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
const MONTHS_FULL  = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const CLOSING_STANDARD = 80;

// ---- Closing Rate Card ----
function ClosingRateCard({ title, subtitle, closed, total }: {
  title: string; subtitle: string; closed: number; total: number;
}) {
  const rate = total > 0 ? Math.round((closed / total) * 100) : 0;
  const aboveStd = rate >= CLOSING_STANDARD;
  const barColor  = aboveStd ? "bg-green-500"  : rate >= 50 ? "bg-yellow-500"  : "bg-red-500";
  const textColor = aboveStd ? "text-green-700" : rate >= 50 ? "text-yellow-700" : "text-red-700";
  const bgColor   = aboveStd ? "bg-green-50 border-green-200" : rate >= 50 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";

  return (
    <Card className={`border ${bgColor}`}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          </div>
          <TrendingUp className={`w-5 h-5 mt-0.5 ${textColor}`} />
        </div>
        <div className={`text-4xl font-bold ${textColor} mb-1`}>{rate}%</div>
        <div className="relative w-full bg-gray-100 rounded-full h-3 mt-2 mb-2">
          <div className={`${barColor} h-3 rounded-full transition-all`} style={{ width: `${Math.min(rate, 100)}%` }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-gray-500" style={{ left: `${CLOSING_STANDARD}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
          <span>{closed} selesai dari {total} temuan</span>
          <span className={`font-semibold ${aboveStd ? "text-green-700" : "text-red-600"}`}>
            Std {CLOSING_STANDARD}% {aboveStd ? "✓" : `(${rate - CLOSING_STANDARD}%)`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Template Total Card ----
function TemplateTotalCard({
  label, templateId, templateList, onChangeTemplate, data, isLoading, month, year,
}: {
  label: string;
  templateId: string;
  templateList: TemplateItem[];
  onChangeTemplate: (v: string) => void;
  data: TemplateSummary | undefined;
  isLoading: boolean;
  month: number; // 0 = yearly aggregate
  year: number;
}) {
  const isYearly = month === 0;
  const periodLabel = isYearly ? `${year}` : `${MONTHS_FULL[month - 1]} ${year}`;
  return (
    <Card className="border-violet-100 bg-violet-50/30">
      <CardContent className="pt-4 pb-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-violet-500 flex-shrink-0" />
            <p className="text-sm font-medium text-gray-700 leading-tight">{label}</p>
          </div>
        </div>
        <Select value={templateId} onValueChange={onChangeTemplate}>
          <SelectTrigger className="w-full mb-3 h-8 text-xs">
            <SelectValue placeholder="Pilih template..." />
          </SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto">
            {templateList.map(t => (
              <SelectItem key={t.id} value={String(t.id)} className="text-xs">{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isLoading ? (
          <div className="text-sm text-gray-400">Memuat...</div>
        ) : !templateId ? (
          <div className="text-sm text-gray-400 italic">Pilih template terlebih dahulu</div>
        ) : (
          <>
            <div className="text-4xl font-bold text-violet-700">{data?.totalReports ?? 0}</div>
            <p className="text-xs text-gray-500 mt-1">laporan diisi pada {periodLabel}</p>
            {isYearly
              ? (data?.targetYearly ?? 0) > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Target tahunan: <strong className="text-gray-600">{data!.targetYearly}</strong> laporan
                  </p>
                )
              : (data?.targetYearly ?? 0) > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Target tahunan: <strong className="text-gray-600">{data!.targetYearly}</strong> laporan
                  </p>
                )
            }
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Template vs Target Card ----
function TemplateVsTargetCard({
  label, templateId, templateList, onChangeTemplate, data, isLoading, month, year, icon: Icon, color,
}: {
  label: string;
  templateId: string;
  templateList: TemplateItem[];
  onChangeTemplate: (v: string) => void;
  data: TemplateSummary | undefined;
  isLoading: boolean;
  month: number;
  year: number;
  icon: React.ElementType;
  color: "violet" | "orange";
}) {
  const actual  = data?.totalReports  ?? 0;
  const target  = data?.targetReports ?? 0;
  const pct     = target > 0 ? Math.round((actual / target) * 100) : 0;
  const aboveStd = pct >= CLOSING_STANDARD;

  const colors = {
    violet: { bg: "bg-violet-50/30 border-violet-100", icon: "text-violet-500", bar: aboveStd ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500", text: aboveStd ? "text-green-700" : pct >= 50 ? "text-yellow-700" : "text-red-700" },
    orange: { bg: "bg-orange-50/30 border-orange-100", icon: "text-orange-500", bar: aboveStd ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500", text: aboveStd ? "text-green-700" : pct >= 50 ? "text-yellow-700" : "text-red-700" },
  }[color];

  return (
    <Card className={`border ${colors.bg}`}>
      <CardContent className="pt-4 pb-5">
        <div className="flex items-start gap-2 mb-3">
          <Icon className={`w-4 h-4 ${colors.icon} flex-shrink-0 mt-0.5`} />
          <p className="text-sm font-medium text-gray-700 leading-tight">{label}</p>
        </div>
        <Select value={templateId} onValueChange={onChangeTemplate}>
          <SelectTrigger className="w-full mb-3 h-8 text-xs">
            <SelectValue placeholder="Pilih template..." />
          </SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto">
            {templateList.map(t => (
              <SelectItem key={t.id} value={String(t.id)} className="text-xs">{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isLoading ? (
          <div className="text-sm text-gray-400">Memuat...</div>
        ) : !templateId ? (
          <div className="text-sm text-gray-400 italic">Pilih template terlebih dahulu</div>
        ) : target === 0 ? (
          <>
            <div className="text-3xl font-bold text-gray-700">{actual}</div>
            <p className="text-xs text-gray-400 mt-1">laporan (jadwal/target belum dikonfigurasi)</p>
          </>
        ) : (
          <>
            {/* Ratio */}
            <div className="flex items-baseline gap-1 mb-1">
              <span className={`text-3xl font-bold ${colors.text}`}>{actual}</span>
              <span className="text-gray-400 text-sm">/ {target}</span>
              <span className={`ml-auto text-lg font-bold ${colors.text}`}>{pct}%</span>
            </div>

            {/* Bar */}
            <div className="relative w-full bg-gray-100 rounded-full h-2.5 mb-2">
              <div className={`${colors.bar} h-2.5 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400" style={{ left: `${CLOSING_STANDARD}%` }} />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{month === 0 ? year : `${MONTHS_FULL[month - 1]} ${year}`}</span>
              <span className={`font-semibold ${aboveStd ? "text-green-700" : "text-red-600"}`}>
                Std {CLOSING_STANDARD}% {aboveStd ? "✓" : `(${pct - CLOSING_STANDARD}%)`}
              </span>
            </div>

            {/* Target breakdown */}
            <p className="text-xs text-gray-400 mt-1.5">
              {month === 0 ? "Target tahunan" : "Target bulanan"}: <strong className="text-gray-600">{target}</strong>
              {month !== 0 && (data?.targetYearly ?? 0) > 0 && (
                <span> · Target tahunan: <strong className="text-gray-600">{data!.targetYearly}</strong></span>
              )}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Main Page ----
export default function DashboardPage() {
  const now = new Date();
  const [mode, setMode]   = useState<"monthly" | "yearly">("monthly");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());

  // Template selectors
  const [walkTalkId, setWalkTalkId]   = useState("");
  const [hazardTplId, setHazardTplId] = useState("");

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const prevYear  = () => setYear(y => y - 1);
  const nextYear  = () => setYear(y => y + 1);

  // Effective month passed to template-summary: 0 = yearly aggregate
  const tplMonth = mode === "yearly" ? 0 : month;

  // Core data
  const { data, isLoading } = useQuery<DashboardSummary>({
    queryKey: ["dashboard", month, year],
    queryFn: () => api.get(`/dashboard/summary?month=${month}&year=${year}`),
    staleTime: 30_000,
  });

  const { data: ytd, isLoading: ytdLoading } = useQuery<YtdSummary>({
    queryKey: ["dashboard-ytd", year],
    queryFn: () => api.get(`/dashboard/ytd?year=${year}`),
    staleTime: 30_000,
  });

  // Template list
  const { data: templateList = [] } = useQuery<TemplateItem[]>({
    queryKey: ["dashboard-templates"],
    queryFn: () => api.get("/dashboard/templates"),
  });

  // Lagging indicator query — must be before the useEffect that references it
  const { data: lagging } = useQuery<LaggingData>({
    queryKey: ["lagging-indicators", year],
    queryFn: () => api.get(`/lagging-indicators?year=${year}`),
    staleTime: 30_000,
  });

  // Incident breakdown (by category + by plant) — always yearly for the pyramid section
  const { data: breakdown } = useQuery<IncidentBreakdown>({
    queryKey: ["dashboard-incident-breakdown", year],
    queryFn: () => api.get(`/dashboard/incident-breakdown?year=${year}&month=0`),
    staleTime: 30_000,
  });

  // Risk Heat Map — uses current month (or full year if mode=yearly)
  const heatmapMonth = mode === "yearly" ? 0 : month;
  const { data: heatmap } = useQuery<RiskHeatmap>({
    queryKey: ["dashboard-risk-heatmap", year, heatmapMonth],
    queryFn: () => api.get(`/dashboard/risk-heatmap?year=${year}&month=${heatmapMonth}`),
    staleTime: 30_000,
  });

  // Heatmap cell drill-down
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const { data: cellIncidents = [], isLoading: cellLoading } = useQuery<CellIncident[]>({
    queryKey: ["heatmap-cell-incidents", selectedCell?.incidentIds],
    queryFn: () => api.get(`/dashboard/incidents-detail?ids=${selectedCell!.incidentIds.join(",")}`),
    enabled: !!selectedCell && selectedCell.incidentIds.length > 0,
    staleTime: 60_000,
  });

  // Auto-select default templates: prefer saved settings, fall back to regex name-match
  useEffect(() => {
    if (templateList.length === 0) return;
    if (!walkTalkId) {
      const savedId = lagging?.walkTalkTemplateId;
      if (savedId && templateList.find(t => t.id === savedId)) {
        setWalkTalkId(String(savedId));
      } else {
        const wt = templateList.find(t => /walk.?talk/i.test(t.name)) ?? templateList.find(t => /walk/i.test(t.name));
        if (wt) setWalkTalkId(String(wt.id));
      }
    }
    if (!hazardTplId) {
      const savedId = lagging?.hazardTemplateId;
      if (savedId && templateList.find(t => t.id === savedId)) {
        setHazardTplId(String(savedId));
      } else {
        const ht = templateList.find(t => /IT\s*harian/i.test(t.name)) ?? templateList.find(t => /harian/i.test(t.name));
        if (ht) setHazardTplId(String(ht.id));
      }
    }
  }, [templateList, lagging]);

  // Template summary queries — tplMonth=0 triggers yearly aggregate in the API
  const { data: walkTalkData, isLoading: walkTalkLoading } = useQuery<TemplateSummary>({
    queryKey: ["dashboard-tpl-summary", walkTalkId, tplMonth, year],
    queryFn: () => api.get(`/dashboard/template-summary?templateId=${walkTalkId}&month=${tplMonth}&year=${year}`),
    enabled: !!walkTalkId,
    staleTime: 30_000,
  });

  const { data: hazardTplData, isLoading: hazardTplLoading } = useQuery<TemplateSummary>({
    queryKey: ["dashboard-tpl-summary", hazardTplId, tplMonth, year],
    queryFn: () => api.get(`/dashboard/template-summary?templateId=${hazardTplId}&month=${tplMonth}&year=${year}`),
    enabled: !!hazardTplId,
    staleTime: 30_000,
  });

  // Charts
  const mtdChartData = (data?.dailyStatus ?? [])
    .filter(d => d.open > 0 || d.closed > 0)
    .map(d => ({ day: d.date.split("-")[2], Open: d.open, Close: d.closed }));

  const ytdChartData = (ytd?.months ?? [])
    .filter(m => m.total > 0)
    .map(m => ({ bulan: MONTHS_SHORT[m.month - 1], Open: m.open, Close: m.closed }));

  const mtdTotal  = data?.totalIncidents ?? 0;
  const mtdClosed = data?.closedIncidents ?? 0;
  const ytdTotal  = ytd?.totalIncidents ?? 0;
  const ytdClosed = ytd?.totalClosed ?? 0;
  const totalAllTime = ytd?.totalAllTime ?? 0;

  // Resolve template names for dynamic card labels
  const walkTalkName = templateList.find(t => String(t.id) === walkTalkId)?.name ?? "Walk & Talk Report";
  const hazardTplName = templateList.find(t => String(t.id) === hazardTplId)?.name ?? "Hazard Identification Report";

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dashboard EHS"
        subtitle="Monitor kesehatan, keselamatan, dan lingkungan"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode toggle */}
            <div className="flex rounded-lg border bg-white overflow-hidden">
              <button
                onClick={() => setMode("monthly")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === "monthly" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Per Bulan
              </button>
              <button
                onClick={() => setMode("yearly")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l ${
                  mode === "yearly" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Tahunan
              </button>
            </div>

            {/* Period navigator */}
            {mode === "monthly" ? (
              <div className="flex items-center gap-1 bg-white border rounded-lg px-2 py-1">
                <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="font-medium text-sm min-w-36 text-center">{MONTHS_FULL[month - 1]} {year}</span>
                <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-white border rounded-lg px-2 py-1">
                <Button variant="ghost" size="sm" onClick={prevYear}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="font-medium text-sm min-w-16 text-center">{year}</span>
                <Button variant="ghost" size="sm" onClick={nextYear}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            )}
          </div>
        }
      />

      {/* ── Row 1: Charts ── */}
      {mode === "monthly" ? (
        /* Monthly: tampilkan MTD (harian) & YTD (bulanan) berdampingan */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                Jumlah Temuan Open vs Close
              </CardTitle>
              <p className="text-xs text-gray-400">MTD — {MONTHS_FULL[month - 1]} {year} (per hari)</p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-56 flex items-center justify-center text-gray-400 text-sm">Memuat...</div>
              ) : mtdChartData.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-gray-400">
                  <AlertTriangle className="w-8 h-8 mb-2 text-gray-300" />
                  <p className="text-sm">Tidak ada temuan pada bulan ini</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={mtdChartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="day"   tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis                 tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5e7eb" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Open"  fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="Close" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {!isLoading && mtdTotal > 0 && (
                <div className="flex gap-4 mt-2 pt-2 border-t text-sm">
                  <span className="text-gray-500">Total: <strong className="text-gray-800">{mtdTotal}</strong></span>
                  <span className="text-red-600">Open: <strong>{data?.openIncidents ?? 0}</strong></span>
                  <span className="text-green-600">Close: <strong>{mtdClosed}</strong></span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                Jumlah Temuan Open vs Close
              </CardTitle>
              <p className="text-xs text-gray-400">YTD — {year} (per bulan)</p>
            </CardHeader>
            <CardContent>
              {ytdLoading ? (
                <div className="h-56 flex items-center justify-center text-gray-400 text-sm">Memuat...</div>
              ) : ytdChartData.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-gray-400">
                  <AlertTriangle className="w-8 h-8 mb-2 text-gray-300" />
                  <p className="text-sm">Tidak ada temuan pada tahun ini</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ytdChartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="bulan" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis                 tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5e7eb" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Open"  fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="Close" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {!ytdLoading && ytdTotal > 0 && (
                <div className="flex gap-4 mt-2 pt-2 border-t text-sm">
                  <span className="text-gray-500">Total: <strong className="text-gray-800">{ytdTotal}</strong></span>
                  <span className="text-red-600">Open: <strong>{ytd?.totalOpen ?? 0}</strong></span>
                  <span className="text-green-600">Close: <strong>{ytdClosed}</strong></span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Yearly: tampilkan hanya YTD (per bulan) full-width */
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
              Jumlah Temuan Open vs Close — Semua Bulan
            </CardTitle>
            <p className="text-xs text-gray-400">YTD — {year} (per bulan)</p>
          </CardHeader>
          <CardContent>
            {ytdLoading ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Memuat...</div>
            ) : ytdChartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                <AlertTriangle className="w-8 h-8 mb-2 text-gray-300" />
                <p className="text-sm">Tidak ada temuan pada tahun {year}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ytdChartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="bulan" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis                 tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5e7eb" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Open"  fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  <Bar dataKey="Close" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {!ytdLoading && ytdTotal > 0 && (
              <div className="flex gap-4 mt-2 pt-2 border-t text-sm">
                <span className="text-gray-500">Total YTD: <strong className="text-gray-800">{ytdTotal}</strong></span>
                <span className="text-red-600">Open: <strong>{ytd?.totalOpen ?? 0}</strong></span>
                <span className="text-green-600">Close: <strong>{ytdClosed}</strong></span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Row 2: Hazard KPI Cards ── */}
      <div className={`grid grid-cols-1 gap-5 ${mode === "monthly" ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {/* Total Hazard Identification (from incidents table) */}
        <Card className="border-blue-100 bg-blue-50/40">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Hazard Identification Report</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {mode === "monthly" ? `Bulan berjalan · ${MONTHS_FULL[month - 1]} ${year}` : `Tahun ${year}`}
                </p>
              </div>
              <AlertTriangle className="w-5 h-5 mt-0.5 text-blue-500" />
            </div>
            <div className="text-4xl font-bold text-blue-700">{mode === "yearly" ? ytdTotal : mtdTotal}</div>
            <div className="mt-2 text-xs text-gray-500 flex gap-3">
              <span>YTD {year}: <strong className="text-gray-700">{ytdTotal}</strong></span>
              <span>All time: <strong className="text-gray-700">{totalAllTime}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Closing Rate MTD — hanya tampil di mode monthly */}
        {mode === "monthly" && (
          <ClosingRateCard
            title="% Closing Rate MTD"
            subtitle={`${MONTHS_FULL[month - 1]} ${year} · Standar ≥ ${CLOSING_STANDARD}%`}
            closed={mtdClosed}
            total={mtdTotal}
          />
        )}

        {/* Closing Rate YTD */}
        <ClosingRateCard
          title="% Closing Rate YTD"
          subtitle={mode === "monthly"
            ? `${year} s/d ${MONTHS_SHORT[month - 1]} · Standar ≥ ${CLOSING_STANDARD}%`
            : `${year} (semua bulan) · Standar ≥ ${CLOSING_STANDARD}%`
          }
          closed={ytdClosed}
          total={ytdTotal}
        />
      </div>

      {/* ── Row 3: Template Report Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card A: Total Walk & Talk Report */}
        <TemplateTotalCard
          label={`Total ${walkTalkName}`}
          templateId={walkTalkId}
          templateList={templateList}
          onChangeTemplate={setWalkTalkId}
          data={walkTalkData}
          isLoading={walkTalkLoading}
          month={tplMonth}
          year={year}
        />

        {/* Card B: Walk & Talk vs Target */}
        <TemplateVsTargetCard
          label={`${walkTalkName} vs ${mode === "yearly" ? "Target Tahunan" : "Target Bulanan"}`}
          templateId={walkTalkId}
          templateList={templateList}
          onChangeTemplate={setWalkTalkId}
          data={walkTalkData}
          isLoading={walkTalkLoading}
          month={tplMonth}
          year={year}
          icon={ClipboardCheck}
          color="violet"
        />

        {/* Card C: Hazard Ditemukan vs Batas Hazard */}
        {(() => {
          const isYearly = mode === "yearly";
          const monthlyAllowance = lagging?.monthlyHazardAllowance ?? 0;
          const allowance = monthlyAllowance > 0 ? (isYearly ? monthlyAllowance * 12 : monthlyAllowance) : 0;
          const found = isYearly ? ytdTotal : mtdTotal;
          const pct = allowance > 0 ? Math.round((found / allowance) * 100) : 0;
          const overLimit = allowance > 0 && found > allowance;
          const barColor = overLimit ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-green-500";
          const textColor = overLimit ? "text-red-700" : pct >= 80 ? "text-yellow-700" : "text-green-700";
          return (
            <Card className="border-orange-100 bg-orange-50/30">
              <CardContent className="pt-4 pb-5">
                <div className="flex items-start gap-2 mb-3">
                  <FileBarChart className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-gray-700 leading-tight">
                    Hazard Ditemukan vs Batas Hazard {isYearly ? "Tahunan" : "Bulanan"}
                  </p>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  {isYearly
                    ? `YTD · Tahun ${year}${monthlyAllowance > 0 ? ` · batas ${monthlyAllowance}/bln × 12` : ""}`
                    : `MTD · ${MONTHS_FULL[month - 1]} ${year}`}
                </p>
                {allowance === 0 ? (
                  <>
                    <div className="text-3xl font-bold text-orange-600">{found}</div>
                    <p className="text-xs text-gray-400 mt-1">
                      hazard ditemukan (batas {isYearly ? "tahunan" : "bulanan"} belum diset)
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className={`text-3xl font-bold ${textColor}`}>{found}</span>
                      <span className="text-gray-400 text-sm">/ {allowance}</span>
                      <span className={`ml-auto text-lg font-bold ${textColor}`}>{pct}%</span>
                    </div>
                    <div className="relative w-full bg-gray-100 rounded-full h-2.5 mb-2">
                      <div className={`${barColor} h-2.5 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <p className="text-xs text-gray-500">
                      {overLimit
                        ? <span className="text-red-600 font-semibold">Melewati batas! ({found - allowance} melebihi)</span>
                        : <span>{allowance - found} hazard tersisa dari batas {isYearly ? "tahunan" : "bulanan"}</span>
                      }
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* ── Row 4: Lagging Indicator Pyramid ── */}
      <div className="rounded-2xl border bg-white shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Lagging Indicator Pyramid</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Insiden keselamatan {year} · isi data di menu Lagging Indicator</p>
          </div>
          <Link href="/lagging-indicators">
            <button className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium">
              <LinkIcon className="w-3.5 h-3.5" /> Input Data
            </button>
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-center">
          {/* Pyramid */}
          <div className="flex-1 w-full max-w-lg mx-auto">
            {(() => {
              const rows = [
                { label: "Fatality",                              value: lagging?.fatality   ?? 0, bg: "bg-red-800",   text: "text-white"       },
                { label: "Lost Time Incident",                    value: lagging?.lti        ?? 0, bg: "bg-red-500",   text: "text-white"       },
                { label: "Medical Treatment Incident",            value: lagging?.mti        ?? 0, bg: "bg-orange-400",text: "text-white"       },
                { label: "First Aid",                             value: lagging?.firstAid   ?? 0, bg: "bg-yellow-400",text: "text-slate-800"   },
                { label: "Near Misses",                           value: lagging?.nearMisses ?? 0, bg: "bg-blue-400",  text: "text-white"       },
                { label: "Unsafe Conditions & Acts (Hazard ID)",  value: lagging?.hazardId   ?? 0, bg: "bg-blue-700",  text: "text-white"       },
              ];
              const maxVal = Math.max(...rows.map(r => r.value), 1);
              return rows.map((row, i) => {
                if (row.value === 0) return (
                  <div key={i} className="flex items-center gap-3 mb-1.5 opacity-40">
                    <div className="ml-auto w-0" />
                    <span className="text-xs text-slate-400 w-52 leading-tight flex-shrink-0 italic">{row.label}: 0</span>
                  </div>
                );
                const pct = 10 + Math.round((row.value / maxVal) * 90);
                return (
                  <div key={i} className="flex items-center gap-3 mb-1.5">
                    <div
                      className={`flex items-center justify-center rounded-sm py-2 px-3 ${row.bg} transition-all ml-auto`}
                      style={{ width: `${pct}%` }}
                    >
                      <span className={`text-sm font-bold mr-2 ${row.text}`}>{row.value.toLocaleString()}</span>
                    </div>
                    <span className="text-xs text-slate-600 w-52 leading-tight flex-shrink-0">{row.label}</span>
                  </div>
                );
              });
            })()}
          </div>

          {/* Non LTI Days + Safe Hours */}
          <div className="flex flex-col gap-4 min-w-[200px] items-center lg:items-start">
            <div className="text-center p-5 bg-slate-50 rounded-2xl border w-full">
              <div className="text-6xl font-black text-slate-800 tracking-tight tabular-nums">
                {(lagging?.nonLtiDays ?? 0).toLocaleString()}
              </div>
              <div className="text-sm font-semibold text-slate-600 mt-1">Non LTI Days</div>
            </div>
            <div className="text-center p-5 bg-slate-50 rounded-2xl border w-full">
              <div className="text-6xl font-black text-slate-800 tracking-tight tabular-nums">
                {(lagging?.safeHours ?? 0).toLocaleString()}
              </div>
              <div className="text-sm font-semibold text-slate-600 mt-1">Safe Hours</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 5: Risk Heat Map ── */}
      {heatmap && (
        <div className="rounded-2xl border bg-white shadow-sm p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Risk Heat Map</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Probability vs Impact · {heatmap.total} incident
                {mode === "yearly"
                  ? ` tahun ${year}`
                  : ` bulan ${MONTHS_FULL[month - 1]} ${year}`}
                {heatmap.plotted < heatmap.total && (() => {
                  const reasons: string[] = [];
                  if (heatmap.missingType > 0) reasons.push(`${heatmap.missingType} tanpa Tipe Incident`);
                  if (heatmap.missingProbability > 0) reasons.push(`${heatmap.missingProbability} Tipe Incident tanpa Probabilitas`);
                  if (heatmap.missingImpact > 0) reasons.push(`${heatmap.missingImpact} Kategori tanpa Impact`);
                  return (
                    <span className="ml-1 text-amber-600">
                      ({heatmap.plotted} terpetakan{reasons.length > 0 ? ` — ${reasons.join(", ")}` : ""})
                    </span>
                  );
                })()}
              </p>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-xs">
              {(["low","medium","high","critical"] as const).map(z => (
                <span key={z} className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-medium ${ZONE_STYLE[z].bg} ${ZONE_STYLE[z].border} ${ZONE_STYLE[z].text}`}>
                  <span className={`w-2 h-2 rounded-full ${ZONE_STYLE[z].dot}`} />
                  {ZONE_STYLE[z].label}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  {/* corner cell */}
                  <th className="pb-2 pr-3 text-right w-32 text-xs text-slate-400 font-normal align-bottom">
                    Probability ↓ / Impact →
                  </th>
                  {(heatmap.impactLabels).map((imp, iIdx) => (
                    <th key={imp} className="pb-2 text-center">
                      <div className={`text-xs font-semibold px-1 py-0.5 rounded ${
                        iIdx === 0 ? "text-slate-500" :
                        iIdx === 1 ? "text-green-700" :
                        iIdx === 2 ? "text-yellow-700" :
                        iIdx === 3 ? "text-orange-700" : "text-red-700"
                      }`}>
                        {IMPACT_LABELS[imp] ?? imp}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Render from Almost Certain (top) down to Rare (bottom) */}
                {[...heatmap.probLabels].reverse().map((prob, revIdx) => {
                  const pIdx = heatmap.probLabels.length - 1 - revIdx;
                  return (
                    <tr key={prob}>
                      {/* Row label */}
                      <td className="pr-3 py-1 text-right">
                        <span className="text-xs font-semibold text-slate-600">
                          {PROB_LABELS[prob] ?? prob}
                        </span>
                      </td>
                      {heatmap.impactLabels.map((imp, iIdx) => {
                        const cell = heatmap.matrix[pIdx]?.[iIdx];
                        const zone = RISK_ZONE[pIdx]?.[iIdx] ?? "low";
                        const style = ZONE_STYLE[zone];
                        const hasIncidents = (cell?.count ?? 0) > 0;
                        return (
                          <td key={imp} className="p-1">
                            <div
                              onClick={() => {
                                if (hasIncidents) {
                                  setSelectedCell({
                                    prob,
                                    impact: imp,
                                    zone,
                                    incidentIds: cell!.incidentIds,
                                  });
                                }
                              }}
                              className={`
                                relative flex flex-col items-center justify-center
                                rounded-xl border-2 transition-all
                                ${style.bg} ${style.border}
                                ${hasIncidents
                                  ? "shadow-sm cursor-pointer hover:brightness-95 hover:shadow-md active:scale-95"
                                  : "opacity-60"}
                              `}
                              style={{ minHeight: 64, minWidth: 72 }}
                              title={hasIncidents
                                ? `Klik untuk melihat ${cell!.count} incident · ${style.label} Risk`
                                : `${style.label} Risk zone`
                              }
                            >
                              {hasIncidents ? (
                                <>
                                  <span className={`text-2xl font-black ${style.text} tabular-nums leading-none`}>
                                    {cell!.count}
                                  </span>
                                  <span className={`text-[10px] font-medium ${style.text} opacity-70 mt-0.5`}>
                                    incident
                                  </span>
                                </>
                              ) : (
                                <span className={`text-xs ${style.text} opacity-40`}>—</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {heatmap.plotted === 0 && (
            <div className="mt-4 text-center text-sm text-slate-400 py-4 border-t">
              Belum ada data untuk ditampilkan. Pastikan:
              <ul className="mt-1 text-xs space-y-0.5">
                <li>1. Tipe Incident sudah dikonfigurasi <span className="font-medium">Probability</span>-nya di Master Tipe Incident</li>
                <li>2. Ada incident yang tercatat untuk periode ini</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Row 6: Incident Breakdown Pie Charts ── */}
      {breakdown && breakdown.total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Pie 1 — By Category (Departemen) */}
          <div className="rounded-2xl border bg-white shadow-sm p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-800">Laporan per Departemen / Kategori</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Distribusi {breakdown.total} laporan incident &amp; hazard tahun {year}
              </p>
            </div>
            {breakdown.byCategory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Belum ada data</p>
            ) : (
              <div className="flex flex-col gap-4">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={breakdown.byCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {breakdown.byCategory.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number, _name, props) => [
                        `${val} laporan (${Math.round((val / breakdown.total) * 100)}%)`,
                        props.payload?.name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {breakdown.byCategory.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2.5 text-sm">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="flex-1 truncate text-slate-700 font-medium">{d.name}</span>
                      <span className="text-slate-500 tabular-nums">{d.value}</span>
                      <span className="text-xs text-slate-400 w-10 text-right tabular-nums">
                        {Math.round((d.value / breakdown.total) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pie 2 — By Plant (Area) */}
          <div className="rounded-2xl border bg-white shadow-sm p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-800">Laporan per Area</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Area dengan insiden terbanyak tahun {year}
              </p>
            </div>
            {breakdown.byPlant.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Belum ada data</p>
            ) : (
              <div className="flex flex-col gap-4">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={breakdown.byPlant}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {breakdown.byPlant.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number, _name, props) => [
                        `${val} laporan (${Math.round((val / breakdown.total) * 100)}%)`,
                        props.payload?.name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {breakdown.byPlant.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2.5 text-sm">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="flex-1 truncate text-slate-700 font-medium">{d.name}</span>
                      <span className="text-slate-500 tabular-nums">{d.value}</span>
                      <span className="text-xs text-slate-400 w-10 text-right tabular-nums">
                        {Math.round((d.value / breakdown.total) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Heatmap Drill-Down Dialog ── */}
      <Dialog open={!!selectedCell} onOpenChange={open => { if (!open) setSelectedCell(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {selectedCell && (() => {
            const style = ZONE_STYLE[selectedCell.zone];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold border ${style.bg} ${style.border} ${style.text}`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                      {style.label} Risk
                    </span>
                    <span className="text-slate-600 font-normal text-sm">
                      {PROB_LABELS[selectedCell.prob]} × {IMPACT_LABELS[selectedCell.impact]}
                    </span>
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    Daftar incident pada zona {style.label} Risk dengan probability {PROB_LABELS[selectedCell.prob]} dan impact {IMPACT_LABELS[selectedCell.impact]}
                  </DialogDescription>
                </DialogHeader>

                {cellLoading ? (
                  <div className="py-8 text-center text-sm text-gray-400">Memuat data incident...</div>
                ) : cellIncidents.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">Tidak ada data ditemukan</div>
                ) : (
                  <div className="space-y-2 mt-1">
                    <p className="text-xs text-gray-500 mb-3">
                      {cellIncidents.length} incident dalam zona ini
                    </p>
                    {cellIncidents.map(inc => (
                      <Link key={inc.id} to={`/incidents/${inc.id}`}
                        onClick={() => setSelectedCell(null)}
                        className="block"
                      >
                        <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer group">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 line-clamp-2 group-hover:text-blue-700">
                              {inc.detail}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              <span className="text-xs text-gray-400">{inc.incidentDate}</span>
                              {inc.categoryName && (
                                <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">{inc.categoryName}</span>
                              )}
                              {inc.plantName && (
                                <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{inc.plantName}</span>
                              )}
                              {inc.incidentType && (
                                <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full">{inc.incidentType.replace(/_/g, " ")}</span>
                              )}
                            </div>
                          </div>
                          <Badge
                            className={`flex-shrink-0 text-xs ${
                              inc.status === "closed"
                                ? "bg-green-100 text-green-700 border-green-200"
                                : inc.status === "in_progress"
                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                : "bg-red-100 text-red-700 border-red-200"
                            } hover:opacity-80`}
                          >
                            {inc.status === "closed" ? "Selesai" : inc.status === "in_progress" ? "Proses" : "Open"}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
