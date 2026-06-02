import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const API_BASE = "/api";
function sysApi() {
  return {
    get: async <T,>(path: string): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  };
}

interface AuditLog {
  id: number;
  action: string;
  performedByNik: string;
  performedByName: string;
  companyId: number | null;
  companyName: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_META: Record<string, { label: string; color: string }> = {
  ACTIVATE_COMPANY:  { label: "Aktifkan Perusahaan", color: "bg-green-100 text-green-700" },
  SUSPEND_COMPANY:   { label: "Tangguhkan Perusahaan", color: "bg-red-100 text-red-700" },
  EDIT_EXPIRY:       { label: "Edit Tanggal Berakhir", color: "bg-blue-100 text-blue-700" },
  APPROVE_PAYMENT:   { label: "Setujui Pembayaran", color: "bg-emerald-100 text-emerald-700" },
  REJECT_PAYMENT:    { label: "Tolak Pembayaran", color: "bg-orange-100 text-orange-700" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function SysadminAudit() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["sys-audit-logs"],
    queryFn: () => sysApi().get<AuditLog[]>("/sysadmin/audit-logs?limit=500"),
    refetchInterval: 30_000,
  });

  const filtered = logs.filter(l => {
    const matchSearch = !search.trim() ||
      l.companyName?.toLowerCase().includes(search.toLowerCase()) ||
      l.performedByName.toLowerCase().includes(search.toLowerCase()) ||
      l.performedByNik.toLowerCase().includes(search.toLowerCase()) ||
      l.details?.toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === "all" || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" /> Log Audit Sistem
        </h1>
        <span className="text-xs text-gray-400">{filtered.length} entri</span>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            className="pl-8 bg-white"
            placeholder="Cari perusahaan, operator..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-52 bg-white">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
            <SelectValue placeholder="Semua aksi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua aksi</SelectItem>
            {Object.entries(ACTION_META).map(([key, meta]) => (
              <SelectItem key={key} value={key}>{meta.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Memuat...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p>Belum ada log audit</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Waktu", "Aksi", "Perusahaan", "Operator", "Detail"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(log => {
                const meta = ACTION_META[log.action] ?? { label: log.action, color: "bg-gray-100 text-gray-700" };
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.companyName ? (
                        <div>
                          <div className="font-medium text-gray-900 text-xs">{log.companyName}</div>
                          {log.companyId && <div className="text-xs text-gray-400">ID #{log.companyId}</div>}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 text-xs">{log.performedByName}</div>
                      <div className="text-xs text-gray-400">{log.performedByNik}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-xs">
                      <span className="line-clamp-2">{log.details ?? "-"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
