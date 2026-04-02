import { Router } from "express";
import {
  db, inspectionsTable, inspectionAnswersTable, schedulesTable,
  usersTable, templatesTable, plantsTable, questionsTable, categoriesTable, incidentsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
  const scheduleId = req.query.scheduleId ? parseInt(req.query.scheduleId as string) : undefined;
  let inspections: (typeof inspectionsTable.$inferSelect)[];
  if (userId) {
    inspections = await db.select().from(inspectionsTable)
      .where(eq(inspectionsTable.supervisorId, userId))
      .orderBy(desc(inspectionsTable.createdAt));
  } else if (scheduleId) {
    inspections = await db.select().from(inspectionsTable)
      .where(eq(inspectionsTable.scheduleId, scheduleId))
      .orderBy(desc(inspectionsTable.createdAt));
  } else {
    inspections = await db.select().from(inspectionsTable)
      .orderBy(desc(inspectionsTable.createdAt));
  }
  const result = await Promise.all(inspections.map(async (i) => {
    const [supervisor] = await db.select().from(usersTable).where(eq(usersTable.id, i.supervisorId));
    const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, i.templateId));
    const [plant] = i.plantId ? await db.select().from(plantsTable).where(eq(plantsTable.id, i.plantId)) : [undefined];
    const schedule = await db.select().from(schedulesTable).where(eq(schedulesTable.id, i.scheduleId));
    const answers = await db.select().from(inspectionAnswersTable).where(eq(inspectionAnswersTable.inspectionId, i.id));
    const questions = await db.select().from(questionsTable).where(eq(questionsTable.templateId, i.templateId));
    return {
      id: i.id, scheduleId: i.scheduleId, supervisorId: i.supervisorId,
      supervisorName: supervisor?.name ?? "",
      plantId: i.plantId, plantName: plant?.name ?? "",
      templateId: i.templateId, templateName: template?.name ?? "",
      frequency: schedule[0]?.frequency ?? "",
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
      expectedAnswer: q?.expectedAnswer ?? null,
      answerYesNo: a.answerYesNo,
      answerText: a.answerText,
      photoUrl: a.photoUrl,
      categoryId: c?.id,
      categoryName: c?.name,
    })),
    createdAt: i.createdAt.toISOString(),
  });
});

// Submit inspection with answers and auto-create incidents for wrong answers
router.post("/", async (req, res) => {
  const user = (req as typeof req & { user: { id: number; role: string } }).user;
  const { scheduleId, plantId, templateId, inspectedAt, answers } = req.body;
  const supervisorId = user.id;

  const [inspection] = await db.insert(inspectionsTable)
    .values({ scheduleId, supervisorId, plantId, templateId, inspectedAt: inspectedAt ?? new Date().toISOString().slice(0, 10) })
    .returning();
  if (!inspection) { res.status(500).json({ message: "Failed" }); return; }

  const autoIncidents: number[] = [];

  if (answers?.length) {
    await db.insert(inspectionAnswersTable).values(
      answers.map((a: { questionId: number; answerYesNo?: boolean; answerText?: string; answerRefId?: number; photoUrl?: string }) => ({
        inspectionId: inspection.id,
        questionId: a.questionId,
        answerYesNo: a.answerYesNo,
        answerText: a.answerText,
        answerRefId: a.answerRefId ?? null,
        photoUrl: a.photoUrl,
      }))
    );

    // Auto-create incidents for wrong answers
    const today = new Date().toISOString().slice(0, 10);
    for (const a of answers) {
      const [q] = await db.select().from(questionsTable).where(eq(questionsTable.id, a.questionId));
      if (!q) continue;
      if (q.answerType === "yes_no" && q.expectedAnswer) {
        const expectedBool = q.expectedAnswer === "yes";
        if (a.answerYesNo !== expectedBool) {
          const detail = `[Auto] Jawaban tidak sesuai harapan. Pertanyaan: "${q.text}" — Diharapkan: ${expectedBool ? "Ya" : "Tidak"}, Dijawab: ${a.answerYesNo ? "Ya" : "Tidak"}`;
          const [incident] = await db.insert(incidentsTable).values({
            reporterId: supervisorId,
            plantId: plantId ?? 1,
            categoryId: q.categoryId ?? 1,
            incidentDate: today,
            reportedDate: today,
            detail,
            status: "open",
            needsFurtherAction: true,
          }).returning();
          if (incident) autoIncidents.push(incident.id);
        }
      }
    }
  }

  await db.update(schedulesTable).set({ status: "completed" }).where(eq(schedulesTable.id, scheduleId));

  res.status(201).json({
    id: inspection.id, scheduleId, supervisorId, plantId, templateId,
    inspectedAt: inspectedAt ?? today,
    totalQuestions: answers?.length ?? 0,
    answeredQuestions: answers?.length ?? 0,
    autoIncidentsCreated: autoIncidents.length,
    supervisorName: "", templateName: "", plantName: "",
    createdAt: inspection.createdAt.toISOString(),
  });
});

export default router;
