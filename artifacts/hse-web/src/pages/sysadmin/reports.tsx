import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, TrendingUp, Building2, CreditCard } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API_BASE = "/api";
function sysApi(token: string) {
  const h = { Authorization: `Bearer ${token}` };
  return {
    get: async <T,>(path: string): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, { headers: h });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  };
}

function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function fmt(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SysadminReports({ token }: { token: string }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const { data: companyReport } = useQuery({
    queryKey: ["sys-report-companies", month, year],
    queryFn: () => sysApi(token).get<any>(`/sysadmin/reports/companies?month=${month}&year=${year}`),
  });

  const { data: paymentReport } = useQuery({
    queryKey: ["sys-report-payments", month, year],
    queryFn: () => sysApi(token).get<any>(`/sysadmin/reports/payments?month=${month}&year=${year}`),
  });

  const months = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember",
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-blue-600" /> Laporan
        </h1>
        <div className="flex gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-36 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Company summary */}
      {companyReport?.summary && (
        <div className="mb-6">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-blue-600" /> Ringkasan Perusahaan
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total", value: companyReport.summary.total, color: "text-gray-900" },
              { label: "Aktif", value: companyReport.summary.active, color: "text-green-600" },
              { label: "Pending", value: companyReport.summary.pending, color: "text-amber-600" },
              { label: "Free Plan", value: companyReport.summary.free, color: "text-gray-600" },
              { label: "Monthly", value: companyReport.summary.monthly, color: "text-blue-600" },
              { label: "Yearly", value: companyReport.summary.yearly, color: "text-purple-600" },
              { label: "Ditangguhkan", value: companyReport.summary.suspended, color: "text-red-600" },
              { label: "Expired", value: companyReport.summary.expired, color: "text-orange-600" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment summary */}
      {paymentReport?.summary && (
        <div className="mb-6">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-blue-600" /> Ringkasan Pembayaran — {months[parseInt(month) - 1]} {year}
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-sm text-gray-500 mb-1">Total Masuk (Disetujui)</div>
              <div className="text-2xl font-bold text-green-600">{fmtRp(paymentReport.summary.totalApproved)}</div>
              <div className="text-xs text-gray-400 mt-1">{paymentReport.summary.countApproved} transaksi</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-sm text-gray-500 mb-1">Menunggu Verifikasi</div>
              <div className="text-2xl font-bold text-amber-600">{fmtRp(paymentReport.summary.totalPending)}</div>
              <div className="text-xs text-gray-400 mt-1">{paymentReport.summary.countPending} transaksi</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-sm text-gray-500 mb-1">Ditolak</div>
              <div className="text-2xl font-bold text-red-600">{paymentReport.summary.countRejected}</div>
              <div className="text-xs text-gray-400 mt-1">transaksi</div>
            </div>
          </div>
        </div>
      )}

      {/* Company list for month */}
      {companyReport?.companies && companyReport.companies.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Perusahaan Terdaftar — {months[parseInt(month) - 1]} {year}</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Nama", "Paket", "Status", "Aktif Sampai", "Tanggal Daftar"].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companyReport.companies.map((co: any) => (
                  <tr key={co.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{co.name}</div>
                      <div className="text-xs text-gray-400">/c/{co.slug}/</div>
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-700">{co.plan}</td>
                    <td className="px-4 py-3 capitalize text-gray-700">{co.status}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{fmt(co.subscriptionEndsAt ?? co.trialEndsAt)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmt(co.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
