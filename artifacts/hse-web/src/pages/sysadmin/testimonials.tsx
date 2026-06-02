import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Star, Eye, EyeOff, Edit2, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_BASE = "/api";
function sysApi() {
  const h = { "Content-Type": "application/json" };
  return {
    get: async <T,>(path: string): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: h });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    put: async <T,>(path: string, body: unknown): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { method: "PUT", credentials: "include", headers: h, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    del: async (path: string) => {
      const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", credentials: "include", headers: h });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  };
}

interface Testimonial {
  id: number; userId: number | null; companyId: number | null;
  authorName: string; authorRole: string; authorCompany: string;
  content: string; rating: number; isActive: boolean; createdAt: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`w-3.5 h-3.5 ${s <= rating ? "text-amber-400 fill-amber-400" : "text-gray-300"}`} />
      ))}
    </div>
  );
}

export default function SysadminTestimonials() {
  const api = sysApi();
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<Testimonial | null>(null);
  const [editForm, setEditForm] = useState({ content: "", authorName: "", authorRole: "", authorCompany: "", rating: 5 });
  const [error, setError] = useState("");

  const { data: testimonials = [], isLoading } = useQuery<Testimonial[]>({
    queryKey: ["sys-testimonials"],
    queryFn: () => api.get("/sysadmin/testimonials"),
  });

  const updateMut = useMutation({
    mutationFn: (data: { id: number } & Partial<Testimonial>) => {
      const { id, ...body } = data;
      return api.put(`/sysadmin/testimonials/${id}`, body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sys-testimonials"] }); setEditItem(null); },
    onError: (e: any) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.del(`/sysadmin/testimonials/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sys-testimonials"] }),
  });

  const openEdit = (t: Testimonial) => {
    setEditItem(t);
    setEditForm({ content: t.content, authorName: t.authorName, authorRole: t.authorRole, authorCompany: t.authorCompany, rating: t.rating });
    setError("");
  };

  const activeCount = testimonials.filter(t => t.isActive).length;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" /> Manajemen Testimoni
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{testimonials.length} testimoni · {activeCount} ditampilkan di landing page</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : testimonials.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>Belum ada testimoni dari pengguna</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {testimonials.map(t => (
            <div key={t.id} className={`bg-white rounded-xl border p-5 ${t.isActive ? "border-green-200 shadow-sm" : "border-gray-200"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-blue-700 font-semibold text-sm">{t.authorName[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{t.authorName}</div>
                      <div className="text-xs text-gray-500">{[t.authorRole, t.authorCompany].filter(Boolean).join(" · ")}</div>
                    </div>
                    <StarRating rating={t.rating} />
                    {t.isActive && (
                      <span className="ml-auto shrink-0 text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{t.content}</p>
                  <p className="text-xs text-gray-400 mt-2">{new Date(t.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm" variant={t.isActive ? "default" : "outline"}
                    className={t.isActive ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                    onClick={() => updateMut.mutate({ id: t.id, isActive: !t.isActive })}
                    title={t.isActive ? "Nonaktifkan" : "Aktifkan"}
                  >
                    {t.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {t.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => { if (confirm("Hapus testimoni ini?")) deleteMut.mutate(t.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editItem} onOpenChange={o => !o && setEditItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Testimoni</DialogTitle>
          </DialogHeader>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nama</Label>
                <Input value={editForm.authorName} onChange={e => setEditForm(f => ({ ...f, authorName: e.target.value }))} />
              </div>
              <div>
                <Label>Jabatan</Label>
                <Input value={editForm.authorRole} onChange={e => setEditForm(f => ({ ...f, authorRole: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Perusahaan</Label>
              <Input value={editForm.authorCompany} onChange={e => setEditForm(f => ({ ...f, authorCompany: e.target.value }))} />
            </div>
            <div>
              <Label>Rating (1-5)</Label>
              <div className="flex items-center gap-2 mt-1">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setEditForm(f => ({ ...f, rating: s }))} type="button">
                    <Star className={`w-6 h-6 transition-colors ${s <= editForm.rating ? "text-amber-400 fill-amber-400" : "text-gray-300 hover:text-amber-300"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Isi Testimoni</Label>
              <Textarea value={editForm.content} onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))} rows={4} className="resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Batal</Button>
            <Button onClick={() => updateMut.mutate({ id: editItem!.id, ...editForm })} disabled={updateMut.isPending}>
              {updateMut.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
