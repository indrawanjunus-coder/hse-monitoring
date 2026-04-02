import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RiskBadge, StatusBadge, IncidentTypeBadge } from "@/components/badges";
import { Plus, AlertTriangle, MapPin, User, Calendar, ChevronDown, Users, ChevronLeft, ChevronRight, ArrowUpDown, ShieldAlert, Mail, Ticket, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Pagination } from "@/components/pagination";

interface Incident {
  id: number;
  reporterName: string;
  plantName: string;
  categoryId: number;
  categoryName: string;
  categoryRiskLevel?: "minor" | "moderate" | "major" | "fatal" | null;
  incidentDate: string;
  reportedDate: string;
  detail: string;
  incidentType?: string | null;
  actionId?: number | null;
  actionName?: string | null;
  preventiveActionId?: number | null;
  preventiveActionName?: string | null;
  targetDate?: string | null;
  rootCause?: string | null;
  followupNote?: string | null;
  needsFurtherAction: boolean;
  status: "open" | "in_progress" | "closed";
  closedAt?: string | null;
  assignedGroupName?: string | null;
}

interface Plant { id: number; name: string }
interface CategoryGroup { id: number; name: string }
interface CategoryUser { id: number; name: string; nik: string }
interface Category {
  id: number; name: string; riskLevel?: string;
  picGroupId?: number | null; picGroupName?: string;
  groups?: CategoryGroup[]; users?: CategoryUser[];
  groupIds?: number[]; userIds?: number[];
}
interface Action { id: number; name: string }
interface PreventiveAction { id: number; name: string }
interface UserItem { id: number; name: string; nik: string; email?: string }
interface GroupItem { id: number; name: string }

type SortMode = "reportedDate" | "aging";

function agingDays(reportedDate: string): number {
  return Math.floor((Date.now() - new Date(reportedDate).getTime()) / (1000 * 60 * 60 * 24));
}

function twoMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d.toISOString().slice(0, 10);
}

interface ApiIncidentType { id: number; code: string; label: string; isActive: boolean; categoryId?: number | null; }

