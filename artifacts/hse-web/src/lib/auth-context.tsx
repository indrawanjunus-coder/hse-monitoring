import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "./api";

export interface CompanyInfo {
  id: number;
  slug: string;
  name: string;
  plan: string;
  status: string;
  subscriptionEndsAt: string | null;
}

export interface AuthUser {
  id: number;
  nik: string;
  name: string;
  email: string | null;
  role: "admin" | "supervisor" | "employee" | "sysadmin";
  companyId: number | null;
  company?: CompanyInfo | null;
}

export interface PaywallInfo {
  code: "SUBSCRIPTION_EXPIRED" | "PENDING_ACTIVATION" | "SUSPENDED";
  message: string;
  company: CompanyInfo;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  companySlug: string | null;
  paywallInfo: PaywallInfo | null;
  login: (nik: string, password: string, companySlug?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getCompanySlugFromPath(): string | null {
  const m = window.location.pathname.match(/^\/c\/([^/]+)/);
  return m ? m[1]! : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [companySlug] = useState<string | null>(() => getCompanySlugFromPath());
  const [paywallInfo, setPaywallInfo] = useState<PaywallInfo | null>(null);

  useEffect(() => {
    api.get<AuthUser>("/auth/me")
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  // Handle mid-session subscription expiry: API returns 402, show paywall
  useEffect(() => {
    const handlePaywall = (e: Event) => {
      const detail = (e as CustomEvent<Record<string, unknown>>).detail;
      if (detail?.code && typeof detail.code === "string") {
        const allowedCodes = ["SUBSCRIPTION_EXPIRED", "PENDING_ACTIVATION", "SUSPENDED"];
        if (allowedCodes.includes(detail.code)) {
          setPaywallInfo({
            code: detail.code as PaywallInfo["code"],
            message: (detail.message as string) ?? "Langganan tidak aktif",
            company: detail.company as PaywallInfo["company"],
          });
          setUser(null);
        }
      }
    };
    window.addEventListener("hse:paywall", handlePaywall);
    return () => window.removeEventListener("hse:paywall", handlePaywall);
  }, []);

  const login = useCallback(async (nik: string, password: string, slug?: string) => {
    setIsLoading(true);
    setPaywallInfo(null);
    try {
      const body: Record<string, string> = { nik, password };
      if (slug) body.companySlug = slug;
      const res = await api.post<{ user: AuthUser }>("/auth/login", body);
      setUser(res.user);
    } catch (err: any) {
      if (err?.status === 402 || err?.code) {
        const info: PaywallInfo = {
          code: err.code ?? "SUBSCRIPTION_EXPIRED",
          message: err.message ?? "Langganan berakhir",
          company: err.company,
        };
        setPaywallInfo(info);
        throw err;
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    api.post("/auth/logout", {}).catch(() => {});
    setUser(null);
    setPaywallInfo(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, companySlug, paywallInfo, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
