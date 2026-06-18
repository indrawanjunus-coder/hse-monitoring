import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Target, ChevronDown, ChevronUp, X, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

interface Indicator {
  id: number;
  name: string;
  description?: string;
  type: string;
  targetPercentage: number;
  percentage: number | null;
  questionCount: number;
}

interface IndicatorQuestion {
  id: number;
  questionId: number;
  weight: number;
  text: string;
  answerType: string;
  expectedAnswer: string | null;
  templateId: number;
  templateName: string;
}

interface Template {
  id: number;
  name: string;
}

interface Question {
  id: number;
  text: string;
  answerType: string;
  expectedAnswer: string | null;
  templateId: number;
}

const INDICATOR_TYPES = ["ISO 45001", "ISO 14001", "OHSAS 18001", "SMK3", "HSE Internal"];

function PercentageRing({ value, target }: { value: number | null; target: number }) {
  if (value === null) return <div className="text-xs text-gray-400">Belum ada data</div>;
  const color = value >= target ? "text-green-600" : value >= target * 0.8 ? "text-amber-600" : "text-red-600";
  const bg = value >= target ? "bg-green-50 border-green-200" : value >= target * 0.8 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm font-bold ${bg} ${color}`}>
      <Target className="w-3.5 h-3.5" />
      {value}%
    </div>
  );
}

function IndicatorForm({ indicator, onSave, onCancel }: {
  indicator?: Indicator;
  onSave: (d: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(indicator?.name ?? "");
  const [description, setDescription] = useState(indicator?.description ?? "");
  const [type, setType] = useState(indicator?.type ?? "ISO 45001");
  const [targetPercentage, setTargetPercentage] = useState(String(indicator?.targetPercentage ?? 100));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ name: name.trim(), description: description.trim() || undefined, type, targetPercentage: parseInt(targetPercentage) || 100 }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nama Indikator *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="cth: ISO 45001 – Keselamatan Kerja" />
      </div>
      <div className="space-y-2">
        <Label>Tipe / Standar</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {INDICATOR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Target (%)</Label>
        <Input type="number" min={1} max={100} value={targetPercentage} onChange={e => setTargetPercentage(e.target.value)} className="w-28" />
      </div>
      <div className="space-y-2">
        <Label>Deskripsi</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Keterangan singkat indikator ini..." />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>{saving ? "Menyimpan..." : "Simpan"}</Button>
      </DialogFooter>
    </div>
  );
}

function QuestionLinker({ indicator }: { indicator: Indicator }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [selTemplate, setSelTemplate] = useState<string>("none");
  const [selQuestion, setSelQuestion] = useState<string>("none");
  const [weight, setWeight] = useState("1");

  const { data: questions = [] } = useQuery<IndicatorQuestion[]>({
    queryKey: ["indicator-questions", indicator.id],
    queryFn: () => api.get(`/indicators/${indicator.id}/questions`),
    enabled: open,
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: () => api.get("/templates"),
    enabled: addMode,
  });

  const { data: allQuestions = [] } = useQuery<Question[]>({
    queryKey: ["questions", selTemplate],
    queryFn: () => api.get(`/questions?templateId=${selTemplate}`),
    enabled: addMode && selTemplate !== "none",
  });

  const addMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post(`/indicators/${indicator.id}/questions`, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indicator-questions", indicator.id] });
      queryClient.invalidateQueries({ queryKey: ["indicators"] });
      setAddMode(false); setSelTemplate("none"); setSelQuestion("none"); setWeight("1");
      toast({ title: "Pertanyaan ditambahkan" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/indicators/${indicator.id}/questions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indicator-questions", indicator.id] });
      queryClient.invalidateQueries({ queryKey: ["indicators"] });
      toast({ title: "Pertanyaan dihapus" });
    },
  });

  const availableQuestions = allQuestions.filter(q => !questions.find(iq => iq.questionId === q.id));

  return (
    <div>
      <button
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium mt-2"
        onClick={() => setOpen(!open)}
      >
        <BookOpen className="w-3.5 h-3.5" />
        {indicator.questionCount} pertanyaan terhubung
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="mt-3 border rounded-lg p-3 bg-gray-50 space-y-2">
          {questions.length === 0 && (
            <p className="text-xs text-gray-500 italic">Belum ada pertanyaan terhubung. Tambahkan dari template inspeksi.</p>
          )}
          {questions.map(q => (
            <div key={q.id} className="flex items-start gap-2 bg-white border rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 line-clamp-2">{q.text}</p>
                <p className="text-xs text-gray-400 mt-0.5">{q.templateName} · Bobot: {q.weight}</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => deleteMutation.mutate(q.id)}
                  className="text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {addMode ? (
            <div className="bg-white border rounded-lg p-3 space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Template</Label>
                <Select value={selTemplate} onValueChange={v => { setSelTemplate(v); setSelQuestion("none"); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih template..." /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selTemplate !== "none" && (
                <div className="space-y-1">
                  <Label className="text-xs">Pertanyaan</Label>
                  <Select value={selQuestion} onValueChange={setSelQuestion}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih pertanyaan..." /></SelectTrigger>
                    <SelectContent>
                      {availableQuestions.length === 0 && <SelectItem value="__none" disabled>Semua sudah ditambahkan</SelectItem>}
                      {availableQuestions.map(q => (
                        <SelectItem key={q.id} value={String(q.id)}>
                          {q.text.length > 60 ? q.text.slice(0, 60) + "..." : q.text}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Bobot</Label>
                <Input type="number" min={1} value={weight} onChange={e => setWeight(e.target.value)} className="h-8 text-xs w-20" />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={selQuestion === "none"}
                  onClick={() => addMutation.mutate({ questionId: parseInt(selQuestion), weight: parseInt(weight) || 1 })}
                >Tambah</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddMode(false)}>Batal</Button>
              </div>
            </div>
          ) : (
            <button
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              onClick={() => setAddMode(true)}
            >
              <Plus className="w-3 h-3" /> Tambah Pertanyaan
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function IndicatorsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editIndicator, setEditIndicator] = useState<Indicator | undefined>();

  const { data: indicators = [], isLoading } = useQuery<Indicator[]>({
    queryKey: ["indicators"],
    queryFn: () => api.get("/indicators"),
  });

  const saveMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) =>
      editIndicator ? api.put(`/indicators/${editIndicator.id}`, d) : api.post("/indicators", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indicators"] });
      setDialog(false);
      toast({ title: "Indikator disimpan" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/indicators/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indicators"] });
      toast({ title: "Indikator dihapus" });
    },
  });

  const handleSeed = async () => {
    await api.post("/indicators", { name: "ISO 45001 – Keselamatan & Kesehatan Kerja", type: "ISO 45001", targetPercentage: 90, description: "Standar sistem manajemen K3 internasional untuk mengurangi risiko kecelakaan kerja" });
    await api.post("/indicators", { name: "ISO 14001 – Lingkungan Hidup", type: "ISO 14001", targetPercentage: 85, description: "Sistem manajemen lingkungan untuk mengontrol dampak lingkungan" });
    await api.post("/indicators", { name: "SMK3 – Sistem Manajemen K3", type: "SMK3", targetPercentage: 80, description: "Standar nasional SMK3 sesuai PP No. 50/2012" });
    queryClient.invalidateQueries({ queryKey: ["indicators"] });
    toast({ title: "Data contoh ditambahkan" });
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Master Indikator"
        subtitle="Kelola indikator EHS (ISO, SMK3, dll.) dan pertanyaan yang mempengaruhi persentasenya"
        action={
          <div className="flex gap-2">
            {indicators.length === 0 && (
              <Button variant="outline" onClick={handleSeed}>Tambah Contoh Data</Button>
            )}
            <Button onClick={() => { setEditIndicator(undefined); setDialog(true); }}>
              <Plus className="w-4 h-4 mr-2" />Tambah Indikator
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : indicators.length === 0 ? (
        <div className="text-center py-16">
          <Target className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Belum ada indikator</p>
          <p className="text-gray-400 text-sm mt-1">Tambah indikator seperti ISO 45001 dan hubungkan dengan pertanyaan inspeksi</p>
          <div className="flex gap-3 justify-center mt-5">
            <Button variant="outline" onClick={handleSeed}>Tambah Contoh Data</Button>
            <Button onClick={() => { setEditIndicator(undefined); setDialog(true); }}>
              <Plus className="w-4 h-4 mr-2" />Tambah Indikator
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {indicators.map(ind => {
            const pct = ind.percentage;
            const barColor = pct === null ? "bg-gray-200" : pct >= ind.targetPercentage ? "bg-green-500" : pct >= ind.targetPercentage * 0.8 ? "bg-amber-500" : "bg-red-500";

            return (
              <div key={ind.id} className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug">{ind.name}</h3>
                    <Badge variant="secondary" className="mt-1 text-xs">{ind.type}</Badge>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={() => { setEditIndicator(ind); setDialog(true); }}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    {isAdmin && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                        onClick={() => { if (confirm(`Hapus "${ind.name}"?`)) deleteMutation.mutate(ind.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {ind.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{ind.description}</p>
                )}

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Pencapaian</span>
                    <div className="flex items-center gap-2">
                      <PercentageRing value={pct} target={ind.targetPercentage} />
                      <span className="text-xs text-gray-400">Target: {ind.targetPercentage}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
                    />
                  </div>
                </div>

                <QuestionLinker indicator={ind} />
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editIndicator ? "Edit Indikator" : "Tambah Indikator"}</DialogTitle>
          </DialogHeader>
          <IndicatorForm
            indicator={editIndicator}
            onSave={d => saveMutation.mutateAsync(d)}
            onCancel={() => setDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
