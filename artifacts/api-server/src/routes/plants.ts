import { Router } from "express";
import { db, plantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", async (_req, res) => {
  const plants = await db.select().from(plantsTable);
  res.json(plants.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })));
});

router.post("/", async (req, res) => {
  const { name, code, description } = req.body;
  const [p] = await db.insert(plantsTable).values({ name, code, description }).returning();
  if (!p) { res.status(500).json({ message: "Failed" }); return; }
  res.status(201).json({ ...p, createdAt: p.createdAt.toISOString() });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, code, description } = req.body;
  const [p] = await db.update(plantsTable).set({ name, code, description }).where(eq(plantsTable.id, id)).returning();
  if (!p) { res.status(404).json({ message: "Not found" }); return; }
  res.json({ ...p, createdAt: p.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(plantsTable).where(eq(plantsTable.id, id));
  res.status(204).end();
});

export default router;
