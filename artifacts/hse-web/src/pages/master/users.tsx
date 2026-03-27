import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Users, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number; nik: string; name: string; email?: string;
  role: "admin" | "supervisor" | "employee"; groupName?: string;
}
interface Group { id: number; name: string }

const roleColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  supervisor: "bg-blue-100 text-blue-700",
  employee: "bg-gray-100 text-gray-700",
};
const roleLabels: Record<string, string> = {
  admin: "Admin", supervisor: "Supervisor", employee: "Employee",
};

function UserForm({ user, groups, onSave, onCancel }: {
  user?: User; groups: Group[];
  onSave: (data: Record<string, unknown>) => Promise<void>; onCancel: () => void;
}) {
  const [nik, setNik] = useState(user?.nik ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState(user?.role ?? "employee");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nik.trim() || !name.trim()) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = { nik: nik.trim(), name: name.trim(), email: email.trim() || undefined, role };
      if (password) data.password = password;
      await onSave(data);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>NIK *</Label>
          <Input value={nik} onChange={e => setNik(e.target.value)} placeholder="cth: EMP001" />
        </div>
        <div className="space-y-2">
          <Label>Nama Lengkap *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nama lengkap" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@perusahaan.com" />
      </div>
      <div className="space-y-2">
        <Label>Role *</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="supervisor">Supervisor</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{user ? "Password Baru (kosongkan jika tidak diubah)" : "Password *"}</Label>
        <Input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={user ? "Kosongkan untuk tidak mengubah" : "Masukkan password"}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={handleSave} disabled={saving || !nik.trim() || !name.trim() || (!user && !password)}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function ChangePasswordDialog({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = async () => {
    if (!newPassword) return;
    setSaving(true);
    try {
      await api.post(`/users/${userId}/change-password`, { newPassword });
      toast({ title: "Password berhasil diubah" });
      onClose();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Password Baru</Label>
        <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Password baru" />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Batal</Button>
        <Button onClick={handleChange} disabled={saving || !newPassword}>
          {saving ? "Mengubah..." : "Ubah Password"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formDialog, setFormDialog] = useState(false);
  const [pwDialog, setPwDialog] = useState<number | null>(null);
  const [editUser, setEditUser] = useState<User | undefined>();
  const [search, setSearch] = useState("");

  const { data: users = [], isLoading } = useQuery<User[]>({ queryKey: ["users"], queryFn: () => api.get("/users") });
  const { data: groups = [] } = useQuery<Group[]>({ queryKey: ["groups"], queryFn: () => api.get("/groups") });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      editUser ? api.put(`/users/${editUser.id}`, data) : api.post("/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setFormDialog(false);
      toast({ title: editUser ? "User diperbarui" : "User ditambahkan" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "User dihapus" });
    },
  });

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.nik.toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Master Users"
        subtitle="Kelola akun pengguna sistem"
        action={
          <Button onClick={() => { setEditUser(undefined); setFormDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Tambah User
          </Button>
        }
      />
      <div className="mb-4">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama, NIK, atau email..."
          className="max-w-sm"
        />
      </div>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">NIK</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Memuat...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Tidak ada user</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{u.nik}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email ?? "-"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${roleColors[u.role]}`}>
                    {roleLabels[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Reset Password"
                      onClick={() => setPwDialog(u.id)}>
                      <Key className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                      onClick={() => { setEditUser(u); setFormDialog(true); }}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      onClick={() => { if (confirm(`Hapus user "${u.name}"?`)) deleteMutation.mutate(u.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={formDialog} onOpenChange={setFormDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editUser ? "Edit User" : "Tambah User"}</DialogTitle></DialogHeader>
          <UserForm user={editUser} groups={groups} onSave={(data) => saveMutation.mutateAsync(data)} onCancel={() => setFormDialog(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwDialog} onOpenChange={open => !open && setPwDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          {pwDialog && <ChangePasswordDialog userId={pwDialog} onClose={() => setPwDialog(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
