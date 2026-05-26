import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { QrCode } from "lucide-react";

interface ScanRow {
  scanId: number;
  scannedAt: string;
  permitId: number;
  permitCode: string;
  permitName: string;
  permitStatus: string;
  workStart: string;
  workEnd: string;
  typeName: string | null;
}

function statusBadge(status: string) {
  if (status === "active") return <Badge className="bg-green-100 text-green-700 border-green-200">Aktif</Badge>;
  if (status === "revoked") return <Badge className="bg-red-100 text-red-700 border-red-200">Dicabut</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Kadaluarsa</Badge>;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

export default function WorkPermitReportPage() {
  const { data: scans = [], isLoading } = useQuery<ScanRow[]>({
    queryKey: ["work-permits-report"],
    queryFn: () => api.get("/work-permits/report"),
    refetchInterval: 30_000,
  });

  return (
    <div className="p-6">
      <PageHeader
        title="Laporan Scan Work Permit"
        subtitle={`${scans.length} scan tercatat`}
      />

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Memuat...</div>
        ) : scans.length === 0 ? (
          <div className="p-10 text-center">
            <QrCode className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Belum ada scan yang tercatat.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Waktu Scan</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nama</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Tipe Pekerjaan</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Periode Kerja</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status Permit</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Kode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scans.map((s) => (
                  <tr key={s.scanId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(s.scannedAt)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.permitName}</td>
                    <td className="px-4 py-3 text-gray-600">{s.typeName ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.workStart} – {s.workEnd}</td>
                    <td className="px-4 py-3">{statusBadge(s.permitStatus)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{s.permitCode.slice(0, 8)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
