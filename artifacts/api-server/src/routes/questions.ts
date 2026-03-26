import { Router } from "express";
import { db, questionsTable, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const templateId = req.query.templateId ? parseInt(req.query.templateId as string) : undefined;
  let query = db.select({ q: questionsTable, c: categoriesTable })
    .from(questionsTable)
    .leftJoin(categoriesTable, eq(questionsTable.categoryId, categoriesTable.id));
  const questions = templateId
    ? await query.where(eq(questionsTable.templateId, templateId))
    : await query;
  res.json(questions.map(({ q, c }) => ({ ...q, categoryName: c?.name, createdAt: q.createdAt.toISOString() })));
});

router.post("/", async (req, res) => {
  const { templateId, text, answerType, isMandatory, requiresPhoto, categoryId, orderIndex } = req.body;
  const [q] = await db.insert(questionsTable).values({ templateId, text, answerType, isMandatory, requiresPhoto, categoryId, orderIndex }).returning();
  if (!q) { res.status(500).json({ message: "Failed" }); return; }
  res.status(201).json({ ...q, createdAt: q.createdAt.toISOString() });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { templateId, text, answerType, isMandatory, requiresPhoto, categoryId, orderIndex } = req.body;
  const [q] = await db.update(questionsTable).set({ templateId, text, answerType, isMandatory, requiresPhoto, categoryId, orderIndex }).where(eq(questionsTable.id, id)).returning();
  if (!q) { res.status(404).json({ message: "Not found" }); return; }
  const cats = categoryId ? await db.select().from(categoriesTable).where(eq(categoriesTable.id, categoryId)) : [];
  res.json({ ...q, categoryName: cats[0]?.name, createdAt: q.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(questionsTable).where(eq(questionsTable.id, id));
  res.status(204).end();
});

export default router;
