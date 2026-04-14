import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Shield, CheckCircle, BarChart2, Calendar, AlertTriangle,
  Users, FileText, Building2, ArrowRight, ChevronRight, Star,
  Globe, Lock, Zap, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FEATURES = [
  {
    icon: AlertTriangle,
    title: "Pelaporan Insiden & Hazard",
    desc: "Laporkan insiden, near miss, dan bahaya dengan foto langsung dari aplikasi. Notifikasi otomatis ke grup PIC.",
    color: "bg-red-50 text-red-600",
  },
  {
    icon: Calendar,
    title: "Jadwal Inspeksi Terstruktur",
    desc: "Kelola jadwal inspeksi harian, mingguan, hingga bulanan. Assign ke personal atau grup, lacak kepatuhan secara real-time.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: BarChart2,
    title: "Dashboard & Laporan",
    desc: "Laporan followup H&I, kepatuhan jadwal, action matrix, dan indikator kinerja HSE dalam satu tampilan.",
    color: "bg-green-50 text-green-600",
  },
  {
    icon: Users,
    title: "Manajemen Tim & Grup",
    desc: "Atur struktur tim HSE, tentukan PIC per kategori, dan kelola notifikasi email per grup kerja.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: FileText,
    title: "Template Inspeksi Kustom",
    desc: "Buat template checklist inspeksi sesuai standar perusahaan, lengkap dengan jawaban ekspektasi otomatis.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: Globe,
    title: "Akses Web & Mobile",
    desc: "Tersedia di browser (web) dan aplikasi mobile Expo. Data tersinkron real-time di semua perangkat.",
    color: "bg-cyan-50 text-cyan-600",
  },
];

const PLANS = [
  {
    id: "free",
    name: "Gratis",
    price: "Rp 0",
    period: "/bulan",
    badge: null,
    features: ["1 bulan trial", "Semua fitur dasar", "Maks. 10 pengguna", "Penyimpanan Google Drive", "Support email"],
    cta: "Mulai Gratis",
    highlight: false,
  },
  {
    id: "monthly",
    name: "Bulanan",
    price: "Rp 250.000",
    period: "/bulan",
    badge: "Populer",
    features: ["Semua fitur", "Pengguna tidak terbatas", "Penyimpanan Google Drive", "Laporan lengkap", "Support prioritas", "Notifikasi email"],
    cta: "Mulai Sekarang",
    highlight: true,
  },
  {
    id: "yearly",
    name: "Tahunan",
    price: "Rp 2.250.000",
    period: "/tahun",
    badge: "Hemat 25%",
    features: ["Semua fitur bulanan", "Bayar sekali setahun", "Hemat Rp 750.000/tahun", "Onboarding gratis", "Dedicated support"],
    cta: "Pilih Tahunan",
    highlight: false,
  },
];

const STATIC_TESTIMONIALS = [
  {
    authorName: "Andi Prasetyo",
    authorRole: "HSE Manager",
    authorCompany: "PT. Karya Cipta Industri",
    content: "HSE Monitor membantu kami mengelola lebih dari 200 jadwal inspeksi per bulan dengan mudah. Laporan otomatis sangat menghemat waktu.",
    rating: 5,
  },
  {
    authorName: "Dewi Rahayu",
    authorRole: "Safety Officer",
    authorCompany: "PT. Maju Bersama",
    content: "Pelaporan insiden kini jauh lebih cepat. Tim lapangan bisa langsung upload foto dari HP, dan notifikasi langsung ke PIC.",
    rating: 5,
  },
];

