import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API_BASE = "/api";
function sysApi(token: string) {
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  return {
    get: async <T,>(path: string): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { headers: h });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    put: async <T,>(path: string, body: unknown): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { method: "PUT", headers: h, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  };
}

interface Payment {
  id: number; companyId: number; companyName: string; companySlug: string;
  plan: string; amount: number; periodMonths: number; status: string;
  proofViewUrl: string | null; proofFileName: string | null;
  submittedAt: string; reviewedAt: string | null; reviewedByNote: string | null;
}

const STATUS = {
  pending: { label: "Menunggu", icon: Clock, className: "bg-amber-100 text-amber-700" },
  approved: { label: "Disetujui", icon: CheckCircle, className: "bg-green-100 text-green-700" },
  rejected: { label: "Ditolak", icon: XCircle, className: "bg-red-100 text-red-700" },
};

function fmt(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

export default function SysadminPayments({ token }: { token: string }) {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewTarget, setReviewTarget] = useState<Payment | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["sys-payments", statusFilter],
    queryFn: () => sysApi(token).get<Payment[]>(`/sysadmin/payments${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
  });

  const review = async (action: "approve" | "reject") => {
    if (!reviewTarget) return;
    setError(""); setLoading(true);
    try {
      await sysApi(token).put(`/sysadmin/payments/${reviewTarget.id}/${action}`, { note });
      qc.invalidateQueries({ queryKey: ["sys-payments"] });
      setReviewTarget(null);
      setNote("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pendingCount = payments.filter(p => p.status === "pending").length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-600" /> Manajemen Pembayaran
        </h1>
        {pendingCount > 0 && statusFilter === "pending" && (
          <span className="bg-amber-100 text-amber-700 text-xs font-medium px-3 py-1 rounded-full">
            {pendingCount} menunggu verifikasi
          </span>
        )}
      </div>

      <div className="flex gap-3 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="approved">Disetujui</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Memuat...</div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Tidak ada pembayaran</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Perusahaan", "Paket", "Nominal", "Bukti", "Tanggal", "Status", "Aksi"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map(p => {
                const s = STATUS[p.status as keyof typeof STATUS] ?? { label: p.status, className: "bg-gray-100 text-gray-600", icon: Clock };
                const Icon = s.icon;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.companyName}</div>
                      <div className="text-xs text-gray-400">/c/{p.companySlug}/</div>
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-700">{p.plan} · {p.periodMonths} bln</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{fmtRp(p.amount)}</td>
                    <td className="px-4 py-3">
                      {p.proofViewUrl ? (
                        <a href={p.proofViewUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                          Lihat <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmt(p.submittedAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${s.className}`}>
                        <Icon className="w-3 h-3" />{s.label}
                      </span>
                      {p.reviewedByNote && <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{p.reviewedByNote}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {p.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => { setReviewTarget(p); setNote(""); }} className="h-7 text-xs">
                          Review
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {reviewTarget && (
        <Dialog open onOpenChange={() => setReviewTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Review Pembayaran</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="p-4 bg-gray-50 rounded-lg text-sm space-y-1">
                <div><span className="text-gray-500">Perusahaan:</span> <span className="font-medium">{reviewTarget.companyName}</span></div>
                <div><span className="text-gray-500">Paket:</span> <span className="capitalize">{reviewTarget.plan} · {reviewTarget.periodMonths} bulan</span></div>
                <div><span className="text-gray-500">Nominal:</span> <span className="font-medium">{fmtRp(reviewTarget.amount)}</span></div>
              </div>
              {reviewTarget.proofViewUrl && (
                <a href={reviewTarget.proofViewUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <ExternalLink className="w-4 h-4" /> Lihat bukti transfer
                </a>
              )}
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="space-y-1.5">
                <Label>Catatan (opsional)</Label>
                <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Catatan review..." />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setReviewTarget(null)} disabled={loading}>Batal</Button>
              <Button onClick={() => review("reject")} disabled={loading} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                {loading ? "..." : "Tolak"}
              </Button>
              <Button onClick={() => review("approve")} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
                {loading ? "..." : "✓ Lunas"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
