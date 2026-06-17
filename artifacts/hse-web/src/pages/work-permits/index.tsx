import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { QRCodeSVG } from "qrcode.react";
import {
  Plus, X, FileText, QrCode, User, Phone, Mail, Calendar,
  ChevronDown, ChevronUp, Upload, Image as ImageIcon,
  CheckCircle, XCircle, Clock, AlertCircle, Shield,
  ChevronLeft, ChevronRight, Printer,
} from "lucide-react";

interface WorkPermitType { id: number; type: string; description: string; }
interface WorkPermit {
  id: number; permitCode: string; name: string; phone: string; email: string;
  emergencyName: string; emergencyPhone: string; workStart: string; workEnd: string;
  supervisorName: string; supervisorPhone: string; ktpUrl: string | null;
  photoUrl: string | null; notes: string | null; status: string;
  typeId: number | null; typeName: string | null; createdAt: string;
}
interface ApprovalRow {
  id: number; userId: number; status: string;
  approvedAt: string | null; notes: string | null;
  userName: string; userRole: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const slug = window.location.pathname.match(/^\/c\/([^/]+)/)?.[1] ?? "";

function scanUrl(code: string) {
  return `${window.location.origin}/c/${slug}/scan?code=${code}`;
}

function statusBadge(status: string) {
  if (status === "active")   return <Badge className="bg-green-100 text-green-700 border-green-200 border">Aktif</Badge>;
  if (status === "revoked")  return <Badge className="bg-red-100 text-red-700 border-red-200 border">Dicabut</Badge>;
  if (status === "pending")  return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 border">Menunggu Approval</Badge>;
  if (status === "rejected") return <Badge className="bg-red-100 text-red-700 border-red-200 border">Ditolak</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-gray-200 border">Kadaluarsa</Badge>;
}

const EMPTY_FORM = {
  name: "", phone: "", email: "", emergencyName: "", emergencyPhone: "",
  workStart: "", workEnd: "", supervisorName: "", supervisorPhone: "",
  notes: "", typeId: "",
};

function ApprovalChain({ permitId }: { permitId: number }) {
  const { data: approvals = [], isLoading } = useQuery<ApprovalRow[]>({
    queryKey: ["work-permit-approvals", permitId],
    queryFn: () => api.get(`/work-permits/${permitId}/approvals`),
    staleTime: 10000,
  });

  if (isLoading) return <div className="text-xs text-gray-400">Memuat approval...</div>;
  if (approvals.length === 0) return null;

  const approved = approvals.filter(a => a.status === "approved").length;
  const total = approvals.length;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-xs font-medium text-gray-600">Approval Chain ({approved}/{total} disetujui)</span>
      </div>
      <div className="space-y-1.5 pl-5">
        {approvals.map(a => (
          <div key={a.id} className="flex items-center gap-2 text-xs">
            {a.status === "approved" && <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
            {a.status === "rejected" && <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
            {a.status === "pending"  && <Clock className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />}
            <span className={`font-medium ${a.status === "approved" ? "text-green-700" : a.status === "rejected" ? "text-red-700" : "text-gray-600"}`}>
              {a.userName}
            </span>
            {a.status === "approved" && a.approvedAt && (
              <span className="text-gray-400">· {new Date(a.approvedAt).toLocaleDateString("id-ID", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}</span>
            )}
            {a.status === "rejected" && a.notes && (
              <span className="text-red-500 italic">· "{a.notes}"</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Colour helpers ────────────────────────────────────────────────────
function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function permitCardClass(p: WorkPermit): string {
  if (p.status === "expired" || p.status === "revoked")
    return "border-red-300 bg-red-50/30";
  if (p.status === "active") {
    if (p.workEnd <= getTomorrow()) return "border-yellow-300 bg-yellow-50/30";
    return "border-green-300 bg-green-50/20";
  }
  if (p.status === "pending") return "border-yellow-200";
  return "";
}

function permitIconBg(p: WorkPermit): string {
  if (p.status === "expired" || p.status === "revoked") return "bg-red-100";
  if (p.status === "active") {
    if (p.workEnd <= getTomorrow()) return "bg-yellow-100";
    return "bg-green-100";
  }
  if (p.status === "pending") return "bg-yellow-50";
  return "bg-gray-100";
}

function permitIconColor(p: WorkPermit): string {
  if (p.status === "expired" || p.status === "revoked") return "text-red-500";
  if (p.status === "active") {
    if (p.workEnd <= getTomorrow()) return "text-yellow-600";
    return "text-green-600";
  }
  if (p.status === "pending") return "text-yellow-600";
  return "text-gray-400";
}
// ──────────────────────────────────────────────────────────────────────

export default function WorkPermitsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user, token } = useAuth() as any;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pagination
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);

  // Status filter
  const [statusFilter, setStatusFilter] = useState("all");

  // Reject dialog
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  // Print / PDF
  const [printPermit, setPrintPermit] = useState<WorkPermit | null>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const triggerPrint = useCallback((p: WorkPermit) => {
    setPrintPermit(p);
    setTimeout(() => {
      const area = printAreaRef.current;
      if (!area) return;
      const svgEl = area.querySelector("svg");
      const qrSvg = svgEl ? svgEl.outerHTML : "";
      const qrUrl = scanUrl(p.permitCode);
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Work Permit — ${p.name}</title>
<style>
  body{font-family:sans-serif;padding:32px;max-width:680px;margin:0 auto;color:#1e293b;}
  h1{font-size:22px;margin:0 0 4px;}
  .sub{font-size:13px;color:#64748b;margin-bottom:20px;}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;}
  td{padding:7px 4px;vertical-align:top;}
  td:first-child{color:#64748b;width:180px;font-size:13px;}
  td:last-child{font-weight:600;}
  tr:nth-child(even){background:#f8fafc;}
  .badge{display:inline-block;background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:700;margin-bottom:16px;}
  .qr-box{text-align:center;margin-top:24px;padding:24px;border:1px solid #e2e8f0;border-radius:10px;}
  .qr-box svg{max-width:180px;height:auto;}
  .code{font-family:monospace;font-size:12px;color:#94a3b8;word-break:break-all;margin-top:10px;}
  .link{font-size:12px;color:#2563eb;word-break:break-all;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;}
  .brand{font-size:11px;color:#94a3b8;font-weight:600;letter-spacing:.06em;text-transform:uppercase;}
  hr{border:none;border-top:1px solid #e2e8f0;margin:20px 0;}
  @media print{button{display:none;}}
</style></head><body>
<div class="brand">H&amp;A Monitoring System · Work Permit</div>
<div class="header">
  <div>
    <h1>${p.name}</h1>
    <div class="sub">${p.typeName ?? "—"}</div>
  </div>
  <span class="badge">✓ Permit Aktif</span>
</div>
<table>
  <tr><td>No. HP</td><td>${p.phone}</td></tr>
  <tr><td>Email</td><td>${p.email}</td></tr>
  <tr><td>Periode Kerja</td><td>${p.workStart} s/d ${p.workEnd}</td></tr>
  <tr><td>Atasan</td><td>${p.supervisorName} · ${p.supervisorPhone}</td></tr>
  <tr><td>Kontak Darurat</td><td>${p.emergencyName} · ${p.emergencyPhone}</td></tr>
  ${p.notes ? `<tr><td>Catatan</td><td>${p.notes}</td></tr>` : ""}
</table>
<div class="qr-box">
  <div style="font-size:13px;color:#64748b;font-weight:600;margin-bottom:12px;">QR Code — Scan untuk Verifikasi</div>
  ${qrSvg}
  <div class="link" style="margin-top:10px;">${qrUrl}</div>
  <div class="code">Kode Permit: ${p.permitCode}</div>
</div>
<hr/>
<div style="font-size:11px;color:#94a3b8;text-align:center;">Dicetak otomatis dari H&amp;A Monitoring System · ${new Date().toLocaleString("id-ID")}</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;
      const win = window.open("", "_blank", "width=800,height=900");
      if (win) { win.document.write(html); win.document.close(); }
      setTimeout(() => setPrintPermit(null), 500);
    }, 80);
  }, []);

  const { data: permits = [], isLoading } = useQuery<WorkPermit[]>({
    queryKey: ["work-permits"],
    queryFn: () => api.get("/work-permits"),
  });
  const { data: types = [] } = useQuery<WorkPermitType[]>({
    queryKey: ["work-permit-types"],
    queryFn: () => api.get("/work-permit-types"),
  });
  const { data: myApprovals = [] } = useQuery<WorkPermit[]>({
    queryKey: ["work-permits-my-approvals"],
    queryFn: () => api.get("/work-permits/my-approvals"),
    refetchInterval: 30000,
  });

  const revokeMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.put(`/work-permits/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work-permits"] }); toast({ title: "Status permit diupdate" }); },
    onError: (e: any) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/work-permits/${id}/approve`, {}),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["work-permits"] });
      qc.invalidateQueries({ queryKey: ["work-permits-my-approvals"] });
      qc.invalidateQueries({ queryKey: ["work-permit-approvals"] });
      if (data?.fullyApproved) {
        toast({ title: "Work permit disetujui & aktif!", description: "Email QR Code telah dikirim ke pemegang permit." });
      } else {
        toast({ title: "Persetujuan berhasil dicatat", description: "Menunggu persetujuan approver lainnya." });
      }
    },
    onError: (e: any) => toast({ title: "Gagal approve", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) => api.post(`/work-permits/${id}/reject`, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-permits"] });
      qc.invalidateQueries({ queryKey: ["work-permits-my-approvals"] });
      qc.invalidateQueries({ queryKey: ["work-permit-approvals"] });
      toast({ title: "Work permit ditolak", description: "Notifikasi telah dikirim ke admin." });
      setRejectId(null);
      setRejectNotes("");
    },
    onError: (e: any) => toast({ title: "Gagal reject", description: e.message, variant: "destructive" }),
  });

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (ktpFile) fd.append("ktp", ktpFile);
      if (photoFile) fd.append("photo", photoFile);

      const resp = await fetch(`${BASE}/api/work-permits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        throw new Error(d.error ?? "Gagal membuat work permit");
      }
      const result = await resp.json();
      qc.invalidateQueries({ queryKey: ["work-permits"] });
      setShowForm(false);
      setForm(EMPTY_FORM);
      setKtpFile(null);
      setPhotoFile(null);
      if (result?.requiresApproval) {
        toast({
          title: "Work permit dibuat, menunggu approval!",
          description: `Notifikasi telah dikirim ke ${result.approverCount} approver. Permit aktif setelah semua menyetujui.`,
        });
      } else {
        toast({ title: "Work permit berhasil dibuat!", description: "Email telah dikirim ke pemegang permit." });
      }
    } catch (err: any) {
      toast({ title: "Gagal membuat permit", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const ktpRef = { current: null as HTMLInputElement | null };
  const photoRef = { current: null as HTMLInputElement | null };

  // Counts per status
  const countActive   = permits.filter(p => p.status === "active").length;
  const countPending  = permits.filter(p => p.status === "pending").length;
  const countExpired  = permits.filter(p => p.status === "expired").length;
  const countRejected = permits.filter(p => p.status === "rejected" || p.status === "revoked").length;

  // Filtered list
  const filtered = statusFilter === "all"
    ? permits
    : statusFilter === "rejected"
      ? permits.filter(p => p.status === "rejected" || p.status === "revoked")
      : permits.filter(p => p.status === statusFilter);

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated  = filtered.slice(page * pageSize, (page + 1) * pageSize);

  function handlePageSizeChange(val: string) {
    setPageSize(Number(val));
    setPage(0);
  }
  function handleFilterChange(val: string) {
    setStatusFilter(val);
    setPage(0);
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Work Permit"
        subtitle={`${permits.length} permit terdaftar`}
        action={
          <Button onClick={() => { setShowForm(true); setForm(EMPTY_FORM); }} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Buat Work Permit
          </Button>
        }
      />

      {/* Status summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <button
          onClick={() => handleFilterChange(statusFilter === "active" ? "all" : "active")}
          className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm ${statusFilter === "active" ? "ring-2 ring-green-400 bg-green-50 border-green-200" : "bg-white"}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-green-700">Aktif</span>
          </div>
          <div className="text-3xl font-black text-green-800 tabular-nums">{isLoading ? "—" : countActive}</div>
        </button>
        <button
          onClick={() => handleFilterChange(statusFilter === "pending" ? "all" : "pending")}
          className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm ${statusFilter === "pending" ? "ring-2 ring-yellow-400 bg-yellow-50 border-yellow-200" : "bg-white"}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-yellow-600" />
            <span className="text-xs font-medium text-yellow-700">Pengajuan</span>
          </div>
          <div className="text-3xl font-black text-yellow-800 tabular-nums">{isLoading ? "—" : countPending}</div>
        </button>
        <button
          onClick={() => handleFilterChange(statusFilter === "expired" ? "all" : "expired")}
          className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm ${statusFilter === "expired" ? "ring-2 ring-gray-400 bg-gray-50 border-gray-300" : "bg-white"}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-600">Expired</span>
          </div>
          <div className="text-3xl font-black text-gray-700 tabular-nums">{isLoading ? "—" : countExpired}</div>
        </button>
        <button
          onClick={() => handleFilterChange(statusFilter === "rejected" ? "all" : "rejected")}
          className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm ${statusFilter === "rejected" ? "ring-2 ring-red-400 bg-red-50 border-red-200" : "bg-white"}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-red-600">Ditolak / Dicabut</span>
          </div>
          <div className="text-3xl font-black text-red-700 tabular-nums">{isLoading ? "—" : countRejected}</div>
        </button>
      </div>

      {/* My pending approvals banner */}
      {myApprovals.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <h3 className="font-semibold text-yellow-800 text-sm">
              Menunggu Persetujuan Anda ({myApprovals.length})
            </h3>
          </div>
          <div className="space-y-2">
            {myApprovals.map(p => (
              <div key={p.id} className="bg-white border border-yellow-100 rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.typeName ?? "—"} · {p.workStart} s/d {p.workEnd}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs gap-1.5"
                    onClick={() => approveMutation.mutate(p.id)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Setujui
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 h-8 text-xs gap-1.5"
                    onClick={() => { setRejectId(p.id); setRejectNotes(""); }}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Tolak
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white border rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-gray-900">Buat Work Permit Baru</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nama Lengkap <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={f("name")} placeholder="Nama pemegang permit" required />
              </div>
              <div className="space-y-1">
                <Label>No. HP <span className="text-red-500">*</span></Label>
                <Input value={form.phone} onChange={f("phone")} placeholder="08xx-xxxx-xxxx" required />
              </div>
              <div className="space-y-1">
                <Label>Email <span className="text-red-500">*</span></Label>
                <Input type="email" value={form.email} onChange={f("email")} placeholder="email@perusahaan.com" required />
              </div>
              <div className="space-y-1">
                <Label>Tipe Pekerjaan</Label>
                <select value={form.typeId} onChange={f("typeId")} className="w-full h-10 px-3 rounded-md border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Pilih tipe —</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.type} — {t.description}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Nama Kontak Darurat <span className="text-red-500">*</span></Label>
                <Input value={form.emergencyName} onChange={f("emergencyName")} placeholder="Nama yang bisa dihubungi" required />
              </div>
              <div className="space-y-1">
                <Label>No. HP Kontak Darurat <span className="text-red-500">*</span></Label>
                <Input value={form.emergencyPhone} onChange={f("emergencyPhone")} placeholder="08xx-xxxx-xxxx" required />
              </div>
              <div className="space-y-1">
                <Label>Tanggal Mulai Kerja <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.workStart} onChange={f("workStart")} required />
              </div>
              <div className="space-y-1">
                <Label>Tanggal Selesai Kerja <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.workEnd} onChange={f("workEnd")} required />
              </div>
              <div className="space-y-1">
                <Label>Nama Atasan <span className="text-red-500">*</span></Label>
                <Input value={form.supervisorName} onChange={f("supervisorName")} placeholder="Nama atasan" required />
              </div>
              <div className="space-y-1">
                <Label>No. HP Atasan <span className="text-red-500">*</span></Label>
                <Input value={form.supervisorPhone} onChange={f("supervisorPhone")} placeholder="08xx-xxxx-xxxx" required />
              </div>
              <div className="space-y-1">
                <Label>Upload KTP</Label>
                <input ref={el => { ktpRef.current = el; }} type="file" accept="image/*" className="hidden" onChange={e => setKtpFile(e.target.files?.[0] ?? null)} />
                <Button type="button" variant="outline" onClick={() => ktpRef.current?.click()} className="w-full justify-start gap-2 h-10">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600 truncate">{ktpFile ? ktpFile.name : "Pilih file KTP (JPG/PNG)"}</span>
                </Button>
              </div>
              <div className="space-y-1">
                <Label>Foto Terkini</Label>
                <input ref={el => { photoRef.current = el; }} type="file" accept="image/*" capture="user" className="hidden" onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} />
                <Button type="button" variant="outline" onClick={() => photoRef.current?.click()} className="w-full justify-start gap-2 h-10">
                  <ImageIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600 truncate">{photoFile ? photoFile.name : "Upload / ambil foto terkini"}</span>
                </Button>
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label>Catatan</Label>
                <textarea
                  value={form.notes}
                  onChange={f("notes")}
                  rows={2}
                  placeholder="Catatan tambahan (opsional)"
                  className="w-full px-3 py-2 rounded-md border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5 pt-4 border-t">
              <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                {submitting ? "Menyimpan..." : "Buat Work Permit"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Batal</Button>
            </div>
          </form>
        </div>
      )}

      {/* Toolbar: filter label + page size selector */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {statusFilter !== "all" && (
            <button
              onClick={() => handleFilterChange("all")}
              className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md text-xs font-medium text-gray-600"
            >
              <X className="w-3 h-3" />
              Hapus filter
            </button>
          )}
          <span>
            {filtered.length} permit
            {statusFilter !== "all" ? ` (${statusFilter === "rejected" ? "ditolak/dicabut" : statusFilter})` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Tampilkan</span>
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-20 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-gray-500">per halaman</span>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white border rounded-xl p-10 text-center text-gray-400 text-sm">Memuat...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border rounded-xl p-10 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {statusFilter !== "all" ? "Tidak ada permit dengan status ini" : "Belum ada work permit"}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {statusFilter !== "all" ? "Coba hapus filter untuk melihat semua permit." : "Buat permit baru untuk mengizinkan seseorang bekerja di area tertentu."}
            </p>
          </div>
        ) : (
          paginated.map(p => {
            const expanded = expandedId === p.id;
            const qr = scanUrl(p.permitCode);
            const isPending = p.status === "pending";
            const isMyPending = myApprovals.some(a => a.id === p.id);
            const isH1 = p.status === "active" && p.workEnd <= getTomorrow();
            return (
              <div key={p.id} className={`bg-white border rounded-xl shadow-sm overflow-hidden ${permitCardClass(p)}`}>
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50/80"
                  onClick={() => setExpandedId(expanded ? null : p.id)}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${permitIconBg(p)}`}>
                    <User className={`w-4 h-4 ${permitIconColor(p)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.typeName ?? "—"} · {p.workStart} s/d {p.workEnd}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isMyPending && (
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200 border text-xs">Perlu Approval Anda</Badge>
                    )}
                    {isH1 && (
                      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 border text-xs">⚠ H-1</Badge>
                    )}
                    {statusBadge(p.status)}
                  </div>
                  <span className="text-gray-400">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
                </div>

                {expanded && (
                  <div className="border-t px-5 py-5">
                    <div className="flex gap-6 flex-wrap">
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">No. HP</p>
                            <p className="text-gray-800">{p.phone}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Email</p>
                            <p className="text-gray-800 truncate">{p.email}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Kontak Darurat</p>
                            <p className="text-gray-800">{p.emergencyName} · {p.emergencyPhone}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Atasan</p>
                            <p className="text-gray-800">{p.supervisorName} · {p.supervisorPhone}</p>
                          </div>
                        </div>
                        {p.notes && (
                          <div className="text-sm">
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Catatan</p>
                            <p className="text-gray-700">{p.notes}</p>
                          </div>
                        )}

                        {/* Approval chain (only for pending/rejected) */}
                        {(p.status === "pending" || p.status === "rejected") && (
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <ApprovalChain permitId={p.id} />
                          </div>
                        )}

                        <div className="flex gap-3 text-xs flex-wrap">
                          {p.ktpUrl && <a href={p.ktpUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Lihat KTP</a>}
                          {p.photoUrl && <a href={p.photoUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" />Lihat Foto</a>}
                        </div>

                        <div className="flex gap-2 pt-2 flex-wrap">
                          {/* Approve/reject buttons for pending approvals */}
                          {isMyPending && p.status === "pending" && (
                            <>
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 gap-1"
                                onClick={() => approveMutation.mutate(p.id)}
                                disabled={approveMutation.isPending}>
                                <CheckCircle className="w-3.5 h-3.5" /> Setujui
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-7 gap-1"
                                onClick={() => { setRejectId(p.id); setRejectNotes(""); }}>
                                <XCircle className="w-3.5 h-3.5" /> Tolak
                              </Button>
                            </>
                          )}
                          {/* Admin controls */}
                          {user?.role === "admin" && (
                            <>
                              {p.status === "active" && (
                                <Button size="sm" variant="outline" className="text-red-500 border-red-200 hover:bg-red-50 text-xs h-7"
                                  onClick={() => { if (confirm("Cabut permit ini?")) revokeMutation.mutate({ id: p.id, status: "revoked" }); }}
                                  disabled={revokeMutation.isPending}>
                                  Cabut Permit
                                </Button>
                              )}
                              {p.status === "revoked" && (
                                <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 text-xs h-7"
                                  onClick={() => revokeMutation.mutate({ id: p.id, status: "active" })}
                                  disabled={revokeMutation.isPending}>
                                  Aktifkan Kembali
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* QR Code — only show for active permits */}
                      {p.status === "active" && (
                        <div className="flex flex-col items-center gap-2 flex-shrink-0">
                          <div className="p-3 border rounded-lg bg-white shadow-sm">
                            <QRCodeSVG value={qr} size={120} level="M" />
                          </div>
                          <p className="text-xs text-gray-400 text-center">Scan untuk verifikasi</p>
                          <a href={qr} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                            <QrCode className="w-3 h-3" />Buka halaman scan
                          </a>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1 text-gray-600 border-gray-200 hover:bg-gray-50 w-full"
                            onClick={(e) => { e.stopPropagation(); triggerPrint(p); }}
                          >
                            <Printer className="w-3 h-3" />Download PDF
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-gray-500">
            Halaman {page + 1} dari {totalPages} · {filtered.length} permit
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage(0)}
              disabled={page === 0}
            >
              <ChevronLeft className="w-3 h-3" /><ChevronLeft className="w-3 h-3 -ml-2" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>

            {/* Page number buttons — show up to 5 around current page */}
            {Array.from({ length: totalPages }, (_, i) => i)
              .filter(i => Math.abs(i - page) <= 2)
              .map(i => (
                <Button
                  key={i}
                  variant={i === page ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0 text-xs"
                  onClick={() => setPage(i)}
                >
                  {i + 1}
                </Button>
              ))
            }

            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="w-3 h-3" /><ChevronRight className="w-3 h-3 -ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={rejectId !== null} onOpenChange={open => { if (!open) { setRejectId(null); setRejectNotes(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="w-4 h-4" /> Tolak Work Permit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Berikan alasan penolakan (opsional). Notifikasi akan dikirim ke admin.</p>
            <div>
              <Label>Alasan Penolakan</Label>
              <textarea
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                rows={3}
                placeholder="Contoh: Dokumen belum lengkap, area belum aman..."
                className="w-full mt-1 px-3 py-2 rounded-md border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectNotes(""); }}>Batal</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => rejectId && rejectMutation.mutate({ id: rejectId, notes: rejectNotes })}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Menolak..." : "Konfirmasi Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden print area — rendered off-screen so SVG is available for extraction */}
      <div
        ref={printAreaRef}
        style={{ position: "absolute", top: "-9999px", left: "-9999px", pointerEvents: "none", opacity: 0 }}
        aria-hidden="true"
      >
        {printPermit && (
          <QRCodeSVG value={scanUrl(printPermit.permitCode)} size={180} level="M" />
        )}
      </div>
    </div>
  );
}
