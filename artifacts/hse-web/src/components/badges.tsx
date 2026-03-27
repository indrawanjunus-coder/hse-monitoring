import { cn } from "@/lib/utils";

type RiskLevel = "high" | "medium" | "low";
type Status = "open" | "in_progress" | "closed" | "pending" | "completed" | "active" | string;

const riskConfig: Record<RiskLevel, { label: string; class: string }> = {
  high: { label: "High", class: "bg-red-100 text-red-700 border border-red-200" },
  medium: { label: "Medium", class: "bg-amber-100 text-amber-700 border border-amber-200" },
  low: { label: "Low", class: "bg-green-100 text-green-700 border border-green-200" },
};

const statusConfig: Record<string, { label: string; class: string }> = {
  open: { label: "Open", class: "bg-red-100 text-red-700 border border-red-200" },
  in_progress: { label: "Proses", class: "bg-amber-100 text-amber-700 border border-amber-200" },
  closed: { label: "Selesai", class: "bg-green-100 text-green-700 border border-green-200" },
  pending: { label: "Pending", class: "bg-amber-100 text-amber-700 border border-amber-200" },
  completed: { label: "Selesai", class: "bg-green-100 text-green-700 border border-green-200" },
  active: { label: "Aktif", class: "bg-blue-100 text-blue-700 border border-blue-200" },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const cfg = riskConfig[level];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold", cfg.class)}>
      {cfg.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const cfg = statusConfig[status] ?? { label: status, class: "bg-gray-100 text-gray-700 border border-gray-200" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold", cfg.class)}>
      {cfg.label}
    </span>
  );
}

const frequencyLabels: Record<string, string> = {
  daily: "Setiap Hari",
  weekly: "Setiap Minggu",
  biweekly: "Dua Minggu Sekali",
  monthly: "Setiap Bulan",
  custom: "Kustom",
};

export function FrequencyBadge({ frequency }: { frequency: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
      {frequencyLabels[frequency] ?? frequency}
    </span>
  );
}
