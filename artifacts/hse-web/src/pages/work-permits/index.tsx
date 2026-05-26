import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { QRCodeSVG } from "qrcode.react";
import {
  Plus, X, FileText, QrCode, User, Phone, Mail, Calendar,
  ChevronDown, ChevronUp, Upload, Image as ImageIcon,
  CheckCircle, XCircle, Clock, AlertCircle, Shield,
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

  // Reject dialog
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

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

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white border rounded-xl p-10 text-center text-gray-400 text-sm">Memuat...</div>
        ) : permits.length === 0 ? (
          <div className="bg-white border rounded-xl p-10 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Belum ada work permit</p>
            <p className="text-gray-400 text-sm mt-1">Buat permit baru untuk mengizinkan seseorang bekerja di area tertentu.</p>
          </div>
        ) : (
          permits.map(p => {
            const expanded = expandedId === p.id;
            const qr = scanUrl(p.permitCode);
            const isPending = p.status === "pending";
            const isMyPending = myApprovals.some(a => a.id === p.id);
            return (
              <div key={p.id} className={`bg-white border rounded-xl shadow-sm overflow-hidden ${isPending ? "border-yellow-200" : ""}`}>
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(expanded ? null : p.id)}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isPending ? "bg-yellow-50" : "bg-blue-50"}`}>
                    <User className={`w-4 h-4 ${isPending ? "text-yellow-600" : "text-blue-600"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.typeName ?? "—"} · {p.workStart} s/d {p.workEnd}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isMyPending && (
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200 border text-xs">Perlu Approval Anda</Badge>
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
    </div>
  );
}
