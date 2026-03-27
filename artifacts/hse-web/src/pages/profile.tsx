import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Shield, Key, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const roleLabels: Record<string, string> = {
  admin: "Administrator", supervisor: "Supervisor", employee: "Employee",
};

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError("Password baru dan konfirmasi tidak cocok");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password baru minimal 6 karakter");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/users/${user!.id}/change-password`, { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password berhasil diubah" });
    } catch (err) {
      setError((err as Error).message ?? "Gagal mengubah password");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="Profil Saya" subtitle="Informasi akun dan keamanan" />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" /> Informasi Akun
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-blue-700">
                  {user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
                <p className="text-sm text-gray-500">NIK: {user.nik}</p>
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                  <Shield className="w-3 h-3" /> {roleLabels[user.role] ?? user.role}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {user.email && (
                <div>
                  <p className="text-gray-500 text-xs mb-1">Email</p>
                  <p className="font-medium text-gray-900">{user.email}</p>
                </div>
              )}
              <div>
                <p className="text-gray-500 text-xs mb-1">Role</p>
                <p className="font-medium text-gray-900">{roleLabels[user.role] ?? user.role}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="w-4 h-4" /> Ubah Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <AlertDescription className="text-green-800 ml-2">Password berhasil diubah!</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Password Saat Ini</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Masukkan password saat ini"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Password Baru</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  required
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Ubah Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
