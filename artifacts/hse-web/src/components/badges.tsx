import { cn } from "@/lib/utils";

type RiskLevel = "insignificant" | "minor" | "moderate" | "major" | "catastrophic" | "fatal" | "high" | "medium" | "low";
type Probability = "rare" | "unlikely" | "possible" | "likely" | "almost_certain";
type Status = "open" | "in_progress" | "closed" | "pending" | "completed" | "active" | string;

const riskConfig: Record<RiskLevel, { label: string; class: string }> = {
  insignificant: { label: "Insignificant", class: "bg-slate-100 text-slate-600 border border-slate-200" },
  minor: { label: "Minor", class: "bg-green-100 text-green-700 border border-green-200" },
  moderate: { label: "Moderate", class: "bg-yellow-100 text-yellow-700 border border-yellow-200" },
  major: { label: "Major", class: "bg-orange-100 text-orange-700 border border-orange-200" },
  catastrophic: { label: "Catastrophic", class: "bg-red-100 text-red-700 border border-red-200" },
  // Legacy/aliases
  fatal: { label: "Catastrophic", class: "bg-red-100 text-red-700 border border-red-200" },
  low: { label: "Minor", class: "bg-green-100 text-green-700 border border-green-200" },
  medium: { label: "Moderate", class: "bg-yellow-100 text-yellow-700 border border-yellow-200" },
  high: { label: "Major", class: "bg-orange-100 text-orange-700 border border-orange-200" },
};

const probabilityConfig: Record<Probability, { label: string; class: string }> = {
  rare:          { label: "Rare",          class: "bg-slate-100 text-slate-600 border border-slate-200" },
  unlikely:      { label: "Unlikely",      class: "bg-green-100 text-green-700 border border-green-200" },
  possible:      { label: "Possible",      class: "bg-yellow-100 text-yellow-700 border border-yellow-200" },
  likely:        { label: "Likely",        class: "bg-orange-100 text-orange-700 border border-orange-200" },
  almost_certain:{ label: "Almost Certain",class: "bg-red-100 text-red-700 border border-red-200" },
};

const statusConfig: Record<string, { label: string; class: string }> = {
  open: { label: "Open", class: "bg-red-100 text-red-700 border border-red-200" },
  in_progress: { label: "Proses", class: "bg-amber-100 text-amber-700 border border-amber-200" },
  "in-progress": { label: "Proses", class: "bg-amber-100 text-amber-700 border border-amber-200" },
  closed: { label: "Selesai", class: "bg-green-100 text-green-700 border border-green-200" },
  pending: { label: "Pending", class: "bg-amber-100 text-amber-700 border border-amber-200" },
  completed: { label: "Selesai", class: "bg-green-100 text-green-700 border border-green-200" },
  active: { label: "Aktif", class: "bg-blue-100 text-blue-700 border border-blue-200" },
  resolved: { label: "Resolved", class: "bg-teal-100 text-teal-700 border border-teal-200" },
};

const incidentTypeConfig: Record<string, { label: string; class: string }> = {
  near_miss: { label: "Near Miss", class: "bg-blue-100 text-blue-700 border border-blue-200" },
  accident: { label: "Accident", class: "bg-red-100 text-red-700 border border-red-200" },
  unsafe_act: { label: "Unsafe Act", class: "bg-orange-100 text-orange-700 border border-orange-200" },
  unsafe_condition: { label: "Unsafe Condition", class: "bg-purple-100 text-purple-700 border border-purple-200" },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const cfg = riskConfig[level] ?? { label: level, class: "bg-gray-100 text-gray-700 border border-gray-200" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold", cfg.class)}>
      {cfg.label}
    </span>
  );
}

export function ProbabilityBadge({ probability }: { probability: string }) {
  const cfg = probabilityConfig[probability as Probability] ?? { label: probability, class: "bg-gray-100 text-gray-700 border border-gray-200" };
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

export function IncidentTypeBadge({ type }: { type: string }) {
  const cfg = incidentTypeConfig[type] ?? { label: type, class: "bg-gray-100 text-gray-700 border border-gray-200" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold", cfg.class)}>
      {cfg.label}
    </span>
  );
}

const frequencyLabels: Record<string, string> = {
  always: "Tampil Selalu",
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

export const INCIDENT_TYPES = [
  { value: "near_miss", label: "Near Miss" },
  { value: "accident", label: "Accident" },
  { value: "unsafe_act", label: "Unsafe Act" },
  { value: "unsafe_condition", label: "Unsafe Condition" },
] as const;

export const SEVERITY_LEVELS = [
  { value: "insignificant", label: "Insignificant" },
  { value: "minor", label: "Minor" },
  { value: "moderate", label: "Moderate" },
  { value: "major", label: "Major" },
  { value: "catastrophic", label: "Catastrophic" },
] as const;

export const PROBABILITY_LEVELS = [
  { value: "rare",          label: "Rare" },
  { value: "unlikely",      label: "Unlikely" },
  { value: "possible",      label: "Possible" },
  { value: "likely",        label: "Likely" },
  { value: "almost_certain",label: "Almost Certain" },
] as const;
