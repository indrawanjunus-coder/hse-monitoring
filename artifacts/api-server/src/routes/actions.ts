import { Router } from "express";
import { db, actionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const cid = req.user!.companyId;
  const actions = cid
    ? await db.select().from(actionsTable).where(eq(actionsTable.companyId, cid))
    : await db.select().from(actionsTable);
  res.json(actions.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })));
});

router.post("/", async (req, res) => {
  const { name, description } = req.body;
  const companyId = req.user!.companyId;
  const [a] = await db.insert(actionsTable).values({ name, description, companyId }).returning();
  if (!a) { res.status(500).json({ message: "Failed" }); return; }
  res.status(201).json({ ...a, createdAt: a.createdAt.toISOString() });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description } = req.body;
  const cid = req.user!.companyId;
  const whereClause = cid ? and(eq(actionsTable.id, id), eq(actionsTable.companyId, cid)) : eq(actionsTable.id, id);
  const [a] = await db.update(actionsTable).set({ name, description }).where(whereClause).returning();
  if (!a) { res.status(404).json({ message: "Not found" }); return; }
  res.json({ ...a, createdAt: a.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const cid = req.user!.companyId;
  const whereClause = cid ? and(eq(actionsTable.id, id), eq(actionsTable.companyId, cid)) : eq(actionsTable.id, id);
  await db.delete(actionsTable).where(whereClause);
  res.status(204).end();
});

export default router;
