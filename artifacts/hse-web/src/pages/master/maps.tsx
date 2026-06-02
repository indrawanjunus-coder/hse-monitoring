import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Plus, Trash2, Eye, FileText, FileImage, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface MapRecord {
  id: number;
  name: string;
  fileType: string;
  driveFileId?: string | null;
  viewUrl?: string | null;
  createdAt: string;
}

export default function MapsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: maps = [], isLoading } = useQuery<MapRecord[]>({
    queryKey: ["maps"],
    queryFn: () => api.get("/maps"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/maps/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maps"] });
      toast({ title: "Map berhasil dihapus" });
    },
    onError: (err: any) => {
      toast({ title: "Gagal menghapus map", description: String(err?.message ?? err), variant: "destructive" });
    },
  });

  const handleUpload = async () => {
    if (!name.trim()) { toast({ title: "Nama map wajib diisi", variant: "destructive" }); return; }
    if (!file) { toast({ title: "File map wajib dipilih", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("file", file);
      const res = await fetch(`${BASE}/api/maps`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Upload gagal");
      }
      qc.invalidateQueries({ queryKey: ["maps"] });
      toast({ title: "Map berhasil diupload" });
      setShowUpload(false);
      setName("");
      setFile(null);
    } catch (err: any) {
      toast({ title: "Gagal upload map", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = (map: MapRecord) => {
    if (!map.driveFileId) {
      toast({ title: "File map belum tersedia", variant: "destructive" });
      return;
    }
    const url = map.fileType === "pdf"
      ? `https://drive.google.com/file/d/${map.driveFileId}/preview`
      : `https://drive.google.com/uc?export=view&id=${map.driveFileId}`;
    window.open(url, "_blank");
  };

  const handleDelete = (map: MapRecord) => {
    if (!confirm(`Hapus map "${map.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    deleteMutation.mutate(map.id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Map Lokasi"
        subtitle="Kelola peta/denah lokasi untuk penandaan area inspeksi dan incident"
        action={
          user?.role === "admin" && (
            <Button onClick={() => setShowUpload(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Upload Map
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Memuat data map...</div>
      ) : maps.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Belum ada map lokasi</p>
            {user?.role === "admin" && (
              <p className="text-sm mt-1">Klik "Upload Map" untuk menambahkan denah atau peta lokasi</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {maps.map(map => (
            <Card key={map.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  {map.fileType === "pdf"
                    ? <FileText className="w-5 h-5 text-red-500" />
                    : <FileImage className="w-5 h-5 text-blue-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{map.name}</p>
                  <p className="text-xs text-gray-400">
                    {map.fileType.toUpperCase()} · Ditambahkan {new Date(map.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => handlePreview(map)}
                  >
                    <Eye className="w-3.5 h-3.5" /> Lihat
                  </Button>
                  {user?.role === "admin" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(map)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showUpload} onOpenChange={v => { if (!uploading) { setShowUpload(v); if (!v) { setName(""); setFile(null); } } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" />
              Upload Map Lokasi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama Map *</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Contoh: Lantai 1 Gedung A, Area Produksi..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>File Map * <span className="text-xs text-gray-400 font-normal">(PDF, JPEG, atau JPG — maks. 50MB)</span></Label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              <div
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-lg p-6 cursor-pointer transition-colors bg-gray-50 hover:bg-blue-50"
              >
                {file ? (
                  <>
                    {file.type === "application/pdf"
                      ? <FileText className="w-8 h-8 text-red-500" />
                      : <FileImage className="w-8 h-8 text-blue-500" />
                    }
                    <p className="text-sm font-medium text-gray-700">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB · Klik untuk ganti</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-300" />
                    <p className="text-sm text-gray-500">Klik untuk pilih file PDF atau JPEG/JPG</p>
                  </>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUpload(false); setName(""); setFile(null); }} disabled={uploading}>
              Batal
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !name.trim() || !file}>
              {uploading ? "Mengupload..." : "Upload Map"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
