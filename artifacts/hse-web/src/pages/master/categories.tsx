import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RiskBadge } from "@/components/badges";
import { Plus, Edit, Trash2, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: number; name: string; description?: string; riskLevel: "high" | "medium" | "low"; code?: string;
}

function CategoryForm({ cat, onSave, onCancel }: {
  cat?: Category; onSave: (d: Record<string, unknown>) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState(cat?.name ?? "");
  const [code, setCode] = useState(cat?.code ?? "");
  const [description, setDescription] = useState(cat?.description ?? "");
  const [riskLevel, setRiskLevel] = useState(cat?.riskLevel ?? "low");
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ name: name.trim(), code: code.trim() || undefined, description: description.trim() || undefined, riskLevel }); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nama Kategori *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="cth: Safety" />
        </div>
        <div className="space-y-2">
          <Label>Kode</Label>
          <Input value={code} onChange={e => setCode(e.target.value)} placeholder="cth: SAF" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Risk Level *</Label>
        <Select value={riskLevel} onValueChange={setRiskLevel}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Deskripsi</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Deskripsi opsional" />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>{saving ? "Menyimpan..." : "Simpan"}</Button>
      </DialogFooter>
    </div>
  );
}

export default function CategoriesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editCat, setEditCat] = useState<Category | undefined>();
  const { data: categories = [], isLoading } = useQuery<Category[]>({ queryKey: ["categories"], queryFn: () => api.get("/categories") });
  const saveMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => editCat ? api.put(`/categories/${editCat.id}`, d) : api.post("/categories", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categories"] }); setDialog(false); toast({ title: "Kategori disimpan" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/categories/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categories"] }); toast({ title: "Kategori dihapus" }); },
  });
  return (
    <div className="p-6">
      <PageHeader
        title="Master Kategori"
        subtitle="Kelola kategori hazard & incident"
        action={<Button onClick={() => { setEditCat(undefined); setDialog(true); }}><Plus className="w-4 h-4 mr-2" />Tambah Kategori</Button>}
      />
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Kode</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Risk Level</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Deskripsi</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">Memuat...</td></tr>
              : categories.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">Tidak ada kategori</td></tr>
              : categories.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.code ?? "-"}</td>
                  <td className="px-4 py-3"><RiskBadge level={c.riskLevel} /></td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{c.description ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setEditCat(c); setDialog(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700" onClick={() => { if (confirm(`Hapus "${c.name}"?`)) deleteMutation.mutate(c.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editCat ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle></DialogHeader>
          <CategoryForm cat={editCat} onSave={(d) => saveMutation.mutateAsync(d)} onCancel={() => setDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
