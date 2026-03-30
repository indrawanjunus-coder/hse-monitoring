import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Pagination } from "@/components/pagination";

interface Category { id: number; name: string }

interface IncidentType {
  id: number;
  code: string;
  label: string;
  description?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  isActive: boolean;
  orderIndex: number;
}

function IncidentTypeForm({ type, categories, onSave, onCancel }: {
  type?: IncidentType;
  categories: Category[];
  onSave: (d: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(type?.code ?? "");
  const [label, setLabel] = useState(type?.label ?? "");
  const [description, setDescription] = useState(type?.description ?? "");
  const [categoryId, setCategoryId] = useState(type?.categoryId ? String(type.categoryId) : "none");
  const [isActive, setIsActive] = useState(type?.isActive ?? true);
  const [orderIndex, setOrderIndex] = useState(String(type?.orderIndex ?? 0));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!label.trim() || (!type && !code.trim())) return;
    setSaving(true);
    try {
      await onSave({
        code: code.trim(),
        label: label.trim(),
        description: description.trim() || null,
        categoryId: categoryId !== "none" ? parseInt(categoryId) : null,
        isActive,
        orderIndex: parseInt(orderIndex) || 0,
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {!type && (
        <div className="space-y-1">
          <Label>Kode <span className="text-red-500">*</span></Label>
          <Input value={code} onChange={e => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} placeholder="contoh: near_miss, accident" />
          <p className="text-xs text-gray-500">Hanya huruf kecil, angka, dan underscore. Tidak bisa diubah setelah disimpan.</p>
        </div>
      )}
      <div className="space-y-1">
        <Label>Label / Nama Tampilan <span className="text-red-500">*</span></Label>
        <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="contoh: Near Miss, Kecelakaan" />
      </div>
      <div className="space-y-1">
        <Label>Kategori <span className="text-red-500">*</span></Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="Pilih kategori..." /></SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto">
            <SelectItem value="none">— Tidak ada kategori —</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">Tipe incident ini akan muncul saat pelapor memilih kategori di atas.</p>
      </div>
      <div className="space-y-1">
        <Label>Deskripsi</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Penjelasan singkat tipe incident ini" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Urutan Tampil</Label>
          <Input type="number" value={orderIndex} onChange={e => setOrderIndex(e.target.value)} min={0} />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label>{isActive ? "Aktif" : "Nonaktif"}</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function IncidentTypesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<IncidentType | null>(null);
  const [filterCat, setFilterCat] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data: types = [], isLoading } = useQuery<IncidentType[]>({
    queryKey: ["incident-types"],
    queryFn: () => api.get("/incident-types"),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories"),
  });

  const createMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post("/incident-types", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incident-types"] }); setShowForm(false); toast({ title: "Tipe incident berhasil ditambahkan" }); },
    onError: (e: any) => toast({ title: e.message ?? "Gagal menyimpan", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: Record<string, unknown>) => api.put(`/incident-types/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incident-types"] }); setEditTarget(null); toast({ title: "Tipe incident diperbarui" }); },
    onError: (e: any) => toast({ title: e.message ?? "Gagal memperbarui", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/incident-types/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incident-types"] }); toast({ title: "Tipe incident dihapus" }); },
  });

  const handleDelete = (t: IncidentType) => {
    if (confirm(`Hapus tipe incident "${t.label}"?`)) deleteMut.mutate(t.id);
  };

  const filtered = filterCat === "all"
    ? types
    : filterCat === "none"
      ? types.filter(t => !t.categoryId)
      : types.filter(t => String(t.categoryId) === filterCat);

  const displayed = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Tipe Incident"
        subtitle="Kelola daftar tipe incident per kategori"
        action={isAdmin ? <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" />Tambah Tipe</Button> : undefined}
      />

      {/* Filter by category */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Filter Kategori:</span>
        <Select value={filterCat} onValueChange={v => { setFilterCat(v); setPage(1); }}>
          <SelectTrigger className="w-52 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto">
            <SelectItem value="all">Semua Kategori</SelectItem>
            <SelectItem value="none">— Tanpa Kategori —</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400">{filtered.length} tipe</span>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Memuat data...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>Tidak ada tipe incident untuk kategori ini</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Label</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Kode</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Kategori</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">Deskripsi</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayed.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">{t.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{t.code}</code>
                    </td>
                    <td className="px-4 py-3">
                      {t.categoryName
                        ? <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">{t.categoryName}</Badge>
                        : <span className="text-gray-400 text-xs italic">Umum</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{t.description ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      {t.isActive
                        ? <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Aktif</Badge>
                        : <Badge variant="outline" className="text-gray-400">Nonaktif</Badge>
                      }
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditTarget(t)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => handleDelete(t)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={filtered.length} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} pageSizeOptions={[20, 50, 100]} />
        </>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tambah Tipe Incident</DialogTitle></DialogHeader>
          <IncidentTypeForm
            categories={categories}
            onSave={async d => { await createMut.mutateAsync(d); }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {editTarget && (
        <Dialog open={true} onOpenChange={() => setEditTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Tipe Incident</DialogTitle></DialogHeader>
            <IncidentTypeForm
              type={editTarget}
              categories={categories}
              onSave={async d => { await updateMut.mutateAsync({ id: editTarget.id, ...d }); }}
              onCancel={() => setEditTarget(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
