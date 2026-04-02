import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
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
import {
  Plus, AlertTriangle, MapPin, User, Calendar, ChevronDown, Users,
  ArrowUpDown, ShieldAlert, Mail, Ticket, X, Search, Paperclip, FileImage, FileText, Trash2, ExternalLink, Upload, Cloud, Eye, Send, MessageSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";

async function uploadAttachment(incidentId: number, file: File): Promise<void> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("incidentId", String(incidentId));
  const token = localStorage.getItem("hse_token");
  const res = await fetch("/api/attachments/upload", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? "Upload gagal");
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === "application/pdf") return <FileText className="w-4 h-4 text-red-500" />;
  return <FileImage className="w-4 h-4 text-blue-500" />;
}

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
  picMembers?: { name: string; email: string }[];
  escalationLevel?: number;
  createdAt?: string;
  attachments?: Attachment[];
}

interface Attachment {
  id: number;
  incidentId: number;
  driveFileId: string;
  fileName: string;
  storedName: string;
  viewUrl: string;
  mimeType: string;
  fileSize: number;
  sequence: number;
  uploadedAt: string;
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
interface ApiIncidentType { id: number; code: string; label: string; isActive: boolean; categoryId?: number | null; }

function agingDays(reportedDate: string): number {
  return Math.floor((Date.now() - new Date(reportedDate).getTime()) / (1000 * 60 * 60 * 24));
}
function twoMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d.toISOString().slice(0, 10);
}

