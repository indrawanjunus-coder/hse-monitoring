import { Router } from "express";
import { db, templatesTable, questionsTable, categoriesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", async (_req, res) => {
  const templates = await db.select().from(templatesTable);
  const result = await Promise.all(templates.map(async (t) => {
    const [cnt] = await db.select({ count: count() }).from(questionsTable).where(eq(questionsTable.templateId, t.id));
    return { ...t, questionCount: cnt?.count ?? 0, createdAt: t.createdAt.toISOString() };
  }));
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const templates = await db.select().from(templatesTable).where(eq(templatesTable.id, id));
  if (!templates[0]) { res.status(404).json({ message: "Not found" }); return; }
  const t = templates[0];
  const questions = await db.select({ q: questionsTable, c: categoriesTable })
    .from(questionsTable)
    .leftJoin(categoriesTable, eq(questionsTable.categoryId, categoriesTable.id))
    .where(eq(questionsTable.templateId, id));
  res.json({
    ...t,
    questions: questions.map(({ q, c }) => ({
      ...q, categoryName: c?.name, createdAt: q.createdAt.toISOString()
    })),
    createdAt: t.createdAt.toISOString(),
  });
});

router.post("/", async (req, res) => {
  const { name, description } = req.body;
  const [t] = await db.insert(templatesTable).values({ name, description }).returning();
  if (!t) { res.status(500).json({ message: "Failed" }); return; }
  res.status(201).json({ ...t, questionCount: 0, createdAt: t.createdAt.toISOString() });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description } = req.body;
  const [t] = await db.update(templatesTable).set({ name, description }).where(eq(templatesTable.id, id)).returning();
  if (!t) { res.status(404).json({ message: "Not found" }); return; }
  const [cnt] = await db.select({ count: count() }).from(questionsTable).where(eq(questionsTable.templateId, id));
  res.json({ ...t, questionCount: cnt?.count ?? 0, createdAt: t.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(templatesTable).where(eq(templatesTable.id, id));
  res.status(204).end();
});

export default router;
