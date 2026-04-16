import { useAuth } from "@/context/AuthContext";
import { useCallback } from "react";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function useApi() {
  const { token } = useAuth();

  const get = useCallback(async (path: string) => {
    const res = await fetch(`${API_BASE}/api${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }, [token]);

  const post = useCallback(async (path: string, body: unknown) => {
    const res = await fetch(`${API_BASE}/api${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `API error: ${res.status}`);
    }
    return res.json();
  }, [token]);

  const put = useCallback(async (path: string, body: unknown) => {
    const res = await fetch(`${API_BASE}/api${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `API error: ${res.status}`);
    }
    return res.json();
  }, [token]);

  const del = useCallback(async (path: string) => {
    const res = await fetch(`${API_BASE}/api${path}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
  }, [token]);

  return { get, post, put, del };
}
