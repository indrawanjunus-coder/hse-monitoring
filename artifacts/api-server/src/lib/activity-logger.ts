import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { systemLogsTable } from "@workspace/db";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function urlSummary(method: string, url: string): string {
  const path = url.split("?")[0] ?? url;
  const parts = path.replace(/^\/api\//, "").split("/");
  const resource = parts[0] ?? path;
  const sub = parts[1] && isNaN(Number(parts[1])) ? `/${parts[1]}` : "";
  const labelMap: Record<string, string> = {
    "users": "User", "groups": "Group", "categories": "Kategori",
    "plants": "Plant", "templates": "Template", "questions": "Pertanyaan",
    "schedules": "Jadwal", "incidents": "H&I", "actions": "Tindakan",
    "preventive-actions": "Tindakan Preventif", "incident-types": "Tipe Incident",
    "inspections": "Inspeksi", "indicators": "Indikator HSE",
    "smtp-settings": "Pengaturan SMTP", "reports": "Laporan",
  };
  const label = labelMap[resource] ?? resource;
  const actionMap: Record<string, string> = {
    "POST": "Tambah", "PUT": "Edit", "PATCH": "Update", "DELETE": "Hapus",
  };
  const action = actionMap[method] ?? method;
  return `${action} ${label}${sub}`;
}

export function activityLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    const status = res.statusCode;
    const method = req.method;
    const user = (req as any).user;

    const shouldLog =
      status >= 400 ||
      (MUTATION_METHODS.has(method) && status >= 200 && status < 300);

    if (shouldLog) {
      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      const errorMessage =
        status >= 400
          ? (typeof body === "object" && body !== null && "error" in body
            ? String((body as any).error)
            : `HTTP ${status}`)
          : undefined;

      const summary = urlSummary(method, req.url ?? "");

      db.insert(systemLogsTable).values({
        level,
        method,
        url: req.url ?? "",
        statusCode: status,
        userId: user?.id ?? null,
        userNik: user?.nik ?? null,
        userName: user?.name ?? null,
        errorMessage: errorMessage ?? null,
        summary,
        ipAddress: req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()
          ?? req.socket.remoteAddress ?? null,
      }).catch(() => {});
    }

    return originalJson(body);
  };

  next();
}
