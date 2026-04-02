import { Router } from "express";
import {
  db, incidentsTable, usersTable, plantsTable, categoriesTable, actionsTable, groupsTable,
  groupMembersTable, preventiveActionsTable, categoryGroupsTable, categoryUsersTable,
} from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { sendEmail, incidentEmailHtml } from "../lib/email";

const router = Router();
router.use(authMiddleware);

async function formatIncident(inc: typeof incidentsTable.$inferSelect) {
  const [reporter] = await db.select().from(usersTable).where(eq(usersTable.id, inc.reporterId));
  const [plant] = await db.select().from(plantsTable).where(eq(plantsTable.id, inc.plantId));
  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, inc.categoryId));
  const [action] = inc.actionId ? await db.select().from(actionsTable).where(eq(actionsTable.id, inc.actionId)) : [undefined];
  const [preventiveAction] = inc.preventiveActionId ? await db.select().from(preventiveActionsTable).where(eq(preventiveActionsTable.id, inc.preventiveActionId)) : [undefined];
  const [assignedGroup] = inc.assignedGroupId ? await db.select().from(groupsTable).where(eq(groupsTable.id, inc.assignedGroupId)) : [undefined];

  return {
    ...inc,
    reporterName: reporter?.name ?? "",
    plantName: plant?.name ?? "",
    categoryName: cat?.name ?? "",
    categoryRiskLevel: (cat?.riskLevel ?? null) as "minor" | "moderate" | "major" | "fatal" | null,
    actionName: action?.name ?? null,
    preventiveActionName: preventiveAction?.name ?? null,
    assignedGroupName: assignedGroup?.name ?? null,
    createdAt: inc.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const authUser = req.user!;

  let incidents: (typeof incidentsTable.$inferSelect)[];

  if (authUser.role === "admin") {
    incidents = await db.select().from(incidentsTable).orderBy(desc(incidentsTable.createdAt));
  } else {
    // Find all groups the user belongs to
    const memberOf = await db.select({ groupId: groupMembersTable.groupId })
      .from(groupMembersTable).where(eq(groupMembersTable.userId, authUser.id));
    const userGroupIds = memberOf.map(r => r.groupId);

    // Find all categories where this user is directly assigned
    const directCats = await db.select({ categoryId: categoryUsersTable.categoryId })
      .from(categoryUsersTable).where(eq(categoryUsersTable.userId, authUser.id));

    // Find all categories where any of the user's groups are assigned
    const groupCats = userGroupIds.length
      ? await db.select({ categoryId: categoryGroupsTable.categoryId })
          .from(categoryGroupsTable).where(inArray(categoryGroupsTable.groupId, userGroupIds))
      : [];

    const allowedCategoryIds = new Set([
      ...directCats.map(r => r.categoryId),
      ...groupCats.map(r => r.categoryId),
    ]);

    // Also include incidents the user personally reported
    if (allowedCategoryIds.size === 0) {
      incidents = await db.select().from(incidentsTable)
        .where(eq(incidentsTable.reporterId, authUser.id))
        .orderBy(desc(incidentsTable.createdAt));
    } else {
      const allIncidents = await db.select().from(incidentsTable).orderBy(desc(incidentsTable.createdAt));
      incidents = allIncidents.filter(i =>
        allowedCategoryIds.has(i.categoryId) || i.reporterId === authUser.id
      );
    }
  }

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
  const { plantId, categoryId, incidentDate, reportedDate, detail, actionId, preventiveActionId, targetDate, rootCause, needsFurtherAction, incidentType, recipientUserIds, recipientGroupIds } = req.body;
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
    incidentType: incidentType ?? "near_miss",
    actionId: actionId && actionId !== "none" ? parseInt(String(actionId)) : null,
    preventiveActionId: preventiveActionId && preventiveActionId !== "none" ? parseInt(String(preventiveActionId)) : null,
    targetDate: targetDate || null,
    rootCause: rootCause?.trim() || null,
    needsFurtherAction: needsFurtherAction ?? false,
    status: "open",
    assignedGroupId,
  }).returning();

  if (!inc) { res.status(500).json({ message: "Failed" }); return; }

  const formatted = await formatIncident(inc);

  // Build email recipient list from the form's recipientUserIds + recipientGroupIds
  // If not provided by the form, fall back to category notification settings
  try {
    let finalGroupIds: number[] = [];
    let finalUserIds: number[] = [];

    if (Array.isArray(recipientGroupIds)) {
      finalGroupIds = recipientGroupIds.map((id: number) => Number(id));
    } else {
      // Fallback: load from category settings
      const catGroups = await db.select({ groupId: categoryGroupsTable.groupId })
        .from(categoryGroupsTable).where(eq(categoryGroupsTable.categoryId, categoryId));
      finalGroupIds = catGroups.map(cg => cg.groupId);
    }

    if (Array.isArray(recipientUserIds)) {
      finalUserIds = recipientUserIds.map((id: number) => Number(id));
    } else {
      // Fallback: load from category settings
      const catUsers = await db.select({ userId: categoryUsersTable.userId })
        .from(categoryUsersTable).where(eq(categoryUsersTable.categoryId, categoryId));
      finalUserIds = catUsers.map(u => u.userId);
    }

    const groupEmailSets: string[] = [];
    for (const gid of [...new Set(finalGroupIds)]) {
      const members = await db.select({ email: usersTable.email })
        .from(groupMembersTable)
        .innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
        .where(eq(groupMembersTable.groupId, gid));
      groupEmailSets.push(...members.map(m => m.email).filter(Boolean) as string[]);
    }

    const directEmails: string[] = [];
    if (finalUserIds.length > 0) {
      const userRows = await db.select({ email: usersTable.email })
        .from(usersTable).where(inArray(usersTable.id, finalUserIds));
      directEmails.push(...userRows.map(u => u.email).filter(Boolean) as string[]);
    }

    const emails = [...new Set([...groupEmailSets, ...directEmails])];
    if (emails.length === 0) {
      console.warn(`[Email] No PIC recipients found for category ${categoryId} (incident #${inc.id})`);
    } else {
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
      ).then((result) => {
        if (!result.success) {
          console.error(`[Email] Failed to send email for incident #${inc.id}:`, result.error);
        }
      }).catch((err: unknown) => {
        console.error(`[Email] Unexpected error sending email for incident #${inc.id}:`, err);
      });
    }
  } catch (err: unknown) {
    console.error(`[Email] Error preparing email for incident #${inc.id}:`, err);
  }

  res.status(201).json(formatted);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    status, actionId, preventiveActionId, followupNote, needsFurtherAction,
    plantId, categoryId, incidentDate, reportedDate, detail,
    incidentType, targetDate, rootCause,
  } = req.body;
  const updates: Record<string, unknown> = {};
  if (status !== undefined) {
    updates.status = status;
    if (status === "closed") updates.closedAt = new Date().toISOString().slice(0, 10);
  }
  if (actionId !== undefined) updates.actionId = (actionId && actionId !== "none") ? parseInt(String(actionId)) : null;
  if (preventiveActionId !== undefined) updates.preventiveActionId = (preventiveActionId && preventiveActionId !== "none") ? parseInt(String(preventiveActionId)) : null;
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
  if (incidentType !== undefined) updates.incidentType = incidentType;
  if (targetDate !== undefined) updates.targetDate = targetDate || null;
  if (rootCause !== undefined) updates.rootCause = rootCause?.trim() || null;

  const [inc] = await db.update(incidentsTable).set(updates).where(eq(incidentsTable.id, id)).returning();
  if (!inc) { res.status(404).json({ message: "Not found" }); return; }
  res.json(await formatIncident(inc));
});

router.delete("/:id", async (req, res) => {
  await db.delete(incidentsTable).where(eq(incidentsTable.id, parseInt(req.params.id)));
  res.status(204).end();
});

export default router;
