import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Mail, Shield, Server, Send } from "lucide-react";

interface SmtpSettings {
  id: number | null;
  host: string;
  port: number;
  protocol: "TLS" | "STARTTLS";
  username: string;
  fromName: string;
  fromEmail: string;
  passwordSet: boolean;
  updatedAt?: string;
}

export default function SmtpSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SmtpSettings>({
    queryKey: ["settings", "smtp"],
    queryFn: () => api.get("/settings/smtp"),
  });

  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [protocol, setProtocol] = useState<"TLS" | "STARTTLS">("STARTTLS");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("HSE System");
  const [fromEmail, setFromEmail] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (data) {
      setHost(data.host);
      setPort(String(data.port));
      setProtocol(data.protocol);
      setUsername(data.username);
      setFromName(data.fromName);
      setFromEmail(data.fromEmail);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.put("/settings/smtp", {
      host, port: parseInt(port), protocol, username,
      password: password || undefined,
      fromName, fromEmail,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "smtp"] });
      setPassword("");
      toast({ title: "Pengaturan SMTP disimpan" });
    },
    onError: (err: Error) => toast({ title: "Gagal menyimpan", description: err.message, variant: "destructive" }),
  });

  const handleTest = async () => {
    if (!testEmail) { toast({ title: "Masukkan email tujuan test", variant: "destructive" }); return; }
    setTesting(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>("/settings/smtp/test", { testEmail });
      if (res.success) {
        toast({ title: "Test email berhasil dikirim ke " + testEmail });
      } else {
        toast({ title: "Gagal mengirim", description: res.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Gagal", description: String(err), variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) return <div className="p-6 text-center text-gray-400">Memuat...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader
        title="Pengaturan Email (SMTP)"
        subtitle="Konfigurasi server email untuk notifikasi sistem"
      />

      {data?.updatedAt && (
        <div className="mb-4 text-xs text-gray-400">Terakhir diperbarui: {new Date(data.updatedAt).toLocaleString("id-ID")}</div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-4 h-4" />Konfigurasi Server SMTP
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Server SMTP *</Label>
              <Input value={host} onChange={e => setHost(e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div className="space-y-2">
              <Label>Port *</Label>
              <Input type="number" value={port} onChange={e => setPort(e.target.value)} placeholder="587" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Enkripsi</Label>
            <Select value={protocol} onValueChange={v => setProtocol(v as "TLS" | "STARTTLS")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STARTTLS">STARTTLS (Port 587)</SelectItem>
                <SelectItem value="TLS">TLS/SSL (Port 465)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Username / Email *</Label>
              <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password {data?.passwordSet ? "(sudah diset)" : "*"}</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={data?.passwordSet ? "Kosongkan jika tidak diubah" : "Masukkan password"}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4" />Konfigurasi Pengirim
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nama Pengirim</Label>
              <Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="HSE System" />
            </div>
            <div className="space-y-2">
              <Label>Email Pengirim</Label>
              <Input value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="noreply@example.com" />
            </div>
          </div>
          <p className="text-xs text-gray-400">Jika Email Pengirim dikosongkan, Username akan digunakan sebagai alamat pengirim.</p>
        </CardContent>
      </Card>

      <div className="flex gap-3 mb-6">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !host || !username}>
          {saveMutation.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="w-4 h-4" />Test Kirim Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              className="flex-1"
            />
            <Button variant="outline" onClick={handleTest} disabled={testing || !host}>
              {testing ? "Mengirim..." : "Kirim Test"}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Simpan pengaturan terlebih dahulu sebelum mengirim test email.
          </p>
        </CardContent>
      </Card>

      {/* Info boxes */}
      <div className="mt-6 space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <p className="font-medium flex items-center gap-1.5"><Shield className="w-4 h-4" />Notifikasi otomatis yang dikonfigurasi:</p>
          <ul className="mt-1.5 space-y-0.5 text-xs list-disc list-inside">
            <li>Incident baru → email ke Group PIC yang ditugaskan</li>
            <li>H-1 jadwal inspeksi → email ke semua anggota group yang ditugaskan</li>
          </ul>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <p className="font-medium">Tips konfigurasi Gmail:</p>
          <ul className="mt-1 space-y-0.5 text-xs list-disc list-inside">
            <li>Aktifkan "2-Step Verification" di akun Google</li>
            <li>Buat "App Password" di Google Account Security</li>
            <li>Gunakan App Password (bukan password Gmail) di field password</li>
            <li>Server: smtp.gmail.com · Port: 587 · Enkripsi: STARTTLS</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
