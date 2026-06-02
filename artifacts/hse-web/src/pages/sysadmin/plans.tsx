import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Edit2, Trash2, Users, Clock, DollarSign, FileText, ToggleLeft, ToggleRight, CalendarDays, Infinity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    post: async <T,>(path: string, body: unknown): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { method: "POST", credentials: "include", headers: h, body: JSON.stringify(body) });
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

interface Plan {
  id: number; name: string; slug: string; description: string; features: string;
  priceMonthly: number; priceYearly: number;
  maxUsers: number | null; durationMonths: number;
  maxTemplates: number | null; isActive: boolean; sortOrder: number;
  createdAt: string;
}

type BillingType = "free" | "monthly" | "yearly";

interface PlanFormState {
  name: string;
  slug: string;
  description: string;
  features: string;
  billingType: BillingType;
  price: number;
  trialMonths: number;
  maxUsers: number | null;
  maxTemplates: number | null;
  isActive: boolean;
  sortOrder: number;
}

function getBillingType(p: Plan): BillingType {
  if (p.priceMonthly === 0 && p.priceYearly === 0) return "free";
  if (p.durationMonths >= 12) return "yearly";
  return "monthly";
}

function getDisplayPrice(p: Plan): { price: number; period: string } {
  const bt = getBillingType(p);
  if (bt === "free") return { price: 0, period: "gratis" };
  if (bt === "yearly") return { price: p.priceYearly, period: "/tahun" };
  return { price: p.priceMonthly, period: "/bulan" };
}

function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

const emptyFormState: PlanFormState = {
  name: "", slug: "", description: "", features: "",
  billingType: "monthly", price: 0, trialMonths: 1,
  maxUsers: null, maxTemplates: null, isActive: true, sortOrder: 0,
};

const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  free: "Gratis",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

const BILLING_TYPE_COLORS: Record<BillingType, string> = {
  free: "bg-green-100 text-green-700",
  monthly: "bg-blue-100 text-blue-700",
  yearly: "bg-purple-100 text-purple-700",
};

