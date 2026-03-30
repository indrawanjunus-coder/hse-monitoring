import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Trash2, RefreshCw, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";

interface LogEntry {
  id: number;
  level: string;
  method?: string | null;
  url?: string | null;
  statusCode?: number | null;
  userId?: number | null;
  userNik?: string | null;
  userName?: string | null;
  errorMessage?: string | null;
  summary?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

interface LogsResponse {
  data: LogEntry[];
  total: number;
  limit: number;
  offset: number;
}

function LevelBadge({ level }: { level: string }) {
  if (level === "error") return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">ERROR</Badge>;
  if (level === "warn") return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">WARN</Badge>;
  return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">INFO</Badge>;
}

function StatusBadge({ code }: { code?: number | null }) {
  if (!code) return null;
  const color = code >= 500 ? "text-red-600" : code >= 400 ? "text-yellow-600" : "text-green-600";
  return <span className={`font-mono text-xs font-semibold ${color}`}>{code}</span>;
}

function MethodBadge({ method }: { method?: string | null }) {
  if (!method) return null;
  const colors: Record<string, string> = {
    GET: "bg-gray-100 text-gray-600",
    POST: "bg-green-100 text-green-700",
    PUT: "bg-blue-100 text-blue-700",
    PATCH: "bg-indigo-100 text-indigo-700",
    DELETE: "bg-red-100 text-red-700",
  };
  return <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold ${colors[method] ?? "bg-gray-100 text-gray-600"}`}>{method}</span>;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const PAGE_SIZE = 50;

export default function LogsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [level, setLevel] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);

  if (user?.role !== "admin") {
    setLocation("/");
    return null;
  }

  const params = new URLSearchParams();
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));
  if (level !== "all") params.set("level", level);
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  const { data, isLoading, refetch, isFetching } = useQuery<LogsResponse>({
    queryKey: ["logs", level, debouncedSearch, dateFrom, dateTo, offset],
    queryFn: () => api.get(`/logs?${params.toString()}`),
    refetchInterval: 15_000,
  });

  const clearMutation = useMutation({
    mutationFn: () => api.del("/logs/clear"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs"] });
      toast({ title: "Log dihapus" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any).__logSearchTimeout);
    (window as any).__logSearchTimeout = setTimeout(() => {
      setDebouncedSearch(v);
      setOffset(0);
    }, 400);
  };

  const resetFilters = () => {
    setLevel("all");
    setSearch("");
    setDebouncedSearch("");
    setDateFrom("");
    setDateTo("");
    setOffset(0);
  };

  const errorCount = data?.data.filter(l => l.level === "error").length ?? 0;
  const warnCount = data?.data.filter(l => l.level === "warn").length ?? 0;

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Log Sistem"
        subtitle={`Riwayat aktivitas & error API. Total: ${data?.total ?? "..."} entri`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="destructive" size="sm"
              onClick={() => { if (confirm("Hapus semua log? Ini tidak bisa dikembalikan.")) clearMutation.mutate(); }}
              disabled={clearMutation.isPending}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Hapus Semua Log
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 items-center bg-white border rounded-lg p-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Cari URL, user, pesan error..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
        <Select value={level} onValueChange={v => { setLevel(v); setOffset(0); }}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Level</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Dari:</span>
          <Input type="date" className="h-8 text-sm w-36" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setOffset(0); }} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">s/d:</span>
          <Input type="date" className="h-8 text-sm w-36" value={dateTo} onChange={e => { setDateTo(e.target.value); setOffset(0); }} />
        </div>
        {(level !== "all" || debouncedSearch || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>Reset filter</Button>
        )}
      </div>

      {errorCount > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{errorCount}</strong> error ditemukan di halaman ini</span>
        </div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium w-36">Waktu</th>
              <th className="text-left px-3 py-2.5 font-medium w-16">Level</th>
              <th className="text-left px-3 py-2.5 font-medium w-16">Method</th>
              <th className="text-left px-3 py-2.5 font-medium w-14">Status</th>
              <th className="text-left px-3 py-2.5 font-medium">Aksi / URL</th>
              <th className="text-left px-3 py-2.5 font-medium w-28">User</th>
              <th className="text-left px-3 py-2.5 font-medium">Pesan Error</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Memuat log...</td></tr>
            ) : !data?.data.length ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Tidak ada log ditemukan</td></tr>
            ) : data.data.map(log => (
              <tr key={log.id} className={`border-b last:border-0 hover:bg-gray-50/70 ${log.level === "error" ? "bg-red-50/30" : log.level === "warn" ? "bg-yellow-50/20" : ""}`}>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatTime(log.createdAt)}</td>
                <td className="px-3 py-2"><LevelBadge level={log.level} /></td>
                <td className="px-3 py-2"><MethodBadge method={log.method} /></td>
                <td className="px-3 py-2"><StatusBadge code={log.statusCode} /></td>
                <td className="px-3 py-2">
                  <p className="font-medium text-gray-800">{log.summary ?? "-"}</p>
                  <p className="text-gray-400 font-mono truncate max-w-xs">{log.url}</p>
                </td>
                <td className="px-3 py-2">
                  {log.userNik ? (
                    <div>
                      <p className="font-semibold text-gray-700">{log.userNik}</p>
                      <p className="text-gray-400">{log.userName}</p>
                    </div>
                  ) : <span className="text-gray-300">-</span>}
                </td>
                <td className="px-3 py-2 text-red-600 max-w-xs">{log.errorMessage ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Halaman {currentPage} dari {totalPages} ({data?.total} entri)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              ← Sebelumnya
            </Button>
            <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= (data?.total ?? 0)} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Berikutnya →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
