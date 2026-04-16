import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

interface AuthUser {
  id: number;
  nik: string;
  name: string;
  email: string;
  role: "admin" | "supervisor" | "employee";
  departmentId?: number;
  isHead: boolean;
  groupIds: number[];
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (nik: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setBaseUrl(API_BASE);
    setAuthTokenGetter(async () => {
      const stored = await AsyncStorage.getItem("hse_token");
      return stored;
    });

    AsyncStorage.getItem("hse_token").then(async (stored) => {
      if (stored) {
        setToken(stored);
        try {
          const res = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${stored}` },
          });
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
          } else {
            await AsyncStorage.removeItem("hse_token");
          }
        } catch {
          await AsyncStorage.removeItem("hse_token");
        }
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (nik: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nik, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Login gagal");
    }
    const data = await res.json();
    await AsyncStorage.setItem("hse_token", data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("hse_token");
    setToken(null);
    setUser(null);
    router.replace("/login");
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
