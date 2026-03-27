import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  AlertTriangle,
  Users,
  Tag,
  Layout,
  MapPin,
  Wrench,
  UsersRound,
  Shield,
  LogOut,
  ChevronDown,
  ChevronRight,
  Settings,
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
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: "Jadwal Inspeksi", href: "/schedules", icon: <Calendar className="w-4 h-4" /> },
  { label: "Hazard & Incident", href: "/incidents", icon: <AlertTriangle className="w-4 h-4" /> },
  {
    label: "Master Data", href: "/master", icon: <Settings className="w-4 h-4" />, adminOnly: true,
    children: [
      { label: "Users", href: "/master/users", icon: <Users className="w-4 h-4" /> },
      { label: "Kategori", href: "/master/categories", icon: <Tag className="w-4 h-4" /> },
      { label: "Group", href: "/master/groups", icon: <UsersRound className="w-4 h-4" /> },
      { label: "Template", href: "/master/templates", icon: <Layout className="w-4 h-4" /> },
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

  const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            isActive
              ? "bg-blue-50 text-blue-700"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
            depth > 0 && "pl-6"
          )}
        >
          {item.icon}
          <span className="flex-1 text-left">{item.label}</span>
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {open && (
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
    <Link href={item.href}>
      <a
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-blue-600 text-white shadow-sm"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
          depth > 0 && "pl-6 text-xs"
        )}
      >
        {item.icon}
        {item.label}
      </a>
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const initials = user?.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "??";

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">HSE Monitor</p>
              <p className="text-xs text-gray-500">Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-blue-700">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate capitalize">{user?.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Keluar
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
