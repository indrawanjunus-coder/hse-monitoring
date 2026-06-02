import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import SysadminLoginPage from "./login";
import SysadminLayout from "./layout";
import SysadminCompanies from "./companies";
import SysadminPayments from "./payments";
import SysadminSettings from "./settings";
import SysadminReports from "./reports";
import SysadminTestimonials from "./testimonials";
import SysadminPlans from "./plans";
import SysadminAudit from "./audit";

export type SysadminTab = "companies" | "payments" | "plans" | "testimonials" | "reports" | "settings" | "audit";

export default function SysadminApp() {
  const [sysUser, setSysUser] = useState<{ name: string; role: string } | null>(null);
  const [tab, setTab] = useState<SysadminTab>("companies");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.get<{ name: string; role: string }>("/auth/me")
      .then((u) => {
        if (u.role === "sysadmin") setSysUser(u);
        else setSysUser(null);
      })
      .catch(() => setSysUser(null))
      .finally(() => setChecking(false));
  }, []);

  const handleLogin = (user: { name: string; role: string }) => {
    setSysUser(user);
  };

  const handleLogout = () => {
    api.post("/auth/logout", {}).catch(() => {});
    setSysUser(null);
  };

  if (checking) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Memuat...</div>
    </div>;
  }

  if (!sysUser) {
    return <SysadminLoginPage onLogin={handleLogin} />;
  }

  return (
    <SysadminLayout user={sysUser} tab={tab} setTab={setTab} onLogout={handleLogout}>
      {tab === "companies" && <SysadminCompanies />}
      {tab === "payments" && <SysadminPayments />}
      {tab === "plans" && <SysadminPlans />}
      {tab === "testimonials" && <SysadminTestimonials />}
      {tab === "reports" && <SysadminReports />}
      {tab === "settings" && <SysadminSettings />}
      {tab === "audit" && <SysadminAudit />}
    </SysadminLayout>
  );
}
