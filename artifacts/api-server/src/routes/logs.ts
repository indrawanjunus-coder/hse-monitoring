import { Router } from "express";
import { db } from "@workspace/db";
import { systemLogsTable } from "@workspace/db";
import { desc, gte, lte, eq, and, or, ilike, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

function requireAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

const router = Router();
router.use(authMiddleware, requireAdmin);

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const level = req.query.level as string | undefined;
    const search = req.query.search as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    const conditions = [];
    if (level && level !== "all") conditions.push(eq(systemLogsTable.level, level));
    if (dateFrom) conditions.push(gte(systemLogsTable.createdAt, new Date(dateFrom)));
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      conditions.push(lte(systemLogsTable.createdAt, to));
    }
    if (search) {
      conditions.push(
        or(
          ilike(systemLogsTable.url, `%${search}%`),
          ilike(systemLogsTable.summary, `%${search}%`),
          ilike(systemLogsTable.userNik, `%${search}%`),
          ilike(systemLogsTable.userName, `%${search}%`),
          ilike(systemLogsTable.errorMessage, `%${search}%`),
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select().from(systemLogsTable)
      .where(where)
      .orderBy(desc(systemLogsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const countRows = await db.select({ count: sql<string>`count(*)` }).from(systemLogsTable).where(where);
    const total = Number(countRows[0]?.count ?? 0);

    res.json({ data: rows, total, limit, offset });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Gagal mengambil log" });
  }
});

router.delete("/clear", async (req, res) => {
  try {
    await db.delete(systemLogsTable);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Gagal menghapus log" });
  }
});

export default router;
