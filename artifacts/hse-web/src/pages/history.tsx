import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, ChevronRight, CheckCircle, XCircle, HelpCircle, ChevronLeft } from "lucide-react";

const PAGE_SIZE_OPTIONS = [20, 50];

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

interface Inspection {
  id: number; scheduleId: number; supervisorName: string; plantName: string;
  templateName: string; frequency: string;
  totalQuestions: number; answeredQuestions: number;
  inspectedAt: string; createdAt: string;
}
interface InspectionDetail {
  id: number; templateName: string; supervisorName: string; plantName: string; inspectedAt: string;
  answers: {
    id: number; questionId: number; questionText: string; answerType: "yes_no" | "text";
    expectedAnswer?: string | null; answerYesNo?: boolean; answerText?: string;
    categoryName?: string;
  }[];
}

const FREQ_LABEL: Record<string, string> = {
  daily: "Harian", weekly: "Mingguan", monthly: "Bulanan", quarterly: "Triwulan",
};

function InspectionDetailDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useQuery<InspectionDetail>({
    queryKey: ["inspection", id],
    queryFn: () => api.get(`/inspections/${id}`),
    staleTime: 0,
  });

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />Detail Inspeksi #{id}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-gray-400">Memuat...</div>
        ) : !data ? (
          <div className="py-8 text-center text-gray-400">Data tidak ditemukan</div>
        ) : (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="bg-gray-50 rounded-lg p-3 text-sm grid grid-cols-2 gap-2">
              <div><span className="text-gray-500">Template: </span><span className="font-medium">{data.templateName}</span></div>
              <div><span className="text-gray-500">Supervisor: </span><span className="font-medium">{data.supervisorName}</span></div>
              <div><span className="text-gray-500">Plant: </span><span className="font-medium">{data.plantName}</span></div>
              <div><span className="text-gray-500">Tanggal: </span><span className="font-medium">{data.inspectedAt}</span></div>
            </div>
            <div className="space-y-2">
              {data.answers.map((a, i) => {
                const isWrong = a.answerType === "yes_no" && a.expectedAnswer
                  && a.answerYesNo !== (a.expectedAnswer === "yes");
                return (
                  <div key={a.id} className={`border rounded-lg p-3 ${isWrong ? "border-red-200 bg-red-50" : "bg-white"}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gray-400 font-mono w-5 flex-shrink-0">{i + 1}.</span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-800">{a.questionText}</p>
                        {a.categoryName && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block">{a.categoryName}</span>
                        )}
                        <div className="mt-2">
                          {a.answerType === "yes_no" ? (
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 text-sm font-semibold ${a.answerYesNo ? "text-green-700" : "text-red-700"}`}>
                                {a.answerYesNo ? <><CheckCircle className="w-4 h-4" />Ya</> : <><XCircle className="w-4 h-4" />Tidak</>}
                              </span>
                              {a.expectedAnswer && (
                                <span className="text-xs text-gray-500">
                                  (harapkan: {a.expectedAnswer === "yes" ? "Ya" : "Tidak"})
                                </span>
                              )}
                              {isWrong && (
                                <Badge variant="destructive" className="text-xs">Tidak Sesuai</Badge>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{a.answerText ?? "—"}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function HistoryPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data: inspections = [], isLoading } = useQuery<Inspection[]>({
    queryKey: ["inspections"],
    queryFn: () => api.get("/inspections"),
  });

  const paginated = inspections.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="p-6">
      <PageHeader
        title="Riwayat Inspeksi"
        subtitle={`${inspections.length} inspeksi telah dilakukan`}
      />

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Memuat...</div>
      ) : inspections.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Belum ada riwayat inspeksi</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Template</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Supervisor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Plant</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Frekuensi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Progress</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tanggal Diisi</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Detail</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(ins => (
                  <tr key={ins.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedId(ins.id)}>
                    <td className="px-4 py-3 text-gray-400 font-mono">#{ins.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <span className="font-medium text-gray-900">{ins.templateName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{ins.supervisorName}</td>
                    <td className="px-4 py-3 text-gray-500">{ins.plantName || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{FREQ_LABEL[ins.frequency] ?? ins.frequency}</td>
                    <td className="px-4 py-3">
                      {ins.totalQuestions > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-gray-200 rounded-full">
                            <div
                              className="h-1.5 bg-green-500 rounded-full"
                              style={{ width: `${(ins.answeredQuestions / ins.totalQuestions) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{ins.answeredQuestions}/{ins.totalQuestions}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 flex items-center gap-1"><HelpCircle className="w-3 h-3" />0 soal</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{ins.inspectedAt}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page} total={inspections.length} pageSize={pageSize}
            onPage={setPage} onPageSize={setPageSize}
          />
        </>
      )}

      {selectedId && <InspectionDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
