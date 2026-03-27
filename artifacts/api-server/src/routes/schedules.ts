import { Router } from "express";
import { db, schedulesTable, usersTable, templatesTable, plantsTable, groupsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

async function formatSchedule(s: typeof schedulesTable.$inferSelect) {
  const [supervisor] = s.supervisorId
    ? await db.select().from(usersTable).where(eq(usersTable.id, s.supervisorId))
    : [undefined];
  const [group] = s.groupId
    ? await db.select().from(groupsTable).where(eq(groupsTable.id, s.groupId))
    : [undefined];
  const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, s.templateId));
  const [plant] = await db.select().from(plantsTable).where(eq(plantsTable.id, s.plantId));
  return {
    ...s,
    supervisorName: supervisor?.name ?? "",
    groupName: group?.name ?? "",
    templateName: template?.name ?? "",
    plantName: plant?.name ?? "",
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const supervisorId = req.query.supervisorId ? parseInt(req.query.supervisorId as string) : undefined;
  const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;
  let schedules: (typeof schedulesTable.$inferSelect)[];
  if (supervisorId) {
    schedules = await db.select().from(schedulesTable).where(eq(schedulesTable.supervisorId, supervisorId));
  } else if (groupId) {
    schedules = await db.select().from(schedulesTable).where(eq(schedulesTable.groupId, groupId));
  } else {
    schedules = await db.select().from(schedulesTable);
  }
  const result = await Promise.all(schedules.map(formatSchedule));
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [s] = await db.select().from(schedulesTable).where(eq(schedulesTable.id, id));
  if (!s) { res.status(404).json({ message: "Not found" }); return; }
  res.json(await formatSchedule(s));
});

router.post("/", async (req, res) => {
  const {
    supervisorId, groupId, templateId, plantId,
    frequency, dayOfWeek, dayOfMonth, customDays,
    weekStart, weekEnd,
  } = req.body;
  const [s] = await db.insert(schedulesTable).values({
    supervisorId: supervisorId ?? null,
    groupId: groupId ?? null,
    templateId, plantId,
    frequency: frequency ?? "weekly",
    dayOfWeek: dayOfWeek ?? null,
    dayOfMonth: dayOfMonth ?? null,
    customDays: customDays ?? null,
    weekStart: weekStart ?? null,
    weekEnd: weekEnd ?? null,
  }).returning();
  if (!s) { res.status(500).json({ message: "Failed" }); return; }
  res.status(201).json(await formatSchedule(s));
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    supervisorId, groupId, templateId, plantId,
    frequency, dayOfWeek, dayOfMonth, customDays,
    weekStart, weekEnd, isActive, status,
  } = req.body;
  const updateData: Record<string, unknown> = {};
  if (supervisorId !== undefined) updateData.supervisorId = supervisorId;
  if (groupId !== undefined) updateData.groupId = groupId;
  if (templateId !== undefined) updateData.templateId = templateId;
  if (plantId !== undefined) updateData.plantId = plantId;
  if (frequency !== undefined) updateData.frequency = frequency;
  if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek;
  if (dayOfMonth !== undefined) updateData.dayOfMonth = dayOfMonth;
  if (customDays !== undefined) updateData.customDays = customDays;
  if (weekStart !== undefined) updateData.weekStart = weekStart;
  if (weekEnd !== undefined) updateData.weekEnd = weekEnd;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (status !== undefined) updateData.status = status;
  const [s] = await db.update(schedulesTable).set(updateData).where(eq(schedulesTable.id, id)).returning();
  if (!s) { res.status(404).json({ message: "Not found" }); return; }
  res.json(await formatSchedule(s));
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(schedulesTable).where(eq(schedulesTable.id, id));
  res.status(204).end();
});

export default router;
