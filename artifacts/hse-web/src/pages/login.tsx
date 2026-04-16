import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertCircle, Building2 } from "lucide-react";
import { api } from "@/lib/api";

interface CompanyInfo {
  id: number; slug: string; name: string; plan: string; status: string;
}

export default function LoginPage() {
  const { login, isLoading, paywallInfo } = useAuth();
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [companySlug, setCompanySlug] = useState<string | null>(null);

  useEffect(() => {
    // Detect company slug from URL path /c/{slug}/...
    const m = window.location.pathname.match(/^\/c\/([^/]+)/);
    if (m) {
      const slug = m[1]!;
      setCompanySlug(slug);
      api.get<CompanyInfo>(`/auth/company/${slug}`).then(co => setCompany(co)).catch(() => {});
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(nik, password, companySlug ?? undefined);
    } catch (err: any) {
      if (err?.status === 402) return; // paywallInfo is set in context
      setError(err instanceof Error ? err.message : "Login gagal");
    }
  };

  // Show paywall redirect if paywallInfo is set
  if (paywallInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Akses Dibatasi</h1>
          <p className="text-gray-600 mb-6">{paywallInfo.message}</p>
          {paywallInfo.code === "SUBSCRIPTION_EXPIRED" && (
            <a
              href={`/c/${paywallInfo.company.slug}/payment`}
              className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700"
            >
              Lakukan Pembayaran
            </a>
          )}
          <div className="mt-4">
            <button onClick={() => window.location.reload()} className="text-sm text-gray-400 hover:text-gray-600">
              Coba login kembali
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">H&A Monitoring System</span>
        </div>

        {company ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-white font-semibold">{company.name}</div>
                <div className="text-slate-400 text-xs capitalize">{company.plan} plan</div>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white leading-snug mb-4">
              Portal HSE<br />{company.name}
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Login dengan NIK dan password akun Anda di perusahaan ini.
            </p>
          </div>
        ) : (
          <div>
            <h2 className="text-3xl font-bold text-white leading-snug mb-4">
              Sistem Manajemen<br />
              Kesehatan, Keselamatan<br />
              & Lingkungan
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Platform terpadu untuk pemantauan jadwal inspeksi, pelaporan
              hazard & insiden, serta pengelolaan data master HSE perusahaan.
            </p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-slate-500 text-xs">H&A Monitoring System · v2.0</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">H&A Monitoring System</span>
          </div>

          {company && (
            <div className="flex items-center gap-2 mb-5 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-sm font-medium text-blue-900">{company.name}</span>
            </div>
          )}

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Masuk ke Sistem</h1>
          <p className="text-sm text-gray-500 mb-7">
            {companySlug ? `Portal ${company?.name ?? companySlug.toUpperCase()}` : "Gunakan NIK dan password akun Anda"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="py-3">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="nik" className="text-sm font-medium text-gray-700">NIK</Label>
              <Input
                id="nik"
                value={nik}
                onChange={(e) => setNik(e.target.value)}
                placeholder="Masukkan NIK Anda"
                required
                autoFocus
                className="h-10 bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                required
                className="h-10 bg-white"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              disabled={isLoading}
            >
              {isLoading ? "Memverifikasi..." : "Masuk"}
            </Button>
          </form>

          {!companySlug && (
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-400">
                Belum punya akun perusahaan?{" "}
                <a href="/register" className="text-blue-600 hover:underline">Daftar di sini</a>
              </p>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mt-6">
            © 2026 H&A Monitoring System. Hak cipta dilindungi.
          </p>
        </div>
      </div>
    </div>
  );
}
