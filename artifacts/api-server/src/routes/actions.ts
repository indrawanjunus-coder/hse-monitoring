import { Router } from "express";
import { db, actionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", async (_req, res) => {
  const actions = await db.select().from(actionsTable);
  res.json(actions.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })));
});

router.post("/", async (req, res) => {
  const { name, description } = req.body;
  const [a] = await db.insert(actionsTable).values({ name, description }).returning();
  if (!a) { res.status(500).json({ message: "Failed" }); return; }
  res.status(201).json({ ...a, createdAt: a.createdAt.toISOString() });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description } = req.body;
  const [a] = await db.update(actionsTable).set({ name, description }).where(eq(actionsTable.id, id)).returning();
  if (!a) { res.status(404).json({ message: "Not found" }); return; }
  res.json({ ...a, createdAt: a.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(actionsTable).where(eq(actionsTable.id, id));
  res.status(204).end();
});

export default router;
