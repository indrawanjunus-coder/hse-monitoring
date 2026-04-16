import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RiskBadge } from "@/components/badges";
import { Plus, Edit, Trash2, UsersRound, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Pagination } from "@/components/pagination";

interface Category {
  id: number; name: string; description?: string; riskLevel: "minor" | "moderate" | "major" | "fatal";
  picGroupId?: number; picGroupName?: string; color?: string;
  groupIds?: number[]; userIds?: number[];
  groups?: { id: number; name: string }[];
  users?: { id: number; name: string; nik: string }[];
}
interface Group { id: number; name: string }
interface UserItem { id: number; name: string; nik: string }

function MultiCheckList<T extends { id: number; name: string }>({
  label, icon, items, selected, onChange, placeholder,
}: {
  label: string; icon?: React.ReactNode;
  items: T[]; selected: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
}) {
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        {icon}{label}
      </Label>
      <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1 bg-white">
        {items.length === 0
          ? <p className="text-xs text-gray-400 py-1 px-1">{placeholder ?? "Tidak ada data"}</p>
          : items.map(item => (
            <label key={item.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
              <Checkbox
                checked={selected.includes(item.id)}
                onCheckedChange={() => toggle(item.id)}
              />
              <span>{item.name}</span>
            </label>
          ))
        }
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-indigo-600">{selected.length} dipilih</p>
      )}
    </div>
  );
}

function CategoryForm({ cat, groups, users, onSave, onCancel }: {
  cat?: Category; groups: Group[]; users: UserItem[];
  onSave: (d: Record<string, unknown>) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState(cat?.name ?? "");
  const [description, setDescription] = useState(cat?.description ?? "");
  const [riskLevel, setRiskLevel] = useState(cat?.riskLevel ?? "minor");
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>(cat?.groupIds ?? []);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>(cat?.userIds ?? []);
  const [color, setColor] = useState(cat?.color ?? "#3B82F6");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        riskLevel,
        color,
        groupIds: selectedGroupIds,
        userIds: selectedUserIds,
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nama Kategori *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="cth: Safety" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Risk Level *</Label>
          <Select value={riskLevel} onValueChange={setRiskLevel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="minor">Minor</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="major">Major</SelectItem>
              <SelectItem value="fatal">Fatal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Warna Label</Label>
          <div className="flex gap-2 items-center">
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
            <span className="text-xs text-gray-500 font-mono">{color}</span>
          </div>
        </div>
      </div>

      <MultiCheckList
        label="Group PIC (Penanggung Jawab)"
        icon={<UsersRound className="w-3.5 h-3.5" />}
        items={groups}
        selected={selectedGroupIds}
        onChange={setSelectedGroupIds}
        placeholder="Tidak ada group tersedia"
      />
      <p className="text-xs text-gray-500 -mt-2">Semua anggota group yang dipilih akan menerima notifikasi dan melihat incident kategori ini</p>

      <MultiCheckList
        label="User Penanggung Jawab"
        icon={<User className="w-3.5 h-3.5" />}
        items={users.map(u => ({ id: u.id, name: `${u.name} (${u.nik})` }))}
        selected={selectedUserIds}
        onChange={setSelectedUserIds}
        placeholder="Tidak ada user tersedia"
      />
      <p className="text-xs text-gray-500 -mt-2">User yang dipilih akan menerima notifikasi dan melihat incident kategori ini</p>

      <div className="space-y-2">
        <Label>Deskripsi</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Deskripsi opsional" />
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["categories"], queryFn: () => api.get("/categories"),
  });
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["groups"], queryFn: () => api.get("/groups"),
  });
  const { data: users = [] } = useQuery<UserItem[]>({
    queryKey: ["users"], queryFn: () => api.get("/users"),
  });

  const saveMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) =>
      editCat ? api.put(`/categories/${editCat.id}`, d) : api.post("/categories", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setDialog(false);
      toast({ title: "Kategori disimpan" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/categories/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categories"] }); toast({ title: "Kategori dihapus" }); },
  });

  const paginated = categories.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="p-6">
      <PageHeader
        title="Master Kategori"
        subtitle="Kelola kategori hazard & incident dan assign group/user PIC"
        action={
          <Button onClick={() => { setEditCat(undefined); setDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />Tambah Kategori
          </Button>
        }
      />
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Risk Level</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Group PIC</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">User PIC</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Deskripsi</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">Memuat...</td></tr>
              : categories.length === 0
              ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">Tidak ada kategori</td></tr>
              : paginated.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.color && (
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                      )}
                      <span className="font-semibold text-gray-900">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RiskBadge level={c.riskLevel} /></td>
                  <td className="px-4 py-3">
                    {c.groups && c.groups.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.groups.map(g => (
                          <span key={g.id} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                            <UsersRound className="w-3 h-3" />{g.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.users && c.users.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.users.map(u => (
                          <span key={u.id} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                            <User className="w-3 h-3" />{u.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{c.description ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                        onClick={() => { setEditCat(c); setDialog(true); }}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        onClick={() => { if (confirm(`Hapus "${c.name}"?`)) deleteMutation.mutate(c.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={categories.length} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editCat ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle></DialogHeader>
          <CategoryForm
            cat={editCat} groups={groups} users={users}
            onSave={(d) => saveMutation.mutateAsync(d)}
            onCancel={() => setDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
