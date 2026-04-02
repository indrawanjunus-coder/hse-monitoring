import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, AlertCircle, Printer, Users, User, Calendar, TrendingUp } from "lucide-react";

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
  lastInspectedAt: string | null;
  status: "compliant" | "partial" | "none";
}
interface ComplianceReport {
  rows: ScheduleCompliance[];
  summary: { total: number; compliant: number; partial: number; none: number; avgRate: number };
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

export default function ScheduleCompliancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [to, setTo] = useState(today);
  const [appliedTo, setAppliedTo] = useState(today);
  const [filterStatus, setFilterStatus] = useState<"all" | "compliant" | "partial" | "none">("all");
  const [filterFreq, setFilterFreq] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<ComplianceReport>({
    queryKey: ["reports", "schedule-compliance", appliedTo],
    queryFn: () => api.get(`/reports/schedule-compliance?to=${appliedTo}`),
  });

  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter(r => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterFreq !== "all" && r.frequency !== filterFreq) return false;
      if (search && !r.title.toLowerCase().includes(search.toLowerCase()) &&
          !r.plantName.toLowerCase().includes(search.toLowerCase()) &&
          !r.assignedTo.some(a => a.name.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [data, filterStatus, filterFreq, search]);

  const handleApply = () => setAppliedTo(to);
  const handlePrint = () => window.print();

  const s = data?.summary;

  return (
    <div className="p-6 print:p-4">
      <PageHeader
        title="Laporan Kepatuhan Jadwal Inspeksi"
        subtitle="Rekap pelaksanaan vs target inspeksi per jadwal"
        action={
          <Button variant="outline" onClick={handlePrint} className="print:hidden">
            <Printer className="w-4 h-4 mr-2" /> Cetak
          </Button>
        }
      />

      {/* Filter */}
      <div className="bg-white border rounded-lg p-3 mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">Sampai Tanggal</p>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={handleApply} size="sm">Tampilkan</Button>
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">Status</p>
          <Select value={filterStatus} onValueChange={v => setFilterStatus(v as typeof filterStatus)}>
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
          <Select value={filterFreq} onValueChange={setFilterFreq}>
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
        <div className="space-y-1 flex-1 min-w-[160px]">
          <p className="text-xs font-medium text-gray-500">Cari Jadwal / Plant / PIC</p>
          <Input placeholder="Ketik untuk cari..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Summary Cards */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Card className="col-span-2 md:col-span-1">
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

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Memuat data...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Tidak ada data jadwal yang ditemukan</div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 min-w-[200px]">Jadwal Inspeksi</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Frekuensi</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">PIC / Group</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Plant</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Seharusnya</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Terlaksana</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Kepatuhan</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Terakhir Dikerjakan</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => {
                  const sm = STATUS_META[r.status];
                  const StatusIcon = sm.icon;
                  const barPct = Math.min(100, r.complianceRate);
                  return (
                    <tr key={r.scheduleId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{r.title}</p>
                        <p className="text-xs text-gray-400">{r.templateName}</p>
                        <p className="text-xs text-gray-400">
                          <Calendar className="w-3 h-3 inline mr-0.5" />
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
                      <td className="px-4 py-3 text-center min-w-[100px]">
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
          <div className="border-t px-4 py-2 bg-gray-50 text-xs text-gray-500">
            Menampilkan {rows.length} dari {data?.rows.length ?? 0} jadwal · Data dihitung dari tanggal jadwal dibuat hingga {new Date(appliedTo).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
          </div>
        </div>
      )}
    </div>
  );
}
