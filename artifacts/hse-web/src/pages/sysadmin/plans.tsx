import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Edit2, Trash2, Users, Clock, DollarSign, FileText, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_BASE = "/api";
function sysApi(token: string) {
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  return {
    get: async <T,>(path: string): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { headers: h });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    post: async <T,>(path: string, body: unknown): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers: h, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    put: async <T,>(path: string, body: unknown): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { method: "PUT", headers: h, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    del: async (path: string) => {
      const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: h });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  };
}

interface Plan {
  id: number; name: string; slug: string; description: string;
  priceMonthly: number; priceYearly: number;
  maxUsers: number | null; durationMonths: number;
  maxTemplates: number | null; isActive: boolean; sortOrder: number;
  createdAt: string;
}

type PlanForm = Omit<Plan, "id" | "createdAt">;

const emptyForm: PlanForm = {
  name: "", slug: "", description: "",
  priceMonthly: 0, priceYearly: 0,
  maxUsers: null, durationMonths: 1,
  maxTemplates: null, isActive: true, sortOrder: 0,
};

function fmtRp(n: number) {
  return n === 0 ? "Gratis" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

export default function SysadminPlans({ token }: { token: string }) {
  const api = sysApi(token);
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [error, setError] = useState("");

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["sys-plans"],
    queryFn: () => api.get("/sysadmin/plans"),
  });

  const setField = (field: keyof PlanForm, value: unknown) => setForm(f => ({ ...f, [field]: value }));

  const openCreate = () => { setForm(emptyForm); setError(""); setEditTarget(null); setDialog("create"); };
  const openEdit = (p: Plan) => {
    setEditTarget(p);
    setForm({ name: p.name, slug: p.slug, description: p.description, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly, maxUsers: p.maxUsers, durationMonths: p.durationMonths, maxTemplates: p.maxTemplates, isActive: p.isActive, sortOrder: p.sortOrder });
    setError(""); setDialog("edit");
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        priceMonthly: Number(form.priceMonthly),
        priceYearly: Number(form.priceYearly),
        durationMonths: Number(form.durationMonths),
        maxUsers: form.maxUsers !== null && form.maxUsers !== undefined && String(form.maxUsers) !== "" ? Number(form.maxUsers) : null,
        maxTemplates: form.maxTemplates !== null && form.maxTemplates !== undefined && String(form.maxTemplates) !== "" ? Number(form.maxTemplates) : null,
        sortOrder: Number(form.sortOrder),
      };
      if (editTarget) return api.put(`/sysadmin/plans/${editTarget.id}`, body);
      return api.post("/sysadmin/plans", body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sys-plans"] }); setDialog(null); },
    onError: (e: any) => setError(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (p: Plan) => api.put(`/sysadmin/plans/${p.id}`, { isActive: !p.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sys-plans"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.del(`/sysadmin/plans/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sys-plans"] }),
  });

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" /> Master Layanan / Paket
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{plans.length} paket terdaftar · {plans.filter(p => p.isActive).length} aktif</p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Tambah Paket
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="mb-3">Belum ada paket layanan</p>
          <Button variant="outline" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Tambah Paket Pertama</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map(p => (
            <div key={p.id} className={`bg-white rounded-xl border p-5 flex flex-col gap-3 ${p.isActive ? "border-blue-200 shadow-sm" : "border-gray-200 opacity-70"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">{p.name}</h3>
                  <code className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{p.slug}</code>
                </div>
                <button onClick={() => toggleMut.mutate(p)} title={p.isActive ? "Nonaktifkan" : "Aktifkan"}>
                  {p.isActive
                    ? <ToggleRight className="w-6 h-6 text-blue-600" />
                    : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                </button>
              </div>

              {p.description && <p className="text-xs text-gray-500 leading-relaxed">{p.description}</p>}

              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <DollarSign className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{fmtRp(p.priceMonthly)}<span className="text-gray-400">/bulan</span></span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <DollarSign className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{fmtRp(p.priceYearly)}<span className="text-gray-400">/tahun</span></span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{p.durationMonths} bulan masa aktif</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{p.maxUsers === null ? "Unlimited user" : `Maks. ${p.maxUsers} user`}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{p.maxTemplates === null ? "Unlimited template" : `Maks. ${p.maxTemplates} template`}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-1 border-t border-gray-100">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}>
                  <Edit2 className="w-3 h-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => { if (confirm(`Hapus paket "${p.name}"?`)) deleteMut.mutate(p.id); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog === "edit" ? "Edit Paket" : "Tambah Paket Baru"}</DialogTitle>
          </DialogHeader>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nama Paket <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => setField("name", e.target.value)} placeholder="Pro, Enterprise..." />
              </div>
              <div>
                <Label>Slug <span className="text-red-500">*</span></Label>
                <Input value={form.slug} onChange={e => setField("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="pro, enterprise..." />
              </div>
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={e => setField("description", e.target.value)} rows={2} className="resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Harga Bulanan (Rp)</Label>
                <Input type="number" value={form.priceMonthly} onChange={e => setField("priceMonthly", e.target.value)} min={0} />
              </div>
              <div>
                <Label>Harga Tahunan (Rp)</Label>
                <Input type="number" value={form.priceYearly} onChange={e => setField("priceYearly", e.target.value)} min={0} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Masa Aktif (bulan)</Label>
                <Input type="number" value={form.durationMonths} onChange={e => setField("durationMonths", e.target.value)} min={1} />
              </div>
              <div>
                <Label>Urutan Tampil</Label>
                <Input type="number" value={form.sortOrder} onChange={e => setField("sortOrder", e.target.value)} min={0} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Maks. User <span className="text-gray-400 text-xs">(kosong = unlimited)</span></Label>
                <Input type="number" value={form.maxUsers ?? ""} onChange={e => setField("maxUsers", e.target.value === "" ? null : e.target.value)} min={1} placeholder="Unlimited" />
              </div>
              <div>
                <Label>Maks. Template <span className="text-gray-400 text-xs">(kosong = unlimited)</span></Label>
                <Input type="number" value={form.maxTemplates ?? ""} onChange={e => setField("maxTemplates", e.target.value === "" ? null : e.target.value)} min={1} placeholder="Unlimited" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setField("isActive", e.target.checked)} className="w-4 h-4 accent-blue-600" />
              <Label htmlFor="isActive" className="cursor-pointer">Paket aktif (tampil di landing page)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name || !form.slug}>
              {saveMut.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
