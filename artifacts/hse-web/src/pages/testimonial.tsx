import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Star, Send, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/layout";
import { api } from "@/lib/api";

interface Testimonial {
  id: number; authorName: string; authorRole: string; authorCompany: string;
  content: string; rating: number; isActive: boolean; createdAt: string;
}

function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s => (
        <button
          key={s} type="button"
          onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
          className="transition-transform hover:scale-110"
        >
          <Star className={`w-8 h-8 transition-colors ${s <= (hover || value) ? "text-amber-400 fill-amber-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

export default function TestimonialPage() {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(5);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const { data: mine, isLoading } = useQuery<Testimonial | null>({
    queryKey: ["my-testimonial"],
    queryFn: () => api.get("/testimonials/mine"),
  });

  const submitMut = useMutation({
    mutationFn: () => api.post("/testimonials", { content, rating }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-testimonial"] });
      setSuccess(true);
      setError("");
    },
    onError: (e: any) => setError(e.message ?? "Gagal mengirim testimoni"),
  });

  const handleEdit = () => {
    if (mine) {
      setContent(mine.content);
      setRating(mine.rating);
      setSuccess(false);
    }
  };

  if (isLoading) return <div className="p-6 text-gray-400">Memuat...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader
        title="Berikan Testimoni"
        subtitle="Bagikan pengalaman Anda menggunakan H&A Monitoring System"
      />

      {/* Existing testimonial display */}
      {mine && !success && (
        <div className="mb-6 bg-white rounded-xl border border-blue-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {mine.isActive ? (
                <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full">
                  <CheckCircle className="w-3 h-3" /> Ditampilkan di website
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 font-medium px-2.5 py-1 rounded-full">
                  <Clock className="w-3 h-3" /> Menunggu persetujuan
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleEdit}>Ubah</Button>
          </div>
          <div className="flex gap-0.5 mb-2">
            {[1,2,3,4,5].map(s => (
              <Star key={s} className={`w-4 h-4 ${s <= mine.rating ? "text-amber-400 fill-amber-400" : "text-gray-300"}`} />
            ))}
          </div>
          <p className="text-gray-700 text-sm leading-relaxed italic">"{mine.content}"</p>
          <p className="text-xs text-gray-400 mt-2">Dikirim {new Date(mine.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
      )}

      {/* Success state */}
      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-800 font-medium">
            Testimoni berhasil dikirim! Tim kami akan meninjau dan menampilkannya di halaman utama.
          </AlertDescription>
        </Alert>
      )}

      {/* Form */}
      {(!mine || success === false && mine) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            {mine ? "Ubah Testimoni" : "Tulis Testimoni Anda"}
          </h2>

          {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="space-y-5">
            <div>
              <Label className="mb-2 block">Rating Kepuasan</Label>
              <StarSelector value={rating} onChange={setRating} />
              <p className="text-xs text-gray-400 mt-1">
                {rating === 5 ? "Sangat Puas 🎉" : rating === 4 ? "Puas 😊" : rating === 3 ? "Cukup 😐" : rating === 2 ? "Kurang Puas 😕" : "Tidak Puas 😞"}
              </p>
            </div>

            <div>
              <Label htmlFor="content" className="mb-2 block">
                Ceritakan pengalaman Anda <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="content"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Bagaimana H&A Monitoring System membantu pekerjaan EHS Anda? Fitur apa yang paling berguna?"
                rows={5}
                className="resize-none"
                maxLength={500}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{content.length}/500</p>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
              <strong>Catatan:</strong> Testimoni Anda akan ditinjau oleh admin sebelum ditampilkan di halaman utama website. Nama dan perusahaan Anda akan ditampilkan secara otomatis.
            </div>

            <Button
              onClick={() => submitMut.mutate()}
              disabled={submitMut.isPending || content.trim().length < 10}
              className="w-full"
            >
              {submitMut.isPending ? "Mengirim..." : (
                <><Send className="w-4 h-4 mr-2" /> {mine ? "Perbarui Testimoni" : "Kirim Testimoni"}</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 bg-gray-50 rounded-xl border border-gray-100 p-4">
        <h3 className="font-medium text-gray-700 text-sm mb-2">Apa yang terjadi setelah Anda mengirim?</h3>
        <ol className="text-xs text-gray-500 space-y-1.5 list-decimal list-inside">
          <li>Testimoni Anda masuk ke antrian review admin</li>
          <li>Admin akan meninjau dan memilih yang akan ditampilkan</li>
          <li>Jika disetujui, testimoni Anda akan muncul di halaman utama H&A Monitoring System</li>
        </ol>
      </div>
    </div>
  );
}
