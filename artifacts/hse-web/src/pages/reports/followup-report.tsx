import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Clock, AlertTriangle, Printer } from "lucide-react";

interface BucketIncident {
  id: number; status: string; incidentDate: string; categoryName: string;
  plantName: string; reporterName: string; assignedGroupName?: string | null;
  actionName?: string | null; followupNote?: string | null;
  detail: string; needsFurtherAction: boolean; ageHours: number;
  createdAt: string; closedAt?: string | null;
}
interface Bucket { label: string; key: string; count: number; incidents: BucketIncident[] }
interface FollowupData { buckets: Bucket[]; total: number; open: number; inProgress: number; closed: number }

const BUCKET_META = [
  { color: "#3B82F6", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  { color: "#F59E0B", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  { color: "#EF4444", bg: "bg-red-50", border: "border-red-200", text: "text-red-700", badge: "bg-red-100 text-red-700 border-red-200" },
];
const STATUS_STYLES: Record<string, string> = {
  open: "bg-red-100 text-red-700 border-red-200",
  in_progress: "bg-yellow-100 text-yellow-700 border-yellow-200",
  closed: "bg-green-100 text-green-700 border-green-200",
};
const STATUS_LABELS: Record<string, string> = { open: "Terbuka", in_progress: "Proses", closed: "Selesai" };

export default function FollowupReportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [appliedFrom, setAppliedFrom] = useState<string | null>(null);
  const [appliedTo, setAppliedTo] = useState<string | null>(null);

  const { data, isLoading } = useQuery<FollowupData>({
    queryKey: ["reports", "followup", appliedFrom, appliedTo],
    queryFn: () => {
      const params = new URLSearchParams();
      if (appliedFrom) params.set("from", appliedFrom);
      if (appliedTo) params.set("to", appliedTo);
      return api.get(`/reports/followup?${params.toString()}`);
    },
    refetchInterval: 60_000,
  });

  const applyFilter = () => { setAppliedFrom(from); setAppliedTo(to); };
  const clearFilter = () => { setAppliedFrom(null); setAppliedTo(null); setFrom(monthStart); setTo(today); };

  return (
    <div className="p-6">
      <PageHeader
        title="Laporan Followup H&I"
        subtitle="Incident dikelompokkan berdasarkan waktu tindak lanjut"
        action={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />Cetak
          </Button>
        }
      />

      {/* Date range filter */}
      <Card className="mb-6 print:hidden">
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
            <Button size="sm" onClick={applyFilter}>Terapkan Filter</Button>
            {(appliedFrom || appliedTo) && (
              <Button size="sm" variant="outline" onClick={clearFilter}>Reset</Button>
            )}
            {appliedFrom && (
              <span className="text-xs text-blue-600">Filter: {appliedFrom} s/d {appliedTo}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Memuat data...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {data?.buckets.map((bucket, bi) => {
            const meta = BUCKET_META[bi] ?? BUCKET_META[0]!;
            return (
              <Card key={bucket.key} className={`border-t-4`} style={{ borderTopColor: meta.color }}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Clock className="w-4 h-4" style={{ color: meta.color }} />
                      {bucket.label}
                    </CardTitle>
                    <Badge variant="outline" className={`text-xs font-bold ${meta.badge}`}>
                      {bucket.count} incident
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {bucket.incidents.length === 0 ? (
                    <div className="flex items-center gap-2 py-6 justify-center text-sm text-gray-400">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      Tidak ada incident
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bucket.incidents.map(inc => (
                        <div key={inc.id} className={`rounded-lg border p-3 ${meta.bg} ${meta.border}`}>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="text-xs font-mono text-gray-500">#{inc.id} · {inc.incidentDate}</span>
                            <span className={`inline-flex text-xs px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0 ${STATUS_STYLES[inc.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {STATUS_LABELS[inc.status] ?? inc.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                            <div className="text-gray-500"><span className="font-medium text-gray-700">Kategori:</span> {inc.categoryName || "—"}</div>
                            <div className="text-gray-500"><span className="font-medium text-gray-700">Plant:</span> {inc.plantName || "—"}</div>
                            <div className="text-gray-500"><span className="font-medium text-gray-700">Pelapor:</span> {inc.reporterName || "—"}</div>
                            <div className="text-gray-500"><span className="font-medium text-gray-700">Group PIC:</span> {inc.assignedGroupName || "—"}</div>
                            <div className="col-span-2 text-gray-500"><span className="font-medium text-gray-700">Tindakan:</span> {inc.actionName || "—"}</div>
                          </div>
                          {inc.needsFurtherAction && (
                            <div className="mt-1.5 flex items-center gap-1 text-xs text-orange-600">
                              <AlertTriangle className="w-3 h-3" />Perlu tindak lanjut lanjutan
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
