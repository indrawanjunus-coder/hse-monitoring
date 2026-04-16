import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ShieldCheck, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Pagination } from "@/components/pagination";

interface PreventiveAction { id: number; name: string; description?: string }

function PreventiveActionForm({ pa, onSave, onCancel }: {
  pa?: PreventiveAction; onSave: (d: Record<string, unknown>) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState(pa?.name ?? "");
  const [description, setDescription] = useState(pa?.description ?? "");
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ name: name.trim(), description: description.trim() || undefined }); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nama Tindakan Preventif *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="cth: Training & Sosialisasi" />
      </div>
      <div className="space-y-2">
        <Label>Deskripsi</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Deskripsi langkah preventif..." />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>{saving ? "Menyimpan..." : "Simpan"}</Button>
      </DialogFooter>
    </div>
  );
}

export default function PreventiveActionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editPa, setEditPa] = useState<PreventiveAction | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");

  const { data: pas = [], isLoading } = useQuery<PreventiveAction[]>({
    queryKey: ["preventive-actions"],
    queryFn: () => api.get("/preventive-actions"),
  });
  const filtered = pas.filter(pa => !search.trim() || pa.name.toLowerCase().includes(search.toLowerCase()) || pa.description?.toLowerCase().includes(search.toLowerCase()));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const saveMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => editPa ? api.put(`/preventive-actions/${editPa.id}`, d) : api.post("/preventive-actions", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["preventive-actions"] }); setDialog(false); toast({ title: "Tindakan preventif disimpan" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/preventive-actions/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["preventive-actions"] }); toast({ title: "Tindakan preventif dihapus" }); },
  });

  return (
    <div className="p-6">
      <PageHeader
        title="Master Tindakan Preventif"
        subtitle="Kelola daftar tindakan pencegahan incident"
        action={<Button onClick={() => { setEditPa(undefined); setDialog(true); }}><Plus className="w-4 h-4 mr-2" />Tambah</Button>}
      />
      <div className="mb-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <Input className="pl-8 h-9 text-sm" placeholder="Cari nama tindakan preventif..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 text-center py-12 text-gray-400">Memuat...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-3 text-center py-12">
            <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{search ? `Tidak ada hasil untuk "${search}"` : "Belum ada tindakan preventif"}</p>
          </div>
        ) : paginated.map(pa => (
          <div key={pa.id} className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="font-semibold text-gray-900">{pa.name}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditPa(pa); setDialog(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => { if (confirm(`Hapus "${pa.name}"?`)) deleteMutation.mutate(pa.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            {pa.description && <p className="text-sm text-gray-500 mt-2">{pa.description}</p>}
          </div>
        ))}
      </div>
      <Pagination page={page} total={filtered.length} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editPa ? "Edit Tindakan Preventif" : "Tambah Tindakan Preventif"}</DialogTitle></DialogHeader>
          <PreventiveActionForm pa={editPa} onSave={(d) => saveMutation.mutateAsync(d)} onCancel={() => setDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
