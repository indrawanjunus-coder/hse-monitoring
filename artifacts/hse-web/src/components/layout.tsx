import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  LayoutDashboard,
  Calendar,
  AlertTriangle,
  Users,
  Tag,
  Layout as LayoutIcon,
  MapPin,
  Wrench,
  UsersRound,
  LogOut,
  ChevronDown,
  ChevronRight,
  Settings,
  UserCircle,
  ClipboardList,
  ClipboardCheck,
  BarChart2,
  FileBarChart,
  Mail,
  Target,
  Grid3X3,
  ScrollText,
  Cloud,
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: NavItem[];
  adminOnly?: boolean;
  supervisorOrAdmin?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: "Inspeksi Saya", href: "/my-inspections", icon: <ClipboardList className="w-4 h-4" /> },
  { label: "Riwayat Inspeksi", href: "/history", icon: <ClipboardCheck className="w-4 h-4" /> },
  { label: "Jadwal Inspeksi", href: "/schedules", icon: <Calendar className="w-4 h-4" /> },
  {
    label: "Hazard & Incident",
    href: "/incidents",
    icon: <AlertTriangle className="w-4 h-4" />,
    children: [
      { label: "Daftar H&I", href: "/incidents", icon: <AlertTriangle className="w-4 h-4" /> },
      { label: "Laporan Followup", href: "/reports/followup", icon: <BarChart2 className="w-4 h-4" /> },
      { label: "Laporan Bulanan", href: "/reports/monthly", icon: <FileBarChart className="w-4 h-4" /> },
      { label: "Matrix Aksi per Plant", href: "/reports/action-matrix", icon: <Grid3X3 className="w-4 h-4" /> },
      { label: "Laporan Indikator HSE", href: "/reports/indicators", icon: <Target className="w-4 h-4" />, supervisorOrAdmin: true },
    ],
  },
  { label: "Profil", href: "/profile", icon: <UserCircle className="w-4 h-4" /> },
  {
    label: "Pengaturan", href: "/settings", icon: <Settings className="w-4 h-4" />, adminOnly: true,
    children: [
      { label: "Email (SMTP)", href: "/settings/smtp", icon: <Mail className="w-4 h-4" /> },
      { label: "Google Drive", href: "/settings/gdrive", icon: <Cloud className="w-4 h-4" /> },
      { label: "Log Sistem", href: "/admin/logs", icon: <ScrollText className="w-4 h-4" />, adminOnly: true },
    ],
  },
  {
    label: "Master Data", href: "/master", icon: <Settings className="w-4 h-4" />, supervisorOrAdmin: true,
    children: [
      { label: "Users", href: "/master/users", icon: <Users className="w-4 h-4" />, adminOnly: true },
      { label: "Kategori", href: "/master/categories", icon: <Tag className="w-4 h-4" /> },
      { label: "Group", href: "/master/groups", icon: <UsersRound className="w-4 h-4" /> },
      { label: "Template", href: "/master/templates", icon: <LayoutIcon className="w-4 h-4" /> },
      { label: "Plant", href: "/master/plants", icon: <MapPin className="w-4 h-4" /> },
      { label: "Aksi", href: "/master/actions", icon: <Wrench className="w-4 h-4" /> },
      { label: "Tindakan Preventif", href: "/master/preventive-actions", icon: <Target className="w-4 h-4" /> },
      { label: "Tipe Incident", href: "/master/incident-types", icon: <AlertTriangle className="w-4 h-4" /> },
      { label: "Indikator HSE", href: "/master/indicators", icon: <Target className="w-4 h-4" /> },
    ],
  },
];

function NavLink({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(() => location.startsWith(item.href) && item.href !== "/");
  const { user } = useAuth();

  if (item.adminOnly && user?.role !== "admin") return null;
  if (item.supervisorOrAdmin && user?.role !== "admin" && user?.role !== "supervisor") return null;

  const isActive = item.href === "/" ? location === "/" : location === item.href;
  const isParentActive = item.children ? item.children.some(c => location === c.href || location.startsWith(c.href + "/")) : false;

  if (item.children) {
    const shouldOpen = open || isParentActive;
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            isParentActive
              ? "bg-blue-50 text-blue-700"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
            depth > 0 && "pl-6"
          )}
        >
          {item.icon}
          <span className="flex-1 text-left">{item.label}</span>
          {shouldOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {shouldOpen && (
          <div className="mt-1 ml-2">
            {item.children.map((child) => (
              <NavLink key={child.href} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-blue-600 text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
        depth > 0 && "pl-6"
      )}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

interface IndicatorItem {
  id: number;
  name: string;
  type: string;
  percentage: number | null;
  targetPercentage: number;
}

function IndicatorWidget() {
  const [, navigate] = useLocation();
  const { data: indicators = [] } = useQuery<IndicatorItem[]>({
    queryKey: ["indicators"],
    queryFn: () => api.get("/indicators"),
    staleTime: 60_000,
  });

  if (indicators.length === 0) return null;

  return (
    <div className="border-t border-gray-100 px-3 py-3">
      <button
        className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 hover:text-blue-600 w-full"
        onClick={() => navigate("/master/indicators")}
      >
        <Target className="w-3.5 h-3.5" />
        Indikator HSE
      </button>
      <div className="space-y-2">
        {indicators.slice(0, 4).map(ind => {
          const pct = ind.percentage;
          const isOk = pct !== null && pct >= ind.targetPercentage;
          const isWarn = pct !== null && !isOk && pct >= ind.targetPercentage * 0.8;
          const barColor = pct === null ? "bg-gray-300" : isOk ? "bg-green-500" : isWarn ? "bg-amber-500" : "bg-red-500";
          const textColor = pct === null ? "text-gray-400" : isOk ? "text-green-600" : isWarn ? "text-amber-600" : "text-red-600";

          return (
            <button
              key={ind.id}
              className="w-full text-left hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors"
              onClick={() => navigate("/master/indicators")}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700 truncate max-w-[120px]" title={ind.name}>
                  {ind.name.length > 18 ? ind.name.slice(0, 18) + "…" : ind.name}
                </span>
                <span className={`text-xs font-bold ${textColor}`}>
                  {pct !== null ? `${pct}%` : "—"}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
                />
              </div>
            </button>
          );
        })}
        {indicators.length > 4 && (
          <button
            className="text-xs text-blue-500 hover:text-blue-700 px-2"
            onClick={() => navigate("/master/indicators")}
          >
            +{indicators.length - 4} lainnya →
          </button>
        )}
      </div>
    </div>
  );
}

function Sidebar() {
  const { user, logout } = useAuth();
  const roleLabel = user?.role === "admin" ? "Administrator" : user?.role === "supervisor" ? "Supervisor" : "Employee";

  return (
    <aside className="print:hidden w-60 flex-shrink-0 h-screen flex flex-col bg-white border-r border-gray-200">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">H</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">HSE System</p>
            <p className="text-xs text-gray-400">Health, Safety & Environment</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-2.5 px-2 mb-2">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-gray-600">{user?.name?.[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400">{roleLabel}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start text-gray-500 hover:text-red-600 text-xs" onClick={logout}>
          <LogOut className="w-3.5 h-3.5 mr-2" />Keluar
        </Button>
      </div>
    </aside>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 print:h-auto print:block">
      <Sidebar />
      <main className="flex-1 overflow-y-auto print:overflow-visible print:h-auto">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
