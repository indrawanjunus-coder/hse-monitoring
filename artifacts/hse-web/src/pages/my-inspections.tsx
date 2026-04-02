import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ClipboardList, CheckCircle, Clock, AlertTriangle, Play, ChevronsUpDown, User, Users, Zap, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Schedule {
  id: number; title?: string; frequency: string; status: string;
  templateId: number; templateName?: string; plantId?: number; plantName?: string;
  supervisorId?: number; supervisorName?: string; dueDate?: string;
  groupId?: number; groupName?: string;
  userIds?: number[]; groupIds?: number[];
  groups?: { id: number; name: string }[];
  lastInspectedAt?: string | null;
}

type AnswerType = "yes_no" | "text" | "master_user" | "master_group" | "master_action";

interface Question {
  id: number; text: string; answerType: AnswerType;
  isMandatory: boolean; requiresPhoto: boolean;
  expectedAnswer?: string | null; categoryName?: string; orderIndex: number;
}

interface MasterItem { id: number; name: string; nik?: string; }

type AnswerMap = Record<number, { answerYesNo?: boolean; answerText?: string; answerRefId?: number; answerRefName?: string }>;

const MASTER_META: Record<string, { label: string; icon: React.ReactNode; color: string; endpoint: string }> = {
  master_user:   { label: "Pilih User",     icon: <User className="w-3.5 h-3.5" />,  color: "text-cyan-700 bg-cyan-50 border-cyan-200",   endpoint: "/users"   },
  master_group:  { label: "Pilih Grup",     icon: <Users className="w-3.5 h-3.5" />, color: "text-indigo-700 bg-indigo-50 border-indigo-200", endpoint: "/groups" },
  master_action: { label: "Pilih Tindakan", icon: <Zap className="w-3.5 h-3.5" />,   color: "text-amber-700 bg-amber-50 border-amber-200", endpoint: "/actions" },
};

