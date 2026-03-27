import { Router } from "express";
import {
  db, incidentsTable, usersTable, plantsTable, categoriesTable, actionsTable, groupsTable,
  groupMembersTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { sendEmail, incidentEmailHtml } from "../lib/email";

const router = Router();
router.use(authMiddleware);

async function formatIncident(inc: typeof incidentsTable.$inferSelect) {
  const [reporter] = await db.select().from(usersTable).where(eq(usersTable.id, inc.reporterId));
  const [plant] = await db.select().from(plantsTable).where(eq(plantsTable.id, inc.plantId));
  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, inc.categoryId));
  const [action] = inc.actionId ? await db.select().from(actionsTable).where(eq(actionsTable.id, inc.actionId)) : [undefined];
  const [assignedGroup] = inc.assignedGroupId ? await db.select().from(groupsTable).where(eq(groupsTable.id, inc.assignedGroupId)) : [undefined];

  return {
    ...inc,
    reporterName: reporter?.name ?? "",
    plantName: plant?.name ?? "",
    categoryName: cat?.name ?? "",
    actionName: action?.name ?? null,
    assignedGroupName: assignedGroup?.name ?? null,
    createdAt: inc.createdAt.toISOString(),
  };
}

router.get("/", async (_req, res) => {
  const incidents = await db.select().from(incidentsTable).orderBy(desc(incidentsTable.createdAt));
  const result = await Promise.all(incidents.map(formatIncident));
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [inc] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, id));
  if (!inc) { res.status(404).json({ message: "Not found" }); return; }
  res.json(await formatIncident(inc));
});

router.post("/", async (req, res) => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const { plantId, categoryId, incidentDate, reportedDate, detail, actionId, needsFurtherAction } = req.body;
  const reporterId = req.body.reporterId ?? user.id;

  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, categoryId));
  const assignedGroupId = cat?.picGroupId ?? null;

  const today = new Date().toISOString().slice(0, 10);
  const [inc] = await db.insert(incidentsTable).values({
    reporterId,
    plantId,
    categoryId,
    incidentDate: incidentDate ?? today,
    reportedDate: reportedDate ?? today,
    detail,
    actionId: actionId && actionId !== "none" ? parseInt(String(actionId)) : null,
    needsFurtherAction: needsFurtherAction ?? false,
    status: "open",
    assignedGroupId,
  }).returning();

  if (!inc) { res.status(500).json({ message: "Failed" }); return; }

  const formatted = await formatIncident(inc);

  if (assignedGroupId) {
    try {
      const members = await db.select({ email: usersTable.email })
        .from(groupMembersTable)
        .innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
        .where(eq(groupMembersTable.groupId, assignedGroupId));
      const emails = members.map(m => m.email).filter(Boolean) as string[];
      if (emails.length) {
        sendEmail(
          emails,
          `[HSE] Incident Baru #${inc.id} - ${formatted.categoryName}`,
          incidentEmailHtml({
            id: inc.id, detail: inc.detail,
            categoryName: formatted.categoryName,
            plantName: formatted.plantName,
            incidentDate: inc.incidentDate,
            reporterName: formatted.reporterName,
            assignedGroupName: formatted.assignedGroupName ?? undefined,
          })
        ).catch(() => {});
      }
    } catch { /* ignore email errors */ }
  }

  res.status(201).json(formatted);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { status, actionId, followupNote, needsFurtherAction, plantId, categoryId, incidentDate, reportedDate, detail } = req.body;
  const updates: Record<string, unknown> = {};
  if (status !== undefined) {
    updates.status = status;
    if (status === "closed") updates.closedAt = new Date().toISOString().slice(0, 10);
  }
  if (actionId !== undefined) updates.actionId = (actionId && actionId !== "none") ? parseInt(String(actionId)) : null;
  if (followupNote !== undefined) updates.followupNote = followupNote;
  if (needsFurtherAction !== undefined) updates.needsFurtherAction = needsFurtherAction;
  if (plantId !== undefined) updates.plantId = plantId;
  if (categoryId !== undefined) {
    updates.categoryId = categoryId;
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, categoryId));
    updates.assignedGroupId = cat?.picGroupId ?? null;
  }
  if (incidentDate !== undefined) updates.incidentDate = incidentDate;
  if (reportedDate !== undefined) updates.reportedDate = reportedDate;
  if (detail !== undefined) updates.detail = detail;

  const [inc] = await db.update(incidentsTable).set(updates).where(eq(incidentsTable.id, id)).returning();
  if (!inc) { res.status(404).json({ message: "Not found" }); return; }
  res.json(await formatIncident(inc));
});

router.delete("/:id", async (req, res) => {
  await db.delete(incidentsTable).where(eq(incidentsTable.id, parseInt(req.params.id)));
  res.status(204).end();
});

export default router;
