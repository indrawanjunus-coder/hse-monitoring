import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { AlertTriangle, CheckCircle, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";

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

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
const MONTHS_FULL  = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const CLOSING_STANDARD = 80;

// ---- Closing Rate Card ----
function ClosingRateCard({
  title, subtitle, closed, total,
}: {
  title: string; subtitle: string; closed: number; total: number;
}) {
  const rate = total > 0 ? Math.round((closed / total) * 100) : 0;
  const aboveStd = rate >= CLOSING_STANDARD;
  const barColor = aboveStd ? "bg-green-500" : rate >= 50 ? "bg-yellow-500" : "bg-red-500";
  const textColor = aboveStd ? "text-green-700" : rate >= 50 ? "text-yellow-700" : "text-red-700";
  const bgColor = aboveStd ? "bg-green-50 border-green-200" : rate >= 50 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";

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

        {/* Big percentage */}
        <div className={`text-4xl font-bold ${textColor} mb-1`}>{rate}%</div>

        {/* Progress bar vs standard */}
        <div className="relative w-full bg-gray-100 rounded-full h-3 mt-2 mb-2">
          <div
            className={`${barColor} h-3 rounded-full transition-all`}
            style={{ width: `${Math.min(rate, 100)}%` }}
          />
          {/* Standard marker at 80% */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-500"
            style={{ left: `${CLOSING_STANDARD}%` }}
          />
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

// ---- Main Page ----
export default function DashboardPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

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

  // MTD chart: open vs closed per day, only days with activity
  const mtdChartData = (data?.dailyStatus ?? [])
    .filter(d => d.open > 0 || d.closed > 0)
    .map(d => ({
      day: d.date.split("-")[2],
      Open: d.open,
      Close: d.closed,
    }));

  // YTD chart: open vs closed per month (only months up to current)
  const ytdChartData = (ytd?.months ?? [])
    .filter(m => m.total > 0)
    .map(m => ({
      bulan: MONTHS_SHORT[m.month - 1],
      Open: m.open,
      Close: m.closed,
    }));

  // Closing rates
  const mtdTotal  = data?.totalIncidents ?? 0;
  const mtdClosed = data?.closedIncidents ?? 0;

  const ytdTotal  = ytd?.totalIncidents ?? 0;
  const ytdClosed = ytd?.totalClosed ?? 0;

  const totalAllTime = ytd?.totalAllTime ?? 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dashboard HSE"
        subtitle="Monitor kesehatan, keselamatan, dan lingkungan"
        action={
          <div className="flex items-center gap-2 bg-white border rounded-lg px-2 py-1">
            <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="font-medium text-sm min-w-36 text-center">{MONTHS_FULL[month - 1]} {year}</span>
            <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        }
      />

      {/* ── Row 1: Charts ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* MTD Chart */}
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
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5e7eb" }}
                    formatter={(v, name) => [v, name === "Open" ? "Open" : "Close"]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Open"  fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="Close" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {/* Summary row */}
            {!isLoading && mtdTotal > 0 && (
              <div className="flex gap-4 mt-2 pt-2 border-t text-sm">
                <span className="text-gray-500">Total: <strong className="text-gray-800">{mtdTotal}</strong></span>
                <span className="text-red-600">Open: <strong>{data?.openIncidents ?? 0}</strong></span>
                <span className="text-green-600">Close: <strong>{mtdClosed}</strong></span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* YTD Chart */}
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
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #e5e7eb" }}
                    formatter={(v, name) => [v, name === "Open" ? "Open" : "Close"]}
                  />
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

      {/* ── Row 2: KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Total Hazard Identification Report */}
        <Card className="border-blue-100 bg-blue-50/40">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Hazard Identification Report</p>
                <p className="text-xs text-gray-400 mt-0.5">Semua periode</p>
              </div>
              <AlertTriangle className="w-5 h-5 mt-0.5 text-blue-500" />
            </div>
            <div className="text-4xl font-bold text-blue-700">{totalAllTime}</div>
            <div className="mt-2 text-xs text-gray-500 flex gap-3">
              <span>YTD {year}: <strong className="text-gray-700">{ytdTotal}</strong></span>
              <span>{MONTHS_SHORT[month - 1]}: <strong className="text-gray-700">{mtdTotal}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Closing Rate MTD */}
        <ClosingRateCard
          title="% Closing Rate MTD"
          subtitle={`${MONTHS_FULL[month - 1]} ${year} · Standar ≥ ${CLOSING_STANDARD}%`}
          closed={mtdClosed}
          total={mtdTotal}
        />

        {/* Closing Rate YTD */}
        <ClosingRateCard
          title="% Closing Rate YTD"
          subtitle={`${year} s/d ${MONTHS_SHORT[month - 1]} · Standar ≥ ${CLOSING_STANDARD}%`}
          closed={ytdClosed}
          total={ytdTotal}
        />
      </div>
    </div>
  );
}
