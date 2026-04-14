import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle, XCircle, AlertCircle, ChevronDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API_BASE = "/api";
function sysApi(token: string) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  return {
    get: async <T>(path: string): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    put: async <T>(path: string, body: unknown): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { method: "PUT", headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    post: async <T>(path: string, body: unknown): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  };
}

interface Company {
  id: number; slug: string; name: string; contactName: string; contactEmail: string;
  plan: string; status: string; activatedAt: string | null; subscriptionEndsAt: string | null;
  trialEndsAt: string | null; createdAt: string; userCount: number; pendingPaymentCount: number;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Menunggu", className: "bg-amber-100 text-amber-700" },
  active: { label: "Aktif", className: "bg-green-100 text-green-700" },
  suspended: { label: "Ditangguhkan", className: "bg-red-100 text-red-700" },
};
const PLAN_BADGE: Record<string, string> = {
  free: "bg-gray-100 text-gray-700",
  monthly: "bg-blue-100 text-blue-700",
  yearly: "bg-purple-100 text-purple-700",
};

function fmt(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

interface ActivateDialogProps {
  company: Company;
  token: string;
  onClose: () => void;
}
function ActivateDialog({ company, token, onClose }: ActivateDialogProps) {
  const [plan, setPlan] = useState(company.plan || "monthly");
  const [months, setMonths] = useState("1");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const activate = async () => {
    setError("");
    setLoading(true);
    try {
      await sysApi(token).post(`/sysadmin/companies/${company.id}/activate`, { plan, months: parseInt(months), note });
      qc.invalidateQueries({ queryKey: ["sys-companies"] });
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Aktifkan: {company.name}</DialogTitle>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Paket</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Gratis</SelectItem>
                <SelectItem value="monthly">Bulanan</SelectItem>
                <SelectItem value="yearly">Tahunan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {plan !== "free" && (
            <div className="space-y-1.5">
              <Label>Durasi (bulan)</Label>
              <Input type="number" min="1" max="24" value={months} onChange={e => setMonths(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Catatan (opsional)</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Catatan aktivasi..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={activate} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
            {loading ? "Memproses..." : "Aktifkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SysadminCompanies({ token }: { token: string }) {
  const [activateTarget, setActivateTarget] = useState<Company | null>(null);
  const [detail, setDetail] = useState<Company | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const qc = useQueryClient();

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["sys-companies"],
    queryFn: () => sysApi(token).get<Company[]>("/sysadmin/companies"),
  });

  const suspend = useMutation({
    mutationFn: (id: number) => sysApi(token).post(`/sysadmin/companies/${id}/suspend`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sys-companies"] }),
  });

  const filtered = companies.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const now = new Date();
  const stats = {
    total: companies.length,
    active: companies.filter(c => c.status === "active").length,
    pending: companies.filter(c => c.status === "pending").length,
    expired: companies.filter(c => c.status === "active" && c.subscriptionEndsAt && new Date(c.subscriptionEndsAt) < now).length,
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" /> Manajemen Perusahaan
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: stats.total, color: "text-gray-900" },
          { label: "Aktif", value: stats.active, color: "text-green-600" },
          { label: "Pending", value: stats.pending, color: "text-amber-600" },
          { label: "Expired", value: stats.expired, color: "text-red-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Input placeholder="Cari perusahaan..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs bg-white" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="suspended">Ditangguhkan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Memuat...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Tidak ada perusahaan</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Perusahaan", "Kontak", "Paket", "Status", "Berakhir", "User", "Aksi"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(co => {
                const sb = STATUS_BADGE[co.status] ?? { label: co.status, className: "bg-gray-100 text-gray-700" };
                const isExpired = co.status === "active" && co.subscriptionEndsAt && new Date(co.subscriptionEndsAt) < now;
                return (
                  <tr key={co.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{co.name}</div>
                      <div className="text-xs text-gray-400">/c/{co.slug}/</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{co.contactName}</div>
                      <div className="text-xs text-gray-400">{co.contactEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PLAN_BADGE[co.plan] ?? ""}`}>{co.plan}</span>
                      {co.pendingPaymentCount > 0 && (
                        <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">{co.pendingPaymentCount} pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sb.className}`}>{sb.label}</span>
                      {isExpired && <div className="text-xs text-red-500 mt-0.5">Expired</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{fmt(co.subscriptionEndsAt ?? co.trialEndsAt)}</td>
                    <td className="px-4 py-3 text-gray-600">{co.userCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActivateTarget(co)}
                          className="h-7 text-xs"
                        >
                          Aktifkan
                        </Button>
                        {co.status !== "suspended" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => suspend.mutate(co.id)}
                            className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          >
                            Tangguhkan
                          </Button>
                        )}
                        <a
                          href={`/c/${co.slug}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-600"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {activateTarget && (
        <ActivateDialog
          company={activateTarget}
          token={token}
          onClose={() => setActivateTarget(null)}
        />
      )}
    </div>
  );
}
