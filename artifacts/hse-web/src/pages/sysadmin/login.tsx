import { useState } from "react";
import { Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";

interface Props { onLogin: (token: string, user: { name: string; role: string }) => void; }

export default function SysadminLoginPage({ onLogin }: Props) {
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: { name: string; role: string } }>("/auth/login", { nik, password });
      if (res.user.role !== "sysadmin") { setError("Akses hanya untuk sysadmin"); return; }
      onLogin(res.token, res.user);
    } catch (err: any) {
      setError(err.message ?? "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-lg">HSE Monitor</div>
            <div className="text-slate-400 text-xs">Panel Administrator Sistem</div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
          <h1 className="text-white font-semibold text-lg mb-6 text-center">Masuk sebagai Sysadmin</h1>

          {error && (
            <Alert variant="destructive" className="mb-5 py-3 bg-red-900/50 border-red-800 text-red-200">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">NIK</Label>
              <Input
                value={nik}
                onChange={e => setNik(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 h-10"
                placeholder="SYSADMIN"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 h-10"
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium mt-2">
              {loading ? "Memverifikasi..." : "Masuk"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
