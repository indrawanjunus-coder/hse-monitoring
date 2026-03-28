import { Router } from "express";
import { db, questionsTable, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const templateId = req.query.templateId ? parseInt(req.query.templateId as string) : undefined;
  const baseQuery = db.select({ q: questionsTable, c: categoriesTable })
    .from(questionsTable)
    .leftJoin(categoriesTable, eq(questionsTable.categoryId, categoriesTable.id));
  const questions = templateId
    ? await baseQuery.where(eq(questionsTable.templateId, templateId))
    : await baseQuery;
  res.json(questions.map(({ q, c }) => ({
    ...q, categoryName: c?.name, createdAt: q.createdAt.toISOString(),
  })));
});

router.post("/", async (req, res) => {
  const { templateId, text, answerType, isMandatory, requiresPhoto, categoryId, orderIndex, expectedAnswer, questionType } = req.body;
  const [q] = await db.insert(questionsTable).values({
    templateId, text, answerType, isMandatory, requiresPhoto, categoryId, orderIndex, expectedAnswer,
    questionType: questionType ?? null,
  }).returning();
  if (!q) { res.status(500).json({ message: "Failed" }); return; }
  res.status(201).json({ ...q, createdAt: q.createdAt.toISOString() });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { templateId, text, answerType, isMandatory, requiresPhoto, categoryId, orderIndex, expectedAnswer, questionType } = req.body;
  const updates: Partial<typeof questionsTable.$inferInsert> = {};
  if (templateId !== undefined) updates.templateId = templateId;
  if (text !== undefined) updates.text = text;
  if (answerType !== undefined) updates.answerType = answerType;
  if (isMandatory !== undefined) updates.isMandatory = isMandatory;
  if (requiresPhoto !== undefined) updates.requiresPhoto = requiresPhoto;
  if (categoryId !== undefined) updates.categoryId = categoryId;
  if (orderIndex !== undefined) updates.orderIndex = orderIndex;
  if (expectedAnswer !== undefined) updates.expectedAnswer = expectedAnswer;
  if (questionType !== undefined) updates.questionType = questionType ?? null;
  const [q] = await db.update(questionsTable).set(updates).where(eq(questionsTable.id, id)).returning();
  if (!q) { res.status(404).json({ message: "Not found" }); return; }
  const cats = q.categoryId ? await db.select().from(categoriesTable).where(eq(categoriesTable.id, q.categoryId)) : [];
  res.json({ ...q, categoryName: cats[0]?.name, createdAt: q.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(questionsTable).where(eq(questionsTable.id, id));
  res.status(204).end();
});

export default router;