function MultiRecipientPicker({
  label, users, groups, selectedUserIds, selectedGroupIds,
  onUserChange, onGroupChange,
}: {
  label: string;
  users: UserItem[]; groups: GroupItem[];
  selectedUserIds: number[]; selectedGroupIds: number[];
  onUserChange: (ids: number[]) => void;
  onGroupChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const totalSelected = selectedUserIds.length + selectedGroupIds.length;

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.nik.toLowerCase().includes(search.toLowerCase())
  );
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  const toggleUser = (id: number) => {
    onUserChange(selectedUserIds.includes(id) ? selectedUserIds.filter(x => x !== id) : [...selectedUserIds, id]);
  };
  const toggleGroup = (id: number) => {
    onGroupChange(selectedGroupIds.includes(id) ? selectedGroupIds.filter(x => x !== id) : [...selectedGroupIds, id]);
  };

  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border rounded-md text-sm bg-white hover:bg-gray-50 text-left"
      >
        <span className={totalSelected === 0 ? "text-gray-400" : "text-gray-900"}>
          {totalSelected === 0 ? "Tidak ada tambahan" : `${totalSelected} dipilih`}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="border rounded-md bg-white shadow-sm">
          <div className="p-2 border-b">
            <Input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari user atau grup..." className="h-7 text-xs"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filteredGroups.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 px-3 py-1.5 bg-gray-50 border-b">Grup</p>
                {filteredGroups.map(g => (
                  <label key={`g-${g.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <Checkbox checked={selectedGroupIds.includes(g.id)} onCheckedChange={() => toggleGroup(g.id)} />
                    <span className="text-sm text-gray-800">{g.name}</span>
                  </label>
                ))}
              </div>
            )}
            {filteredUsers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 px-3 py-1.5 bg-gray-50 border-b">Users</p>
                {filteredUsers.map(u => (
                  <label key={`u-${u.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <Checkbox checked={selectedUserIds.includes(u.id)} onCheckedChange={() => toggleUser(u.id)} />
                    <span className="text-sm text-gray-800">{u.name}</span>
                    <span className="text-xs text-gray-400">{u.nik}</span>
                  </label>
                ))}
              </div>
            )}
            {filteredGroups.length === 0 && filteredUsers.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">Tidak ditemukan</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IncidentForm({ onSave, onCancel, plants, categories, actions, preventiveActions, reporterId }: {
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  plants: Plant[]; categories: Category[]; actions: Action[]; preventiveActions: PreventiveAction[];
  reporterId: number;
}) {
  const { data: incidentTypes = [] } = useQuery<ApiIncidentType[]>({ queryKey: ["incident-types"], queryFn: () => api.get("/incident-types") });
  const { data: allUsers = [] } = useQuery<UserItem[]>({ queryKey: ["users"], queryFn: () => api.get("/users") });
  const { data: allGroups = [] } = useQuery<GroupItem[]>({ queryKey: ["groups"], queryFn: () => api.get("/groups") });

  const today = new Date().toISOString().split("T")[0]!;
  const [plantId, setPlantId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [incidentDate, setIncidentDate] = useState(today);
  const [incidentType, setIncidentType] = useState("");
  const [detail, setDetail] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [actionId, setActionId] = useState("none");
  const [preventiveActionId, setPreventiveActionId] = useState("none");
  const [targetDate, setTargetDate] = useState("");
  const [needsFurtherAction, setNeedsFurtherAction] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extraUserIds, setExtraUserIds] = useState<number[]>([]);
  const [extraGroupIds, setExtraGroupIds] = useState<number[]>([]);

  const availableTypes = incidentTypes.filter(t => t.isActive && (categoryId ? t.categoryId === parseInt(categoryId) : !t.categoryId));

  const selectedCategory = categories.find(c => c.id === parseInt(categoryId));

  useEffect(() => {
    if (!availableTypes.find(t => t.code === incidentType)) {
      setIncidentType(availableTypes[0]?.code ?? "");
    }
  }, [categoryId, incidentTypes]);

  useEffect(() => {
    setExtraUserIds([]);
    setExtraGroupIds([]);
  }, [categoryId]);

  const handleSave = async () => {
    if (!plantId || !categoryId || !detail.trim()) return;
    setSaving(true);
    try {
      await onSave({
        reporterId,
        plantId: parseInt(plantId),
        categoryId: parseInt(categoryId),
        incidentDate,
        incidentType,
        detail: detail.trim(),
        rootCause: rootCause.trim() || undefined,
        actionId: actionId !== "none" ? parseInt(actionId) : undefined,
        preventiveActionId: preventiveActionId !== "none" ? parseInt(preventiveActionId) : undefined,
        targetDate: targetDate || undefined,
        needsFurtherAction,
        extraUserIds: extraUserIds.length ? extraUserIds : undefined,
        extraGroupIds: extraGroupIds.length ? extraGroupIds : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const catGroups = selectedCategory?.groups ?? [];
  const catUsers = selectedCategory?.users ?? [];
  const picGroupName = selectedCategory?.picGroupName;
  const notifyCount = catGroups.length + catUsers.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Plant *</Label>
          <Select value={plantId} onValueChange={setPlantId}>
            <SelectTrigger><SelectValue placeholder="Pilih plant" /></SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">{plants.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Kategori *</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">{categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {selectedCategory && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Ticket className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-blue-800">Tiket Incident</span>
              {picGroupName ? (
                <p className="text-blue-700">Akan ditangani oleh Group PIC: <span className="font-semibold">{picGroupName}</span></p>
              ) : (
                <p className="text-blue-600 italic">Belum ada Group PIC untuk kategori ini</p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2 border-t border-blue-200 pt-2">
            <Mail className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-blue-800">Notifikasi Email Otomatis</span>
              {notifyCount === 0 ? (
                <p className="text-blue-600 italic">Belum ada penerima notifikasi untuk kategori ini</p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-1">
                  {catGroups.map(g => (
                    <span key={`cg-${g.id}`} className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                      <Users className="w-3 h-3" />{g.name}
                    </span>
                  ))}
                  {catUsers.map(u => (
                    <span key={`cu-${u.id}`} className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                      <User className="w-3 h-3" />{u.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tanggal Kejadian *</Label>
          <Input type="date" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Tipe Incident</Label>
          {!categoryId ? (
            <div className="flex items-center h-9 px-3 rounded-md border border-dashed border-gray-300 text-sm text-gray-400">
              Pilih kategori terlebih dahulu
            </div>
          ) : availableTypes.length === 0 ? (
            <div className="flex items-center h-9 px-3 rounded-md border border-dashed border-amber-300 bg-amber-50 text-sm text-amber-600">
              Tidak ada tipe untuk kategori ini
            </div>
          ) : (
            <Select value={incidentType} onValueChange={setIncidentType}>
              <SelectTrigger><SelectValue placeholder="Pilih tipe..." /></SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {availableTypes.map(t => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Detail Kejadian *</Label>
        <Textarea value={detail} onChange={e => setDetail(e.target.value)} placeholder="Deskripsikan kejadian secara detail..." rows={3} />
      </div>
      <div className="space-y-2">
        <Label>Root Cause / Akar Masalah</Label>
        <Textarea value={rootCause} onChange={e => setRootCause(e.target.value)} placeholder="Analisa penyebab utama kejadian..." rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tindakan yang Dilakukan</Label>
          <Select value={actionId} onValueChange={setActionId}>
            <SelectTrigger><SelectValue placeholder="Pilih tindakan..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tidak ada</SelectItem>
              {actions.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tindakan Preventif</Label>
          <Select value={preventiveActionId} onValueChange={setPreventiveActionId}>
            <SelectTrigger><SelectValue placeholder="Pilih tindakan preventif..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tidak ada</SelectItem>
              {preventiveActions.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Target Tanggal Penyelesaian</Label>
        <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="furtherAction" checked={needsFurtherAction} onCheckedChange={v => setNeedsFurtherAction(v === true)} />
        <Label htmlFor="furtherAction">Perlu tindak lanjut lebih lanjut</Label>
      </div>

      <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-500" />
          <p className="text-sm font-semibold text-gray-700">Tambah Penerima Email (opsional)</p>
        </div>
        <p className="text-xs text-gray-500">Di luar penerima otomatis dari kategori, Anda dapat menambahkan user atau grup tambahan yang akan menerima email notifikasi incident ini.</p>
        <MultiRecipientPicker
          label="Pilih User / Grup Tambahan"
          users={allUsers}
          groups={allGroups}
          selectedUserIds={extraUserIds}
          selectedGroupIds={extraGroupIds}
          onUserChange={setExtraUserIds}
          onGroupChange={setExtraGroupIds}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={handleSave} disabled={saving || !plantId || !categoryId || !detail.trim()}>
          {saving ? "Menyimpan..." : "Kirim Laporan"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function IncidentDetail({ incident, onClose, onUpdate, actions, preventiveActions }: {
  incident: Incident; onClose: () => void;
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
  actions: Action[]; preventiveActions: PreventiveAction[];
}) {
  const canUpdate = incident.status !== "closed";
  const { data: allIncidentTypes = [] } = useQuery<ApiIncidentType[]>({ queryKey: ["incident-types"], queryFn: () => api.get("/incident-types") });
  const incidentTypes = allIncidentTypes.filter(t => t.categoryId === incident.categoryId || t.categoryId == null);
  const [incidentType, setIncidentType] = useState(incident.incidentType ?? "none");
  const [actionId, setActionId] = useState(String(incident.actionId ?? "none"));
  const [preventiveActionId, setPreventiveActionId] = useState(String(incident.preventiveActionId ?? "none"));
  const [targetDate, setTargetDate] = useState(incident.targetDate ?? "");
  const [followupNote, setFollowupNote] = useState(incident.followupNote ?? "");
  const [saving, setSaving] = useState(false);

  const handleResolve = async (status: string) => {
    setSaving(true);
    try {
      await onUpdate({
        status,
        incidentType: incidentType !== "none" ? incidentType : null,
        actionId: actionId !== "none" ? parseInt(actionId) : null,
        preventiveActionId: preventiveActionId !== "none" ? parseInt(preventiveActionId) : null,
        targetDate: targetDate || null,
        followupNote: followupNote.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <StatusBadge status={incident.status} />
        {incident.incidentType && <IncidentTypeBadge type={incident.incidentType} />}
        {incident.categoryRiskLevel && <RiskBadge level={incident.categoryRiskLevel} />}
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-500 mb-1">Detail Kejadian</p>
        <p className="text-gray-900">{incident.detail}</p>
      </div>
      {incident.rootCause && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-sm font-medium text-orange-800 mb-1">Root Cause / Akar Masalah</p>
          <p className="text-sm text-orange-700">{incident.rootCause}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-gray-500">Plant:</span> <span className="font-medium">{incident.plantName}</span></div>
        <div><span className="text-gray-500">Kategori:</span> <span className="font-medium">{incident.categoryName}</span></div>
        <div><span className="text-gray-500">Tgl Kejadian:</span> <span className="font-medium">{incident.incidentDate}</span></div>
        <div><span className="text-gray-500">Tgl Laporan:</span> <span className="font-medium">{incident.reportedDate}</span></div>
        <div><span className="text-gray-500">Pelapor:</span> <span className="font-medium">{incident.reporterName}</span></div>
        {incident.actionName && <div><span className="text-gray-500">Tindakan:</span> <span className="font-medium">{incident.actionName}</span></div>}
        {incident.preventiveActionName && <div><span className="text-gray-500">Preventif:</span> <span className="font-medium">{incident.preventiveActionName}</span></div>}
        {incident.targetDate && <div><span className="text-gray-500">Target Selesai:</span> <span className="font-medium">{incident.targetDate}</span></div>}
        {incident.closedAt && <div><span className="text-gray-500">Ditutup:</span> <span className="font-medium">{incident.closedAt}</span></div>}
        {incident.assignedGroupName && (
          <div className="col-span-2">
            <span className="text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" />Group PIC:</span>
            <span className="font-medium text-blue-700 ml-1">{incident.assignedGroupName}</span>
          </div>
        )}
      </div>
      {incident.needsFurtherAction && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          ⚠️ Perlu tindak lanjut{incident.assignedGroupName ? ` · PIC: ${incident.assignedGroupName}` : ""}
        </div>
      )}
      {incident.followupNote && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <p className="font-medium text-blue-800 mb-1">Catatan Followup</p>
          <p className="text-blue-700">{incident.followupNote}</p>
        </div>
      )}
      {canUpdate && incident.status !== "closed" && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-sm font-medium text-gray-700">Resolusi Incident</p>
          <div className="space-y-2">
            <Label>Tipe Incident</Label>
            <Select value={incidentType} onValueChange={setIncidentType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="none">Tidak Ditentukan</SelectItem>
                {incidentTypes.map(t => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tindakan Penanganan</Label>
              <Select value={actionId} onValueChange={setActionId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih tindakan...</SelectItem>
                  {actions.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tindakan Preventif</Label>
              <Select value={preventiveActionId} onValueChange={setPreventiveActionId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih tindakan preventif...</SelectItem>
                  {preventiveActions.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Target Tanggal Penyelesaian</Label>
            <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Catatan Tindak Lanjut</Label>
            <Textarea value={followupNote} onChange={e => setFollowupNote(e.target.value)}
              placeholder="Deskripsikan tindakan yang sudah/akan dilakukan..." rows={3} />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Tutup</Button>
            {incident.status === "open" && (
              <Button variant="outline" className="text-amber-600 border-amber-300"
                disabled={saving} onClick={() => handleResolve("in_progress")}>Tandai Proses</Button>
            )}
            <Button className="bg-green-600 hover:bg-green-700"
              disabled={saving} onClick={() => handleResolve("closed")}>Tutup Incident</Button>
          </DialogFooter>
        </div>
      )}
      {(!canUpdate || incident.status === "closed") && (
        <DialogFooter><Button variant="outline" onClick={onClose}>Tutup</Button></DialogFooter>
      )}
    </div>
  );
}

export default function IncidentsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const search = useSearch();

  const [newOpen, setNewOpen] = useState(false);
  const [detailIncident, setDetailIncident] = useState<Incident | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "in_progress" | "closed">("open");
  const [sortMode, setSortMode] = useState<SortMode>("reportedDate");
  const [dateFrom, setDateFrom] = useState(twoMonthsAgo());
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterRisk, setFilterRisk] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const cat = params.get("category");
    const risk = params.get("risk");
    if (cat) { setFilterCategory(cat); setFilterStatus("all"); setDateFrom(""); setDateTo(""); }
    if (risk && risk !== "all") setFilterRisk(risk);
    else setFilterRisk("");
    if (cat || risk) setPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data: incidents = [], isLoading } = useQuery<Incident[]>({
    queryKey: ["incidents"], queryFn: () => api.get("/incidents"),
  });
  const { data: plants = [] } = useQuery<Plant[]>({ queryKey: ["plants"], queryFn: () => api.get("/plants") });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["categories"], queryFn: () => api.get("/categories") });
  const { data: actions = [] } = useQuery<Action[]>({ queryKey: ["actions"], queryFn: () => api.get("/actions") });
  const { data: preventiveActions = [] } = useQuery<PreventiveAction[]>({ queryKey: ["preventive-actions"], queryFn: () => api.get("/preventive-actions") });
  const { data: incidentTypesMaster = [] } = useQuery<ApiIncidentType[]>({ queryKey: ["incident-types"], queryFn: () => api.get("/incident-types") });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/incidents", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["incidents"] }); setNewOpen(false); toast({ title: "Laporan berhasil dikirim" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateIncident = async (id: number, data: Record<string, unknown>) => {
    await api.put(`/incidents/${id}`, data);
    queryClient.invalidateQueries({ queryKey: ["incidents"] });
    setDetailIncident(null);
    if (data.status === "closed") toast({ title: "Incident ditutup" });
    else if (data.status === "in_progress") toast({ title: "Incident ditandai proses" });
    else toast({ title: "Incident diperbarui" });
  };

  const filtered = useMemo(() => {
    let list = incidents.filter(i => {
      if (filterStatus !== "all" && i.status !== filterStatus) return false;
      if (dateFrom && i.reportedDate < dateFrom) return false;
      if (dateTo && i.reportedDate > dateTo) return false;
      if (filterCategory && i.categoryName !== filterCategory) return false;
      if (filterRisk && i.categoryRiskLevel !== filterRisk) return false;
      if (filterType && i.incidentType !== filterType) return false;
      return true;
    });
    if (sortMode === "reportedDate") list = [...list].sort((a, b) => b.reportedDate.localeCompare(a.reportedDate));
    else list = [...list].sort((a, b) => agingDays(b.reportedDate) - agingDays(a.reportedDate));
    return list;
  }, [incidents, filterStatus, sortMode, dateFrom, dateTo, filterCategory, filterRisk, filterType]);

  const clearDashboardFilter = () => {
    setFilterCategory(""); setFilterRisk(""); setFilterType("");
    setFilterStatus("open"); setDateFrom(twoMonthsAgo());
    setDateTo(new Date().toISOString().slice(0, 10)); setPage(1);
  };
  const resetPage = () => setPage(1);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const typeMap: Record<string, string> = incidentTypesMaster.reduce((m, t) => ({ ...m, [t.code]: t.label }), { near_miss: "Near Miss", accident: "Accident", unsafe_act: "Unsafe Act", unsafe_condition: "Unsafe Condition" });

  return (
    <div className="p-6">
      <PageHeader
        title="Hazard & Incident"
        subtitle={`${filtered.length} laporan ditemukan`}
        action={
          <Button onClick={() => setNewOpen(true)} className="bg-red-600 hover:bg-red-700">
            <Plus className="w-4 h-4 mr-2" />Laporkan Incident
          </Button>
        }
      />

      {(filterCategory || filterRisk) && (
        <div className="mb-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
          <span className="text-blue-700 font-medium">Filter dari Dashboard:</span>
          {filterCategory && <span className="bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-md text-xs font-semibold">Kategori: {filterCategory}</span>}
          {filterRisk && <span className="bg-orange-100 text-orange-800 border border-orange-300 px-2 py-0.5 rounded-md text-xs font-semibold">Severity: {filterRisk}</span>}
          <button onClick={clearDashboardFilter} className="ml-auto text-xs text-blue-600 hover:text-blue-800 underline">Hapus Filter</button>
        </div>
      )}

      <div className="bg-white border rounded-lg p-3 mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium">Status</p>
          <div className="flex gap-1.5">
            {(["all", "open", "in_progress", "closed"] as const).map(f => (
              <Button key={f} variant={filterStatus === f ? "default" : "outline"} size="sm" className="h-7 text-xs px-2.5"
                onClick={() => { setFilterStatus(f); resetPage(); }}>
                {f === "all" ? "Semua" : f === "open" ? "Open" : f === "in_progress" ? "Proses" : "Selesai"}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium">Tipe Incident</p>
          <Select value={filterType || "all"} onValueChange={v => { setFilterType(v === "all" ? "" : v); resetPage(); }}>
            <SelectTrigger className="h-7 text-xs w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              {incidentTypesMaster.map(t => (
                <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium">Tgl Pelaporan</p>
          <div className="flex items-center gap-1.5">
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); resetPage(); }} className="h-7 text-xs w-32" />
            <span className="text-xs text-gray-400">s/d</span>
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); resetPage(); }} className="h-7 text-xs w-32" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium">Urutkan</p>
          <div className="flex gap-1.5">
            {(["reportedDate", "aging"] as const).map(m => (
              <Button key={m} size="sm" className="h-7 text-xs px-2.5 gap-1" variant={sortMode === m ? "default" : "outline"}
                onClick={() => { setSortMode(m); resetPage(); }}>
                <ArrowUpDown className="w-3 h-3" />{m === "reportedDate" ? "Tgl Pelaporan" : "Aging"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Tidak ada incident dalam rentang filter ini</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map(inc => {
              const aging = agingDays(inc.reportedDate);
              return (
                <Card key={inc.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailIncident(inc)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <StatusBadge status={inc.status} />
                          {inc.incidentType && <IncidentTypeBadge type={inc.incidentType} />}
                          {inc.categoryRiskLevel && <RiskBadge level={inc.categoryRiskLevel} />}
                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-medium">{inc.categoryName}</span>
                          {inc.needsFurtherAction && (
                            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-medium">⚠ Tindak Lanjut</span>
                          )}
                          {inc.preventiveActionName && (
                            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                              <ShieldAlert className="w-3 h-3" />{inc.preventiveActionName}
                            </span>
                          )}
                          {inc.assignedGroupName && (
                            <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                              <Users className="w-3 h-3" />{inc.assignedGroupName}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${aging > 48 ? "bg-red-50 text-red-600 border-red-200" : aging > 24 ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                            Aging: {aging} hari
                          </span>
                        </div>
                        <p className="text-gray-900 font-medium line-clamp-2 mb-2">{inc.detail}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{inc.plantName}</span>
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{inc.reporterName}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Kejadian: {inc.incidentDate}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Laporan: {inc.reportedDate}</span>
                          {inc.targetDate && <span className="flex items-center gap-1 text-orange-600"><Calendar className="w-3 h-3" />Target: {inc.targetDate}</span>}
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-400 rotate-[-90deg] flex-shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination page={page} total={filtered.length} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
        </>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Laporkan Incident / Hazard</DialogTitle></DialogHeader>
          {user && (
            <IncidentForm
              onSave={(d) => createMutation.mutateAsync(d)}
              onCancel={() => setNewOpen(false)}
              plants={plants} categories={categories} actions={actions} preventiveActions={preventiveActions}
              reporterId={user.id}
            />
          )}
        </DialogContent>
      </Dialog>

      {detailIncident && (
        <Dialog open={true} onOpenChange={() => setDetailIncident(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Incident #{detailIncident.id}{detailIncident.incidentType ? ` — ${typeMap[detailIncident.incidentType] ?? detailIncident.incidentType}` : ""}</DialogTitle>
            </DialogHeader>
            <IncidentDetail
              incident={detailIncident}
              onClose={() => setDetailIncident(null)}
              onUpdate={(d) => updateIncident(detailIncident.id, d)}
              actions={actions}
              preventiveActions={preventiveActions}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
