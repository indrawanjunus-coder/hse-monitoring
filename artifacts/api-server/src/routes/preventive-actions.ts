import { Router } from "express";
import { db } from "@workspace/db";
import { preventiveActionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", async (_req, res) => {
  const rows = await db.select().from(preventiveActionsTable).orderBy(preventiveActionsTable.id);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Name required" });
  const [created] = await db.insert(preventiveActionsTable).values({ name: name.trim(), description }).returning();
  res.status(201).json(created);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description } = req.body;
  const [updated] = await db.update(preventiveActionsTable).set({ name, description }).where(eq(preventiveActionsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  await db.delete(preventiveActionsTable).where(eq(preventiveActionsTable.id, parseInt(req.params.id)));
  res.json({ ok: true });
});

export default router;
