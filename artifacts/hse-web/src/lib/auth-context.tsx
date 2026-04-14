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
  token: string | null;
  isLoading: boolean;
  companySlug: string | null;
  paywallInfo: PaywallInfo | null;
  login: (nik: string, password: string, companySlug?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function decodeToken(token: string): AuthUser | null {
  try {
    const payload = token.startsWith("hse_") ? token.slice(4) : token;
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function getCompanySlugFromPath(): string | null {
  const m = window.location.pathname.match(/^\/c\/([^/]+)/);
  return m ? m[1]! : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("hse_token"));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const t = localStorage.getItem("hse_token");
    return t ? decodeToken(t) : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [companySlug] = useState<string | null>(() => getCompanySlugFromPath());
  const [paywallInfo, setPaywallInfo] = useState<PaywallInfo | null>(null);

  const login = useCallback(async (nik: string, password: string, slug?: string) => {
    setIsLoading(true);
    setPaywallInfo(null);
    try {
      const body: Record<string, string> = { nik, password };
      if (slug) body.companySlug = slug;
      const res = await api.post<{ token: string; user: AuthUser }>("/auth/login", body);
      localStorage.setItem("hse_token", res.token);
      setToken(res.token);
      setUser(res.user);
    } catch (err: any) {
      // Handle 402 paywall errors
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
    localStorage.removeItem("hse_token");
    setToken(null);
    setUser(null);
    setPaywallInfo(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, companySlug, paywallInfo, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
