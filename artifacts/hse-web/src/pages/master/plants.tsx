import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Plant { id: number; name: string; code?: string; description?: string; location?: string }

function PlantForm({ plant, onSave, onCancel }: {
  plant?: Plant; onSave: (d: Record<string, unknown>) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState(plant?.name ?? "");
  const [code, setCode] = useState(plant?.code ?? "");
  const [location, setLocation] = useState(plant?.location ?? "");
  const [description, setDescription] = useState(plant?.description ?? "");
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ name: name.trim(), code: code.trim() || undefined, location: location.trim() || undefined, description: description.trim() || undefined }); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nama Plant *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="cth: Hot End Plant" />
        </div>
        <div className="space-y-2">
          <Label>Kode</Label>
          <Input value={code} onChange={e => setCode(e.target.value)} placeholder="cth: HOT" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Lokasi</Label>
        <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="cth: Area A, Gedung 1" />
      </div>
      <div className="space-y-2">
        <Label>Deskripsi</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>{saving ? "Menyimpan..." : "Simpan"}</Button>
      </DialogFooter>
    </div>
  );
}

export default function PlantsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editPlant, setEditPlant] = useState<Plant | undefined>();
  const { data: plants = [], isLoading } = useQuery<Plant[]>({ queryKey: ["plants"], queryFn: () => api.get("/plants") });
  const saveMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => editPlant ? api.put(`/plants/${editPlant.id}`, d) : api.post("/plants", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["plants"] }); setDialog(false); toast({ title: "Plant disimpan" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/plants/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["plants"] }); toast({ title: "Plant dihapus" }); },
  });
  return (
    <div className="p-6">
      <PageHeader
        title="Master Plant"
        subtitle="Kelola daftar plant / area inspeksi"
        action={<Button onClick={() => { setEditPlant(undefined); setDialog(true); }}><Plus className="w-4 h-4 mr-2" />Tambah Plant</Button>}
      />
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Kode</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Lokasi</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Deskripsi</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">Memuat...</td></tr>
              : plants.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">Tidak ada plant</td></tr>
              : plants.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.code ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{p.location ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{p.description ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setEditPlant(p); setDialog(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700" onClick={() => { if (confirm(`Hapus "${p.name}"?`)) deleteMutation.mutate(p.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editPlant ? "Edit Plant" : "Tambah Plant"}</DialogTitle></DialogHeader>
          <PlantForm plant={editPlant} onSave={(d) => saveMutation.mutateAsync(d)} onCancel={() => setDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