function RecipientChip({ label, type, onRemove }: { label: string; type: "group" | "user"; onRemove: () => void }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium border
      ${type === "group" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
      {type === "group" ? <Users className="w-3 h-3 flex-shrink-0" /> : <User className="w-3 h-3 flex-shrink-0" />}
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className={`ml-0.5 rounded-full p-0.5 hover:bg-opacity-20 transition-colors
          ${type === "group" ? "hover:bg-indigo-700 text-indigo-500 hover:text-indigo-800" : "hover:bg-blue-700 text-blue-500 hover:text-blue-800"}`}
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}

function RecipientPicker({ allUsers, allGroups, recipientUserIds, recipientGroupIds, onAddUser, onAddGroup }: {
  allUsers: UserItem[];
  allGroups: GroupItem[];
  recipientUserIds: number[];
  recipientGroupIds: number[];
  onAddUser: (u: UserItem) => void;
  onAddGroup: (g: GroupItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filteredGroups = allGroups.filter(g =>
    !recipientGroupIds.includes(g.id) && g.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredUsers = allUsers.filter(u =>
    !recipientUserIds.includes(u.id) &&
    (u.name.toLowerCase().includes(search.toLowerCase()) || u.nik.toLowerCase().includes(search.toLowerCase()))
  );
  const hasResults = filteredGroups.length > 0 || filteredUsers.length > 0;

  return (
    <div className="relative" ref={ref}>
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1 border-dashed"
        onClick={() => { setOpen(!open); setSearch(""); }}>
        <Plus className="w-3 h-3" />Tambah Penerima
      </Button>
      {open && (
        <div className="absolute left-0 top-8 z-50 w-72 border rounded-lg bg-white shadow-lg">
          <div className="p-2 border-b flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari user atau grup..."
              className="text-sm flex-1 outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filteredGroups.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 px-3 py-1.5 bg-gray-50 sticky top-0">Grup</p>
                {filteredGroups.map(g => (
                  <button key={g.id} type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                    onClick={() => { onAddGroup(g); if (filteredGroups.length + filteredUsers.length === 1) setOpen(false); }}>
                    <Users className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    <span className="text-gray-800">{g.name}</span>
                  </button>
                ))}
              </div>
            )}
            {filteredUsers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 px-3 py-1.5 bg-gray-50 sticky top-0">Users</p>
                {filteredUsers.map(u => (
                  <button key={u.id} type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                    onClick={() => { onAddUser(u); if (filteredGroups.length + filteredUsers.length === 1) setOpen(false); }}>
                    <User className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <span className="text-gray-800">{u.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{u.nik}</span>
                  </button>
                ))}
              </div>
            )}
            {!hasResults && (
              <p className="text-xs text-gray-400 text-center py-4">
                {search ? "Tidak ditemukan" : "Semua sudah ditambahkan"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IncidentForm({ onSave, onDone, onCancel, plants, categories, actions, preventiveActions, reporterId }: {
  onSave: (data: Record<string, unknown>) => Promise<{ id: number }>;
  onDone: () => void;
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recipientGroupIds, setRecipientGroupIds] = useState<number[]>([]);
  const [recipientUserIds, setRecipientUserIds] = useState<number[]>([]);

  const availableTypes = incidentTypes.filter(t => t.isActive && (categoryId ? t.categoryId === parseInt(categoryId) : !t.categoryId));
  const selectedCategory = categories.find(c => c.id === parseInt(categoryId));

  useEffect(() => {
    if (!availableTypes.find(t => t.code === incidentType)) {
      setIncidentType(availableTypes[0]?.code ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, incidentTypes]);

  useEffect(() => {
    if (selectedCategory) {
      setRecipientGroupIds(selectedCategory.groupIds ?? []);
      setRecipientUserIds(selectedCategory.userIds ?? []);
    } else {
      setRecipientGroupIds([]);
      setRecipientUserIds([]);
    }
  }, [categoryId]);

  const recipientGroups = allGroups.filter(g => recipientGroupIds.includes(g.id));
  const recipientUsers = allUsers.filter(u => recipientUserIds.includes(u.id));

  const removeGroup = (id: number) => setRecipientGroupIds(prev => prev.filter(x => x !== id));
  const removeUser = (id: number) => setRecipientUserIds(prev => prev.filter(x => x !== id));
  const addGroup = (g: GroupItem) => setRecipientGroupIds(prev => prev.includes(g.id) ? prev : [...prev, g.id]);
  const addUser = (u: UserItem) => setRecipientUserIds(prev => prev.includes(u.id) ? prev : [...prev, u.id]);

  const handleSave = async () => {
    if (!plantId || !categoryId || !detail.trim()) return;
    setSaving(true);
    try {
      const created = await onSave({
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
        recipientUserIds,
        recipientGroupIds,
      });

      if (pendingFiles.length > 0) {
        const errs: string[] = [];
        for (let i = 0; i < pendingFiles.length; i++) {
          const f = pendingFiles[i]!;
          setUploadStatus(`Mengupload file ${i + 1}/${pendingFiles.length}: ${f.name}`);
          try {
            await uploadAttachment(created.id, f);
          } catch (e: any) {
            errs.push(`${f.name}: ${e.message ?? "gagal"}`);
          }
        }
        setUploadStatus("");
        if (errs.length > 0) {
          setUploadErrors(errs);
          return;
        }
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPendingFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...files.filter(f => !existing.has(f.name + f.size))];
    });
    e.target.value = "";
  };

  const removeFile = (idx: number) => setPendingFiles(prev => prev.filter((_, i) => i !== idx));

  const picGroupName = selectedCategory?.picGroupName;
  const totalRecipients = recipientGroups.length + recipientUsers.length;

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
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <Ticket className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-blue-800">Tiket Incident</span>
              {picGroupName ? (
                <p className="text-blue-700 mt-0.5">Akan ditangani oleh Group PIC: <span className="font-semibold">{picGroupName}</span></p>
              ) : (
                <p className="text-blue-600 italic mt-0.5">Belum ada Group PIC untuk kategori ini</p>
              )}
            </div>
          </div>

          <div className="border-t border-blue-200 pt-2.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-semibold text-blue-800 text-sm">Penerima Email Notifikasi</span>
                {totalRecipients > 0 && (
                  <span className="text-xs text-blue-500">({totalRecipients} penerima)</span>
                )}
              </div>
              <RecipientPicker
                allUsers={allUsers}
                allGroups={allGroups}
                recipientUserIds={recipientUserIds}
                recipientGroupIds={recipientGroupIds}
                onAddUser={addUser}
                onAddGroup={addGroup}
              />
            </div>
            {totalRecipients === 0 ? (
              <p className="text-xs text-blue-500 italic py-1">
                Tidak ada penerima — email tidak akan dikirim. Klik "Tambah Penerima" untuk menambahkan.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {recipientGroups.map(g => (
                  <RecipientChip key={`g-${g.id}`} label={g.name} type="group" onRemove={() => removeGroup(g.id)} />
                ))}
                {recipientUsers.map(u => (
                  <RecipientChip key={`u-${u.id}`} label={u.name} type="user" onRemove={() => removeUser(u.id)} />
                ))}
              </div>
            )}
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

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-gray-400" />
          Lampiran Foto / PDF
          <span className="text-xs text-gray-400 font-normal">(opsional, maks 20MB per file)</span>
        </Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-lg p-4 cursor-pointer transition-colors bg-gray-50 hover:bg-blue-50 text-sm text-gray-500 hover:text-blue-600"
        >
          <Upload className="w-4 h-4" />
          Klik untuk pilih foto atau PDF
        </div>
        {pendingFiles.length > 0 && (
          <div className="space-y-1.5">
            {pendingFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm">
                {f.type === "application/pdf" ? <FileText className="w-4 h-4 text-red-500 shrink-0" /> : <FileImage className="w-4 h-4 text-blue-500 shrink-0" />}
                <span className="truncate flex-1">{f.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{formatBytes(f.size)}</span>
                <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {uploadStatus && (
          <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-md px-3 py-2">
            <Cloud className="w-4 h-4 animate-pulse" />
            {uploadStatus}
          </div>
        )}
        {uploadErrors.length > 0 && (
          <div className="space-y-1 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            <p className="font-medium">Beberapa file gagal diupload:</p>
            {uploadErrors.map((e, i) => <p key={i} className="text-xs">{e}</p>)}
            <button className="text-xs underline text-red-600 mt-1" onClick={onDone}>Tutup tanpa menunggu</button>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={handleSave} disabled={saving || !plantId || !categoryId || !detail.trim()}>
          {saving ? (uploadStatus || "Menyimpan...") : "Kirim Laporan"}
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
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [addUploadStatus, setAddUploadStatus] = useState("");
  const [addUploadErrors, setAddUploadErrors] = useState<string[]>([]);
  const [addUploading, setAddUploading] = useState(false);
  const addFileRef = useRef<HTMLInputElement>(null);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: comments = [], refetch: refetchComments } = useQuery<{
    id: number; incidentId: number; userId: number | null; userName: string | null; content: string; createdAt: string;
  }[]>({
    queryKey: ["incident-comments", incident.id],
    queryFn: () => api.get(`/incidents/${incident.id}/comments`),
  });

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      await api.post(`/incidents/${incident.id}/comments`, { content: commentText.trim() });
      setCommentText("");
      refetchComments();
    } catch (e: any) {
      toast({ title: "Gagal kirim komentar", description: e.message, variant: "destructive" });
    } finally {
      setSendingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await api.del(`/incidents/${incident.id}/comments/${commentId}`);
      refetchComments();
    } catch (e: any) {
      toast({ title: "Gagal hapus komentar", description: e.message, variant: "destructive" });
    }
  };

  const handleAddFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    setAddUploading(true);
    setAddUploadErrors([]);
    const errs: string[] = [];
    for (let i = 0; i < fileArr.length; i++) {
      const f = fileArr[i]!;
      if (f.size > 20 * 1024 * 1024) { errs.push(`${f.name}: ukuran melebihi 20MB`); continue; }
      setAddUploadStatus(`Mengupload ${i + 1}/${fileArr.length}: ${f.name}`);
      try {
        await uploadAttachment(incident.id, f);
      } catch (e: any) {
        errs.push(`${f.name}: ${e.message ?? "gagal"}`);
      }
    }
    setAddUploadStatus("");
    setAddUploading(false);
    if (errs.length > 0) {
      setAddUploadErrors(errs);
    } else {
      toast({ title: `${fileArr.length} lampiran berhasil diupload` });
    }
    queryClient.invalidateQueries({ queryKey: ["incidents"] });
    if (addFileRef.current) addFileRef.current.value = "";
  };

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

      {incident.picMembers && incident.picMembers.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" />Email PIC Follow-up
          </p>
          <div className="flex flex-wrap gap-1.5">
            {incident.picMembers.map((m) => (
              <span key={m.email} className="inline-flex items-center gap-1 text-xs bg-white border border-blue-200 text-blue-800 px-2 py-1 rounded-full">
                <User className="w-3 h-3 text-blue-400" />
                <span className="font-medium">{m.name}</span>
                <span className="text-blue-500">·</span>
                <a href={`mailto:${m.email}`} className="text-blue-600 hover:underline">{m.email}</a>
              </span>
            ))}
          </div>
        </div>
      )}

      {(!incident.picMembers || incident.picMembers.length === 0) && incident.assignedGroupName && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          <Mail className="w-3.5 h-3.5 inline mr-1" />
          Anggota group PIC belum memiliki email — eskalasi tidak dapat dikirim.
        </div>
      )}

      {incident.escalationLevel !== undefined && incident.escalationLevel > 0 && incident.status !== "closed" && (
        <div className={`rounded-lg p-3 text-xs font-semibold flex items-center gap-2 ${
          incident.escalationLevel >= 3 ? "bg-red-900 text-white" :
          incident.escalationLevel === 2 ? "bg-red-100 text-red-800 border border-red-300" :
          "bg-amber-100 text-amber-800 border border-amber-300"
        }`}>
          {incident.escalationLevel >= 3 ? "🚨 Eskalasi level 3 — Incident belum ditutup > 72 jam" :
           incident.escalationLevel === 2 ? "🔴 Eskalasi level 2 — Incident belum ditutup > 48 jam" :
           "⚠️ Eskalasi level 1 — Incident belum ditutup > 24 jam"}
        </div>
      )}

      {incident.needsFurtherAction && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          ⚠️ Perlu tindak lanjut{incident.assignedGroupName ? ` · PIC: ${incident.assignedGroupName}` : ""}
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
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Batal</Button>
            {incident.status === "open" && (
              <Button variant="outline" className="text-amber-600 border-amber-300"
                disabled={saving} onClick={() => handleResolve("in_progress")}>Tandai Proses</Button>
            )}
            <Button className="bg-green-600 hover:bg-green-700"
              disabled={saving} onClick={() => setShowCloseConfirm(true)}>Tutup Incident</Button>
          </DialogFooter>
        </div>
      )}
      {(!canUpdate || incident.status === "closed") && (
        <DialogFooter><Button variant="outline" onClick={onClose}>Tutup</Button></DialogFooter>
      )}

      {/* Lampiran */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5" />
            Lampiran {incident.attachments && incident.attachments.length > 0 ? `(${incident.attachments.length})` : ""}
          </p>
          <button
            onClick={() => addFileRef.current?.click()}
            disabled={addUploading}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 font-medium"
          >
            {addUploading
              ? <><Cloud className="w-3.5 h-3.5 animate-pulse" /> Mengupload...</>
              : <><Upload className="w-3.5 h-3.5" /> Tambah Lampiran</>
            }
          </button>
          <input
            ref={addFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
            multiple
            className="hidden"
            onChange={e => handleAddFiles(e.target.files)}
          />
        </div>
        {addUploadStatus && (
          <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1.5">
            <Cloud className="w-3.5 h-3.5 animate-pulse shrink-0" />
            {addUploadStatus}
          </div>
        )}
        {addUploadErrors.length > 0 && (
          <div className="space-y-0.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
            <p className="font-medium">Gagal upload:</p>
            {addUploadErrors.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}
        {incident.attachments && incident.attachments.length > 0 ? (
          <div className="space-y-1.5">
            {incident.attachments.map((a) => {
              const isImage = a.mimeType.startsWith("image/");
              return (
                <div
                  key={a.id}
                  onClick={() => isImage ? setPreviewAttachment(a) : window.open(a.viewUrl, "_blank")}
                  className="flex items-center gap-2.5 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 rounded-md px-3 py-2 text-sm transition-colors group cursor-pointer"
                >
                  <AttachmentIcon mimeType={a.mimeType} />
                  <span className="flex-1 truncate font-medium text-gray-800 group-hover:text-blue-700">{a.fileName}</span>
                  <span className="text-xs text-gray-400 shrink-0">{formatBytes(a.fileSize)}</span>
                  {isImage
                    ? <Eye className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 shrink-0" />
                    : <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 shrink-0" />
                  }
                </div>
              );
            })}
          </div>
        ) : (
          !addUploading && <p className="text-xs text-gray-400 text-center py-2">Belum ada lampiran</p>
        )}
      </div>

      {previewAttachment && (
        <Dialog open onOpenChange={() => setPreviewAttachment(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <p className="text-sm font-medium truncate">{previewAttachment.fileName}</p>
              <div className="flex items-center gap-2 shrink-0">
                <a href={previewAttachment.viewUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
                  <ExternalLink className="w-3 h-3" /> Buka di Drive
                </a>
                <button onClick={() => setPreviewAttachment(null)} className="text-gray-400 hover:text-gray-700 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="bg-black flex items-center justify-center" style={{ minHeight: 400 }}>
              <img
                src={(() => {
                  const fileId = previewAttachment.viewUrl.split("/d/")[1]?.split("/")[0] ?? "";
                  return fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : previewAttachment.viewUrl;
                })()}
                alt={previewAttachment.fileName}
                className="max-h-[70vh] max-w-full object-contain"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  const fileId = previewAttachment.viewUrl.split("/d/")[1]?.split("/")[0] ?? "";
                  if (fileId && !img.src.includes("drive.google.com")) {
                    img.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
                  }
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Comment Thread — Catatan Tindak Lanjut */}
      <div className="border-t pt-3 space-y-2">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-blue-500" />
          Catatan Tindak Lanjut {comments.length > 0 && <span className="text-xs font-normal text-gray-500">({comments.length} komentar)</span>}
        </p>
        {comments.length === 0 && (
          <p className="text-xs text-gray-400 italic py-1">Belum ada catatan. Tambahkan update perkembangan di bawah.</p>
        )}
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {comments.map(c => (
            <div key={c.id} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm relative group">
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-medium text-gray-800">{c.userName ?? "—"}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  {(c.userId === user?.id || user?.role === "admin") && (
                    <button onClick={() => handleDeleteComment(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
            placeholder="Tulis update perkembangan... (Enter untuk kirim, Shift+Enter baris baru)"
            rows={2}
            className="flex-1 text-sm resize-none"
            disabled={sendingComment}
          />
          <Button size="sm" onClick={handleSendComment} disabled={sendingComment || !commentText.trim()} className="self-end">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Konfirmasi tutup incident */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Tutup Incident?</p>
                <p className="text-sm text-gray-600 mt-1">
                  Pastikan semua pekerjaan dan tindakan perbaikan sudah benar-benar selesai dilaksanakan sebelum menutup incident ini.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCloseConfirm(false)} disabled={saving}>Batal</Button>
              <Button className="bg-green-600 hover:bg-green-700" disabled={saving}
                onClick={() => { setShowCloseConfirm(false); handleResolve("closed"); }}>
                Ya, Tutup Incident
              </Button>
            </div>
          </div>
        </div>
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
    mutationFn: (data: Record<string, unknown>) => api.post<{ id: number }>("/incidents", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["incidents"] }); },
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

  // Always derive the detail panel data from fresh query results so it auto-updates after uploads/changes
  const liveDetailIncident = detailIncident
    ? (incidents.find(i => i.id === detailIncident.id) ?? detailIncident)
    : null;

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
              {incidentTypesMaster.map(t => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}
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
              onDone={() => { setNewOpen(false); toast({ title: "Laporan berhasil dikirim" }); }}
              onCancel={() => setNewOpen(false)}
              plants={plants} categories={categories} actions={actions} preventiveActions={preventiveActions}
              reporterId={user.id}
            />
          )}
        </DialogContent>
      </Dialog>

      {liveDetailIncident && (
        <Dialog open={true} onOpenChange={() => setDetailIncident(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Incident #{liveDetailIncident.id}{liveDetailIncident.incidentType ? ` — ${typeMap[liveDetailIncident.incidentType] ?? liveDetailIncident.incidentType}` : ""}</DialogTitle>
            </DialogHeader>
            <IncidentDetail
              incident={liveDetailIncident}
              onClose={() => setDetailIncident(null)}
              onUpdate={(d) => updateIncident(liveDetailIncident.id, d)}
              actions={actions}
              preventiveActions={preventiveActions}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
