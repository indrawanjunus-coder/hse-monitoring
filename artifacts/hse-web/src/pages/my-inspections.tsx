import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, CheckCircle, Clock, AlertTriangle, Play } from "lucide-react";
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
interface Question {
  id: number; text: string; answerType: "yes_no" | "text";
  isMandatory: boolean; requiresPhoto: boolean;
  expectedAnswer?: string | null; categoryName?: string; orderIndex: number;
}

type AnswerMap = Record<number, { answerYesNo?: boolean; answerText?: string }>;

function InspectionForm({ schedule, onClose }: { schedule: Schedule; onClose: () => void }) {
  const { user } = useAuth();
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

  const mandatoryLeft = questions.filter(q => q.isMandatory && q.answerType === "yes_no" && answers[q.id]?.answerYesNo === undefined).length
    + questions.filter(q => q.isMandatory && q.answerType === "text" && !answers[q.id]?.answerText?.trim()).length;

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

        return (
          <div key={q.id} className={`border rounded-lg p-4 ${isWrong ? "border-red-200 bg-red-50" : "bg-white"}`}>
            <div className="flex items-start gap-2 mb-3">
              <span className="text-xs font-bold text-gray-400 mt-0.5 w-6 flex-shrink-0">{i + 1}.</span>
              <div className="flex-1">
                <p className="text-sm text-gray-900">{q.text}</p>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {q.isMandatory && <span className="text-xs text-red-600 font-medium">* Wajib</span>}
                  {q.categoryName && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{q.categoryName}</span>}
                  {q.expectedAnswer && q.answerType === "yes_no" && (
                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded">
                      Harapkan: {q.expectedAnswer === "yes" ? "Ya" : "Tidak"}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {q.answerType === "yes_no" ? (
              <div className="flex gap-2 ml-8">
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
            ) : (
              <Textarea className="ml-8" rows={2} placeholder="Tulis jawaban..."
                value={ans?.answerText ?? ""}
                onChange={e => setText(q.id, e.target.value)} />
            )}
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

  // Filter to schedules that belong to this user via userIds array, supervisorId, or all if no user assignment
  const mySchedules = schedules.filter(s => {
    if (!user) return false;
    // Admin/supervisor can see all
    if (user.role === "admin") return true;
    // Check junction-based user assignment
    if (s.userIds && s.userIds.length > 0) return s.userIds.includes(user.id);
    // Fall back to legacy supervisorId
    if (s.supervisorId) return s.supervisorId === user.id;
    // If no specific assignment, show to all
    return true;
  });
  const pending = mySchedules.filter(s => s.status === "active" || s.status === "pending" || !s.status);
  const completed = mySchedules.filter(s => s.status === "completed");

  return (
    <div className="p-6">
      <PageHeader
        title="Inspeksi Saya"
        subtitle="Daftar inspeksi yang perlu diisi"
      />
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
