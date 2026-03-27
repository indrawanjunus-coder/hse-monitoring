import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, UsersRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Group { id: number; name: string; description?: string; memberCount?: number }

function GroupForm({ group, onSave, onCancel }: {
  group?: Group; onSave: (d: Record<string, unknown>) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
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
        <Label>Nama Group *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="cth: Tim Safety Hot End" />
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

export default function GroupsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | undefined>();
  const { data: groups = [], isLoading } = useQuery<Group[]>({ queryKey: ["groups"], queryFn: () => api.get("/groups") });
  const saveMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => editGroup ? api.put(`/groups/${editGroup.id}`, d) : api.post("/groups", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["groups"] }); setDialog(false); toast({ title: "Group disimpan" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/groups/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["groups"] }); toast({ title: "Group dihapus" }); },
  });
  return (
    <div className="p-6">
      <PageHeader
        title="Master Group"
        subtitle="Kelola grup pengguna untuk penugasan jadwal"
        action={<Button onClick={() => { setEditGroup(undefined); setDialog(true); }}><Plus className="w-4 h-4 mr-2" />Tambah Group</Button>}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 text-center py-12 text-gray-400">Memuat...</div>
        ) : groups.length === 0 ? (
          <div className="col-span-3 text-center py-12">
            <UsersRound className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Belum ada group</p>
            <Button className="mt-4" onClick={() => { setEditGroup(undefined); setDialog(true); }}>
              <Plus className="w-4 h-4 mr-2" />Tambah Group
            </Button>
          </div>
        ) : groups.map(g => (
          <div key={g.id} className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <UsersRound className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{g.name}</p>
                  {g.memberCount !== undefined && (
                    <p className="text-xs text-gray-500">{g.memberCount} anggota</p>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditGroup(g); setDialog(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => { if (confirm(`Hapus group "${g.name}"?`)) deleteMutation.mutate(g.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            {g.description && <p className="text-sm text-gray-500 mt-3">{g.description}</p>}
          </div>
        ))}
      </div>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editGroup ? "Edit Group" : "Tambah Group"}</DialogTitle></DialogHeader>
          <GroupForm group={editGroup} onSave={(d) => saveMutation.mutateAsync(d)} onCancel={() => setDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
