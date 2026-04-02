import { Router } from "express";
import { db, questionsTable, categoriesTable } from "@workspace/db";
import { eq, inArray, max } from "drizzle-orm";
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
  const { templateId, text, answerType, isMandatory, requiresPhoto, categoryId, expectedAnswer, questionType } = req.body;
  const [maxRow] = await db.select({ m: max(questionsTable.orderIndex) })
    .from(questionsTable).where(eq(questionsTable.templateId, templateId));
  const nextIndex = (maxRow?.m ?? 0) + 1;
  const [q] = await db.insert(questionsTable).values({
    templateId, text, answerType, isMandatory, requiresPhoto, categoryId,
    orderIndex: nextIndex, expectedAnswer,
    questionType: questionType ?? null,
  }).returning();
  if (!q) { res.status(500).json({ message: "Failed" }); return; }
  res.status(201).json({ ...q, createdAt: q.createdAt.toISOString() });
});

router.patch("/reorder", async (req, res) => {
  const items: { id: number; orderIndex: number }[] = req.body;
  if (!Array.isArray(items) || items.length === 0) { res.status(400).json({ error: "Invalid payload" }); return; }
  await db.transaction(async (tx) => {
    for (const { id, orderIndex } of items) {
      await tx.update(questionsTable).set({ orderIndex }).where(eq(questionsTable.id, id));
    }
  });
  res.json({ ok: true });
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
