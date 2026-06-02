import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle, XCircle, AlertCircle, ChevronDown, ExternalLink, CalendarDays, Mail, RefreshCw, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const API_BASE = "/api";
function sysApi() {
  const headers = { "Content-Type": "application/json" };
  return {
    get: async <T,>(path: string): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { credentials: "include", headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    put: async <T,>(path: string, body: unknown): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { method: "PUT", credentials: "include", headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    post: async <T,>(path: string, body: unknown): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { method: "POST", credentials: "include", headers, body: JSON.stringify(body) });
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

interface ActivateResult {
  company: { status: string; plan: string };
  adminProvisioned: { alreadyExists: boolean; nik: string | null } | null;
}

interface ResendResult {
  success: boolean; created: boolean; nik: string | null; emailSentTo: string;
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
  onClose: () => void;
}
function ActivateDialog({ company, onClose }: ActivateDialogProps) {
  const [plan, setPlan] = useState(company.plan || "monthly");
  const [months, setMonths] = useState("1");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ActivateResult | null>(null);
  const qc = useQueryClient();

  const activate = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await sysApi().post<ActivateResult>(`/sysadmin/companies/${company.id}/activate`, { plan, months: parseInt(months), note });
      setResult(res);
      qc.invalidateQueries({ queryKey: ["sys-companies"] });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    const ap = result.adminProvisioned;
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" /> Aktivasi Berhasil
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-700">
              <strong>{company.name}</strong> telah diaktifkan dengan paket <strong className="capitalize">{plan}</strong>.
            </p>
            {ap && !ap.alreadyExists && ap.nik ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-semibold text-green-800 text-sm">
                  <UserCheck className="w-4 h-4" /> Akun Admin Dibuat
                </div>
                <div className="text-sm text-gray-700 space-y-1">
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-24 shrink-0">NIK (Login)</span>
                    <strong className="font-mono text-base text-green-800 tracking-wide">{ap.nik}</strong>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-24 shrink-0">Dikirim ke</span>
                    <span className="text-gray-800">{company.contactEmail}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 mt-2 pt-2 border-t border-green-200">
                  <Mail className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-green-700">Email berisi kredensial login telah dikirimkan ke alamat email di atas.</p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                Akun admin sudah ada sebelumnya. Kredensial tidak berubah.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={onClose} className="bg-green-600 hover:bg-green-700 text-white w-full">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Aktifkan: {company.name}</DialogTitle>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-4 py-2">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
            <Mail className="w-3.5 h-3.5 inline mr-1" />
            Akun admin akan otomatis dibuat dan kredensial dikirim ke <strong>{company.contactEmail}</strong>
          </div>
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
          {plan !== "free" && plan !== "yearly" && (
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

interface EditExpiryDialogProps {
  company: Company;
  onClose: () => void;
}
function EditExpiryDialog({ company, onClose }: EditExpiryDialogProps) {
  const currentExpiry = company.subscriptionEndsAt
    ? new Date(company.subscriptionEndsAt).toISOString().slice(0, 10)
    : "";
  const [expiryDate, setExpiryDate] = useState(currentExpiry);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const save = async () => {
    if (!expiryDate) { setError("Tanggal berakhir wajib diisi"); return; }
    setError("");
    setLoading(true);
    try {
      await sysApi().post(`/sysadmin/companies/${company.id}/edit-expiry`, {
        subscriptionEndsAt: new Date(expiryDate).toISOString(),
        note: note.trim() || undefined,
      });
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
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            Edit Tanggal Berakhir: {company.name}
          </DialogTitle>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Tanggal Berakhir Baru</Label>
            <Input
              type="date"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
            />
            {currentExpiry && (
              <p className="text-xs text-gray-400">Saat ini: {fmt(company.subscriptionEndsAt)}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Catatan (opsional)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Alasan perubahan tanggal..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={save} disabled={loading || !expiryDate} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ResendCredentialsDialogProps {
  company: Company;
  onClose: () => void;
}
function ResendCredentialsDialog({ company, onClose }: ResendCredentialsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResendResult | null>(null);

  const resend = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await sysApi().post<ResendResult>(`/sysadmin/companies/${company.id}/resend-credentials`, {});
      setResult(res);
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
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            Kirim Ulang Kredensial Admin
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 py-2">
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 font-semibold text-green-800 text-sm">
                <CheckCircle className="w-4 h-4" /> Email Berhasil Dikirim
              </div>
              <div className="text-sm text-gray-700 space-y-1">
                <div className="flex gap-2">
                  <span className="text-gray-500 w-24 shrink-0">NIK Admin</span>
                  <strong className="font-mono text-green-800">{result.nik}</strong>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 w-24 shrink-0">Dikirim ke</span>
                  <span>{result.emailSentTo}</span>
                </div>
                {result.created && (
                  <p className="text-xs text-blue-700 mt-1">Admin baru dibuat karena belum ada akun admin sebelumnya.</p>
                )}
              </div>
            </div>
            <Button onClick={onClose} className="w-full">Tutup</Button>
          </div>
        ) : (
          <>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="py-2 space-y-3">
              <p className="text-sm text-gray-600">
                Password admin <strong>{company.name}</strong> akan direset dan kredensial baru dikirimkan ke:
              </p>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm font-medium text-gray-800">
                {company.contactEmail}
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                ⚠️ Password admin yang lama akan dinonaktifkan.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
              <Button onClick={resend} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                {loading ? "Mengirim..." : "Kirim Ulang"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function SysadminCompanies() {
  const [activateTarget, setActivateTarget] = useState<Company | null>(null);
  const [editExpiryTarget, setEditExpiryTarget] = useState<Company | null>(null);
  const [resendTarget, setResendTarget] = useState<Company | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const qc = useQueryClient();

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["sys-companies"],
    queryFn: () => sysApi().get<Company[]>("/sysadmin/companies"),
  });

  const suspend = useMutation({
    mutationFn: (id: number) => sysApi().post(`/sysadmin/companies/${id}/suspend`, {}),
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
                    <td className="px-4 py-3 text-xs">
                      <button
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                        title="Edit tanggal berakhir"
                        onClick={() => setEditExpiryTarget(co)}
                      >
                        <CalendarDays className="w-3 h-3" />
                        {fmt(co.subscriptionEndsAt ?? co.trialEndsAt)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{co.userCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActivateTarget(co)}
                          className="h-7 text-xs"
                        >
                          Aktifkan
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setResendTarget(co)}
                          className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                          title="Kirim ulang kredensial admin"
                        >
                          <Mail className="w-3 h-3 mr-1" /> Kredensial
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
          onClose={() => setActivateTarget(null)}
        />
      )}
      {editExpiryTarget && (
        <EditExpiryDialog
          company={editExpiryTarget}
          onClose={() => setEditExpiryTarget(null)}
        />
      )}
      {resendTarget && (
        <ResendCredentialsDialog
          company={resendTarget}
          onClose={() => setResendTarget(null)}
        />
      )}
    </div>
  );
}
