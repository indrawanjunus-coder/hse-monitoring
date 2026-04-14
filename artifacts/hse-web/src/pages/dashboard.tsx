import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { AlertTriangle, CheckCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { RiskBadge } from "@/components/badges";

interface DashboardSummary {
  totalIncidents: number;
  openIncidents: number;
  closedIncidents: number;
  dailyIncidents: { date: string; count: number }[];
  dailyStatus: { date: string; open: number; closed: number }[];
  riskMatrix: { categoryId: number; categoryName: string; riskLevel: string; fatal: number; major: number; moderate: number; minor: number; total: number }[];
  categoryTrend: { date: string; categoryId: number; categoryName: string; count: number }[];
  actionsPerDay: Record<string, number | string>[];
  actionNames: string[];
}

interface HazardArea {
  area: string;
  count: number;
  pct: number;
}

interface TemplateCompliance {
  name: string;
  frequency: string;
  targetReporterCount: number;
  reporterCount: number;
  pctReporter: number;
  reportCount: number;
  targetReports: number;
  pctReport: number;
}

interface TemplateItem { id: number; name: string }

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ACTION_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16"];
const CATEGORY_COLORS = ["#6366F1", "#F43F5E", "#14B8A6", "#F97316", "#8B5CF6", "#0EA5E9", "#D946EF"];
const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16", "#F97316", "#14B8A6"];

const FREQ_LABEL: Record<string, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  biweekly: "2 Mingguan",
  monthly: "Bulanan",
  custom: "Custom",
};

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
          <div className={`p-3 rounded-xl bg-gray-50 ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PctBar({ value, color = "bg-blue-500" }: { value: number; color?: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function PctBadge({ value }: { value: number }) {
  const color = value >= 80 ? "text-green-700 bg-green-50" : value >= 50 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{value}%</span>;
}

export default function DashboardPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [, navigate] = useLocation();

  const goToIncidents = (categoryName: string, risk: "fatal" | "major" | "moderate" | "minor" | "all") => {
    const params = new URLSearchParams({ category: categoryName, risk });
    navigate(`/incidents?${params.toString()}`);
  };

  const { data, isLoading } = useQuery<DashboardSummary>({
    queryKey: ["dashboard", month, year],
    queryFn: () => api.get(`/dashboard/summary?month=${month}&year=${year}`),
  });

  const { data: hazardData, isLoading: hazardLoading } = useQuery<{ areas: HazardArea[]; total: number }>({
    queryKey: ["dashboard-hazard", month, year],
    queryFn: () => api.get(`/dashboard/hazard-by-area?month=${month}&year=${year}`),
  });

  const { data: templateList = [] } = useQuery<TemplateItem[]>({
    queryKey: ["dashboard-templates"],
    queryFn: () => api.get("/dashboard/templates"),
  });

  const { data: complianceData, isLoading: complianceLoading } = useQuery<{ departments: TemplateCompliance[] }>({
    queryKey: ["dashboard-compliance", selectedTemplate, month, year],
    queryFn: () => api.get(`/dashboard/template-compliance?templateId=${selectedTemplate}&month=${month}&year=${year}`),
    enabled: !!selectedTemplate,
  });

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
  };

  const dailyData = data?.dailyIncidents.map(d => ({
    day: d.date.split("-")[2],
    Incident: d.count,
  }));

  // Aggregate monthly open/closed for pie chart
  const totalOpen = data?.dailyStatus.reduce((s, d) => s + d.open, 0) ?? 0;
  const totalClosed = data?.dailyStatus.reduce((s, d) => s + d.closed, 0) ?? 0;
  const openClosedPieData = [
    { name: "Open", value: totalOpen },
    { name: "Selesai", value: totalClosed },
  ].filter(d => d.value > 0);

  const categoryTotalMap = (data?.categoryTrend ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.categoryName] = (acc[item.categoryName] ?? 0) + item.count;
    return acc;
  }, {});
  const categoryData = Object.entries(categoryTotalMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  const actionsPerDay = (data?.actionsPerDay ?? []).filter(d => (d.total as number) > 0).map(d => ({
    ...d,
    day: String(d.date).split("-")[2],
  }));
  const actionNames = data?.actionNames ?? [];

  const categoryPerDayMap: Record<string, Record<string, number>> = {};
  for (const item of data?.categoryTrend ?? []) {
    const day = item.date.split("-")[2]!;
    if (!categoryPerDayMap[day]) categoryPerDayMap[day] = {};
    categoryPerDayMap[day]![item.categoryName] = item.count;
  }
  const allCategories = [...new Set((data?.categoryTrend ?? []).map(t => t.categoryName))];
  const categoryPerDayData = (data?.dailyIncidents ?? [])
    .filter(d => {
      const day = d.date.split("-")[2]!;
      return Object.values(categoryPerDayMap[day] ?? {}).reduce((s, v) => s + v, 0) > 0;
    })
    .map(d => {
      const day = d.date.split("-")[2]!;
      return { day, ...categoryPerDayMap[day] };
    });

  const hazardAreas = hazardData?.areas ?? [];
  const hazardTotal = hazardData?.total ?? 0;
  const hazardPieData = hazardAreas.map((a, i) => ({ name: a.area, value: a.count, color: PIE_COLORS[i % PIE_COLORS.length] }));

  const departments = complianceData?.departments ?? [];

  return (
    <div className="p-6">
      <PageHeader
        title="Dashboard HSE"
        subtitle="Monitor kesehatan, keselamatan, dan lingkungan"
        action={
          <div className="flex items-center gap-2 bg-white border rounded-lg px-2 py-1">
            <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="font-medium text-sm min-w-36 text-center">{MONTHS[month - 1]} {year}</span>
            <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Incident" value={data?.totalIncidents ?? 0} icon={<AlertTriangle className="w-6 h-6" />} color="text-blue-600" />
        <StatCard title="Open" value={data?.openIncidents ?? 0} icon={<Clock className="w-6 h-6" />} color="text-red-600" />
        <StatCard title="Selesai" value={data?.closedIncidents ?? 0} icon={<CheckCircle className="w-6 h-6" />} color="text-green-600" />
      </div>

      {/* Row 1: Incident harian + Open vs Selesai (Pie) */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Incident Harian</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center text-gray-400">Memuat...</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="Incident" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open vs Selesai Bulan Ini</CardTitle>
            <p className="text-xs text-gray-400 -mt-1">{MONTHS[month - 1]} {year}</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center text-gray-400">Memuat...</div>
            ) : openClosedPieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Tidak ada data</div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie
                      data={openClosedPieData}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      <Cell key="open" fill="#EF4444" />
                      <Cell key="closed" fill="#10B981" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-700">Open</div>
                      <div className="text-2xl font-bold text-red-600">{totalOpen}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-700">Selesai</div>
                      <div className="text-2xl font-bold text-green-600">{totalClosed}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Aksi per hari, Kategori per hari, Kategori total */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aksi per Hari</CardTitle>
            <p className="text-xs text-gray-400 -mt-1">Distribusi tindakan penanganan harian – {MONTHS[month - 1]} {year}</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center text-gray-400">Memuat...</div>
            ) : actionsPerDay.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Belum ada aksi pada bulan ini</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={actionsPerDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {actionNames.map((name, i) => (
                    <Bar key={name} dataKey={name} stackId="a" fill={ACTION_COLORS[i % ACTION_COLORS.length]} radius={i === actionNames.length - 1 ? [4, 4, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Incident per Kategori per Hari</CardTitle>
            <p className="text-xs text-gray-400 -mt-1">Perbandingan kategori kejadian harian – {MONTHS[month - 1]} {year}</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center text-gray-400">Memuat...</div>
            ) : categoryPerDayData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Tidak ada data pada bulan ini</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={categoryPerDayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {allCategories.map((cat, i) => (
                    <Line key={cat} type="monotone" dataKey={cat} stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Incident per Kategori</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center text-gray-400">Memuat...</div>
            ) : categoryData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400">Tidak ada data</div>
            ) : (
              <div className="space-y-3">
                {categoryData.map((item) => {
                  const maxCount = Math.max(...categoryData.map(d => d.count));
                  const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  return (
                    <div key={item.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{item.name}</span>
                        <span className="font-bold text-blue-600">{item.count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Identifikasi Bahaya per Area */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Identifikasi Bahaya per Area</CardTitle>
          <p className="text-xs text-gray-400 -mt-1">{MONTHS[month - 1]} {year} · Total: {hazardTotal} kasus</p>
        </CardHeader>
        <CardContent>
          {hazardLoading ? (
            <div className="h-40 flex items-center justify-center text-gray-400">Memuat...</div>
          ) : hazardAreas.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Tidak ada data identifikasi bahaya pada bulan ini</div>
          ) : (
            <div className="flex gap-6 items-start">
              {/* Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium text-gray-600">Area / Lokasi</th>
                      <th className="text-center py-2 font-medium text-gray-600">No Case</th>
                      <th className="text-center py-2 font-medium text-gray-600">% of Case</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hazardAreas.map((area, i) => (
                      <tr key={area.area} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="font-medium text-gray-800">{area.area}</span>
                          </div>
                        </td>
                        <td className="text-center py-2 font-bold text-gray-800">{area.count}</td>
                        <td className="text-center py-2">
                          <span className="font-semibold text-blue-700">{area.pct}%</span>
                          <PctBar value={area.pct} />
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-gray-50">
                      <td className="py-2 font-semibold text-gray-700">Total</td>
                      <td className="text-center py-2 font-bold text-gray-900">{hazardTotal}</td>
                      <td className="text-center py-2 font-bold text-gray-900">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Pie chart */}
              <div className="shrink-0 w-64">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={hazardPieData}
                      cx="50%" cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={true}
                    >
                      {hazardPieData.map((entry, i) => (
                        <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} kasus`, n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Compliance Dashboard */}
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Kepatuhan Laporan Template</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">{MONTHS[month - 1]} {year}</p>
            </div>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Pilih template..." />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {templateList.map(t => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedTemplate ? (
            <div className="h-24 flex items-center justify-center text-gray-400 text-sm">Pilih template untuk melihat laporan kepatuhan</div>
          ) : complianceLoading ? (
            <div className="h-24 flex items-center justify-center text-gray-400">Memuat...</div>
          ) : departments.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-gray-400 text-sm">Belum ada jadwal atau data untuk template ini</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2.5 px-3 font-medium text-gray-600">Nama Departemen</th>
                    <th className="text-center py-2.5 px-2 font-medium text-gray-600">Jadwal</th>
                    <th className="text-center py-2.5 px-2 font-medium text-gray-600">Jml User Pelapor</th>
                    <th className="text-center py-2.5 px-2 font-medium text-gray-600">Target Pelapor</th>
                    <th className="text-center py-2.5 px-2 font-medium text-gray-600">% Pelapor</th>
                    <th className="text-center py-2.5 px-2 font-medium text-gray-600">Laporan Masuk</th>
                    <th className="text-center py-2.5 px-2 font-medium text-gray-600">Target Laporan</th>
                    <th className="text-center py-2.5 px-2 font-medium text-gray-600">% Laporan</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-800">{dept.name}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          {FREQ_LABEL[dept.frequency] ?? dept.frequency}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-gray-800">{dept.reporterCount}</td>
                      <td className="py-2.5 px-2 text-center text-gray-600">{dept.targetReporterCount}</td>
                      <td className="py-2.5 px-2 text-center">
                        <PctBadge value={dept.pctReporter} />
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-gray-800">{dept.reportCount}</td>
                      <td className="py-2.5 px-2 text-center text-gray-600">{dept.targetReports}</td>
                      <td className="py-2.5 px-2 text-center">
                        <PctBadge value={dept.pctReport} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Matrix */}
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Risk Matrix per Kategori</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium text-gray-600">Kategori</th>
                <th className="text-center py-2 font-medium text-red-700">Fatal</th>
                <th className="text-center py-2 font-medium text-orange-600">Major</th>
                <th className="text-center py-2 font-medium text-amber-600">Moderate</th>
                <th className="text-center py-2 font-medium text-green-600">Minor</th>
                <th className="text-center py-2 font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Memuat...</td></tr>
              ) : data?.riskMatrix.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Tidak ada data</td></tr>
              ) : data?.riskMatrix.map((r) => (
                <tr key={r.categoryId} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 font-medium">
                    <div className="flex items-center gap-1.5">
                      <RiskBadge level={r.riskLevel as "fatal" | "major" | "moderate" | "minor"} />
                      <span>{r.categoryName}</span>
                    </div>
                  </td>
                  <td className="text-center py-2">
                    {r.fatal > 0 ? <button onClick={() => goToIncidents(r.categoryName, "fatal")} className="text-red-700 font-bold hover:underline cursor-pointer px-1 rounded hover:bg-red-50">{r.fatal}</button> : <span className="text-gray-300 font-bold">—</span>}
                  </td>
                  <td className="text-center py-2">
                    {r.major > 0 ? <button onClick={() => goToIncidents(r.categoryName, "major")} className="text-orange-600 font-bold hover:underline cursor-pointer px-1 rounded hover:bg-orange-50">{r.major}</button> : <span className="text-gray-300 font-bold">—</span>}
                  </td>
                  <td className="text-center py-2">
                    {r.moderate > 0 ? <button onClick={() => goToIncidents(r.categoryName, "moderate")} className="text-amber-600 font-bold hover:underline cursor-pointer px-1 rounded hover:bg-amber-50">{r.moderate}</button> : <span className="text-gray-300 font-bold">—</span>}
                  </td>
                  <td className="text-center py-2">
                    {r.minor > 0 ? <button onClick={() => goToIncidents(r.categoryName, "minor")} className="text-green-600 font-bold hover:underline cursor-pointer px-1 rounded hover:bg-green-50">{r.minor}</button> : <span className="text-gray-300 font-bold">—</span>}
                  </td>
                  <td className="text-center py-2">
                    {r.total > 0 ? <button onClick={() => goToIncidents(r.categoryName, "all")} className="text-gray-800 font-bold hover:underline cursor-pointer px-1 rounded hover:bg-gray-100">{r.total}</button> : <span className="text-gray-300 font-bold">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
