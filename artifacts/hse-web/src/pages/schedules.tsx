import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FrequencyBadge, StatusBadge } from "@/components/badges";
import { Plus, Calendar, Edit, Trash2, User, Users, MapPin, Layout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Schedule {
  id: number;
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
}
interface Template { id: number; name: string }
interface Plant { id: number; name: string }
interface Group { id: number; name: string }
interface User { id: number; name: string; nik: string; role: string }

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

function ScheduleForm({
  schedule, onSave, onCancel,
  templates, plants, groups, users,
}: {
  schedule?: Schedule;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  templates: Template[]; plants: Plant[]; groups: Group[]; users: User[];
}) {
  const [templateId, setTemplateId] = useState(String(schedule?.templateId ?? ""));
  const [plantId, setPlantId] = useState(String(schedule?.plantId ?? ""));
  const [frequency, setFrequency] = useState(schedule?.frequency ?? "weekly");
  const [dayOfWeek, setDayOfWeek] = useState(String(schedule?.dayOfWeek ?? "1"));
  const [dayOfMonth, setDayOfMonth] = useState(String(schedule?.dayOfMonth ?? "1"));
  const [customDays, setCustomDays] = useState(schedule?.customDays ?? "");
  const [assignType, setAssignType] = useState<"group" | "user">(
    schedule?.groupId ? "group" : "user"
  );
  const [groupId, setGroupId] = useState(String(schedule?.groupId ?? ""));
  const [supervisorId, setSupervisorId] = useState(String(schedule?.supervisorId ?? ""));
  const [saving, setSaving] = useState(false);

  const supervisors = users.filter(u => u.role === "supervisor" || u.role === "admin");

  const handleSave = async () => {
    if (!templateId || !plantId) return;
    setSaving(true);
    try {
      await onSave({
        templateId: parseInt(templateId),
        plantId: parseInt(plantId),
        frequency,
        dayOfWeek: frequency === "weekly" || frequency === "biweekly" ? parseInt(dayOfWeek) : null,
        dayOfMonth: frequency === "monthly" ? parseInt(dayOfMonth) : null,
        customDays: frequency === "custom" ? customDays : null,
        groupId: assignType === "group" && groupId ? parseInt(groupId) : null,
        supervisorId: assignType === "user" && supervisorId ? parseInt(supervisorId) : null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
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

      <div className="space-y-2">
        <Label>Assign ke</Label>
        <div className="flex gap-2">
          <Button
            variant={assignType === "group" ? "default" : "outline"}
            size="sm"
            onClick={() => setAssignType("group")}
            type="button"
          >
            <Users className="w-4 h-4 mr-1" /> Group
          </Button>
          <Button
            variant={assignType === "user" ? "default" : "outline"}
            size="sm"
            onClick={() => setAssignType("user")}
            type="button"
          >
            <User className="w-4 h-4 mr-1" /> User Spesifik
          </Button>
        </div>
      </div>

      {assignType === "group" ? (
        <div className="space-y-2">
          <Label>Group</Label>
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger><SelectValue placeholder="Pilih group" /></SelectTrigger>
            <SelectContent>
              {groups.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Supervisor / User</Label>
          <Select value={supervisorId} onValueChange={setSupervisorId}>
            <SelectTrigger><SelectValue placeholder="Pilih user" /></SelectTrigger>
            <SelectContent>
              {supervisors.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.nik})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={handleSave} disabled={saving || !templateId || !plantId}>
          {saving ? "Menyimpan..." : "Simpan Jadwal"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function SchedulesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | undefined>();
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ["schedules"],
    queryFn: () => api.get("/schedules"),
  });
  const { data: templates = [] } = useQuery<Template[]>({ queryKey: ["templates"], queryFn: () => api.get("/templates") });
  const { data: plants = [] } = useQuery<Plant[]>({ queryKey: ["plants"], queryFn: () => api.get("/plants") });
  const { data: groups = [] } = useQuery<Group[]>({ queryKey: ["groups"], queryFn: () => api.get("/groups") });
  const { data: users = [] } = useQuery<User[]>({ queryKey: ["users"], queryFn: () => api.get("/users") });

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

  return (
    <div className="p-6">
      <PageHeader
        title="Jadwal Inspeksi"
        subtitle="Kelola jadwal inspeksi template"
        action={
          <Button onClick={() => { setEditSchedule(undefined); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Tambah Jadwal
          </Button>
        }
      />

      <div className="flex gap-2 mb-4">
        {(["all", "active", "inactive"] as const).map(f => (
          <Button
            key={f}
            variant={filterActive === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterActive(f)}
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
          <Button className="mt-4" onClick={() => { setEditSchedule(undefined); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Tambah Jadwal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(s => (
            <Card key={s.id} className={`${s.isActive === 0 ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FrequencyBadge frequency={s.frequency} />
                    <StatusBadge status={s.status as "pending" | "completed"} />
                    {s.isActive === 0 && <Badge variant="secondary">Nonaktif</Badge>}
                  </div>
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
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Layout className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-medium text-gray-900">{s.templateName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <span>{s.plantName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    {s.groupName ? (
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
                <div className="mt-3 pt-3 border-t">
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => toggleActive(s)}>
                    {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
