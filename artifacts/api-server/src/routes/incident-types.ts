import { Router } from "express";
import { db } from "@workspace/db";
import { incidentTypesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

function requireAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

const router = Router();
router.use(authMiddleware);

router.get("/", async (_req, res) => {
  const rows = await db.select().from(incidentTypesTable).orderBy(asc(incidentTypesTable.orderIndex), asc(incidentTypesTable.id));
  res.json(rows);
});

router.post("/", requireAdmin, async (req, res) => {
  const { code, label, description, isActive, orderIndex } = req.body;
  if (!code?.trim() || !label?.trim()) return res.status(400).json({ error: "code and label required" });
  const existing = await db.select().from(incidentTypesTable).where(eq(incidentTypesTable.code, code.trim()));
  if (existing.length) return res.status(409).json({ error: "Code already exists" });
  const [created] = await db.insert(incidentTypesTable).values({
    code: code.trim().toLowerCase().replace(/\s+/g, "_"),
    label: label.trim(),
    description: description?.trim() || null,
    isActive: isActive ?? true,
    orderIndex: orderIndex ?? 0,
  }).returning();
  res.status(201).json(created);
});

router.put("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { label, description, isActive, orderIndex } = req.body;
  const [updated] = await db.update(incidentTypesTable)
    .set({ label, description: description?.trim() || null, isActive, orderIndex })
    .where(eq(incidentTypesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(incidentTypesTable).where(eq(incidentTypesTable.id, id));
  res.json({ ok: true });
});

export default router;
