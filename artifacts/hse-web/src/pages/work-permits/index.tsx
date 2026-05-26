import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { QRCodeSVG } from "qrcode.react";
import {
  Plus, X, FileText, QrCode, User, Phone, Mail, Calendar,
  ChevronDown, ChevronUp, Upload, Image as ImageIcon,
} from "lucide-react";

interface WorkPermitType { id: number; type: string; description: string; }
interface WorkPermit {
  id: number; permitCode: string; name: string; phone: string; email: string;
  emergencyName: string; emergencyPhone: string; workStart: string; workEnd: string;
  supervisorName: string; supervisorPhone: string; ktpUrl: string | null;
  photoUrl: string | null; notes: string | null; status: string;
  typeId: number | null; typeName: string | null; createdAt: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const slug = window.location.pathname.match(/^\/c\/([^/]+)/)?.[1] ?? "";

function scanUrl(code: string) {
  return `${window.location.origin}/c/${slug}/scan?code=${code}`;
}

function statusBadge(status: string) {
  if (status === "active") return <Badge className="bg-green-100 text-green-700 border-green-200 border">Aktif</Badge>;
  if (status === "revoked") return <Badge className="bg-red-100 text-red-700 border-red-200 border">Dicabut</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-gray-200 border">Kadaluarsa</Badge>;
}

const EMPTY_FORM = {
  name: "", phone: "", email: "", emergencyName: "", emergencyPhone: "",
  workStart: "", workEnd: "", supervisorName: "", supervisorPhone: "",
  notes: "", typeId: "",
};

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
  const ktpRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const { data: permits = [], isLoading } = useQuery<WorkPermit[]>({
    queryKey: ["work-permits"],
    queryFn: () => api.get("/work-permits"),
  });
  const { data: types = [] } = useQuery<WorkPermitType[]>({
    queryKey: ["work-permit-types"],
    queryFn: () => api.get("/work-permit-types"),
  });

  const revokeMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.put(`/work-permits/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work-permits"] }); toast({ title: "Status permit diupdate" }); },
    onError: (e: any) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
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
      qc.invalidateQueries({ queryKey: ["work-permits"] });
      setShowForm(false);
      setForm(EMPTY_FORM);
      setKtpFile(null);
      setPhotoFile(null);
      toast({ title: "Work permit berhasil dibuat!", description: "Email telah dikirim ke pemegang permit." });
    } catch (err: any) {
      toast({ title: "Gagal membuat permit", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
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

      {/* Create form */}
      {showForm && (
        <div className="bg-white border rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-gray-900">Buat Work Permit Baru</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Personal info */}
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

              {/* Emergency contact */}
              <div className="space-y-1">
                <Label>Nama Kontak Darurat <span className="text-red-500">*</span></Label>
                <Input value={form.emergencyName} onChange={f("emergencyName")} placeholder="Nama yang bisa dihubungi" required />
              </div>
              <div className="space-y-1">
                <Label>No. HP Kontak Darurat <span className="text-red-500">*</span></Label>
                <Input value={form.emergencyPhone} onChange={f("emergencyPhone")} placeholder="08xx-xxxx-xxxx" required />
              </div>

              {/* Work dates */}
              <div className="space-y-1">
                <Label>Tanggal Mulai Kerja <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.workStart} onChange={f("workStart")} required />
              </div>
              <div className="space-y-1">
                <Label>Tanggal Selesai Kerja <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.workEnd} onChange={f("workEnd")} required />
              </div>

              {/* Supervisor */}
              <div className="space-y-1">
                <Label>Nama Atasan <span className="text-red-500">*</span></Label>
                <Input value={form.supervisorName} onChange={f("supervisorName")} placeholder="Nama atasan" required />
              </div>
              <div className="space-y-1">
                <Label>No. HP Atasan <span className="text-red-500">*</span></Label>
                <Input value={form.supervisorPhone} onChange={f("supervisorPhone")} placeholder="08xx-xxxx-xxxx" required />
              </div>

              {/* File uploads */}
              <div className="space-y-1">
                <Label>Upload KTP</Label>
                <input ref={ktpRef} type="file" accept="image/*" className="hidden" onChange={e => setKtpFile(e.target.files?.[0] ?? null)} />
                <Button type="button" variant="outline" onClick={() => ktpRef.current?.click()} className="w-full justify-start gap-2 h-10">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600 truncate">{ktpFile ? ktpFile.name : "Pilih file KTP (JPG/PNG)"}</span>
                </Button>
              </div>
              <div className="space-y-1">
                <Label>Foto Terkini</Label>
                <input ref={photoRef} type="file" accept="image/*" capture="user" className="hidden" onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} />
                <Button type="button" variant="outline" onClick={() => photoRef.current?.click()} className="w-full justify-start gap-2 h-10">
                  <ImageIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600 truncate">{photoFile ? photoFile.name : "Upload / ambil foto terkini"}</span>
                </Button>
              </div>

              {/* Notes */}
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
                {submitting ? "Menyimpan & mengirim email..." : "Buat & Kirim Email"}
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
            return (
              <div key={p.id} className="bg-white border rounded-xl shadow-sm overflow-hidden">
                {/* Row header */}
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(expanded ? null : p.id)}
                >
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.typeName ?? "—"} · {p.workStart} s/d {p.workEnd}</p>
                  </div>
                  {statusBadge(p.status)}
                  <span className="text-gray-400">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div className="border-t px-5 py-5">
                    <div className="flex gap-6 flex-wrap">
                      {/* Details */}
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
                        <div className="flex gap-3 text-xs flex-wrap">
                          {p.ktpUrl && <a href={p.ktpUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Lihat KTP</a>}
                          {p.photoUrl && <a href={p.photoUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" />Lihat Foto</a>}
                        </div>
                        {user?.role === "admin" && (
                          <div className="flex gap-2 pt-2">
                            {p.status !== "revoked" && (
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
                          </div>
                        )}
                      </div>

                      {/* QR Code */}
                      <div className="flex flex-col items-center gap-2 flex-shrink-0">
                        <div className="p-3 border rounded-lg bg-white shadow-sm">
                          <QRCodeSVG value={qr} size={120} level="M" />
                        </div>
                        <p className="text-xs text-gray-400 text-center">Scan untuk verifikasi</p>
                        <a
                          href={qr}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                        >
                          <QrCode className="w-3 h-3" />Buka halaman scan
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
