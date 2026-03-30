import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FrequencyBadge, StatusBadge } from "@/components/badges";
import { Plus, Calendar, Edit, Trash2, User, Users, MapPin, Layout, Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

interface Group { id: number; name: string }
interface Schedule {
  id: number;
  title?: string;
  supervisorId?: number;
  supervisorName?: string;
  groupId?: number;
  groupName?: string;
  templateId: number;
  templateName: string;
  plantId: number;
  plantName: string;
  frequency: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  customDays?: string;
  isActive: number;
  status: string;
  createdAt: string;
  groups?: Group[];
  groupIds?: number[];
  userIds?: number[];
}
interface Template { id: number; name: string }
interface Plant { id: number; name: string }
interface UserItem { id: number; name: string; nik: string; role: string }

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Setiap Hari" },
  { value: "weekly", label: "Setiap Minggu (pilih hari)" },
  { value: "biweekly", label: "Dua Minggu Sekali" },
  { value: "monthly", label: "Setiap Bulan (pilih tanggal)" },
  { value: "custom", label: "Kustom" },
];

function frequencyLabel(s: Schedule): string {
  if (s.frequency === "daily") return "Setiap Hari";
  if (s.frequency === "weekly" && s.dayOfWeek !== null && s.dayOfWeek !== undefined)
    return `Setiap ${DAY_NAMES[s.dayOfWeek]}`;
  if (s.frequency === "biweekly") return "Dua Minggu Sekali";
  if (s.frequency === "monthly" && s.dayOfMonth)
    return `Setiap tgl ${s.dayOfMonth}`;
  if (s.frequency === "custom" && s.customDays)
    return `Kustom: ${s.customDays}`;
  return s.frequency;
}

function MultiGroupSelect({ groups, selected, onChange }: {
  groups: Group[]; selected: number[]; onChange: (ids: number[]) => void;
}) {
  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };
  return (
    <div className="border rounded-lg max-h-36 overflow-y-auto p-2 space-y-1">
      {groups.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Tidak ada group</p>}
      {groups.map(g => (
        <label key={g.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
          <Checkbox
            checked={selected.includes(g.id)}
            onCheckedChange={() => toggle(g.id)}
            id={`group-${g.id}`}
          />
          <span className="text-sm text-gray-700">{g.name}</span>
        </label>
      ))}
    </div>
  );
}

