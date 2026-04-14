import { db, auditLogsTable } from "@workspace/db";
import type { Request } from "express";

export async function writeAuditLog({
  action,
  performedByNik,
  performedByName,
  companyId,
  companyName,
  details,
  req,
}: {
  action: string;
  performedByNik: string;
  performedByName: string;
  companyId?: number | null;
  companyName?: string | null;
  details?: string | null;
  req?: Request;
}) {
  try {
    const ipAddress = req
      ? ((req.headers["x-forwarded-for"] as string) || req.socket?.remoteAddress || null)
      : null;
    await db.insert(auditLogsTable).values({
      action,
      performedByNik,
      performedByName,
      companyId: companyId ?? null,
      companyName: companyName ?? null,
      details: details ?? null,
      ipAddress,
    });
  } catch (e) {
    console.error("Failed to write audit log:", e);
  }
}
