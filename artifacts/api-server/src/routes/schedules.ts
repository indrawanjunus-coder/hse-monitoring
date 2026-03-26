import { Router } from "express";
import { db, schedulesTable, usersTable, templatesTable, plantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

async function formatSchedule(s: typeof schedulesTable.$inferSelect) {
  const [supervisor] = await db.select().from(usersTable).where(eq(usersTable.id, s.supervisorId));
  const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, s.templateId));
  const [plant] = await db.select().from(plantsTable).where(eq(plantsTable.id, s.plantId));
  return {
    ...s,
    supervisorName: supervisor?.name ?? "",
    templateName: template?.name ?? "",
    plantName: plant?.name ?? "",
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const supervisorId = req.query.supervisorId ? parseInt(req.query.supervisorId as string) : undefined;
  let schedules: (typeof schedulesTable.$inferSelect)[];
  if (supervisorId) {
    schedules = await db.select().from(schedulesTable).where(eq(schedulesTable.supervisorId, supervisorId));
  } else {
    schedules = await db.select().from(schedulesTable);
  }
  const result = await Promise.all(schedules.map(formatSchedule));
  res.json(result);
});

router.post("/", async (req, res) => {
  const { supervisorId, templateId, plantId, weekStart, weekEnd } = req.body;
  const [s] = await db.insert(schedulesTable).values({ supervisorId, templateId, plantId, weekStart, weekEnd }).returning();
  if (!s) { res.status(500).json({ message: "Failed" }); return; }
  const result = await formatSchedule(s);
  res.status(201).json(result);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { supervisorId, templateId, plantId, weekStart, weekEnd, status } = req.body;
  const updateData: Record<string, unknown> = {};
  if (supervisorId !== undefined) updateData.supervisorId = supervisorId;
  if (templateId !== undefined) updateData.templateId = templateId;
  if (plantId !== undefined) updateData.plantId = plantId;
  if (weekStart !== undefined) updateData.weekStart = weekStart;
  if (weekEnd !== undefined) updateData.weekEnd = weekEnd;
  if (status !== undefined) updateData.status = status;
  const [s] = await db.update(schedulesTable).set(updateData).where(eq(schedulesTable.id, id)).returning();
  if (!s) { res.status(404).json({ message: "Not found" }); return; }
  const result = await formatSchedule(s);
  res.json(result);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(schedulesTable).where(eq(schedulesTable.id, id));
  res.status(204).end();
});

export default router;
