import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Grid3X3 } from "lucide-react";
import * as XLSX from "xlsx";

interface ActionMatrixData {
  plants: string[];
  actions: string[];
  rows: Record<string, number | string>[];
  plantTotals: Record<string, number>;
  grandTotal: number;
}

function getDefaultRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${new Date(y, now.getMonth() + 1, 0).getDate()}` };
}

export default function ActionMatrixPage() {
  const def = getDefaultRange();
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [applied, setApplied] = useState({ from: def.from, to: def.to });

  const { data, isLoading } = useQuery<ActionMatrixData>({
    queryKey: ["action-matrix", applied.from, applied.to],
    queryFn: () => api.get(`/reports/action-matrix?from=${applied.from}&to=${applied.to}`),
  });

  const exportExcel = () => {
    if (!data) return;
    const header = ["Tindakan", ...data.plants, "Total"];
    const rows = data.rows.map(r => [r.actionName, ...data.plants.map(p => r[p] ?? 0), r["_total"]]);
    const footer = ["TOTAL", ...data.plants.map(p => data.plantTotals[p] ?? 0), data.grandTotal];
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows, footer]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matrix Aksi");
    XLSX.writeFile(wb, `matrix-aksi-${applied.from}-${applied.to}.xlsx`);
  };

  return (
    <div className="p-6 print:p-4">
      <PageHeader
        title="Matrix Aksi per Plant"
        subtitle="Distribusi tindakan penanganan per lokasi plant"
        action={
          <Button variant="outline" onClick={exportExcel} disabled={!data}>
            <Download className="w-4 h-4 mr-2" />Export Excel
          </Button>
        }
      />

      <Card className="mb-6 print:hidden">
        <CardContent className="pt-4">
          <div className="flex items-end gap-4">
            <div className="space-y-1">
              <Label>Dari Tanggal</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label>Sampai Tanggal</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
            </div>
            <Button onClick={() => setApplied({ from, to })}>Terapkan</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Memuat data...</div>
          ) : !data || data.rows.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Grid3X3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Tidak ada data pada periode ini</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="text-left px-3 py-2.5 font-semibold border border-blue-500 whitespace-nowrap">Tindakan</th>
                  {data.plants.map(p => (
                    <th key={p} className="text-center px-3 py-2.5 font-semibold border border-blue-500 whitespace-nowrap">{p}</th>
                  ))}
                  <th className="text-center px-3 py-2.5 font-semibold border border-blue-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2 border border-gray-200 font-medium whitespace-nowrap">{row.actionName as string}</td>
                    {data.plants.map(p => {
                      const val = Number(row[p] ?? 0);
                      return (
                        <td key={p} className="text-center px-3 py-2 border border-gray-200">
                          {val > 0 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
                              {val}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center px-3 py-2 border border-gray-200 font-bold text-gray-800">{row["_total"] as number}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                  <td className="px-3 py-2 border border-blue-200 text-blue-700">TOTAL</td>
                  {data.plants.map(p => (
                    <td key={p} className="text-center px-3 py-2 border border-blue-200 text-blue-700">
                      {data.plantTotals[p] ?? 0}
                    </td>
                  ))}
                  <td className="text-center px-3 py-2 border border-blue-200 text-blue-800 text-base">{data.grandTotal}</td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 text-xs text-gray-400 print:hidden">
        Periode: {applied.from} s/d {applied.to} · Total insiden: {data?.grandTotal ?? 0}
      </div>
    </div>
  );
}
