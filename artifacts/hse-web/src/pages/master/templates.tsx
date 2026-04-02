import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Edit, Trash2, LayoutTemplate, HelpCircle, ChevronUp, ChevronDown,
  Camera, Star, CheckSquare, AlignLeft, Lock, Search, Users, User, Zap,
} from "lucide-react";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";

type AnswerType = "yes_no" | "text" | "master_user" | "master_group" | "master_action";

interface Question {
  id: number; templateId: number; text: string;
  answerType: AnswerType; isMandatory: boolean; requiresPhoto: boolean;
  categoryId?: number; categoryName?: string; orderIndex: number;
  expectedAnswer?: string | null;
  questionType?: string | null;
}
interface Template { id: number; name: string; description?: string; questionCount?: number }
interface Category { id: number; name: string }

const ANSWER_TYPE_OPTIONS: { value: AnswerType; label: string; icon: React.ReactNode; hint: string }[] = [
  { value: "yes_no", label: "Ya / Tidak", icon: <CheckSquare className="w-3.5 h-3.5" />, hint: "Jawaban berupa Ya atau Tidak. Bisa otomatis trigger hazard jika jawaban tidak sesuai." },
  { value: "text", label: "Teks Bebas", icon: <AlignLeft className="w-3.5 h-3.5" />, hint: "Responden mengisi teks bebas sebagai jawaban." },
  { value: "master_user", label: "Pilih User", icon: <User className="w-3.5 h-3.5" />, hint: "Responden memilih salah satu user dari daftar user yang terdaftar di sistem." },
  { value: "master_group", label: "Pilih Grup", icon: <Users className="w-3.5 h-3.5" />, hint: "Responden memilih salah satu grup dari daftar grup yang ada." },
  { value: "master_action", label: "Pilih Tindakan", icon: <Zap className="w-3.5 h-3.5" />, hint: "Responden memilih tindakan penanganan dari daftar tindakan yang terdaftar." },
];

function getAnswerTypeMeta(type: AnswerType) {
  return ANSWER_TYPE_OPTIONS.find(o => o.value === type) ?? ANSWER_TYPE_OPTIONS[0]!;
}