function MasterPicker({
  type, value, onChange,
}: {
  type: "master_user" | "master_group" | "master_action";
  value?: number;
  onChange: (id: number, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = MASTER_META[type];

  const { data: items = [] } = useQuery<MasterItem[]>({
    queryKey: ["master", type],
    queryFn: async () => {
      const raw = await api.get<any[]>(meta.endpoint);
      return raw.map((r: any) => ({
        id: r.id,
        name: type === "master_user" ? `${r.name}${r.nik ? ` (${r.nik})` : ""}` : r.name,
      }));
    },
    staleTime: 60000,
  });

  const selected = items.find(i => i.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between font-normal ${selected ? "" : "text-gray-400"}`}
        >
          <span className="flex items-center gap-2 truncate">
            {meta.icon}
            {selected ? selected.name : `— ${meta.label} —`}
          </span>
          <ChevronsUpDown className="w-4 h-4 ml-2 text-gray-400 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Cari ${meta.label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {items.map(item => (
                <CommandItem
                  key={item.id}
                  value={item.name}
                  onSelect={() => {
                    onChange(item.id, item.name);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 w-4 h-4 ${value === item.id ? "opacity-100" : "opacity-0"}`} />
                  {item.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function InspectionForm({ schedule, onClose }: { schedule: Schedule; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["questions", schedule.templateId],
    queryFn: () => api.get<Question[]>(`/questions?templateId=${schedule.templateId}`)
      .then(qs => [...qs].sort((a, b) => a.orderIndex - b.orderIndex)),
    staleTime: 0,
  });

  const setYesNo = (qId: number, val: boolean) =>
    setAnswers(prev => ({ ...prev, [qId]: { ...prev[qId], answerYesNo: val } }));
  const setText = (qId: number, val: string) =>
    setAnswers(prev => ({ ...prev, [qId]: { ...prev[qId], answerText: val } }));
  const setRef = (qId: number, id: number, name: string) =>
    setAnswers(prev => ({ ...prev, [qId]: { ...prev[qId], answerRefId: id, answerRefName: name } }));

  const isMasterType = (t: AnswerType) => t === "master_user" || t === "master_group" || t === "master_action";

  const mandatoryLeft = questions.filter(q => {
    if (!q.isMandatory) return false;
    const ans = answers[q.id];
    if (q.answerType === "yes_no") return ans?.answerYesNo === undefined;
    if (q.answerType === "text") return !ans?.answerText?.trim();
    if (isMasterType(q.answerType)) return ans?.answerRefId === undefined;
    return false;
  }).length;

  const handleSubmit = async () => {
    if (mandatoryLeft > 0) {
      toast({ title: "Isi semua pertanyaan wajib", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      const payload = {
        scheduleId: schedule.id,
        plantId: schedule.plantId,
        templateId: schedule.templateId,
        inspectedAt: new Date().toISOString().slice(0, 10),
        answers: questions.map(q => ({
          questionId: q.id,
          answerYesNo: answers[q.id]?.answerYesNo,
          answerText: answers[q.id]?.answerText,
          answerRefId: answers[q.id]?.answerRefId,
        })),
      };
      const result = await api.post<{ id: number; autoIncidentsCreated?: number }>("/inspections", payload);
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast({
        title: "Inspeksi berhasil disubmit",
        description: result.autoIncidentsCreated
          ? `${result.autoIncidentsCreated} incident otomatis dibuat dari jawaban tidak sesuai`
          : "Semua jawaban sesuai harapan",
      });
      onClose();
    } catch (err) {
      toast({ title: "Gagal submit", description: String(err), variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  if (isLoading) return <div className="py-8 text-center text-gray-400">Memuat pertanyaan...</div>;
  if (questions.length === 0) return (
    <div className="py-8 text-center text-gray-400">
      <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
      <p>Template ini belum memiliki pertanyaan.</p>
    </div>
  );

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
        <p className="font-medium text-blue-800">Template: {schedule.templateName}</p>
        <p className="text-blue-600 text-xs mt-0.5">Plant: {schedule.plantName} · {questions.length} pertanyaan</p>
        {mandatoryLeft > 0 && (
          <p className="text-orange-600 text-xs mt-1 font-medium">⚠ {mandatoryLeft} pertanyaan wajib belum dijawab</p>
        )}
      </div>

      {questions.map((q, i) => {
        const ans = answers[q.id];
        const isWrong = q.answerType === "yes_no" && q.expectedAnswer && ans?.answerYesNo !== undefined
          && ans.answerYesNo !== (q.expectedAnswer === "yes");
        const meta = isMasterType(q.answerType) ? MASTER_META[q.answerType] : null;

        return (
          <div key={q.id} className={`border rounded-lg p-4 ${isWrong ? "border-red-200 bg-red-50" : "bg-white"}`}>
            <div className="flex items-start gap-2 mb-3">
              <span className="text-xs font-bold text-gray-400 mt-0.5 w-6 flex-shrink-0">{i + 1}.</span>
              <div className="flex-1">
                <p className="text-sm text-gray-900">{q.text}</p>
                <div className="flex gap-1.5 mt-1 flex-wrap items-center">
                  {q.isMandatory && <span className="text-xs text-red-600 font-medium">* Wajib</span>}
                  {q.categoryName && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{q.categoryName}</span>}
                  {q.expectedAnswer && q.answerType === "yes_no" && (
                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded">
                      Harapkan: {q.expectedAnswer === "yes" ? "Ya" : "Tidak"}
                    </span>
                  )}
                  {meta && (
                    <span className={`text-xs border px-1.5 py-0.5 rounded flex items-center gap-1 ${meta.color}`}>
                      {meta.icon}{meta.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="ml-8">
              {q.answerType === "yes_no" && (
                <div className="flex gap-2">
                  <Button size="sm" variant={ans?.answerYesNo === true ? "default" : "outline"}
                    className={`flex-1 ${ans?.answerYesNo === true ? "bg-green-600 hover:bg-green-700" : ""}`}
                    onClick={() => setYesNo(q.id, true)}>
                    ✓ Ya
                  </Button>
                  <Button size="sm" variant={ans?.answerYesNo === false ? "default" : "outline"}
                    className={`flex-1 ${ans?.answerYesNo === false ? "bg-red-600 hover:bg-red-700" : ""}`}
                    onClick={() => setYesNo(q.id, false)}>
                    ✗ Tidak
                  </Button>
                </div>
              )}

              {q.answerType === "text" && (
                <Textarea rows={2} placeholder="Tulis jawaban..."
                  value={ans?.answerText ?? ""}
                  onChange={e => setText(q.id, e.target.value)} />
              )}

              {isMasterType(q.answerType) && (
                <MasterPicker
                  type={q.answerType as "master_user" | "master_group" | "master_action"}
                  value={ans?.answerRefId}
                  onChange={(id, name) => setRef(q.id, id, name)}
                />
              )}
            </div>

            {isWrong && (
              <p className="ml-8 mt-2 text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />Jawaban tidak sesuai — akan otomatis dibuat incident
              </p>
            )}
          </div>
        );
      })}

      <DialogFooter className="pt-2">
        <Button variant="outline" onClick={onClose}>Batal</Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Menyimpan..." : "Submit Inspeksi"}
        </Button>
      </DialogFooter>
    </div>
  );
}

const FREQ_LABEL: Record<string, string> = {
  daily: "Harian", weekly: "Mingguan", monthly: "Bulanan", quarterly: "Triwulan",
};

export default function MyInspectionsPage() {
  const { user } = useAuth();
  const [fillSchedule, setFillSchedule] = useState<Schedule | null>(null);

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ["schedules"],
    queryFn: () => api.get("/schedules"),
  });

  const mySchedules = schedules.filter(s => {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (s.userIds && s.userIds.length > 0) return s.userIds.includes(user.id);
    if (s.supervisorId) return s.supervisorId === user.id;
    return true;
  });
  const pending = mySchedules.filter(s => s.status === "active" || s.status === "pending" || !s.status);
  const completed = mySchedules.filter(s => s.status === "completed");

  return (
    <div className="p-6">
      <PageHeader title="Inspeksi Saya" subtitle="Daftar inspeksi yang perlu diisi" />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{mySchedules.length}</p>
              <p className="text-xs text-gray-500">Total Jadwal</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pending.length}</p>
              <p className="text-xs text-gray-500">Perlu Diisi</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{completed.length}</p>
              <p className="text-xs text-gray-500">Selesai</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {pending.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Perlu Diisi</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map(s => (
              <Card key={s.id} className="hover:shadow-md transition-shadow border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{s.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {s.templateName && <span>Template: {s.templateName} · </span>}
                        {FREQ_LABEL[s.frequency] ?? s.frequency}
                      </p>
                      {s.plantName && <p className="text-xs text-gray-400">{s.plantName}</p>}
                    </div>
                    <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-50 flex-shrink-0">
                      <Clock className="w-3 h-3 mr-1" />Pending
                    </Badge>
                  </div>
                  <Button size="sm" className="mt-3 w-full" onClick={() => setFillSchedule(s)}>
                    <Play className="w-3.5 h-3.5 mr-1.5" />Mulai Inspeksi
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Selesai</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {completed.map(s => (
              <div key={s.id} className="flex items-center gap-3 bg-white border border-green-200 rounded-lg px-4 py-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{s.templateName ?? s.title}</p>
                  {s.lastInspectedAt && (
                    <p className="text-xs text-gray-400 mt-0.5">Diselesaikan: {s.lastInspectedAt}</p>
                  )}
                </div>
                <Badge className="bg-green-100 text-green-700 border-green-300 flex-shrink-0 text-xs">
                  Selesai
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && mySchedules.length === 0 && (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Tidak ada jadwal inspeksi yang ditugaskan kepada Anda</p>
        </div>
      )}

      <Dialog open={!!fillSchedule} onOpenChange={open => { if (!open) setFillSchedule(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />{fillSchedule?.title}
            </DialogTitle>
          </DialogHeader>
          {fillSchedule && <InspectionForm schedule={fillSchedule} onClose={() => setFillSchedule(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
