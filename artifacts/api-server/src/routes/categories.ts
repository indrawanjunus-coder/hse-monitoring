import { Router } from "express";
import { db, categoriesTable, groupsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", async (_req, res) => {
  const cats = await db.select().from(categoriesTable);
  const result = await Promise.all(cats.map(async (c) => {
    let picGroupName: string | undefined;
    if (c.picGroupId) {
      const groups = await db.select().from(groupsTable).where(eq(groupsTable.id, c.picGroupId));
      picGroupName = groups[0]?.name;
    }
    return { ...c, picGroupName, createdAt: c.createdAt.toISOString() };
  }));
  res.json(result);
});

router.post("/", async (req, res) => {
  const { name, description, riskLevel, picGroupId, color } = req.body;
  const [c] = await db.insert(categoriesTable).values({ name, description, riskLevel, picGroupId, color }).returning();
  if (!c) { res.status(500).json({ message: "Failed" }); return; }
  res.status(201).json({ ...c, createdAt: c.createdAt.toISOString() });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, riskLevel, picGroupId, color } = req.body;
  const [c] = await db.update(categoriesTable).set({ name, description, riskLevel, picGroupId, color }).where(eq(categoriesTable.id, id)).returning();
  if (!c) { res.status(404).json({ message: "Not found" }); return; }
  res.json({ ...c, createdAt: c.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.status(204).end();
});

export default router;
