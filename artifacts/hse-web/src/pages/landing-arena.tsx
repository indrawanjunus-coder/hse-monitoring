import { useState } from "react";
import { ArrowRight, Building2, X, Shield, Globe, ChevronRight, CheckCircle, Lock, Award, Users } from "lucide-react";
import arenaLogo from "../assets/arena-logo.png";

function PortalLoginModal({ onClose }: { onClose: () => void }) {
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!clean) { setError("Masukkan portal ID perusahaan Anda"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/company/${clean}`);
      if (!res.ok) { setError("Portal tidak ditemukan. Periksa kembali ID Anda."); setLoading(false); return; }
      window.location.href = `/c/${clean}/`;
    } catch {
      setError("Gagal menghubungi server. Coba lagi.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div
        className="relative bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-7"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="mb-6">
          <div className="text-xs font-semibold tracking-widest uppercase text-[#4ade80] mb-1">ARENA HSE Portal</div>
          <div className="text-xl font-bold text-white">Masuk ke Portal Perusahaan</div>
          <div className="text-sm text-gray-400 mt-1">Masukkan portal ID untuk mengakses sistem HSE Anda</div>
        </div>
        <form onSubmit={handleGo} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Portal ID</label>
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden focus-within:border-[#4ade80]/50 focus-within:ring-1 focus-within:ring-[#4ade80]/30 transition-all">
              <span className="px-3 py-3 text-gray-500 text-sm border-r border-white/10 whitespace-nowrap">/c/</span>
              <input
                className="flex-1 px-3 py-3 text-sm bg-transparent text-white outline-none placeholder-gray-600"
                placeholder="nama-perusahaan"
                value={slug}
                onChange={e => { setSlug(e.target.value); setError(""); }}
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#2563eb] to-[#16a34a] hover:from-[#3b82f6] hover:to-[#22c55e] text-white text-sm font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Memverifikasi..." : <>Akses Portal <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
        <div className="mt-5 pt-5 border-t border-white/10 text-center">
          <p className="text-xs text-gray-500">
            Perusahaan Anda belum terdaftar?{" "}
            <a href="/register" className="text-[#4ade80] hover:underline font-medium">Daftar sekarang</a>
          </p>
        </div>
      </div>
    </div>
  );
}

const TRUST_STATS = [
  { val: "500+", label: "Perusahaan Aktif" },
  { val: "99.9%", label: "System Uptime" },
  { val: "ISO 45001", label: "Compliance Ready" },
  { val: "24/7", label: "Monitoring & Support" },
];

const BENEFITS = [
  { icon: Shield, title: "Enterprise-Grade Security", desc: "Data tersimpan aman dengan enkripsi end-to-end dan audit log lengkap di setiap tindakan." },
  { icon: Globe, title: "Multi-Site Management", desc: "Kelola operasional HSE di seluruh plant dan lokasi dari satu dashboard terpusat." },
  { icon: Award, title: "Compliance Automation", desc: "Laporan kepatuhan otomatis sesuai standar ISO 45001 dan regulasi K3 Indonesia." },
  { icon: Users, title: "Team Collaboration", desc: "Struktur tim yang fleksibel — assign PIC, group notifikasi, dan eskalasi insiden secara otomatis." },
  { icon: Lock, title: "Role-Based Access", desc: "Kontrol akses penuh per jabatan. Setiap pengguna hanya melihat data yang relevan untuk perannya." },
  { icon: CheckCircle, title: "Real-Time Reporting", desc: "Dashboard eksekutif dengan KPI HSE real-time — zero-lag, zero-paper, zero-excuse." },
];

export default function ArenaLanding() {
  const [showPortal, setShowPortal] = useState(false);

  return (
    <div className="min-h-screen bg-[#060b14] text-white font-sans overflow-x-hidden">
      {showPortal && <PortalLoginModal onClose={() => setShowPortal(false)} />}

      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#2563eb]/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#16a34a]/10 blur-[120px]" />
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#060b14]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-18 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={arenaLogo} alt="Arena Corporation" className="h-9 w-auto" />
            <div className="hidden sm:block pl-3 border-l border-white/10">
              <div className="text-xs font-semibold tracking-widest uppercase text-gray-400">HSE Management</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPortal(true)}
              className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block"
            >
              Masuk Portal
            </button>
            <a
              href="/register"
              className="text-sm font-semibold bg-gradient-to-r from-[#2563eb] to-[#16a34a] text-white px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              Daftar Perusahaan <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-24 pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Logo large */}
          <div className="flex justify-center mb-10">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#2563eb]/30 to-[#16a34a]/30 rounded-full blur-3xl scale-150" />
              <img src={arenaLogo} alt="Arena Corporation" className="relative h-28 w-auto drop-shadow-2xl" />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 border border-white/10 bg-white/5 text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full text-[#4ade80] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />
            Arena Corporation · Official HSE Platform
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.05] mb-8 tracking-tight">
            <span className="text-white">Elevate Your</span>
            <br />
            <span className="bg-gradient-to-r from-[#60a5fa] via-[#34d399] to-[#4ade80] bg-clip-text text-transparent">
              HSE Standards
            </span>
          </h1>

          <p className="text-gray-400 text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
            Platform manajemen HSE kelas enterprise milik Arena Corporation — memadukan kecepatan, kepatuhan, dan visibilitas operasional dalam satu sistem terpadu.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <a
              href="/register"
              className="group inline-flex items-center justify-center gap-3 bg-gradient-to-r from-[#2563eb] to-[#16a34a] text-white font-bold px-8 py-4 rounded-2xl text-base hover:opacity-90 transition-all shadow-xl shadow-blue-900/30"
            >
              <Building2 className="w-5 h-5" />
              Daftarkan Perusahaan Anda
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <button
              onClick={() => setShowPortal(true)}
              className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold px-8 py-4 rounded-2xl text-base transition-all"
            >
              Masuk ke Portal Saya
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5 max-w-3xl mx-auto">
            {TRUST_STATS.map(s => (
              <div key={s.label} className="bg-[#0d1117] px-6 py-5 text-center">
                <div className="text-2xl font-extrabold bg-gradient-to-r from-[#60a5fa] to-[#34d399] bg-clip-text text-transparent mb-1">{s.val}</div>
                <div className="text-xs text-gray-500 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider line */}
      <div className="h-px max-w-7xl mx-auto bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Benefits */}
      <section className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold tracking-widest uppercase text-[#4ade80] mb-3">Capabilities</div>
            <h2 className="text-4xl font-bold text-white mb-4">Built for Enterprise. Ready for Scale.</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Setiap fitur dirancang untuk kebutuhan operasional perusahaan berskala besar — dari inspeksi lapangan hingga laporan direksi.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map(b => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-white/[0.14] rounded-2xl p-7 transition-all duration-300"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2563eb]/20 to-[#16a34a]/20 border border-white/10 flex items-center justify-center mb-5">
                    <Icon className="w-5 h-5 text-[#4ade80]" />
                  </div>
                  <h3 className="font-bold text-white mb-2 text-base">{b.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section — full width gradient */}
      <section className="relative py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2563eb]/20 via-transparent to-[#16a34a]/20" />
        <div className="absolute inset-0 border-y border-white/5" />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <img src={arenaLogo} alt="Arena" className="h-16 w-auto opacity-90" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-5 leading-tight">
            Siap Bergabung dengan<br />
            <span className="bg-gradient-to-r from-[#60a5fa] to-[#4ade80] bg-clip-text text-transparent">Arena Corporation?</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
            Daftarkan unit bisnis atau anak perusahaan Anda ke sistem HSE Arena Corporation. Tim kami akan memverifikasi dan mengaktifkan akses Anda.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/register"
              className="group inline-flex items-center justify-center gap-3 bg-gradient-to-r from-[#2563eb] to-[#16a34a] text-white font-bold px-10 py-4 rounded-2xl text-base hover:opacity-90 transition-all shadow-2xl shadow-blue-900/40"
            >
              <Building2 className="w-5 h-5" />
              Daftarkan Perusahaan
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <button
              onClick={() => setShowPortal(true)}
              className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/15 font-semibold px-8 py-4 rounded-2xl text-base transition-all"
            >
              Sudah Punya Akun? Masuk →
            </button>
          </div>
          <p className="text-gray-600 text-xs mt-6">Proses verifikasi oleh tim Arena Corporation dalam 1×24 jam kerja</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#060b14] py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src={arenaLogo} alt="Arena" className="h-7 w-auto opacity-70" />
            <span className="text-gray-600 text-sm">HSE Management Platform</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-gray-600">
            <a href="/register" className="hover:text-gray-300 transition-colors">Daftar</a>
            <button onClick={() => setShowPortal(true)} className="hover:text-gray-300 transition-colors">Portal Login</button>
            <a href="/sysadmin" className="hover:text-gray-300 transition-colors text-xs opacity-40">Admin</a>
          </div>
          <div className="text-xs text-gray-700">© 2026 Arena Corporation. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
