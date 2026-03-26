import { Router } from "express";
import { db, inspectionsTable, inspectionAnswersTable, schedulesTable, usersTable, templatesTable, plantsTable, questionsTable, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const supervisorId = req.query.supervisorId ? parseInt(req.query.supervisorId as string) : undefined;
  const scheduleId = req.query.scheduleId ? parseInt(req.query.scheduleId as string) : undefined;
  let inspections: (typeof inspectionsTable.$inferSelect)[];
  if (supervisorId) {
    inspections = await db.select().from(inspectionsTable).where(eq(inspectionsTable.supervisorId, supervisorId));
  } else if (scheduleId) {
    inspections = await db.select().from(inspectionsTable).where(eq(inspectionsTable.scheduleId, scheduleId));
  } else {
    inspections = await db.select().from(inspectionsTable);
  }
  const result = await Promise.all(inspections.map(async (i) => {
    const [supervisor] = await db.select().from(usersTable).where(eq(usersTable.id, i.supervisorId));
    const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, i.templateId));
    const [plant] = i.plantId ? await db.select().from(plantsTable).where(eq(plantsTable.id, i.plantId)) : [undefined];
    const answers = await db.select().from(inspectionAnswersTable).where(eq(inspectionAnswersTable.inspectionId, i.id));
    const questions = await db.select().from(questionsTable).where(eq(questionsTable.templateId, i.templateId));
    return {
      id: i.id, scheduleId: i.scheduleId, supervisorId: i.supervisorId,
      supervisorName: supervisor?.name ?? "",
      plantId: i.plantId, plantName: plant?.name ?? "",
      templateId: i.templateId, templateName: template?.name ?? "",
      inspectedAt: i.inspectedAt,
      totalQuestions: questions.length, answeredQuestions: answers.length,
      createdAt: i.createdAt.toISOString(),
    };
  }));
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const inspections = await db.select().from(inspectionsTable).where(eq(inspectionsTable.id, id));
  if (!inspections[0]) { res.status(404).json({ message: "Not found" }); return; }
  const i = inspections[0];
  const [supervisor] = await db.select().from(usersTable).where(eq(usersTable.id, i.supervisorId));
  const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, i.templateId));
  const [plant] = i.plantId ? await db.select().from(plantsTable).where(eq(plantsTable.id, i.plantId)) : [undefined];
  const answers = await db.select({ a: inspectionAnswersTable, q: questionsTable, c: categoriesTable })
    .from(inspectionAnswersTable)
    .leftJoin(questionsTable, eq(inspectionAnswersTable.questionId, questionsTable.id))
    .leftJoin(categoriesTable, eq(questionsTable.categoryId, categoriesTable.id))
    .where(eq(inspectionAnswersTable.inspectionId, id));
  res.json({
    id: i.id, scheduleId: i.scheduleId, supervisorId: i.supervisorId,
    supervisorName: supervisor?.name ?? "",
    plantId: i.plantId, plantName: plant?.name ?? "",
    templateId: i.templateId, templateName: template?.name ?? "",
    inspectedAt: i.inspectedAt,
    answers: answers.map(({ a, q, c }) => ({
      id: a.id, questionId: a.questionId,
      questionText: q?.text ?? "",
      answerType: q?.answerType ?? "yes_no",
      answerYesNo: a.answerYesNo,
      answerText: a.answerText,
      photoUrl: a.photoUrl,
      categoryId: c?.id,
      categoryName: c?.name,
    })),
    createdAt: i.createdAt.toISOString(),
  });
});

router.post("/", async (req, res) => {
  const { scheduleId, supervisorId, plantId, templateId, inspectedAt, answers } = req.body;
  const [inspection] = await db.insert(inspectionsTable).values({ scheduleId, supervisorId, plantId, templateId, inspectedAt }).returning();
  if (!inspection) { res.status(500).json({ message: "Failed" }); return; }
  if (answers?.length) {
    await db.insert(inspectionAnswersTable).values(
      answers.map((a: { questionId: number; answerYesNo?: boolean; answerText?: string; photoUrl?: string }) => ({
        inspectionId: inspection.id, questionId: a.questionId,
        answerYesNo: a.answerYesNo, answerText: a.answerText, photoUrl: a.photoUrl,
      }))
    );
  }
  await db.update(schedulesTable).set({ status: "completed" }).where(eq(schedulesTable.id, scheduleId));
  res.status(201).json({
    id: inspection.id, scheduleId, supervisorId, plantId, templateId, inspectedAt,
    totalQuestions: answers?.length ?? 0, answeredQuestions: answers?.length ?? 0,
    supervisorName: "", templateName: "", plantName: "",
    createdAt: inspection.createdAt.toISOString(),
  });
});

export default router;
