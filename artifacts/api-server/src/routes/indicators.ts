import { Router } from "express";
import { db } from "@workspace/db";
import { indicatorsTable, indicatorQuestionsTable, questionsTable, templatesTable, inspectionAnswersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

async function calcIndicatorPercentage(indicatorId: number): Promise<number | null> {
  const links = await db.select().from(indicatorQuestionsTable).where(eq(indicatorQuestionsTable.indicatorId, indicatorId));
  if (links.length === 0) return null;
  const questionIds = links.map(l => l.questionId);
  const questions = await db.select().from(questionsTable).where(inArray(questionsTable.id, questionIds));
  const answers = await db.select().from(inspectionAnswersTable).where(inArray(inspectionAnswersTable.questionId, questionIds));
  if (answers.length === 0) return null;
  let totalWeight = 0;
  let correctWeight = 0;
  for (const link of links) {
    const q = questions.find(q => q.id === link.questionId);
    if (!q) continue;
    const qAnswers = answers.filter(a => a.questionId === link.questionId);
    for (const ans of qAnswers) {
      totalWeight += link.weight;
      if (q.answerType === "yes_no") {
        const expected = q.expectedAnswer === "no" ? false : true;
        if (ans.answerYesNo === expected) correctWeight += link.weight;
      } else {
        if (ans.answerText && ans.answerText.trim() !== "") correctWeight += link.weight;
      }
    }
  }
  if (totalWeight === 0) return null;
  return Math.round((correctWeight / totalWeight) * 100);
}

router.get("/", async (_req, res) => {
  const indicators = await db.select().from(indicatorsTable).orderBy(indicatorsTable.id);
  const result = await Promise.all(indicators.map(async (ind) => {
    const percentage = await calcIndicatorPercentage(ind.id);
    const links = await db.select({ questionId: indicatorQuestionsTable.questionId })
      .from(indicatorQuestionsTable).where(eq(indicatorQuestionsTable.indicatorId, ind.id));
    return { ...ind, percentage, questionCount: links.length };
  }));
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [indicator] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, id));
  if (!indicator) return res.status(404).json({ error: "Not found" });
  const links = await db.select({
    id: indicatorQuestionsTable.id,
    questionId: indicatorQuestionsTable.questionId,
    weight: indicatorQuestionsTable.weight,
    questionText: questionsTable.text,
    answerType: questionsTable.answerType,
    expectedAnswer: questionsTable.expectedAnswer,
    templateId: questionsTable.templateId,
  }).from(indicatorQuestionsTable)
    .leftJoin(questionsTable, eq(indicatorQuestionsTable.questionId, questionsTable.id))
    .where(eq(indicatorQuestionsTable.indicatorId, id));
  const percentage = await calcIndicatorPercentage(id);
  res.json({ ...indicator, percentage, questions: links });
});

router.post("/", async (req, res) => {
  const { name, description, type, targetPercentage } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Name required" });
  const [created] = await db.insert(indicatorsTable).values({ name: name.trim(), description, type: type || "ISO", targetPercentage: targetPercentage ?? 100 }).returning();
  res.status(201).json(created);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, type, targetPercentage } = req.body;
  const [updated] = await db.update(indicatorsTable).set({ name, description, type, targetPercentage }).where(eq(indicatorsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(indicatorsTable).where(eq(indicatorsTable.id, id));
  res.json({ ok: true });
});

router.get("/:id/questions", async (req, res) => {
  const id = parseInt(req.params.id);
  const rows = await db.select({
    id: indicatorQuestionsTable.id,
    questionId: indicatorQuestionsTable.questionId,
    weight: indicatorQuestionsTable.weight,
    text: questionsTable.text,
    answerType: questionsTable.answerType,
    expectedAnswer: questionsTable.expectedAnswer,
    templateId: questionsTable.templateId,
    templateName: templatesTable.name,
  }).from(indicatorQuestionsTable)
    .leftJoin(questionsTable, eq(indicatorQuestionsTable.questionId, questionsTable.id))
    .leftJoin(templatesTable, eq(questionsTable.templateId, templatesTable.id))
    .where(eq(indicatorQuestionsTable.indicatorId, id));
  res.json(rows);
});

router.post("/:id/questions", async (req, res) => {
  const indicatorId = parseInt(req.params.id);
  const { questionId, weight } = req.body;
  if (!questionId) return res.status(400).json({ error: "questionId required" });
  const [created] = await db.insert(indicatorQuestionsTable).values({ indicatorId, questionId, weight: weight ?? 1 }).returning();
  res.status(201).json(created);
});

router.delete("/:id/questions/:qid", async (req, res) => {
  const id = parseInt(req.params.qid);
  await db.delete(indicatorQuestionsTable).where(eq(indicatorQuestionsTable.id, id));
  res.json({ ok: true });
});

export default router;