export default function SysadminPlans() {
  const api = sysApi();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanFormState>(emptyFormState);
  const [error, setError] = useState("");

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["sys-plans"],
    queryFn: () => api.get("/sysadmin/plans"),
  });

  const setField = <K extends keyof PlanFormState>(field: K, value: PlanFormState[K]) =>
    setForm(f => ({ ...f, [field]: value }));

  const openCreate = () => {
    setForm(emptyFormState);
    setError("");
    setEditTarget(null);
    setDialog("create");
  };

  const openEdit = (p: Plan) => {
    const bt = getBillingType(p);
    const price = bt === "yearly" ? p.priceYearly : p.priceMonthly;
    setForm({
      name: p.name, slug: p.slug, description: p.description, features: p.features ?? "",
      billingType: bt, price, trialMonths: p.durationMonths,
      maxUsers: p.maxUsers, maxTemplates: p.maxTemplates,
      isActive: p.isActive, sortOrder: p.sortOrder,
    });
    setEditTarget(p);
    setError("");
    setDialog("edit");
  };

  const buildBody = () => {
    const { billingType, price, trialMonths } = form;
    return {
      name: form.name,
      slug: form.slug,
      description: form.description,
      features: form.features,
      priceMonthly: billingType === "monthly" ? Number(price) : 0,
      priceYearly: billingType === "yearly" ? Number(price) : 0,
      durationMonths: billingType === "yearly" ? 12 : billingType === "free" ? Number(trialMonths) : 1,
      maxUsers: form.maxUsers !== null && String(form.maxUsers) !== "" ? Number(form.maxUsers) : null,
      maxTemplates: form.maxTemplates !== null && String(form.maxTemplates) !== "" ? Number(form.maxTemplates) : null,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder),
    };
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = buildBody();
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

  const slugAutoFill = (name: string) => {
    setField("name", name);
    if (!editTarget) {
      setField("slug", name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 30));
    }
  };

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
          {plans.map(p => {
            const bt = getBillingType(p);
            const { price, period } = getDisplayPrice(p);
            return (
              <div key={p.id} className={`bg-white rounded-xl border p-5 flex flex-col gap-3 ${p.isActive ? "border-blue-200 shadow-sm" : "border-gray-200 opacity-70"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900">{p.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <code className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{p.slug}</code>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BILLING_TYPE_COLORS[bt]}`}>
                        {BILLING_TYPE_LABELS[bt]}
                      </span>
                    </div>
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
                    {bt === "free"
                      ? <span className="font-semibold text-green-600">Gratis</span>
                      : <span><span className="font-semibold">{fmtRp(price)}</span><span className="text-gray-400">{period}</span></span>
                    }
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>
                      {bt === "yearly" ? "12 bulan / tahun"
                        : bt === "free" ? `${p.durationMonths} bulan trial`
                        : "1 bulan per periode"}
                    </span>
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
            );
          })}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog === "edit" ? "Edit Paket" : "Tambah Paket Baru"}</DialogTitle>
          </DialogHeader>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-4">

            <div>
              <Label className="mb-2 block">Jenis Periode Langganan <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-3 gap-2">
                {(["free", "monthly", "yearly"] as BillingType[]).map(bt => (
                  <button
                    key={bt}
                    type="button"
                    onClick={() => setField("billingType", bt)}
                    className={`py-2.5 px-3 rounded-lg border-2 text-sm font-semibold transition-all flex flex-col items-center gap-1 ${
                      form.billingType === bt
                        ? bt === "free"
                          ? "border-green-500 bg-green-50 text-green-700"
                          : bt === "monthly"
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {bt === "free" && <Infinity className="w-4 h-4" />}
                    {bt === "monthly" && <CalendarDays className="w-4 h-4" />}
                    {bt === "yearly" && <CalendarDays className="w-4 h-4" />}
                    <span>{BILLING_TYPE_LABELS[bt]}</span>
                    <span className="text-xs font-normal opacity-70">
                      {bt === "free" ? "0 bulan trial" : bt === "monthly" ? "1 bulan/periode" : "12 bulan/periode"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nama Paket <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => slugAutoFill(e.target.value)} placeholder="Bulanan, Tahunan, Pro..." />
              </div>
              <div>
                <Label>Slug <span className="text-red-500">*</span></Label>
                <Input value={form.slug} onChange={e => setField("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="bulanan, tahunan..." />
              </div>
            </div>

            <div>
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={e => setField("description", e.target.value)} rows={2} className="resize-none" />
            </div>

            <div>
              <Label>Fitur-fitur <span className="text-gray-400 text-xs">(satu per baris)</span></Label>
              <Textarea
                value={form.features}
                onChange={e => setField("features", e.target.value)}
                rows={5}
                className="resize-none font-mono text-sm"
                placeholder={"Semua fitur dasar\nMaks. 5 pengguna\nPenyimpanan Google Drive\nSupport email"}
              />
            </div>

            {form.billingType === "free" ? (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
                <Infinity className="w-4 h-4" /> Paket gratis — tidak memerlukan pembayaran
              </div>
            ) : (
              <div>
                <Label>
                  Harga {form.billingType === "monthly" ? "Bulanan" : "Tahunan"} (Rp) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rp</span>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={e => setField("price", Number(e.target.value))}
                    min={0}
                    className="pl-9"
                    placeholder={form.billingType === "monthly" ? "250000" : "2250000"}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {form.billingType === "monthly"
                    ? "Dibayar setiap bulan — masa aktif 1 bulan per pembayaran"
                    : "Dibayar setiap tahun — masa aktif 12 bulan per pembayaran"}
                </p>
              </div>
            )}

            {form.billingType === "free" && (
              <div>
                <Label>Durasi Trial (bulan)</Label>
                <Input
                  type="number"
                  value={form.trialMonths}
                  onChange={e => setField("trialMonths", Number(e.target.value))}
                  min={1}
                  max={24}
                />
                <p className="text-xs text-gray-400 mt-1">Berapa bulan pengguna dapat menggunakan secara gratis</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Maks. User <span className="text-gray-400 text-xs">(kosong = unlimited)</span></Label>
                <Input type="number" value={form.maxUsers ?? ""} onChange={e => setField("maxUsers", e.target.value === "" ? null : Number(e.target.value))} min={1} placeholder="Unlimited" />
              </div>
              <div>
                <Label>Maks. Template <span className="text-gray-400 text-xs">(kosong = unlimited)</span></Label>
                <Input type="number" value={form.maxTemplates ?? ""} onChange={e => setField("maxTemplates", e.target.value === "" ? null : Number(e.target.value))} min={1} placeholder="Unlimited" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Urutan Tampil</Label>
                <Input type="number" value={form.sortOrder} onChange={e => setField("sortOrder", Number(e.target.value))} min={0} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setField("isActive", e.target.checked)} className="w-4 h-4 accent-blue-600" />
              <Label htmlFor="isActive" className="cursor-pointer">Paket aktif (tampil di halaman pendaftaran)</Label>
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
