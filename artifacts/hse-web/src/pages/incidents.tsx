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
import { RiskBadge, StatusBadge } from "@/components/badges";
import { Plus, AlertTriangle, MapPin, User, Calendar, ChevronDown, Users, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

interface Incident {
  id: number;
  reporterName: string;
  plantName: string;
  categoryName: string;
  categoryRiskLevel?: "high" | "medium" | "low";
  incidentDate: string;
  reportedDate: string;
  detail: string;
  actionId?: number | null;
  actionName?: string | null;
  followupNote?: string | null;
  needsFurtherAction: boolean;
  status: "open" | "in_progress" | "closed";
  closedAt?: string | null;
  assignedGroupName?: string | null;
}
interface Plant { id: number; name: string }
interface Category { id: number; name: string; riskLevel?: string }
interface Action { id: number; name: string }

type SortMode = "reportedDate" | "aging";

const PAGE_SIZE_OPTIONS = [20, 50];

function agingDays(reportedDate: string): number {
  const reported = new Date(reportedDate).getTime();
  const now = Date.now();
  return Math.floor((now - reported) / (1000 * 60 * 60 * 24));
}

function twoMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d.toISOString().slice(0, 10);
}

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
        <span>per halaman · {total} total</span>
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

function IncidentForm({ onSave, onCancel, plants, categories, actions, reporterId }: {
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  plants: Plant[]; categories: Category[]; actions: Action[];
  reporterId: number;
}) {
  const today = new Date().toISOString().split("T")[0]!;
  const [plantId, setPlantId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [incidentDate, setIncidentDate] = useState(today);
  const [detail, setDetail] = useState("");
  const [actionId, setActionId] = useState("none");
  const [needsFurtherAction, setNeedsFurtherAction] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!plantId || !categoryId || !detail.trim()) return;
    setSaving(true);
    try {
      await onSave({
        reporterId,
        plantId: parseInt(plantId),
        categoryId: parseInt(categoryId),
        incidentDate,
        detail: detail.trim(),
        actionId: (actionId && actionId !== "none") ? parseInt(actionId) : undefined,
        needsFurtherAction,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Plant *</Label>
          <Select value={plantId} onValueChange={setPlantId}>
            <SelectTrigger><SelectValue placeholder="Pilih plant" /></SelectTrigger>
            <SelectContent>
              {plants.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Kategori *</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Tanggal Kejadian *</Label>
        <Input type="date" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Detail Laporan *</Label>
        <Textarea
          value={detail}
          onChange={e => setDetail(e.target.value)}
          placeholder="Deskripsikan kejadian secara detail..."
          rows={4}
        />
      </div>
      <div className="space-y-2">
        <Label>Tindakan yang Dilakukan</Label>
        <Select value={actionId} onValueChange={setActionId}>
          <SelectTrigger><SelectValue placeholder="Pilih tindakan (opsional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Tidak ada</SelectItem>
            {actions.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="furtherAction"
          checked={needsFurtherAction}
          onCheckedChange={v => setNeedsFurtherAction(v === true)}
        />
        <Label htmlFor="furtherAction">Perlu tindak lanjut lebih lanjut</Label>
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

function IncidentDetail({ incident, onClose, onUpdate, actions }: {
  incident: Incident; onClose: () => void;
  onUpdate: (data: Record<string, unknown>) => Promise<void>;
  actions: Action[];
}) {
  const { user } = useAuth();
  const canUpdate = user?.role === "admin" || user?.role === "supervisor";
  const [actionId, setActionId] = useState(String(incident.actionId ?? "none"));
  const [followupNote, setFollowupNote] = useState(incident.followupNote ?? "");
  const [saving, setSaving] = useState(false);

  const handleResolve = async (status: string) => {
    setSaving(true);
    try {
      await onUpdate({
        status,
        actionId: actionId !== "none" ? parseInt(actionId) : null,
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
        {incident.categoryRiskLevel && <RiskBadge level={incident.categoryRiskLevel} />}
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-500 mb-1">Detail Kejadian</p>
        <p className="text-gray-900">{incident.detail}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-gray-500">Plant:</span> <span className="font-medium">{incident.plantName}</span></div>
        <div><span className="text-gray-500">Kategori:</span> <span className="font-medium">{incident.categoryName}</span></div>
        <div><span className="text-gray-500">Tgl Kejadian:</span> <span className="font-medium">{incident.incidentDate}</span></div>
        <div><span className="text-gray-500">Tgl Laporan:</span> <span className="font-medium">{incident.reportedDate}</span></div>
        <div><span className="text-gray-500">Pelapor:</span> <span className="font-medium">{incident.reporterName}</span></div>
        {incident.actionName && <div><span className="text-gray-500">Tindakan:</span> <span className="font-medium">{incident.actionName}</span></div>}
        {incident.closedAt && <div><span className="text-gray-500">Ditutup:</span> <span className="font-medium">{incident.closedAt}</span></div>}
        {incident.assignedGroupName && (
          <div className="col-span-2">
            <span className="text-gray-500 flex items-center gap-1">
              <Users className="w-3 h-3" />Group PIC:
            </span>
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
            <Label>Catatan Tindak Lanjut</Label>
            <Textarea
              value={followupNote}
              onChange={e => setFollowupNote(e.target.value)}
              placeholder="Deskripsikan tindakan yang sudah/akan dilakukan..."
              rows={3}
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Tutup</Button>
            {incident.status === "open" && (
              <Button variant="outline" className="text-amber-600 border-amber-300"
                disabled={saving} onClick={() => handleResolve("in_progress")}>
                Tandai Proses
              </Button>
            )}
            <Button className="bg-green-600 hover:bg-green-700"
              disabled={saving} onClick={() => handleResolve("closed")}>
              Tutup Incident
            </Button>
          </DialogFooter>
        </div>
      )}
      {(!canUpdate || incident.status === "closed") && (
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </DialogFooter>
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
  const [filterRisk, setFilterRisk] = useState<"" | "high" | "medium" | "low">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const cat = params.get("category");
    const risk = params.get("risk");
    if (cat) {
      setFilterCategory(cat);
      setFilterStatus("all");
      setDateFrom("");
      setDateTo("");
    }
    if (risk && risk !== "all") {
      setFilterRisk(risk as "high" | "medium" | "low");
    } else {
      setFilterRisk("");
    }
    if (cat || risk) setPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data: incidents = [], isLoading } = useQuery<Incident[]>({
    queryKey: ["incidents"],
    queryFn: () => api.get("/incidents"),
  });
  const { data: plants = [] } = useQuery<Plant[]>({ queryKey: ["plants"], queryFn: () => api.get("/plants") });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["categories"], queryFn: () => api.get("/categories") });
  const { data: actions = [] } = useQuery<Action[]>({ queryKey: ["actions"], queryFn: () => api.get("/actions") });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/incidents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      setNewOpen(false);
      toast({ title: "Laporan berhasil dikirim" });
    },
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
      return true;
    });
    if (sortMode === "reportedDate") {
      list = [...list].sort((a, b) => b.reportedDate.localeCompare(a.reportedDate));
    } else {
      list = [...list].sort((a, b) => agingDays(a.reportedDate) > agingDays(b.reportedDate) ? -1 : 1);
    }
    return list;
  }, [incidents, filterStatus, sortMode, dateFrom, dateTo, filterCategory, filterRisk]);

  const clearDashboardFilter = () => {
    setFilterCategory("");
    setFilterRisk("");
    setFilterStatus("open");
    setDateFrom(twoMonthsAgo());
    setDateTo(new Date().toISOString().slice(0, 10));
    setPage(1);
  };

  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  const resetPage = () => setPage(1);

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

      {/* Active dashboard filter banner */}
      {(filterCategory || filterRisk) && (
        <div className="mb-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
          <span className="text-blue-700 font-medium">Filter dari Dashboard:</span>
          {filterCategory && (
            <span className="bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-md text-xs font-semibold">
              Kategori: {filterCategory}
            </span>
          )}
          {filterRisk && (
            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${
              filterRisk === "high" ? "bg-red-100 text-red-700 border-red-300" :
              filterRisk === "medium" ? "bg-amber-100 text-amber-700 border-amber-300" :
              "bg-green-100 text-green-700 border-green-300"
            }`}>
              Risk: {filterRisk === "high" ? "High" : filterRisk === "medium" ? "Medium" : "Low"}
            </span>
          )}
          <button onClick={clearDashboardFilter}
            className="ml-auto text-xs text-blue-600 hover:text-blue-800 underline">
            Hapus Filter
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border rounded-lg p-3 mb-4 flex flex-wrap items-end gap-3">
        {/* Status filter */}
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium">Status</p>
          <div className="flex gap-1.5">
            {(["all", "open", "in_progress", "closed"] as const).map(f => (
              <Button
                key={f}
                variant={filterStatus === f ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => { setFilterStatus(f); resetPage(); }}
              >
                {f === "all" ? "Semua" : f === "open" ? "Open" : f === "in_progress" ? "Proses" : "Selesai"}
              </Button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium">Tgl Pelaporan</p>
          <div className="flex items-center gap-1.5">
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); resetPage(); }}
              className="h-7 text-xs w-32" />
            <span className="text-xs text-gray-400">s/d</span>
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); resetPage(); }}
              className="h-7 text-xs w-32" />
          </div>
        </div>

        {/* Sort */}
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium">Urutkan</p>
          <div className="flex gap-1.5">
            <Button size="sm" className="h-7 text-xs px-2.5 gap-1"
              variant={sortMode === "reportedDate" ? "default" : "outline"}
              onClick={() => { setSortMode("reportedDate"); resetPage(); }}>
              <ArrowUpDown className="w-3 h-3" />Tgl Pelaporan
            </Button>
            <Button size="sm" className="h-7 text-xs px-2.5 gap-1"
              variant={sortMode === "aging" ? "default" : "outline"}
              onClick={() => { setSortMode("aging"); resetPage(); }}>
              <ArrowUpDown className="w-3 h-3" />Aging
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Tidak ada incident{filterStatus !== "all" ? " dengan status ini" : ""} dalam rentang tanggal ini</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map(inc => {
              const aging = agingDays(inc.reportedDate);
              return (
                <Card
                  key={inc.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setDetailIncident(inc)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <StatusBadge status={inc.status} />
                          {inc.categoryRiskLevel && <RiskBadge level={inc.categoryRiskLevel} />}
                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-medium">
                            {inc.categoryName}
                          </span>
                          {inc.needsFurtherAction && (
                            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-medium">
                              ⚠ Tindak Lanjut
                            </span>
                          )}
                          {inc.assignedGroupName && (
                            <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                              <Users className="w-3 h-3" />{inc.assignedGroupName}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${aging > 48 ? "bg-red-50 text-red-600 border border-red-200" : aging > 24 ? "bg-amber-50 text-amber-600 border border-amber-200" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                            Aging: {aging} hari
                          </span>
                        </div>
                        <p className="text-gray-900 font-medium line-clamp-2 mb-2">{inc.detail}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{inc.plantName}</span>
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{inc.reporterName}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Kejadian: {inc.incidentDate}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Laporan: {inc.reportedDate}</span>
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-400 rotate-[-90deg] flex-shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Laporkan Incident / Hazard</DialogTitle></DialogHeader>
          {user && (
            <IncidentForm
              plants={plants}
              categories={categories}
              actions={actions}
              reporterId={user.id}
              onSave={(data) => createMutation.mutateAsync(data)}
              onCancel={() => setNewOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailIncident} onOpenChange={(open) => !open && setDetailIncident(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detail Incident #{detailIncident?.id}</DialogTitle></DialogHeader>
          {detailIncident && (
            <IncidentDetail
              incident={detailIncident}
              actions={actions}
              onClose={() => setDetailIncident(null)}
              onUpdate={(data) => updateIncident(detailIncident.id, data)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
