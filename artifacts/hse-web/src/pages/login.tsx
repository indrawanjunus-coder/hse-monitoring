import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";

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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">HSE Monitor</h1>
          <p className="text-blue-200 mt-2">Health, Safety & Environment</p>
        </div>

        <Card className="shadow-2xl">
          <CardHeader>
            <CardTitle className="text-xl">Masuk ke Sistem</CardTitle>
            <CardDescription>Masukkan NIK dan password Anda</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="nik">NIK</Label>
                <Input
                  id="nik"
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  placeholder="Masukkan NIK Anda"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Memuat..." : "Masuk"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-blue-300 text-sm mt-6">
          HSE Monitor v1.0 · PT Demo Indonesia
        </p>
      </div>
    </div>
  );
}