function Navbar({ onPortalOpen }: { onPortalOpen: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-4.5 h-4.5 text-white w-5 h-5" />
          </div>
          <span className="font-bold text-gray-900 text-lg">HSE Monitor</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
          <a href="#fitur" className="hover:text-gray-900 transition-colors">Fitur</a>
          <a href="#harga" className="hover:text-gray-900 transition-colors">Harga</a>
          <a href="#testimoni" className="hover:text-gray-900 transition-colors">Testimoni</a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={onPortalOpen}
            className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
          >
            Masuk ke Portal
          </button>
          <a
            href="/register"
            className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Daftar Gratis
          </a>
        </div>

        {/* Mobile menu toggle */}
        <button className="md:hidden text-gray-600" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3">
          <a href="#fitur" className="block text-sm text-gray-700 py-2" onClick={() => setOpen(false)}>Fitur</a>
          <a href="#harga" className="block text-sm text-gray-700 py-2" onClick={() => setOpen(false)}>Harga</a>
          <a href="#testimoni" className="block text-sm text-gray-700 py-2" onClick={() => setOpen(false)}>Testimoni</a>
          <div className="pt-2 space-y-2 border-t border-gray-100">
            <button onClick={() => { onPortalOpen(); setOpen(false); }} className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg py-2 hover:bg-gray-50">
              Masuk ke Portal
            </button>
            <a href="/register" className="block text-center text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Daftar Gratis
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function PortalLoginModal({ onClose }: { onClose: () => void }) {
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");

  const handleGo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!clean) { setError("Masukkan slug portal perusahaan Anda"); return; }
    // Verify slug exists before redirecting
    try {
      const res = await fetch(`/api/auth/company/${clean}`);
      if (!res.ok) { setError("Portal perusahaan tidak ditemukan. Periksa kembali slug Anda."); return; }
      window.location.href = `/c/${clean}/`;
    } catch {
      setError("Gagal menghubungi server. Coba lagi.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">Masuk ke Portal</div>
            <div className="text-xs text-gray-500">Portal HSE Perusahaan Anda</div>
          </div>
        </div>

        <form onSubmit={handleGo} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug Perusahaan</label>
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
              <span className="px-3 py-2.5 bg-gray-50 text-gray-400 text-sm border-r border-gray-200 whitespace-nowrap">
                /c/
              </span>
              <input
                className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
                placeholder="nama-perusahaan"
                value={slug}
                onChange={e => { setSlug(e.target.value); setError(""); }}
                autoFocus
              />
            </div>
            {error ? (
              <p className="text-xs text-red-500 mt-1.5">{error}</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1.5">
                Contoh: untuk PT. Karya Cipta Industri → <code className="bg-gray-100 px-1 rounded">kci</code>
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            Buka Portal <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            Belum punya akun?{" "}
            <a href="/register" className="text-blue-600 hover:underline font-medium">Daftar perusahaan baru</a>
          </p>
        </div>
      </div>
    </div>
  );
}

interface ApiTestimonial {
  id: number; authorName: string; authorRole: string; authorCompany: string; content: string; rating: number;
}

export default function LandingPage() {
  const [showPortal, setShowPortal] = useState(false);
  const { data: apiTestimonials } = useQuery<ApiTestimonial[]>({
    queryKey: ["public-testimonials"],
    queryFn: async () => {
      const res = await fetch("/api/testimonials/public");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
  const testimonials = apiTestimonials && apiTestimonials.length > 0 ? apiTestimonials : STATIC_TESTIMONIALS;

  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar onPortalOpen={() => setShowPortal(true)} />

      {showPortal && <PortalLoginModal onClose={() => setShowPortal(false)} />}

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-28 relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-blue-600/20 text-blue-300 border border-blue-500/30 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <Zap className="w-3.5 h-3.5" />
              Platform HSE Terpadu untuk Industri Indonesia
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5">
              Kelola HSE Perusahaan<br />
              <span className="text-blue-400">Lebih Mudah & Efisien</span>
            </h1>
            <p className="text-slate-300 text-lg mb-8 leading-relaxed">
              Satu platform untuk pelaporan insiden, jadwal inspeksi, laporan kepatuhan, dan manajemen tim HSE — 
              tersedia di web dan mobile.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
              >
                Mulai Gratis <ArrowRight className="w-4 h-4" />
              </a>
              <button
                onClick={() => setShowPortal(true)}
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white border border-white/20 font-medium px-6 py-3 rounded-xl transition-colors text-sm"
              >
                <Building2 className="w-4 h-4" />
                Masuk ke Portal
              </button>
            </div>
            <p className="text-slate-400 text-xs mt-4">
              Gratis 1 bulan · Tidak perlu kartu kredit · Setup dalam 5 menit
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-3 gap-4 text-center">
            {[
              { val: "500+", label: "Inspeksi per bulan" },
              { val: "99.9%", label: "Uptime layanan" },
              { val: "< 5 min", label: "Waktu setup" },
            ].map(s => (
              <div key={s.label}>
                <div className="text-2xl font-bold text-white">{s.val}</div>
                <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="fitur" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="text-blue-600 font-semibold text-sm mb-2 uppercase tracking-wide">Fitur Lengkap</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Semua yang Anda Butuhkan</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Dari pelaporan insiden hingga laporan kepatuhan jadwal — semuanya dalam satu sistem yang terintegrasi.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="harga" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="text-blue-600 font-semibold text-sm mb-2 uppercase tracking-wide">Harga Transparan</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Pilih Paket yang Sesuai</h2>
            <p className="text-gray-500">Mulai gratis, upgrade kapan saja. Tidak ada biaya tersembunyi.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PLANS.map(plan => (
              <div
                key={plan.id}
                className={`rounded-2xl p-6 border-2 relative ${
                  plan.highlight
                    ? "border-blue-600 bg-blue-600 text-white shadow-xl shadow-blue-200"
                    : "border-gray-200 bg-white"
                }`}
              >
                {plan.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full ${
                    plan.highlight ? "bg-white text-blue-600" : "bg-amber-400 text-amber-900"
                  }`}>
                    {plan.badge}
                  </div>
                )}

                <div className="mb-4">
                  <div className={`font-bold text-lg mb-1 ${plan.highlight ? "text-white" : "text-gray-900"}`}>{plan.name}</div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-bold ${plan.highlight ? "text-white" : "text-gray-900"}`}>{plan.price}</span>
                    <span className={`text-sm ${plan.highlight ? "text-blue-100" : "text-gray-400"}`}>{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className={`w-4 h-4 shrink-0 ${plan.highlight ? "text-blue-200" : "text-green-500"}`} />
                      <span className={plan.highlight ? "text-blue-50" : "text-gray-600"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="/register"
                  className={`block text-center text-sm font-semibold py-2.5 rounded-xl transition-colors ${
                    plan.highlight
                      ? "bg-white text-blue-600 hover:bg-blue-50"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            Pembayaran via transfer bank / QRIS. Aktivasi oleh tim kami dalam 1×24 jam.
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimoni" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="text-blue-600 font-semibold text-sm mb-2 uppercase tracking-wide">Testimoni</div>
            <h2 className="text-3xl font-bold text-gray-900">Dipercaya Profesional HSE</h2>
          </div>
          <div className={`grid gap-6 max-w-4xl mx-auto ${testimonials.length === 1 ? "max-w-lg" : testimonials.length === 2 ? "md:grid-cols-2 max-w-3xl" : "md:grid-cols-2 lg:grid-cols-3"}`}>
            {testimonials.map((t, i) => (
              <div key={"id" in t ? (t as any).id : i} className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">"{t.content}"</p>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{t.authorName}</div>
                  <div className="text-xs text-gray-400">{[t.authorRole, t.authorCompany].filter(Boolean).join(" · ")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Siap Mulai?</h2>
          <p className="text-blue-100 mb-8">
            Daftar sekarang dan kelola HSE perusahaan Anda lebih efektif mulai hari ini.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors text-sm"
            >
              Daftar Perusahaan Baru <ArrowRight className="w-4 h-4" />
            </a>
            <button
              onClick={() => setShowPortal(true)}
              className="inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white border border-blue-400 font-medium px-6 py-3 rounded-xl transition-colors text-sm"
            >
              <Building2 className="w-4 h-4" />
              Masuk ke Portal Saya
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-white text-sm">HSE Monitor</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="#fitur" className="hover:text-white transition-colors">Fitur</a>
              <a href="#harga" className="hover:text-white transition-colors">Harga</a>
              <a href="/register" className="hover:text-white transition-colors">Daftar</a>
              <a href="/sysadmin" className="hover:text-white transition-colors text-xs opacity-50">Admin</a>
            </div>
            <div className="text-xs">© 2026 HSE Monitor. Hak cipta dilindungi.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
