import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, X, Check } from "lucide-react";

interface WorkPermitType {
  id: number;
  type: string;
  description: string;
  companyId: number | null;
}

export default function WorkPermitTypesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ type: "", description: "" });

  const { data: types = [], isLoading } = useQuery<WorkPermitType[]>({
    queryKey: ["work-permit-types"],
    queryFn: () => api.get("/work-permit-types"),
  });

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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Tipe Work Permit"
        subtitle="Master data jenis pekerjaan untuk work permit"
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
    </div>
  );
}
