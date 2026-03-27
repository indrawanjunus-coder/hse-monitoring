import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Edit, Trash2, Layout, HelpCircle, ChevronUp, ChevronDown,
  GripVertical, Camera, Star, CheckSquare, AlignLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Question {
  id: number;
  templateId: number;
  text: string;
  answerType: "yes_no" | "text";
  isMandatory: boolean;
  requiresPhoto: boolean;
  categoryId?: number;
  categoryName?: string;
  orderIndex: number;
}
interface Template {
  id: number;
  name: string;
  description?: string;
  questionCount?: number;
  questions?: Question[];
}
interface Category { id: number; name: string }

function QuestionRow({ q, categories, onUpdate, onDelete, onMoveUp, onMoveDown }: {
  q: Question; categories: Category[];
  onUpdate: (id: number, data: Partial<Question>) => void;
  onDelete: (id: number) => void;
  onMoveUp: (q: Question) => void;
  onMoveDown: (q: Question) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(q.text);
  const [answerType, setAnswerType] = useState(q.answerType);
  const [isMandatory, setIsMandatory] = useState(q.isMandatory);
  const [requiresPhoto, setRequiresPhoto] = useState(q.requiresPhoto);
  const [categoryId, setCategoryId] = useState(String(q.categoryId ?? ""));

  const handleSave = () => {
    onUpdate(q.id, {
      text, answerType, isMandatory, requiresPhoto,
      categoryId: categoryId ? parseInt(categoryId) : undefined,
    });
    setEditing(false);
  };

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
            <Select value={answerType} onValueChange={(v: "yes_no" | "text") => setAnswerType(v)}>
              <SelectTrigger className="h-8 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes_no">Ya / Tidak</SelectItem>
                <SelectItem value="text">Teks Bebas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kategori</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-8 bg-white"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tidak ada</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
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

  return (
    <div className="border rounded-lg p-3 flex items-start gap-3 hover:bg-gray-50 group">
      <div className="flex flex-col gap-1 pt-0.5">
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onMoveUp(q)}>
          <ChevronUp className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onMoveDown(q)}>
          <ChevronDown className="w-3 h-3" />
        </Button>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 leading-relaxed">{q.text}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${
            q.answerType === "yes_no" ? "bg-purple-50 text-purple-700" : "bg-orange-50 text-orange-700"
          }`}>
            {q.answerType === "yes_no" ? <><CheckSquare className="w-3 h-3" /> Ya/Tidak</> : <><AlignLeft className="w-3 h-3" /> Teks</>}
          </span>
          {q.isMandatory && (
            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium bg-red-50 text-red-700">
              <Star className="w-3 h-3" /> Wajib
            </span>
          )}
          {q.requiresPhoto && (
            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-700">
              <Camera className="w-3 h-3" /> Foto
            </span>
          )}
          {q.categoryName && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
              {q.categoryName}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(true)}>
          <Edit className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
          onClick={() => { if (confirm("Hapus pertanyaan ini?")) onDelete(q.id); }}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function AddQuestionForm({ templateId, categories, onAdded, onCancel }: {
  templateId: number; categories: Category[];
  onAdded: (q: Question) => void; onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [answerType, setAnswerType] = useState<"yes_no" | "text">("yes_no");
  const [isMandatory, setIsMandatory] = useState(true);
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const q = await api.post<Question>("/questions", {
        templateId, text: text.trim(), answerType, isMandatory, requiresPhoto,
        categoryId: categoryId ? parseInt(categoryId) : undefined,
        orderIndex: 999,
      });
      onAdded(q);
      setText(""); setAnswerType("yes_no"); setIsMandatory(true); setRequiresPhoto(false); setCategoryId("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50/50 space-y-3">
      <p className="text-sm font-semibold text-blue-700">+ Pertanyaan Baru</p>
      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Tulis pertanyaan inspeksi..."
        rows={2}
        className="bg-white"
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tipe Jawaban</Label>
          <Select value={answerType} onValueChange={(v: "yes_no" | "text") => setAnswerType(v)}>
            <SelectTrigger className="h-8 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yes_no">Ya / Tidak</SelectItem>
              <SelectItem value="text">Teks Bebas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Kategori</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-8 bg-white"><SelectValue placeholder="Opsional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tidak ada</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
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

function TemplateBuilder({ template, categories, onClose }: {
  template: Template; categories: Category[]; onClose: () => void;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const queryClient = useQueryClient();

  useQuery<Question[]>({
    queryKey: ["questions", template.id],
    queryFn: async () => {
      const qs = await api.get<Question[]>(`/questions?templateId=${template.id}`);
      const sorted = qs.sort((a, b) => a.orderIndex - b.orderIndex);
      setQuestions(sorted);
      return sorted;
    },
  });

  const updateQuestion = async (id: number, data: Partial<Question>) => {
    await api.put(`/questions/${id}`, data);
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...data } : q));
    queryClient.invalidateQueries({ queryKey: ["questions", template.id] });
    queryClient.invalidateQueries({ queryKey: ["templates"] });
  };

  const deleteQuestion = async (id: number) => {
    await api.del(`/questions/${id}`);
    setQuestions(qs => qs.filter(q => q.id !== id));
    queryClient.invalidateQueries({ queryKey: ["templates"] });
  };

  const moveUp = async (q: Question) => {
    const idx = questions.findIndex(x => x.id === q.id);
    if (idx === 0) return;
    const prev = questions[idx - 1]!;
    await api.put(`/questions/${q.id}`, { orderIndex: prev.orderIndex });
    await api.put(`/questions/${prev.id}`, { orderIndex: q.orderIndex });
    const newQs = [...questions];
    newQs[idx] = { ...newQs[idx]!, orderIndex: prev.orderIndex };
    newQs[idx - 1] = { ...newQs[idx - 1]!, orderIndex: q.orderIndex };
    setQuestions(newQs.sort((a, b) => a.orderIndex - b.orderIndex));
  };

  const moveDown = async (q: Question) => {
    const idx = questions.findIndex(x => x.id === q.id);
    if (idx === questions.length - 1) return;
    const next = questions[idx + 1]!;
    await api.put(`/questions/${q.id}`, { orderIndex: next.orderIndex });
    await api.put(`/questions/${next.id}`, { orderIndex: q.orderIndex });
    const newQs = [...questions];
    newQs[idx] = { ...newQs[idx]!, orderIndex: next.orderIndex };
    newQs[idx + 1] = { ...newQs[idx + 1]!, orderIndex: q.orderIndex };
    setQuestions(newQs.sort((a, b) => a.orderIndex - b.orderIndex));
  };

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{questions.length} pertanyaan dalam template ini</p>
        <Button size="sm" onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus className="w-4 h-4 mr-1" /> Tambah Pertanyaan
        </Button>
      </div>

      {questions.length === 0 && !showAddForm && (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <HelpCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-3">Belum ada pertanyaan</p>
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Tambah Pertanyaan Pertama
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={q.id} className="flex items-start gap-2">
            <span className="text-xs text-gray-400 font-mono w-6 flex-shrink-0 pt-3 text-right">{i + 1}.</span>
            <div className="flex-1">
              <QuestionRow
                q={q}
                categories={categories}
                onUpdate={updateQuestion}
                onDelete={deleteQuestion}
                onMoveUp={moveUp}
                onMoveDown={moveDown}
              />
            </div>
          </div>
        ))}
      </div>

      {showAddForm && (
        <AddQuestionForm
          templateId={template.id}
          categories={categories}
          onAdded={(q) => {
            setQuestions(prev => [...prev, q].sort((a, b) => a.orderIndex - b.orderIndex));
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
  const queryClient = useQueryClient();
  const [formDialog, setFormDialog] = useState(false);
  const [builderDialog, setBuilderDialog] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | undefined>();
  const [builderTemplate, setBuilderTemplate] = useState<Template | undefined>();

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
      editTemplate
        ? api.put(`/templates/${editTemplate.id}`, data)
        : api.post("/templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setFormDialog(false);
      toast({ title: editTemplate ? "Template diperbarui" : "Template ditambahkan" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({ title: "Template dihapus" });
    },
  });

  return (
    <div className="p-6">
      <PageHeader
        title="Master Template Inspeksi"
        subtitle="Kelola template dan pertanyaan inspeksi"
        action={
          <Button onClick={() => { setEditTemplate(undefined); setFormDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Tambah Template
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12">
          <Layout className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Belum ada template</p>
          <Button className="mt-4" onClick={() => { setEditTemplate(undefined); setFormDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Tambah Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map(t => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Layout className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <HelpCircle className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{t.questionCount ?? 0} pertanyaan</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={() => { setEditTemplate(t); setFormDialog(true); }}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                      onClick={() => { if (confirm(`Hapus template "${t.name}"?`)) deleteMutation.mutate(t.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {t.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{t.description}</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => { setBuilderTemplate(t); setBuilderDialog(true); }}
                >
                  <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                  Kelola Pertanyaan
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formDialog} onOpenChange={setFormDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTemplate ? "Edit Template" : "Tambah Template"}</DialogTitle>
          </DialogHeader>
          <TemplateForm
            template={editTemplate}
            onSave={(data) => saveMutation.mutateAsync(data)}
            onCancel={() => setFormDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={builderDialog} onOpenChange={setBuilderDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pertanyaan: {builderTemplate?.name}</DialogTitle>
          </DialogHeader>
          {builderTemplate && (
            <TemplateBuilder
              template={builderTemplate}
              categories={categories}
              onClose={() => setBuilderDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
