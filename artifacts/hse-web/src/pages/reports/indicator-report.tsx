import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Target, TrendingUp, TrendingDown, CheckCircle2, XCircle, BarChart3 } from "lucide-react";

interface IndicatorResult {
  id: number;
  name: string;
  description?: string | null;
  type: string;
  targetPercentage: number;
  percentage: number | null;
  questionCount: number;
  totalAnswers: number;
  correctAnswers: number;
}

interface ReportData {
  indicators: IndicatorResult[];
  byType: Record<string, IndicatorResult[]>;
  summary: {
    total: number;
    withData: number;
    avgPercentage: number | null;
    metTarget: number;
    notMet: number;
  };
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const TYPE_COLORS: Record<string, string> = {
  "ISO 45001": "bg-blue-600",
  "ISO 14001": "bg-green-600",
  "OHSAS 18001": "bg-purple-600",
  "SMK3": "bg-orange-600",
  "HSE Internal": "bg-teal-600",
};

function ProgressBar({ value, target }: { value: number | null; target: number }) {
  if (value === null) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1 h-3 bg-gray-100 rounded-full" />
        <span className="text-xs text-gray-400 w-10 text-right">N/A</span>
      </div>
    );
  }
  const met = value >= target;
  const near = value >= target * 0.8;
  const barColor = met ? "bg-green-500" : near ? "bg-amber-500" : "bg-red-500";
  const pct = Math.min(value, 100);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden relative">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        <div className="absolute inset-y-0 border-l-2 border-dashed border-gray-400" style={{ left: `${target}%` }} />
      </div>
      <span className={`text-sm font-bold w-10 text-right ${met ? "text-green-600" : near ? "text-amber-600" : "text-red-600"}`}>
        {value}%
      </span>
    </div>
  );
}

function SummaryCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function IndicatorCard({ ind }: { ind: IndicatorResult }) {
  const met = ind.percentage !== null && ind.percentage >= ind.targetPercentage;
  const near = ind.percentage !== null && ind.percentage >= ind.targetPercentage * 0.8;
  const statusColor = ind.percentage === null ? "border-gray-200" : met ? "border-green-200" : near ? "border-amber-200" : "border-red-200";
  const typeBg = TYPE_COLORS[ind.type] ?? "bg-gray-500";

  return (
    <div className={`bg-white rounded-xl border-2 ${statusColor} shadow-sm p-4 space-y-3`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs text-white px-2 py-0.5 rounded-full font-semibold ${typeBg}`}>{ind.type}</span>
            {ind.percentage !== null && (
              met
                ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5" />Target Tercapai</span>
                : <span className="flex items-center gap-1 text-xs text-red-500 font-medium"><XCircle className="w-3.5 h-3.5" />Belum Tercapai</span>
            )}
          </div>
          <p className="font-semibold text-gray-900 leading-snug">{ind.name}</p>
          {ind.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ind.description}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          {ind.percentage !== null ? (
            <span className={`text-2xl font-bold ${met ? "text-green-600" : near ? "text-amber-600" : "text-red-500"}`}>
              {ind.percentage}%
            </span>
          ) : (
            <span className="text-xl text-gray-300 font-bold">—</span>
          )}
          <p className="text-xs text-gray-400">target {ind.targetPercentage}%</p>
        </div>
      </div>

      <ProgressBar value={ind.percentage} target={ind.targetPercentage} />

      <div className="flex items-center gap-4 text-xs text-gray-500 pt-1 border-t">
        <span><span className="font-medium text-gray-700">{ind.questionCount}</span> pertanyaan terhubung</span>
        {ind.percentage !== null && (
          <span><span className="font-medium text-gray-700">{ind.totalAnswers}</span> jawaban</span>
        )}
      </div>
    </div>
  );
}

export default function IndicatorReportPage() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [filterMode, setFilterMode] = useState<"month" | "year" | "all">("month");

  const params = new URLSearchParams();
  if (filterMode === "month") { params.set("month", month); params.set("year", year); }
  if (filterMode === "year") params.set("year", year);

  const { data, isLoading } = useQuery<ReportData>({
    queryKey: ["report-indicators", filterMode, month, year],
    queryFn: () => api.get(`/reports/indicators?${params.toString()}`),
  });

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));
  const types = data ? Object.keys(data.byType).sort() : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Indikator HSE"
        subtitle="Persentase pencapaian indikator berdasarkan hasil inspeksi"
      />

      {/* Filter */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">Periode</Label>
              <Select value={filterMode} onValueChange={v => setFilterMode(v as "month" | "year" | "all")}>
                <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Per Bulan</SelectItem>
                  <SelectItem value="year">Per Tahun</SelectItem>
                  <SelectItem value="all">Semua Waktu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filterMode !== "all" && (
              <div className="space-y-1">
                <Label className="text-xs">Tahun</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {filterMode === "month" && (
              <div className="space-y-1">
                <Label className="text-xs">Bulan</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Memuat laporan...</div>
      ) : !data || data.indicators.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Belum ada data indikator</p>
          <p className="text-sm">Tambahkan indikator dan hubungkan pertanyaan dari halaman Master Indikator HSE</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Total Indikator" value={data.summary.total} icon={Target} color="bg-blue-500" />
            <SummaryCard
              label="Rata-rata Pencapaian"
              value={data.summary.avgPercentage !== null ? `${data.summary.avgPercentage}%` : "—"}
              sub={`dari ${data.summary.withData} indikator berdata`}
              icon={TrendingUp}
              color="bg-indigo-500"
            />
            <SummaryCard
              label="Target Tercapai"
              value={data.summary.metTarget}
              sub={`dari ${data.summary.withData} yang terukur`}
              icon={CheckCircle2}
              color="bg-green-500"
            />
            <SummaryCard
              label="Belum Tercapai"
              value={data.summary.notMet}
              icon={TrendingDown}
              color="bg-red-500"
            />
          </div>

          {/* By Type */}
          {types.map(type => (
            <div key={type} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${TYPE_COLORS[type] ?? "bg-gray-400"}`} />
                <h3 className="font-semibold text-gray-800">{type}</h3>
                <span className="text-xs text-gray-500">({data.byType[type].length} indikator)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.byType[type].map(ind => (
                  <IndicatorCard key={ind.id} ind={ind} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