function QuestionRow({ q, categories, onUpdate, onDelete, onMoveUp, onMoveDown, canEdit }: {
  q: Question; categories: Category[];
  onUpdate: (id: number, data: Partial<Question>) => void;
  onDelete: (id: number) => void;
  onMoveUp: (q: Question) => void;
  onMoveDown: (q: Question) => void;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(q.text);
  const [answerType, setAnswerType] = useState<AnswerType>(q.answerType);
  const [isMandatory, setIsMandatory] = useState(q.isMandatory);
  const [requiresPhoto, setRequiresPhoto] = useState(q.requiresPhoto);
  const [categoryId, setCategoryId] = useState(q.categoryId ? String(q.categoryId) : "none");
  const [expectedAnswer, setExpectedAnswer] = useState(q.expectedAnswer ?? "none");
  const handleSave = () => {
    onUpdate(q.id, {
      text, answerType, isMandatory, requiresPhoto,
      categoryId: (categoryId && categoryId !== "none") ? parseInt(categoryId) : undefined,
      expectedAnswer: answerType === "yes_no" ? (expectedAnswer !== "none" ? expectedAnswer : null) : null,
    });
    setEditing(false);
  };

  const meta = getAnswerTypeMeta(answerType);

  if (editing) {
    return (
      <div className="border rounded-lg p-4 bg-blue-50 border-blue-200 space-y-3">
        <div className="space-y-2">
          <Label className="text-xs">Pertanyaan *</Label>
          <Textarea value={text} onChange={e => setText(e.target.value)} rows={2} className="bg-white" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipe Jawaban</Label>
            <Select value={answerType} onValueChange={(v) => setAnswerType(v as AnswerType)}>
              <SelectTrigger className="h-8 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANSWER_TYPE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="flex items-center gap-1.5">{o.icon}{o.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {meta.hint && <p className="text-xs text-gray-400 leading-relaxed">{meta.hint}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kategori</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-8 bg-white"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak ada</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {answerType === "yes_no" && (
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-blue-700">Jawaban yang Diharapkan</Label>
            <Select value={expectedAnswer} onValueChange={setExpectedAnswer}>
              <SelectTrigger className="h-8 bg-white"><SelectValue placeholder="Pilih jawaban yang benar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak ditentukan</SelectItem>
                <SelectItem value="yes">Ya (jawaban benar = Ya)</SelectItem>
                <SelectItem value="no">Tidak (jawaban benar = Tidak)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">Jika dijawab berbeda, akan otomatis masuk Hazard & Incident</p>
          </div>
        )}
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Checkbox id={`mandatory-${q.id}`} checked={isMandatory} onCheckedChange={v => setIsMandatory(v === true)} />
            <Label htmlFor={`mandatory-${q.id}`} className="text-xs font-medium">Wajib</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id={`photo-${q.id}`} checked={requiresPhoto} onCheckedChange={v => setRequiresPhoto(v === true)} />
            <Label htmlFor={`photo-${q.id}`} className="text-xs font-medium">Perlu Foto</Label>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave}>Simpan</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Batal</Button>
        </div>
      </div>
    );
  }

  const typeMeta = getAnswerTypeMeta(q.answerType);
  const typeColorMap: Record<AnswerType, string> = {
    yes_no: "bg-purple-50 text-purple-700",
    text: "bg-orange-50 text-orange-700",
    master_user: "bg-cyan-50 text-cyan-700",
    master_group: "bg-indigo-50 text-indigo-700",
    master_action: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="border rounded-lg p-3 flex items-start gap-3 hover:bg-gray-50 group">
      {canEdit && (
        <div className="flex flex-col gap-1 pt-0.5">
          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onMoveUp(q)}>
            <ChevronUp className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onMoveDown(q)}>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 leading-relaxed">{q.text}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${typeColorMap[q.answerType]}`}>
            {typeMeta.icon}{typeMeta.label}
          </span>
          {q.answerType === "yes_no" && q.expectedAnswer && (
            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium bg-green-50 text-green-700 border border-green-200">
              Harapkan: {q.expectedAnswer === "yes" ? "✓ Ya" : "✗ Tidak"}
            </span>
          )}
          {q.isMandatory && (
            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium bg-red-50 text-red-700">
              <Star className="w-3 h-3" />Wajib
            </span>
          )}
          {q.requiresPhoto && (
            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-700">
              <Camera className="w-3 h-3" />Foto
            </span>
          )}
          {q.categoryName && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{q.categoryName}</span>
          )}
        </div>
      </div>
      {canEdit && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(true)}>
            <Edit className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
            onClick={() => { if (confirm("Hapus pertanyaan ini?")) onDelete(q.id); }}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function AddQuestionForm({ templateId, categories, onAdded, onCancel }: {
  templateId: number; categories: Category[];
  onAdded: (q: Question) => void; onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [answerType, setAnswerType] = useState<AnswerType>("yes_no");
  const [isMandatory, setIsMandatory] = useState(true);
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [categoryId, setCategoryId] = useState("none");
  const [expectedAnswer, setExpectedAnswer] = useState("none");
  const [saving, setSaving] = useState(false);

  const meta = getAnswerTypeMeta(answerType);

  const handleAdd = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const q = await api.post<Question>("/questions", {
        templateId, text: text.trim(), answerType, isMandatory, requiresPhoto,
        categoryId: (categoryId && categoryId !== "none") ? parseInt(categoryId) : undefined,
        expectedAnswer: answerType === "yes_no" ? (expectedAnswer !== "none" ? expectedAnswer : null) : null,
      });
      onAdded(q);
      setText(""); setAnswerType("yes_no"); setIsMandatory(true);
      setRequiresPhoto(false); setCategoryId("none"); setExpectedAnswer("none");
    } finally { setSaving(false); }
  };

  return (
    <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50/50 space-y-3">
      <p className="text-sm font-semibold text-blue-700">+ Pertanyaan Baru</p>
      <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Tulis pertanyaan inspeksi..." rows={2} className="bg-white" />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tipe Jawaban</Label>
          <Select value={answerType} onValueChange={(v) => setAnswerType(v as AnswerType)}>
            <SelectTrigger className="h-8 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANSWER_TYPE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>
                  <span className="flex items-center gap-1.5">{o.icon}{o.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {meta.hint && <p className="text-xs text-gray-400 leading-relaxed">{meta.hint}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Kategori</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-8 bg-white"><SelectValue placeholder="Opsional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tidak ada</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {answerType === "yes_no" && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-blue-700">Jawaban yang Diharapkan</Label>
          <Select value={expectedAnswer} onValueChange={setExpectedAnswer}>
            <SelectTrigger className="h-8 bg-white"><SelectValue placeholder="Pilih jawaban yang benar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tidak ditentukan</SelectItem>
              <SelectItem value="yes">Ya (jawaban benar = Ya)</SelectItem>
              <SelectItem value="no">Tidak (jawaban benar = Tidak)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-400">Jika dijawab berbeda → otomatis masuk Hazard & Incident</p>
        </div>
      )}
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <Checkbox id="new-mandatory" checked={isMandatory} onCheckedChange={v => setIsMandatory(v === true)} />
          <Label htmlFor="new-mandatory" className="text-xs font-medium">Wajib</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="new-photo" checked={requiresPhoto} onCheckedChange={v => setRequiresPhoto(v === true)} />
          <Label htmlFor="new-photo" className="text-xs font-medium">Perlu Foto</Label>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleAdd} disabled={saving || !text.trim()}>
          {saving ? "Menambahkan..." : "Tambah Pertanyaan"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Batal</Button>
      </div>
    </div>
  );
}

function TemplateBuilder({ template, categories, canEdit, onClose }: {
  template: Template; categories: Category[]; canEdit: boolean; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ["questions", template.id],
    queryFn: () => api.get<Question[]>(`/questions?templateId=${template.id}`)
      .then(qs => [...qs].sort((a, b) => a.orderIndex - b.orderIndex)),
    staleTime: 0,
  });

  const setCache = (updater: (prev: Question[]) => Question[]) => {
    queryClient.setQueryData<Question[]>(["questions", template.id], prev => updater(prev ?? []));
  };

  const updateQuestion = async (id: number, data: Partial<Question>) => {
    await api.put(`/questions/${id}`, data);
    setCache(qs => qs.map(q => q.id === id ? { ...q, ...data } : q));
    queryClient.invalidateQueries({ queryKey: ["templates"] });
  };

  const deleteQuestion = async (id: number) => {
    await api.del(`/questions/${id}`);
    setCache(qs => qs.filter(q => q.id !== id));
    queryClient.invalidateQueries({ queryKey: ["templates"] });
  };

  const moveQuestion = async (q: Question, direction: "up" | "down") => {
    const sorted = [...questions];
    const idx = sorted.findIndex(x => x.id === q.id);
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx]!, reordered[idx]!];
    const normalized = reordered.map((x, i) => ({ ...x, orderIndex: i + 1 }));
    setCache(() => normalized);
    await api.patch("/questions/reorder", normalized.map(x => ({ id: x.id, orderIndex: x.orderIndex })));
  };

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {isLoading ? "Memuat..." : `${questions.length} pertanyaan dalam template ini`}
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setShowAddForm(true)} disabled={showAddForm}>
            <Plus className="w-4 h-4 mr-1" />Tambah Pertanyaan
          </Button>
        )}
      </div>

      {!isLoading && questions.length === 0 && !showAddForm && (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <HelpCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-3">Belum ada pertanyaan</p>
          {canEdit && (
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4 mr-1" />Tambah Pertanyaan Pertama
            </Button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={q.id} className="flex items-start gap-2">
            <span className="text-xs text-gray-400 font-mono w-6 flex-shrink-0 pt-3 text-right">{i + 1}.</span>
            <div className="flex-1">
              <QuestionRow
                q={q} categories={categories} canEdit={canEdit}
                onUpdate={updateQuestion}
                onDelete={deleteQuestion}
                onMoveUp={q => moveQuestion(q, "up")}
                onMoveDown={q => moveQuestion(q, "down")}
              />
            </div>
          </div>
        ))}
      </div>

      {showAddForm && canEdit && (
        <AddQuestionForm
          templateId={template.id}
          categories={categories}
          onAdded={(q) => {
            setCache(prev => [...prev, q].sort((a, b) => a.orderIndex - b.orderIndex));
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}

function TemplateForm({ template, onSave, onCancel }: {
  template?: Template;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ name: name.trim(), description: description.trim() || undefined }); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nama Template *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nama template inspeksi" />
      </div>
      <div className="space-y-2">
        <Label>Deskripsi</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Deskripsi opsional" rows={3} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function TemplatesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formDialog, setFormDialog] = useState(false);
  const [builderDialog, setBuilderDialog] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | undefined>();
  const [builderTemplate, setBuilderTemplate] = useState<Template | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");

  const canManage = user?.role === "admin" || user?.role === "supervisor";

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: () => api.get("/templates"),
  });
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories"),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      editTemplate ? api.put(`/templates/${editTemplate.id}`, data) : api.post("/templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setFormDialog(false);
      toast({ title: editTemplate ? "Template diperbarui" : "Template ditambahkan" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/templates/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["templates"] }); toast({ title: "Template dihapus" }); },
  });

  const filtered = templates.filter(t => !search.trim() || t.name.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase()));

  const openBuilder = (t: Template) => {
    setBuilderTemplate(t);
    setBuilderDialog(true);
  };

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="p-6">
      <PageHeader
        title="Master Template Inspeksi"
        subtitle="Kelola template dan pertanyaan inspeksi"
        action={canManage ? (
          <Button onClick={() => { setEditTemplate(undefined); setFormDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />Tambah Template
          </Button>
        ) : undefined}
      />

      {!canManage && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>Hanya Supervisor dan Admin yang dapat membuat atau mengubah template dan pertanyaan.</span>
        </div>
      )}

      <div className="mb-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <Input className="pl-8 h-9 text-sm" placeholder="Cari nama atau deskripsi template..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <LayoutTemplate className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{search ? "Tidak ada template yang cocok" : "Belum ada template"}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map(t => (
              <Card key={t.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <LayoutTemplate className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <p className="font-semibold text-gray-900">{t.name}</p>
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                          {t.questionCount ?? 0} pertanyaan
                        </span>
                      </div>
                      {t.description && <p className="text-sm text-gray-500 ml-6">{t.description}</p>}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="outline" size="sm" onClick={() => openBuilder(t)}>
                        <HelpCircle className="w-3.5 h-3.5 mr-1" />
                        {canManage ? "Edit Pertanyaan" : "Lihat Pertanyaan"}
                      </Button>
                      {canManage && (
                        <>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                            onClick={() => { setEditTemplate(t); setFormDialog(true); }}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            onClick={() => { if (confirm("Hapus template ini?")) deleteMutation.mutate(t.id); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination page={page} total={filtered.length} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
        </>
      )}

      <Dialog open={formDialog} onOpenChange={setFormDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTemplate ? "Edit Template" : "Tambah Template Baru"}</DialogTitle>
          </DialogHeader>
          <TemplateForm
            template={editTemplate}
            onSave={data => saveMutation.mutateAsync(data)}
            onCancel={() => setFormDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {builderTemplate && (
        <Dialog open={builderDialog} onOpenChange={setBuilderDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                <span className="flex items-center gap-2">
                  <LayoutTemplate className="w-5 h-5 text-blue-500" />
                  {builderTemplate.name}
                </span>
              </DialogTitle>
            </DialogHeader>
            <TemplateBuilder
              template={builderTemplate}
              categories={categories}
              canEdit={canManage}
              onClose={() => setBuilderDialog(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
