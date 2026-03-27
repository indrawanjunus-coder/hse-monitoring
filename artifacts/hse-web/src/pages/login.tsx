import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(nik, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">HSE Monitor</span>
        </div>

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

        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-slate-500 text-xs">PT Demo Indonesia · v1.0</span>
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
            <span className="font-bold text-gray-900 text-lg">HSE Monitor</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Masuk ke Sistem</h1>
          <p className="text-sm text-gray-500 mb-7">Gunakan NIK dan password akun Anda</p>

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

          <p className="text-xs text-gray-400 text-center mt-8">
            © 2026 PT Demo Indonesia. Hak cipta dilindungi.
          </p>
        </div>
      </div>
    </div>
  );
}
