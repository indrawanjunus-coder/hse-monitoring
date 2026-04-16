import { Building2, CreditCard, BarChart2, Settings, Shield, LogOut, MessageSquare, Package, ClipboardList } from "lucide-react";
import type { SysadminTab } from "./index";

const NAV = [
  { key: "companies" as SysadminTab, label: "Perusahaan", icon: Building2 },
  { key: "payments" as SysadminTab, label: "Pembayaran", icon: CreditCard },
  { key: "plans" as SysadminTab, label: "Layanan", icon: Package },
  { key: "testimonials" as SysadminTab, label: "Testimoni", icon: MessageSquare },
  { key: "reports" as SysadminTab, label: "Laporan", icon: BarChart2 },
  { key: "audit" as SysadminTab, label: "Log Audit", icon: ClipboardList },
  { key: "settings" as SysadminTab, label: "Pengaturan", icon: Settings },
];

interface Props {
  user: { name: string; role: string };
  tab: SysadminTab;
  setTab: (t: SysadminTab) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function SysadminLayout({ user, tab, setTab, onLogout, children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-white font-semibold text-sm leading-tight">H&A Monitoring</div>
              <div className="text-slate-500 text-xs">Sysadmin</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === item.key
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <div className="px-3 py-2 mb-1">
            <div className="text-slate-300 text-sm font-medium truncate">{user.name}</div>
            <div className="text-slate-500 text-xs capitalize">{user.role}</div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
