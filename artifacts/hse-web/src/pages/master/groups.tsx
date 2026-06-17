import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, UsersRound, User, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Pagination } from "@/components/pagination";

interface Member { userId: number; name: string; nik: string; email?: string }
interface Group { id: number; name: string; description?: string; members?: Member[] }
interface UserItem { id: number; name: string; nik: string; role: string; email?: string }

function GroupForm({ group, onSave, onCancel, allUsers }: {
  group?: Group;
  onSave: (d: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  allUsers: UserItem[];
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(group?.members?.map(m => m.userId) ?? [])
  );
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredUsers = allUsers.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.nik.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredUsers.map(u => u.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        memberIds: Array.from(selectedIds),
      });
    } finally {
      setSaving(false);
    }
  };

  const roleLabel: Record<string, string> = {
    admin: "Admin",
    supervisor: "Supervisor",
    employee: "Karyawan",
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nama Group *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="cth: Tim Safety Hot End" />
      </div>
      <div className="space-y-2">
        <Label>Deskripsi</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Deskripsi opsional" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Anggota / PIC Group</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-600 font-medium">{selectedIds.size} dipilih</span>
            <button type="button" onClick={selectAll} className="text-xs text-blue-600 hover:underline">Pilih Semua</button>
            <span className="text-xs text-gray-300">|</span>
            <button type="button" onClick={deselectAll} className="text-xs text-gray-500 hover:underline">Hapus Pilihan</button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama atau NIK..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="border rounded-lg overflow-hidden max-h-52 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Tidak ada user ditemukan</p>
          ) : filteredUsers.map(u => (
            <label
              key={u.id}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b last:border-b-0 ${
                selectedIds.has(u.id) ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(u.id)}
                onChange={() => toggleUser(u.id)}
                className="w-4 h-4 accent-blue-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                <p className="text-xs text-gray-500">{u.nik} · {roleLabel[u.role] ?? u.role}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function GroupsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: () => api.get("/groups"),
  });
  const { data: allUsers = [] } = useQuery<UserItem[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/users"),
  });

  const saveMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) =>
      editGroup ? api.put(`/groups/${editGroup.id}`, d) : api.post("/groups", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setDialog(false);
      toast({ title: editGroup ? "Group diperbarui" : "Group ditambahkan" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast({ title: "Group dihapus" });
    },
  });

  const openEdit = (g: Group) => { setEditGroup(g); setDialog(true); };
  const openCreate = () => { setEditGroup(undefined); setDialog(true); };

  const paginatedGroups = groups.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="p-6">
      <PageHeader
        title="Master Group"
        subtitle="Kelola grup pengguna dan anggota PIC untuk penugasan jadwal"
        action={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />Tambah Group
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 text-center py-12 text-gray-400">Memuat...</div>
        ) : groups.length === 0 ? (
          <div className="col-span-3 text-center py-12">
            <UsersRound className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Belum ada group</p>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Tambah Group</Button>
          </div>
        ) : paginatedGroups.map(g => (
          <div key={g.id} className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <UsersRound className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{g.name}</p>
                  <p className="text-xs text-gray-500">
                    {g.members?.length ?? 0} anggota
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(g)}>
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                    onClick={() => { if (confirm(`Hapus group "${g.name}"?`)) deleteMutation.mutate(g.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {g.description && (
              <p className="text-sm text-gray-500 mb-3">{g.description}</p>
            )}

            {/* Members list */}
            {g.members && g.members.length > 0 ? (
              <div className="border-t pt-3 mt-auto">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Anggota PIC</p>
                <div className="space-y-1.5">
                  {g.members.slice(0, 4).map(m => (
                    <div key={m.userId} className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-3 h-3 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{m.name}</p>
                        <p className="text-xs text-gray-400">{m.nik}</p>
                      </div>
                    </div>
                  ))}
                  {g.members.length > 4 && (
                    <p className="text-xs text-gray-400 pl-8">+{g.members.length - 4} lainnya</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-t pt-3 mt-auto">
                <p className="text-xs text-gray-400 italic">Belum ada anggota — klik edit untuk menambah</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <Pagination page={page} total={groups.length} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editGroup ? "Edit Group" : "Tambah Group"}</DialogTitle>
          </DialogHeader>
          <GroupForm
            group={editGroup}
            allUsers={allUsers}
            onSave={(d) => saveMutation.mutateAsync(d)}
            onCancel={() => setDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
