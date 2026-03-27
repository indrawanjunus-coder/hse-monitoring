import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AlertTriangle, Clock, CheckCircle, TrendingUp } from "lucide-react";

interface BucketIncident {
  id: number; status: string; incidentDate: string; categoryName?: string;
  detail: string; needsFurtherAction?: boolean; ageHours: number; createdAt: string;
}
interface Bucket { label: string; key: string; count: number; incidents: BucketIncident[] }
interface FollowupData { buckets: Bucket[]; total: number; open: number }

const BUCKET_COLORS = ["#3B82F6", "#F59E0B", "#EF4444", "#7C3AED"];
const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700 border-red-200",
  "in-progress": "bg-yellow-100 text-yellow-700 border-yellow-200",
  resolved: "bg-green-100 text-green-700 border-green-200",
  closed: "bg-gray-100 text-gray-600 border-gray-200",
};
const STATUS_LABELS: Record<string, string> = {
  open: "Terbuka", "in-progress": "Dalam Proses", resolved: "Terselesaikan", closed: "Ditutup",
};

export default function FollowupReportPage() {
  const { data, isLoading } = useQuery<FollowupData>({
    queryKey: ["reports", "followup"],
    queryFn: () => api.get("/reports/followup"),
    refetchInterval: 60_000, // auto-refresh every minute
  });

  const chartData = data?.buckets.map((b, i) => ({
    name: b.label, count: b.count, color: BUCKET_COLORS[i] ?? "#6B7280",
  })) ?? [];

  return (
    <div className="p-6">
      <PageHeader
        title="Laporan Followup H&I"
        subtitle="Incident dikelompokkan berdasarkan waktu sejak dilaporkan"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data?.total ?? "—"}</p>
              <p className="text-xs text-gray-500">Total Incident</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{data?.open ?? "—"}</p>
              <p className="text-xs text-gray-500">Open / Belum Resolved</p>
            </div>
          </CardContent>
        </Card>
        {data?.buckets.slice(0, 2).map((b, i) => (
          <Card key={b.key}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: (BUCKET_COLORS[i] ?? "#6B7280") + "20" }}>
                <Clock className="w-5 h-5" style={{ color: BUCKET_COLORS[i] }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{b.count}</p>
                <p className="text-xs text-gray-500">{b.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Distribusi Incident per Waktu</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center text-gray-400">Memuat chart...</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={60}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v} incident`, "Jumlah"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Bucket detail tables */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Memuat data...</div>
      ) : (
        <div className="space-y-6">
          {data?.buckets.map((bucket, bi) => (
            <Card key={bucket.key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BUCKET_COLORS[bi] }} />
                    {bucket.label}
                  </CardTitle>
                  <Badge variant="outline" style={{ color: BUCKET_COLORS[bi], borderColor: BUCKET_COLORS[bi] }}>
                    {bucket.count} incident
                  </Badge>
                </div>
              </CardHeader>
              {bucket.incidents.length > 0 && (
                <CardContent className="pt-0">
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-600 w-10">#</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Detail</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Kategori</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Umur</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Tanggal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bucket.incidents.map(inc => (
                          <tr key={inc.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400 font-mono">#{inc.id}</td>
                            <td className="px-3 py-2 text-gray-700 max-w-xs">
                              <p className="truncate">{inc.detail}</p>
                              {inc.needsFurtherAction && (
                                <span className="text-xs text-orange-600 flex items-center gap-0.5 mt-0.5">
                                  <AlertTriangle className="w-3 h-3" />Perlu tindak lanjut
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-500">{inc.categoryName || "—"}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[inc.status] ?? "bg-gray-100 text-gray-600"}`}>
                                {inc.status === "resolved" && <CheckCircle className="w-3 h-3 mr-1" />}
                                {STATUS_LABELS[inc.status] ?? inc.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-500 font-mono text-xs">{inc.ageHours}j</td>
                            <td className="px-3 py-2 text-gray-400 text-xs">{inc.incidentDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
              {bucket.incidents.length === 0 && (
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Tidak ada incident dalam rentang waktu ini
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
