import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle, XCircle, Clock, Shield, User, Phone, Mail,
  Calendar, FileCheck, AlertCircle,
} from "lucide-react";

interface WorkPermit {
  id: number;
  permitCode: string;
  name: string;
  phone: string;
  email: string;
  workStart: string;
  workEnd: string;
  supervisorName: string;
  notes: string | null;
  status: string;
  typeId: number | null;
  typeName: string | null;
  createdAt: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export default function MyApprovalsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const { data: permits = [], isLoading } = useQuery<WorkPermit[]>({
    queryKey: ["work-permits-my-approvals"],
    queryFn: () => api.get("/work-permits/my-approvals"),
    refetchInterval: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/work-permits/${id}/approve`, {}),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["work-permits-my-approvals"] });
      qc.invalidateQueries({ queryKey: ["work-permits"] });
      if (data?.fullyApproved) {
        toast({ title: "Permit disetujui & aktif!", description: "Email QR Code telah dikirim ke pemegang permit." });
      } else {
        toast({ title: "Persetujuan dicatat", description: "Menunggu persetujuan approver lainnya." });
      }
    },
    onError: (e: any) => toast({ title: "Gagal approve", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      api.post(`/work-permits/${id}/reject`, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-permits-my-approvals"] });
      qc.invalidateQueries({ queryKey: ["work-permits"] });
      toast({ title: "Permit ditolak", description: "Notifikasi telah dikirim ke admin." });
      setRejectId(null);
      setRejectNotes("");
    },
    onError: (e: any) => toast({ title: "Gagal tolak", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6">
      <PageHeader
        title="Perlu Approval Saya"
        subtitle={
          isLoading
            ? "Memuat..."
            : permits.length === 0
            ? "Tidak ada permit yang perlu disetujui"
            : `${permits.length} permit menunggu persetujuan Anda`
        }
      />

      {isLoading ? (
        <div className="mt-10 text-center text-gray-400 text-sm">Memuat data...</div>
      ) : permits.length === 0 ? (
        <div className="mt-16 text-center">
          <CheckCircle className="w-14 h-14 text-green-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Semua beres!</p>
          <p className="text-gray-400 text-sm mt-1">Tidak ada work permit yang menunggu persetujuan Anda.</p>
        </div>
      ) : (
        <div className="space-y-4 mt-2">
          {permits.map(p => (
            <div key={p.id} className="bg-white border border-orange-100 rounded-xl shadow-sm overflow-hidden">
              {/* Header bar */}
              <div className="bg-orange-50 border-b border-orange-100 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold text-orange-700">Menunggu Persetujuan Anda</span>
                </div>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 border text-xs">
                  {p.typeName ?? "—"}
                </Badge>
              </div>

              {/* Body */}
              <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="font-semibold text-gray-900">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    {p.phone}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    {p.email}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Shield className="w-3.5 h-3.5 text-gray-400" />
                    Atasan: {p.supervisorName}
                  </div>
                </div>

                {/* Right: Period & notes */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="text-sm text-gray-700">
                      <p className="font-medium">Periode Kerja</p>
                      <p className="text-gray-600">{fmtDate(p.workStart)} – {fmtDate(p.workEnd)}</p>
                    </div>
                  </div>
                  {p.notes && (
                    <div className="flex items-start gap-2">
                      <FileCheck className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div className="text-sm text-gray-600 italic">"{p.notes}"</div>
                    </div>
                  )}
                  <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    Dibuat {fmtDate(p.createdAt)}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-gray-100 px-5 py-3 flex gap-3 bg-gray-50">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white gap-2"
                  disabled={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(p.id)}
                >
                  <CheckCircle className="w-4 h-4" />
                  Setujui
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 gap-2"
                  onClick={() => { setRejectId(p.id); setRejectNotes(""); }}
                >
                  <XCircle className="w-4 h-4" />
                  Tolak
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={rejectId !== null} onOpenChange={open => { if (!open) { setRejectId(null); setRejectNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Tolak Work Permit</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">Berikan alasan penolakan (wajib diisi):</p>
          <Textarea
            value={rejectNotes}
            onChange={e => setRejectNotes(e.target.value)}
            placeholder="Contoh: Dokumen tidak lengkap, area kerja belum siap, dll."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectNotes(""); }}>Batal</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!rejectNotes.trim() || rejectMutation.isPending}
              onClick={() => rejectId !== null && rejectMutation.mutate({ id: rejectId, notes: rejectNotes.trim() })}
            >
              Konfirmasi Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
