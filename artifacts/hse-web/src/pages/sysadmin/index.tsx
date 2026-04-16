import { useState } from "react";
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

function getSysToken() { return localStorage.getItem("sys_token"); }
function getSysUser() {
  const u = localStorage.getItem("sys_user");
  return u ? JSON.parse(u) as { name: string; role: string } : null;
}

export default function SysadminApp() {
  const [token, setToken] = useState<string | null>(getSysToken);
  const [sysUser, setSysUser] = useState<{ name: string; role: string } | null>(getSysUser);
  const [tab, setTab] = useState<SysadminTab>("companies");

  const handleLogin = (tok: string, user: { name: string; role: string }) => {
    localStorage.setItem("sys_token", tok);
    localStorage.setItem("sys_user", JSON.stringify(user));
    setToken(tok);
    setSysUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem("sys_token");
    localStorage.removeItem("sys_user");
    setToken(null);
    setSysUser(null);
  };

  if (!token || !sysUser) {
    return <SysadminLoginPage onLogin={handleLogin} />;
  }

  return (
    <SysadminLayout user={sysUser} tab={tab} setTab={setTab} onLogout={handleLogout}>
      {tab === "companies" && <SysadminCompanies token={token} />}
      {tab === "payments" && <SysadminPayments token={token} />}
      {tab === "plans" && <SysadminPlans token={token} />}
      {tab === "testimonials" && <SysadminTestimonials token={token} />}
      {tab === "reports" && <SysadminReports token={token} />}
      {tab === "settings" && <SysadminSettings token={token} />}
      {tab === "audit" && <SysadminAudit token={token} />}
    </SysadminLayout>
  );
}
