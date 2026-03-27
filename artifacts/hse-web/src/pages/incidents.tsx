import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Plus, AlertTriangle, MapPin, User, Calendar, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

interface Incident {
  id: number;
  reporterName: string;
  plantName: string;
  categoryName: string;
  categoryRiskLevel: "high" | "medium" | "low";
  incidentDate: string;
  reportedDate: string;
  detail: string;
  actionName?: string;
  needsFurtherAction: boolean;
  status: "open" | "in_progress" | "closed";
  closedAt?: string;
  picGroupName?: string;
}
interface Plant { id: number; name: string }
interface Category { id: number; name: string; riskLevel: string }
interface Action { id: number; name: string }

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

function IncidentDetail({ incident, onClose, onUpdateStatus }: {
  incident: Incident; onClose: () => void; onUpdateStatus: (status: string) => void;
}) {
  const { user } = useAuth();
  const canUpdate = user?.role === "admin" || user?.role === "supervisor";
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <StatusBadge status={incident.status} />
        <RiskBadge level={incident.categoryRiskLevel} />
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
      </div>
      {incident.needsFurtherAction && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          ⚠️ Perlu tindak lanjut {incident.picGroupName ? `· PIC: ${incident.picGroupName}` : ""}
        </div>
      )}
      {canUpdate && incident.status !== "closed" && (
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Tutup</Button>
          {incident.status === "open" && (
            <Button variant="outline" className="text-amber-600 border-amber-300" onClick={() => onUpdateStatus("in_progress")}>
              Tandai Proses
            </Button>
          )}
          <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => onUpdateStatus("closed")}>
            Tutup Incident
          </Button>
        </DialogFooter>
      )}
    </div>
  );
}

export default function IncidentsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [detailIncident, setDetailIncident] = useState<Incident | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "in_progress" | "closed">("all");

  const now = new Date();
  const [month] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());

  const { data: incidents = [], isLoading } = useQuery<Incident[]>({
    queryKey: ["incidents"],
    queryFn: () => api.get(`/incidents?month=${month}&year=${year}`),
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

  const updateStatus = async (id: number, status: string) => {
    await api.put(`/incidents/${id}`, { status });
    queryClient.invalidateQueries({ queryKey: ["incidents"] });
    setDetailIncident(null);
    toast({ title: `Incident ${status === "closed" ? "ditutup" : "diproses"}` });
  };

  const filtered = incidents.filter(i => filterStatus === "all" || i.status === filterStatus);

  return (
    <div className="p-6">
      <PageHeader
        title="Hazard & Incident"
        subtitle="Laporan temuan hazard dan incident"
        action={
          <Button onClick={() => setNewOpen(true)} className="bg-red-600 hover:bg-red-700">
            <Plus className="w-4 h-4 mr-2" /> Laporkan Incident
          </Button>
        }
      />

      <div className="flex gap-2 mb-4">
        {(["all", "open", "in_progress", "closed"] as const).map(f => (
          <Button
            key={f}
            variant={filterStatus === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(f)}
          >
            {f === "all" ? "Semua" : f === "open" ? "Open" : f === "in_progress" ? "Proses" : "Selesai"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Tidak ada incident{filterStatus !== "all" ? " dengan status ini" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(inc => (
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
                      <RiskBadge level={inc.categoryRiskLevel} />
                      <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-medium">
                        {inc.categoryName}
                      </span>
                      {inc.needsFurtherAction && (
                        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-medium">
                          ⚠ Tindak Lanjut
                        </span>
                      )}
                    </div>
                    <p className="text-gray-900 font-medium line-clamp-2 mb-2">{inc.detail}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{inc.plantName}</span>
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{inc.reporterName}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{inc.incidentDate}</span>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 rotate-[-90deg] flex-shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Detail Incident #{detailIncident?.id}</DialogTitle></DialogHeader>
          {detailIncident && (
            <IncidentDetail
              incident={detailIncident}
              onClose={() => setDetailIncident(null)}
              onUpdateStatus={(status) => updateStatus(detailIncident.id, status)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
