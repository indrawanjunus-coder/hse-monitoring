import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
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
    ],
  },
  { label: "Profil", href: "/profile", icon: <UserCircle className="w-4 h-4" /> },
  {
    label: "Pengaturan", href: "/settings", icon: <Mail className="w-4 h-4" />, adminOnly: true,
    children: [
      { label: "Email (SMTP)", href: "/settings/smtp", icon: <Mail className="w-4 h-4" /> },
    ],
  },
  {
    label: "Master Data", href: "/master", icon: <Settings className="w-4 h-4" />, adminOnly: true,
    children: [
      { label: "Users", href: "/master/users", icon: <Users className="w-4 h-4" /> },
      { label: "Kategori", href: "/master/categories", icon: <Tag className="w-4 h-4" /> },
      { label: "Group", href: "/master/groups", icon: <UsersRound className="w-4 h-4" /> },
      { label: "Template", href: "/master/templates", icon: <LayoutIcon className="w-4 h-4" />, supervisorOrAdmin: true },
      { label: "Plant", href: "/master/plants", icon: <MapPin className="w-4 h-4" /> },
      { label: "Aksi", href: "/master/actions", icon: <Wrench className="w-4 h-4" /> },
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

function Sidebar() {
  const { user, logout } = useAuth();
  const roleLabel = user?.role === "admin" ? "Administrator" : user?.role === "supervisor" ? "Supervisor" : "Employee";

  return (
    <aside className="w-60 flex-shrink-0 h-screen flex flex-col bg-white border-r border-gray-200">
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
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
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
