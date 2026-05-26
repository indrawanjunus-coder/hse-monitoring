import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, X, Check, Users, UserCheck } from "lucide-react";

interface WorkPermitType {
  id: number;
  type: string;
  description: string;
  companyId: number | null;
}

interface User {
  id: number;
  name: string;
  email?: string | null;
  role: string;
}

interface ApproverRow {
  id: number;
  userId: number;
  userName: string;
  userEmail?: string | null;
  userRole: string;
}

export default function WorkPermitTypesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ type: "", description: "" });

  // Approver dialog state
  const [approverTypeId, setApproverTypeId] = useState<number | null>(null);
  const [approverTypeName, setApproverTypeName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const { data: types = [], isLoading } = useQuery<WorkPermitType[]>({
    queryKey: ["work-permit-types"],
    queryFn: () => api.get("/work-permit-types"),
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/users"),
    enabled: approverTypeId !== null,
  });

  const { data: currentApprovers = [], isLoading: loadingApprovers } = useQuery<ApproverRow[]>({
    queryKey: ["work-permit-type-approvers", approverTypeId],
    queryFn: () => api.get(`/work-permit-types/${approverTypeId}/approvers`),
    enabled: approverTypeId !== null,
  });

  // Sync selected user ids when approvers loaded
  const [approversInited, setApproversInited] = useState(false);
  if (approverTypeId !== null && !loadingApprovers && !approversInited) {
    setSelectedUserIds(currentApprovers.map(a => a.userId));
    setApproversInited(true);
  }

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post("/work-permit-types", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work-permit-types"] }); setShowForm(false); setForm({ type: "", description: "" }); toast({ title: "Tipe berhasil ditambahkan" }); },
    onError: (e: any) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & typeof form) => api.put(`/work-permit-types/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work-permit-types"] }); setEditId(null); toast({ title: "Tipe berhasil diupdate" }); },
    onError: (e: any) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/work-permit-types/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work-permit-types"] }); toast({ title: "Tipe dihapus" }); },
    onError: (e: any) => toast({ title: "Gagal hapus", description: e.message, variant: "destructive" }),
  });

  const saveApproversMutation = useMutation({
    mutationFn: ({ typeId, userIds }: { typeId: number; userIds: number[] }) =>
      api.put(`/work-permit-types/${typeId}/approvers`, { userIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-permit-type-approvers", approverTypeId] });
      toast({ title: "Approver berhasil disimpan" });
      closeApproverDialog();
    },
    onError: (e: any) => toast({ title: "Gagal simpan approver", description: e.message, variant: "destructive" }),
  });

  function openApproverDialog(t: WorkPermitType) {
    setApproverTypeId(t.id);
    setApproverTypeName(t.type);
    setSelectedUserIds([]);
    setApproversInited(false);
  }

  function closeApproverDialog() {
    setApproverTypeId(null);
    setApproverTypeName("");
    setSelectedUserIds([]);
    setApproversInited(false);
  }

  function toggleUser(uid: number) {
    setSelectedUserIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  }

  const eligibleUsers = allUsers.filter(u => u.role !== "sysadmin");

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Tipe Work Permit"
        subtitle="Master data jenis pekerjaan dan konfigurasi approver per tipe"
        action={
          <Button onClick={() => { setShowForm(true); setForm({ type: "", description: "" }); }} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Tambah Tipe
          </Button>
        }
      />

      {showForm && (
        <div className="bg-white border rounded-xl p-5 mb-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Tambah Tipe Work Permit</h3>
          <div className="grid gap-4">
            <div>
              <Label>Tipe</Label>
              <Input value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} placeholder="cth: height place" className="mt-1" />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="cth: work from heights" className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate(form)} disabled={!form.type || !form.description || createMutation.isPending} size="sm">
                Simpan
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)} size="sm"><X className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Memuat...</div>
        ) : types.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Belum ada tipe work permit.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-8">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Tipe</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Deskripsi</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Approver</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {types.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{t.id}</td>
                  <td className="px-4 py-3">
                    {editId === t.id ? (
                      <Input value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="h-7 text-sm" />
                    ) : (
                      <span className="font-medium text-gray-900">{t.type}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {editId === t.id ? (
                      <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="h-7 text-sm" />
                    ) : (
                      t.description
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ApproverCount typeId={t.id} onEdit={() => openApproverDialog(t)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editId === t.id ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600" onClick={() => updateMutation.mutate({ id: t.id, ...form })} disabled={updateMutation.isPending}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-600" onClick={() => { setEditId(t.id); setForm({ type: t.type, description: t.description }); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500" onClick={() => { if (confirm("Hapus tipe ini?")) deleteMutation.mutate(t.id); }} disabled={deleteMutation.isPending}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Approver dialog */}
      <Dialog open={approverTypeId !== null} onOpenChange={open => { if (!open) closeApproverDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              Atur Approver — {approverTypeName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Pilih user yang wajib menyetujui work permit bertipe ini. Semua approver harus setuju sebelum permit aktif.
            </p>
            {loadingApprovers ? (
              <div className="text-sm text-gray-400 py-4 text-center">Memuat...</div>
            ) : eligibleUsers.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">Belum ada user tersedia.</div>
            ) : (
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {eligibleUsers.map(u => {
                  const selected = selectedUserIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${selected ? "bg-blue-50" : ""}`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${selected ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                        {u.email && <p className="text-xs text-gray-400 truncate">{u.email}</p>}
                      </div>
                      <Badge variant="outline" className="text-xs capitalize flex-shrink-0">{u.role}</Badge>
                    </button>
                  );
                })}
              </div>
            )}
            {selectedUserIds.length > 0 && (
              <p className="text-xs text-blue-600 font-medium">
                {selectedUserIds.length} approver dipilih — semua harus setuju sebelum permit aktif
              </p>
            )}
            {selectedUserIds.length === 0 && !loadingApprovers && (
              <p className="text-xs text-gray-400">
                Jika tidak ada approver dipilih, permit langsung aktif tanpa perlu persetujuan.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeApproverDialog}>Batal</Button>
            <Button
              onClick={() => saveApproversMutation.mutate({ typeId: approverTypeId!, userIds: selectedUserIds })}
              disabled={saveApproversMutation.isPending}
            >
              {saveApproversMutation.isPending ? "Menyimpan..." : "Simpan Approver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApproverCount({ typeId, onEdit }: { typeId: number; onEdit: () => void }) {
  const { data = [] } = useQuery<{ id: number; userName: string }[]>({
    queryKey: ["work-permit-type-approvers", typeId],
    queryFn: () => api.get(`/work-permit-types/${typeId}/approvers`),
    staleTime: 30000,
  });

  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
    >
      <Users className="w-3.5 h-3.5" />
      {data.length === 0 ? (
        <span className="text-gray-400">Tidak ada</span>
      ) : (
        <span>{data.length} approver</span>
      )}
      <Pencil className="w-3 h-3 opacity-50" />
    </button>
  );
}
