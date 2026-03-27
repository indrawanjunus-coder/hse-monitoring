import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "./api";

interface AuthUser {
  id: number;
  nik: string;
  name: string;
  email: string;
  role: "admin" | "supervisor" | "employee";
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (nik: string, password: string) => Promise<void>;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("hse_token"));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const t = localStorage.getItem("hse_token");
    return t ? decodeToken(t) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (nik: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.post<{ token: string; user: AuthUser }>("/auth/login", { nik, password });
      localStorage.setItem("hse_token", res.token);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hse_token");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
