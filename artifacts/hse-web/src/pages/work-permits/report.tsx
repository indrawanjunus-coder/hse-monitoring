import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  QrCode, FileCheck, CheckCircle, XCircle, Clock,
  Search, ChevronDown, ChevronUp, Shield,
} from "lucide-react";

// ---- Types ----
interface ApprovalEntry {
  workPermitId: number;
  userId: number;
  status: "pending" | "approved" | "rejected";
  approvedAt: string | null;
  notes: string | null;
  userName: string;
}

interface PermitRow {
  id: number;
  permitCode: string;
  name: string;
  phone: string;
  email: string;
  workStart: string;
  workEnd: string;
  supervisorName: string;
  notes: string | null;
  status: string;
  createdAt: string;
  typeId: number | null;
  typeName: string | null;
  approvals: ApprovalEntry[];
  scanCount: number;
}

interface ScanRow {
  scanId: number;
  scannedAt: string;
  permitId: number;
  permitCode: string;
  permitName: string;
  permitStatus: string;
  workStart: string;
  workEnd: string;
  typeName: string | null;
}

// ---- Helpers ----
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}
function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active")   return <Badge className="bg-green-100 text-green-700 border-green-200 border">Aktif</Badge>;
  if (status === "revoked")  return <Badge className="bg-red-100 text-red-700 border-red-200 border">Dicabut</Badge>;
  if (status === "pending")  return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 border">Menunggu Approval</Badge>;
  if (status === "rejected") return <Badge className="bg-red-100 text-red-700 border-red-200 border">Ditolak</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-gray-200 border">Kadaluarsa</Badge>;
}

function ApprovalChainInline({ approvals }: { approvals: ApprovalEntry[] }) {
  if (approvals.length === 0) return <span className="text-xs text-gray-400 italic">Tanpa approval</span>;
  const approved = approvals.filter(a => a.status === "approved").length;
  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-500 font-medium">{approved}/{approvals.length} disetujui</p>
      {approvals.map((a, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          {a.status === "approved" && <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />}
          {a.status === "rejected" && <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />}
          {a.status === "pending"  && <Clock className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
          <span className={
            a.status === "approved" ? "text-green-700 font-medium" :
            a.status === "rejected" ? "text-red-700 font-medium" : "text-gray-500"
          }>{a.userName}</span>
          {a.status === "approved" && a.approvedAt && (
            <span className="text-gray-400">· {fmtDate(a.approvedAt)}</span>
          )}
        </div>
      ))}
      {/* Show rejection notes prominently */}
      {approvals.filter(a => a.status === "rejected" && a.notes).map((a, i) => (
        <div key={`note-${i}`} className="mt-1 bg-red-50 border border-red-100 rounded px-2 py-1 text-xs text-red-700">
          <span className="font-semibold">{a.userName}</span> menolak: {a.notes}
        </div>
      ))}
    </div>
  );
}

const STATUS_OPTIONS = ["all", "pending", "active", "expired", "revoked", "rejected"];
const STATUS_LABELS: Record<string, string> = {
  all: "Semua", pending: "Menunggu Approval", active: "Aktif",
  expired: "Kadaluarsa", revoked: "Dicabut", rejected: "Ditolak",
};

