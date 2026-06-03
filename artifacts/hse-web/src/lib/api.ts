const API_BASE = "/api";

class ApiError extends Error {
  status: number;
  code?: string;
  company?: unknown;
  error?: string;

  constructor(message: string, status: number, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = data?.code as string | undefined;
    this.company = data?.company;
    this.error = data?.error as string | undefined;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = (data.error || data.message || `HTTP ${res.status}`) as string;
    // Dispatch paywall event for mid-session subscription expiry (auth-context listens)
    if (res.status === 402 && data.code) {
      window.dispatchEvent(new CustomEvent("hse:paywall", { detail: data }));
    }
    throw new ApiError(msg, res.status, data);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = (data.error || data.message || `HTTP ${res.status}`) as string;
    throw new ApiError(msg, res.status, data);
  }
  return res.json();
}

export { ApiError };
export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  del: (path: string) => request<void>("DELETE", path),
  upload: <T>(path: string, formData: FormData) => upload<T>(path, formData),
};
