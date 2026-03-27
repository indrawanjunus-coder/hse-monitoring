import { Router } from "express";
import {
  db, schedulesTable, usersTable, templatesTable, plantsTable, groupsTable,
  scheduleGroupsTable, scheduleUsersTable, groupMembersTable, inspectionsTable,
} from "@workspace/db";
import { eq, inArray, max } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { sendEmail, scheduleReminderHtml } from "../lib/email";

const router = Router();
router.use(authMiddleware);

async function getScheduleGroups(scheduleId: number) {
  return db.select({ id: groupsTable.id, name: groupsTable.name })
    .from(scheduleGroupsTable)
    .innerJoin(groupsTable, eq(scheduleGroupsTable.groupId, groupsTable.id))
    .where(eq(scheduleGroupsTable.scheduleId, scheduleId));
}

async function getScheduleUsers(scheduleId: number) {
  return db.select({ id: usersTable.id, name: usersTable.name, nik: usersTable.nik })
    .from(scheduleUsersTable)
    .innerJoin(usersTable, eq(scheduleUsersTable.userId, usersTable.id))
    .where(eq(scheduleUsersTable.scheduleId, scheduleId));
}

async function formatSchedule(s: typeof schedulesTable.$inferSelect) {
  const [supervisor] = s.supervisorId
    ? await db.select().from(usersTable).where(eq(usersTable.id, s.supervisorId))
    : [undefined];
  const [group] = s.groupId
    ? await db.select().from(groupsTable).where(eq(groupsTable.id, s.groupId))
    : [undefined];
  const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, s.templateId));
  const [plant] = await db.select().from(plantsTable).where(eq(plantsTable.id, s.plantId));
  const groups = await getScheduleGroups(s.id);
  const users = await getScheduleUsers(s.id);

  const [lastInsp] = await db.select({ inspectedAt: max(inspectionsTable.inspectedAt) })
    .from(inspectionsTable)
    .where(eq(inspectionsTable.scheduleId, s.id));

  return {
    ...s,
    title: s.title ?? template?.name ?? `Inspeksi #${s.id}`,
    supervisorName: supervisor?.name ?? "",
    groupName: group?.name ?? "",
    templateName: template?.name ?? "",
    plantName: plant?.name ?? "",
    groups,
    users,
    groupIds: groups.map(g => g.id),
    userIds: users.map(u => u.id),
    createdAt: s.createdAt.toISOString(),
    lastInspectedAt: lastInsp?.inspectedAt ?? null,
  };
}

router.get("/", async (req, res) => {
  const supervisorId = req.query.supervisorId ? parseInt(req.query.supervisorId as string) : undefined;
  const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;

  let scheduleIds: number[] | undefined;

  if (groupId) {
    // Find schedules assigned to this group via junction table OR old column
    const junctionMatches = await db.select({ scheduleId: scheduleGroupsTable.scheduleId })
      .from(scheduleGroupsTable).where(eq(scheduleGroupsTable.groupId, groupId));
    scheduleIds = junctionMatches.map(r => r.scheduleId);
  }

  let schedules: (typeof schedulesTable.$inferSelect)[];
  if (supervisorId) {
    const junctionMatches = await db.select({ scheduleId: scheduleUsersTable.scheduleId })
      .from(scheduleUsersTable).where(eq(scheduleUsersTable.userId, supervisorId));
    const jIds = junctionMatches.map(r => r.scheduleId);
    const fromCol = await db.select().from(schedulesTable).where(eq(schedulesTable.supervisorId, supervisorId));
    const fromJunction = jIds.length
      ? await db.select().from(schedulesTable).where(inArray(schedulesTable.id, jIds))
      : [];
    const allIds = new Set([...fromCol.map(s => s.id), ...fromJunction.map(s => s.id)]);
    schedules = [...fromCol, ...fromJunction].filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);
  } else if (scheduleIds) {
    schedules = scheduleIds.length ? await db.select().from(schedulesTable).where(inArray(schedulesTable.id, scheduleIds)) : [];
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

async function upsertJunctions(scheduleId: number, groupIds?: number[], userIds?: number[]) {
  if (groupIds !== undefined) {
    await db.delete(scheduleGroupsTable).where(eq(scheduleGroupsTable.scheduleId, scheduleId));
    if (groupIds.length) {
      await db.insert(scheduleGroupsTable).values(groupIds.map(gid => ({ scheduleId, groupId: gid })));
    }
  }
  if (userIds !== undefined) {
    await db.delete(scheduleUsersTable).where(eq(scheduleUsersTable.scheduleId, scheduleId));
    if (userIds.length) {
      await db.insert(scheduleUsersTable).values(userIds.map(uid => ({ scheduleId, userId: uid })));
    }
  }
}

router.post("/", async (req, res) => {
  const {
    title, supervisorId, groupId, templateId, plantId,
    frequency, dayOfWeek, dayOfMonth, customDays, weekStart, weekEnd,
    groupIds, userIds,
  } = req.body;

  const [s] = await db.insert(schedulesTable).values({
    title: title ?? null,
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

  await upsertJunctions(s.id,
    groupIds ?? (groupId ? [groupId] : []),
    userIds ?? (supervisorId ? [supervisorId] : [])
  );

  res.status(201).json(await formatSchedule(s));
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    title, supervisorId, groupId, templateId, plantId,
    frequency, dayOfWeek, dayOfMonth, customDays, weekStart, weekEnd,
    isActive, status, groupIds, userIds,
  } = req.body;

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
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

  await upsertJunctions(s.id, groupIds, userIds);

  res.json(await formatSchedule(s));
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(schedulesTable).where(eq(schedulesTable.id, id));
  res.status(204).end();
});

// POST /schedules/notify/tomorrow - send H-1 reminders (call via cron/manual trigger)
router.post("/notify/tomorrow", async (req, res) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayOfWeek = tomorrow.getDay();
  const dayOfMonth = tomorrow.getDate();
  const month = tomorrow.getMonth();
  const year = tomorrow.getFullYear();
  const tomorrowStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;

  const allSchedules = await db.select().from(schedulesTable).where(eq(schedulesTable.isActive, 1));
  const due = allSchedules.filter(s => {
    if (s.frequency === "daily") return true;
    if (s.frequency === "weekly" && s.dayOfWeek !== null) return s.dayOfWeek === dayOfWeek;
    if (s.frequency === "monthly" && s.dayOfMonth !== null) return s.dayOfMonth === dayOfMonth;
    return false;
  });

  let sent = 0;
  for (const s of due) {
    const formatted = await formatSchedule(s);
    const groupEmails: string[] = [];

    for (const g of formatted.groups) {
      const members = await db.select({ email: usersTable.email })
        .from(groupMembersTable)
        .innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
        .where(eq(groupMembersTable.groupId, g.id));
      groupEmails.push(...members.map(m => m.email).filter(Boolean) as string[]);
    }

    if (groupEmails.length) {
      await sendEmail(
        [...new Set(groupEmails)],
        `[HSE] Pengingat Jadwal Inspeksi Besok - ${formatted.title}`,
        scheduleReminderHtml({ ...formatted, dueDate: tomorrowStr })
      );
      sent++;
    }
  }

  res.json({ due: due.length, emailsSent: sent, tomorrowStr });
});

export default router;
