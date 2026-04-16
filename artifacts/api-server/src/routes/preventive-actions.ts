import { Router } from "express";
import { db } from "@workspace/db";
import { preventiveActionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const cid = req.user!.companyId;
  const rows = cid
    ? await db.select().from(preventiveActionsTable).where(eq(preventiveActionsTable.companyId, cid)).orderBy(preventiveActionsTable.id)
    : await db.select().from(preventiveActionsTable).orderBy(preventiveActionsTable.id);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Name required" });
  const companyId = req.user!.companyId;
  const [created] = await db.insert(preventiveActionsTable).values({ name: name.trim(), description, companyId }).returning();
  res.status(201).json(created);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description } = req.body;
  const cid = req.user!.companyId;
  const whereClause = cid ? and(eq(preventiveActionsTable.id, id), eq(preventiveActionsTable.companyId, cid)) : eq(preventiveActionsTable.id, id);
  const [updated] = await db.update(preventiveActionsTable).set({ name, description }).where(whereClause).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const cid = req.user!.companyId;
  const id = parseInt(req.params.id);
  const whereClause = cid ? and(eq(preventiveActionsTable.id, id), eq(preventiveActionsTable.companyId, cid)) : eq(preventiveActionsTable.id, id);
  await db.delete(preventiveActionsTable).where(whereClause);
  res.json({ ok: true });
});

export default router;