function ScheduleForm({
  schedule, onSave, onCancel,
  templates, plants, groups, users,
}: {
  schedule?: Schedule;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  templates: Template[]; plants: Plant[]; groups: Group[]; users: UserItem[];
}) {
  const [title, setTitle] = useState(schedule?.title ?? "");
  const [templateId, setTemplateId] = useState(String(schedule?.templateId ?? ""));
  const [plantId, setPlantId] = useState(String(schedule?.plantId ?? ""));
  const [frequency, setFrequency] = useState(schedule?.frequency ?? "weekly");
  const [dayOfWeek, setDayOfWeek] = useState(String(schedule?.dayOfWeek ?? "1"));
  const [dayOfMonth, setDayOfMonth] = useState(String(schedule?.dayOfMonth ?? "1"));
  const [customDays, setCustomDays] = useState(schedule?.customDays ?? "");
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>(schedule?.groupIds ?? []);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>(schedule?.userIds ?? []);
  const [saving, setSaving] = useState(false);

  const allUsers = users;

  const handleSave = async () => {
    if (!templateId || !plantId) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim() || null,
        templateId: parseInt(templateId),
        plantId: parseInt(plantId),
        frequency,
        dayOfWeek: (frequency === "weekly" || frequency === "biweekly") ? parseInt(dayOfWeek) : null,
        dayOfMonth: frequency === "monthly" ? parseInt(dayOfMonth) : null,
        customDays: frequency === "custom" ? customDays : null,
        groupIds: selectedGroupIds,
        userIds: selectedUserIds,
        // Legacy single fields for backward compat
        groupId: selectedGroupIds[0] ?? null,
        supervisorId: selectedUserIds[0] ?? null,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = (id: number) => {
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Judul Jadwal (opsional)</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="cth: Inspeksi Harian Area A" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Template Inspeksi *</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue placeholder="Pilih template" /></SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Plant *</Label>
          <Select value={plantId} onValueChange={setPlantId}>
            <SelectTrigger><SelectValue placeholder="Pilih plant" /></SelectTrigger>
            <SelectContent>
              {plants.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Frekuensi Jadwal *</Label>
        <Select value={frequency} onValueChange={setFrequency}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FREQUENCY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {(frequency === "weekly" || frequency === "biweekly") && (
        <div className="space-y-2">
          <Label>Hari dalam Minggu</Label>
          <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DAY_NAMES.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {frequency === "monthly" && (
        <div className="space-y-2">
          <Label>Tanggal dalam Bulan (1-31)</Label>
          <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <SelectItem key={d} value={String(d)}>Tanggal {d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {frequency === "custom" && (
        <div className="space-y-2">
          <Label>Deskripsi Jadwal Kustom</Label>
          <Input value={customDays} onChange={e => setCustomDays(e.target.value)} placeholder="cth: Setiap Senin dan Kamis" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />Assign ke Group</Label>
          <MultiGroupSelect groups={groups} selected={selectedGroupIds} onChange={setSelectedGroupIds} />
          {selectedGroupIds.length > 0 && (
            <p className="text-xs text-blue-600">{selectedGroupIds.length} group dipilih</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1"><User className="w-3.5 h-3.5" />Assign ke User</Label>
          <div className="border rounded-lg max-h-36 overflow-y-auto p-2 space-y-1">
            {allUsers.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Tidak ada user</p>}
            {allUsers.map(u => (
              <label key={u.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                <Checkbox
                  checked={selectedUserIds.includes(u.id)}
                  onCheckedChange={() => toggleUser(u.id)}
                  id={`user-${u.id}`}
                />
                <span className="text-sm text-gray-700">{u.name} <span className="text-gray-400">({u.nik})</span></span>
              </label>
            ))}
          </div>
          {selectedUserIds.length > 0 && (
            <p className="text-xs text-blue-600">{selectedUserIds.length} user dipilih</p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={handleSave} disabled={saving || !templateId || !plantId}>
          {saving ? "Menyimpan..." : "Simpan Jadwal"}
        </Button>
      </DialogFooter>
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [20, 50];

function Pagination({ page, total, pageSize, onPage, onPageSize }: {
  page: number; total: number; pageSize: number;
  onPage: (p: number) => void; onPageSize: (n: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between pt-4 mt-2 border-t text-sm text-gray-600">
      <div className="flex items-center gap-2">
        <span>Tampilkan</span>
        {PAGE_SIZE_OPTIONS.map(n => (
          <Button key={n} size="sm" variant={pageSize === n ? "default" : "outline"} className="h-7 px-2 text-xs"
            onClick={() => { onPageSize(n); onPage(1); }}>
            {n}
          </Button>
        ))}
        <span>per halaman</span>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="px-2">{page} / {totalPages}</span>
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function PrintView({ schedules }: { schedules: Schedule[] }) {
  return (
    <div className="hidden print:block">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold">Daftar Jadwal Inspeksi HSE</h1>
        <p className="text-sm text-gray-500">Dicetak pada {new Date().toLocaleDateString("id-ID", { dateStyle: "full" })}</p>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-gray-900">
            <th className="text-left py-2 px-2 font-bold">#</th>
            <th className="text-left py-2 px-2 font-bold">Template</th>
            <th className="text-left py-2 px-2 font-bold">Plant</th>
            <th className="text-left py-2 px-2 font-bold">Frekuensi</th>
            <th className="text-left py-2 px-2 font-bold">Assignee</th>
            <th className="text-left py-2 px-2 font-bold">Status</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((s, i) => (
            <tr key={s.id} className={i % 2 === 0 ? "bg-gray-50" : ""}>
              <td className="py-1.5 px-2 text-gray-500">{i + 1}</td>
              <td className="py-1.5 px-2 font-medium">{s.templateName}</td>
              <td className="py-1.5 px-2">{s.plantName}</td>
              <td className="py-1.5 px-2">{frequencyLabel(s)}</td>
              <td className="py-1.5 px-2">
                {s.groups && s.groups.length > 0
                  ? s.groups.map(g => g.name).join(", ")
                  : s.groupName || s.supervisorName || "—"}
              </td>
              <td className="py-1.5 px-2">{s.isActive ? "Aktif" : "Nonaktif"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SchedulesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "supervisor";
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | undefined>();
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ["schedules"],
    queryFn: () => api.get("/schedules"),
  });
  const { data: templates = [] } = useQuery<Template[]>({ queryKey: ["templates"], queryFn: () => api.get("/templates") });
  const { data: plants = [] } = useQuery<Plant[]>({ queryKey: ["plants"], queryFn: () => api.get("/plants") });
  const { data: groups = [] } = useQuery<Group[]>({ queryKey: ["groups"], queryFn: () => api.get("/groups") });
  const { data: users = [] } = useQuery<UserItem[]>({ queryKey: ["users"], queryFn: () => api.get("/users") });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      editSchedule
        ? api.put(`/schedules/${editSchedule.id}`, data)
        : api.post("/schedules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      setDialogOpen(false);
      toast({ title: editSchedule ? "Jadwal diperbarui" : "Jadwal ditambahkan" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast({ title: "Jadwal dihapus" });
    },
  });

  const toggleActive = async (s: Schedule) => {
    await api.put(`/schedules/${s.id}`, { isActive: s.isActive ? 0 : 1 });
    queryClient.invalidateQueries({ queryKey: ["schedules"] });
  };

  const filtered = schedules.filter(s => {
    if (filterActive === "active") return s.isActive === 1;
    if (filterActive === "inactive") return s.isActive === 0;
    return true;
  });

  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  return (
    <div className="p-6">
      <PrintView schedules={filtered} />
      <div className="print:hidden">
        <PageHeader
          title="Jadwal Inspeksi"
          subtitle={`${filtered.length} jadwal ditemukan`}
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" />Cetak
              </Button>
              {canManage && (
                <Button onClick={() => { setEditSchedule(undefined); setDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />Tambah Jadwal
                </Button>
              )}
            </div>
          }
        />

        <div className="flex gap-2 mb-4">
          {(["all", "active", "inactive"] as const).map(f => (
            <Button
              key={f}
              variant={filterActive === f ? "default" : "outline"}
              size="sm"
              onClick={() => { setFilterActive(f); setPage(1); }}
            >
              {f === "all" ? "Semua" : f === "active" ? "Aktif" : "Nonaktif"}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Memuat...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Belum ada jadwal inspeksi</p>
            {canManage && (
              <Button className="mt-4" onClick={() => { setEditSchedule(undefined); setDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />Tambah Jadwal
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginated.map(s => (
                <Card key={s.id} className={`${s.isActive === 0 ? "opacity-60" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FrequencyBadge frequency={s.frequency} />
                        <StatusBadge status={s.status as "pending" | "completed"} />
                        {s.isActive === 0 && <Badge variant="secondary">Nonaktif</Badge>}
                      </div>
                      {canManage && (
                        <div className="flex gap-1 ml-2">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                            onClick={() => { setEditSchedule(s); setDialogOpen(true); }}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            onClick={() => { if (confirm("Hapus jadwal ini?")) deleteMutation.mutate(s.id); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {s.title && (
                        <p className="font-semibold text-gray-900 text-sm">{s.title}</p>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Layout className="w-3.5 h-3.5 text-gray-400" />
                        <span className={`${s.title ? "text-gray-500" : "font-medium text-gray-900"}`}>{s.templateName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span>{s.plantName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {s.groups && s.groups.length > 0 ? (
                          <>
                            <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{s.groups.map(g => g.name).join(", ")}</span>
                          </>
                        ) : s.groupName ? (
                          <><Users className="w-3.5 h-3.5 text-gray-400" /><span>Group: {s.groupName}</span></>
                        ) : s.supervisorName ? (
                          <><User className="w-3.5 h-3.5 text-gray-400" /><span>{s.supervisorName}</span></>
                        ) : (
                          <span className="text-gray-400 text-xs">Belum ada assignee</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>{frequencyLabel(s)}</span>
                      </div>
                    </div>
                    {canManage && (
                      <div className="mt-3 pt-3 border-t">
                        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => toggleActive(s)}>
                          {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <Pagination
              page={page}
              total={filtered.length}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editSchedule ? "Edit Jadwal" : "Tambah Jadwal Inspeksi"}</DialogTitle>
          </DialogHeader>
          <ScheduleForm
            schedule={editSchedule}
            templates={templates}
            plants={plants}
            groups={groups}
            users={users}
            onSave={(data) => saveMutation.mutateAsync(data)}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