// ---- Tab 1: Semua Permit ----
function AllPermitsTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: permits = [], isLoading } = useQuery<PermitRow[]>({
    queryKey: ["work-permits-full-report"],
    queryFn: () => api.get("/work-permits/full-report"),
    refetchInterval: 30_000,
  });

  const filtered = permits.filter(p => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.typeName ?? "").toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // Stats
  const counts = {
    all: permits.length,
    pending: permits.filter(p => p.status === "pending").length,
    active: permits.filter(p => p.status === "active").length,
    expired: permits.filter(p => p.status === "expired").length,
    revoked: permits.filter(p => p.status === "revoked").length,
    rejected: permits.filter(p => p.status === "rejected").length,
  };

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg border p-3 text-center cursor-pointer transition-all ${
              statusFilter === s ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <p className={`text-xl font-bold ${statusFilter === s ? "text-blue-700" : "text-gray-800"}`}>
              {s === "all" ? counts.all : counts[s as keyof typeof counts]}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{STATUS_LABELS[s]}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, email, atau tipe pekerjaan..." className="pl-9" />
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Memuat data...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <FileCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Tidak ada permit yang sesuai filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nama</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Tipe</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Periode Kerja</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Approval</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Scan</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Dibuat</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(p => {
                  const expanded = expandedId === p.id;
                  const rejectedBy = p.approvals.find(a => a.status === "rejected");
                  return (
                    <>
                      <tr
                        key={p.id}
                        className={`hover:bg-gray-50 cursor-pointer ${expanded ? "bg-blue-50/40" : ""}`}
                        onClick={() => setExpandedId(expanded ? null : p.id)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.email}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{p.typeName ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                          {p.workStart}<br /><span className="text-gray-400">s/d</span> {p.workEnd}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                        <td className="px-4 py-3">
                          {p.approvals.length === 0 ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : (
                            <div className="flex items-center gap-1 text-xs">
                              <Shield className="w-3 h-3 text-blue-400" />
                              <span className="text-gray-600">
                                {p.approvals.filter(a => a.status === "approved").length}/{p.approvals.length}
                              </span>
                              {rejectedBy && (
                                <span className="text-red-600 font-medium">· Ditolak {rejectedBy.userName}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700 font-medium">{p.scanCount || "—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtShort(p.createdAt)}</td>
                        <td className="px-4 py-3 text-gray-400">
                          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                      </tr>
                      {expanded && (
                        <tr key={`${p.id}-detail`}>
                          <td colSpan={8} className="px-6 py-4 bg-blue-50/30 border-b border-blue-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Detail Permit</p>
                                <div className="space-y-1 text-sm">
                                  <div className="flex gap-2"><span className="text-gray-400 w-32">No. HP</span><span className="text-gray-800">{p.phone}</span></div>
                                  <div className="flex gap-2"><span className="text-gray-400 w-32">Atasan</span><span className="text-gray-800">{p.supervisorName}</span></div>
                                  {p.notes && <div className="flex gap-2"><span className="text-gray-400 w-32">Catatan</span><span className="text-gray-700 italic">{p.notes}</span></div>}
                                  <div className="flex gap-2"><span className="text-gray-400 w-32">Kode Permit</span><span className="font-mono text-xs text-gray-500">{p.permitCode.slice(0, 16)}…</span></div>
                                  <div className="flex gap-2"><span className="text-gray-400 w-32">Total Scan</span><span className="text-gray-800 font-medium">{p.scanCount}×</span></div>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Riwayat Approval</p>
                                <ApprovalChainInline approvals={p.approvals} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Tab 2: Riwayat Scan ----
function ScanHistoryTab() {
  const [search, setSearch] = useState("");
  const { data: scans = [], isLoading } = useQuery<ScanRow[]>({
    queryKey: ["work-permits-report"],
    queryFn: () => api.get("/work-permits/report"),
    refetchInterval: 30_000,
  });

  const filtered = scans.filter(s => {
    const q = search.toLowerCase();
    return !q || s.permitName.toLowerCase().includes(q) || (s.typeName ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau tipe..." className="pl-9" />
      </div>
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Memuat...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <QrCode className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Belum ada scan yang tercatat.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Waktu Scan</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nama</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Tipe Pekerjaan</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Periode Kerja</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status Permit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(s => (
                  <tr key={s.scanId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(s.scannedAt)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.permitName}</td>
                    <td className="px-4 py-3 text-gray-600">{s.typeName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.workStart} – {s.workEnd}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.permitStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main Page ----
export default function WorkPermitReportPage() {
  const [tab, setTab] = useState<"permits" | "scans">("permits");

  const { data: allPermits = [] } = useQuery<PermitRow[]>({
    queryKey: ["work-permits-full-report"],
    queryFn: () => api.get("/work-permits/full-report"),
    staleTime: 30_000,
  });
  const { data: scans = [] } = useQuery<ScanRow[]>({
    queryKey: ["work-permits-report"],
    queryFn: () => api.get("/work-permits/report"),
    staleTime: 30_000,
  });

  return (
    <div className="p-6">
      <PageHeader
        title="Laporan Work Permit"
        subtitle={`${allPermits.length} permit · ${scans.length} scan`}
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setTab("permits")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === "permits" ? "bg-white shadow-sm text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
        >
          <span className="flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            Semua Permit
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === "permits" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"}`}>
              {allPermits.length}
            </span>
          </span>
        </button>
        <button
          onClick={() => setTab("scans")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === "scans" ? "bg-white shadow-sm text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
        >
          <span className="flex items-center gap-2">
            <QrCode className="w-4 h-4" />
            Riwayat Scan
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === "scans" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"}`}>
              {scans.length}
            </span>
          </span>
        </button>
      </div>

      {tab === "permits" ? <AllPermitsTab /> : <ScanHistoryTab />}
    </div>
  );
}
