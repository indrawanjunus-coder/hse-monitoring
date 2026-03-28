import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
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

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const ACTION_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16"];
const CATEGORY_COLORS = ["#6366F1", "#F43F5E", "#14B8A6", "#F97316", "#8B5CF6", "#0EA5E9", "#D946EF"];

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

export default function DashboardPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [, navigate] = useLocation();

  const goToIncidents = (categoryName: string, risk: "fatal" | "major" | "moderate" | "minor" | "all") => {
    const params = new URLSearchParams({ category: categoryName, risk });
    navigate(`/incidents?${params.toString()}`);
  };

  const { data, isLoading } = useQuery<DashboardSummary>({
    queryKey: ["dashboard", month, year],
    queryFn: () => api.get(`/dashboard/summary?month=${month}&year=${year}`),
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

  const statusData = data?.dailyStatus.filter(d => d.open + d.closed > 0).map(d => ({
    day: d.date.split("-")[2],
    Open: d.open,
    Selesai: d.closed,
  }));

  const categoryTotalMap = (data?.categoryTrend ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.categoryName] = (acc[item.categoryName] ?? 0) + item.count;
    return acc;
  }, {});
  const categoryData = Object.entries(categoryTotalMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  // Aksi per hari — only days with actions
  const actionsPerDay = (data?.actionsPerDay ?? []).filter(d => (d.total as number) > 0).map(d => ({
    ...d,
    day: String(d.date).split("-")[2],
  }));
  const actionNames = data?.actionNames ?? [];

  // Category per day stacked bar — merge dailyIncidents with categoryTrend
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

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Total Incident"
          value={data?.totalIncidents ?? 0}
          icon={<AlertTriangle className="w-6 h-6" />}
          color="text-blue-600"
        />
        <StatCard
          title="Open"
          value={data?.openIncidents ?? 0}
          icon={<Clock className="w-6 h-6" />}
          color="text-red-600"
        />
        <StatCard
          title="Selesai"
          value={data?.closedIncidents ?? 0}
          icon={<CheckCircle className="w-6 h-6" />}
          color="text-green-600"
        />
      </div>

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
          <CardHeader><CardTitle className="text-base">Open vs Selesai per Hari</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center text-gray-400">Memuat...</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Open" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Selesai" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aksi per Hari vs Kategori */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aksi per Hari</CardTitle>
            <p className="text-xs text-gray-400 -mt-1">Distribusi tindakan penanganan harian – {MONTHS[month - 1]} {year}</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center text-gray-400">Memuat...</div>
            ) : actionsPerDay.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                Belum ada aksi pada bulan ini
              </div>
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
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                Tidak ada data pada bulan ini
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={categoryPerDayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {allCategories.map((cat, i) => (
                    <Line
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
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
                      {r.fatal > 0 ? (
                        <button onClick={() => goToIncidents(r.categoryName, "fatal")}
                          className="text-red-700 font-bold hover:underline cursor-pointer px-1 rounded hover:bg-red-50">
                          {r.fatal}
                        </button>
                      ) : <span className="text-gray-300 font-bold">—</span>}
                    </td>
                    <td className="text-center py-2">
                      {r.major > 0 ? (
                        <button onClick={() => goToIncidents(r.categoryName, "major")}
                          className="text-orange-600 font-bold hover:underline cursor-pointer px-1 rounded hover:bg-orange-50">
                          {r.major}
                        </button>
                      ) : <span className="text-gray-300 font-bold">—</span>}
                    </td>
                    <td className="text-center py-2">
                      {r.moderate > 0 ? (
                        <button onClick={() => goToIncidents(r.categoryName, "moderate")}
                          className="text-amber-600 font-bold hover:underline cursor-pointer px-1 rounded hover:bg-amber-50">
                          {r.moderate}
                        </button>
                      ) : <span className="text-gray-300 font-bold">—</span>}
                    </td>
                    <td className="text-center py-2">
                      {r.minor > 0 ? (
                        <button onClick={() => goToIncidents(r.categoryName, "minor")}
                          className="text-green-600 font-bold hover:underline cursor-pointer px-1 rounded hover:bg-green-50">
                          {r.minor}
                        </button>
                      ) : <span className="text-gray-300 font-bold">—</span>}
                    </td>
                    <td className="text-center py-2">
                      {r.total > 0 ? (
                        <button onClick={() => goToIncidents(r.categoryName, "all")}
                          className="text-gray-800 font-bold hover:underline cursor-pointer px-1 rounded hover:bg-gray-100">
                          {r.total}
                        </button>
                      ) : <span className="text-gray-300 font-bold">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
