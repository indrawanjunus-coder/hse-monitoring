import { Router } from "express";
import { db, incidentsTable, usersTable, plantsTable, categoriesTable, actionsTable, groupsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

async function formatIncident(i: typeof incidentsTable.$inferSelect) {
  const [reporter] = await db.select().from(usersTable).where(eq(usersTable.id, i.reporterId));
  const [plant] = await db.select().from(plantsTable).where(eq(plantsTable.id, i.plantId));
  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, i.categoryId));
  const [action] = i.actionId ? await db.select().from(actionsTable).where(eq(actionsTable.id, i.actionId)) : [undefined];
  let picGroupName: string | undefined;
  if (category?.picGroupId) {
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, category.picGroupId));
    picGroupName = group?.name;
  }
  return {
    id: i.id, reporterId: i.reporterId, reporterName: reporter?.name ?? "",
    plantId: i.plantId, plantName: plant?.name ?? "",
    categoryId: i.categoryId, categoryName: category?.name ?? "",
    categoryRiskLevel: category?.riskLevel ?? "low",
    incidentDate: i.incidentDate, reportedDate: i.reportedDate,
    detail: i.detail, actionId: i.actionId, actionName: action?.name,
    needsFurtherAction: i.needsFurtherAction, status: i.status, closedAt: i.closedAt,
    picGroupId: category?.picGroupId, picGroupName,
    createdAt: i.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const month = req.query.month ? parseInt(req.query.month as string) : undefined;
  const year = req.query.year ? parseInt(req.query.year as string) : undefined;
  const plantId = req.query.plantId ? parseInt(req.query.plantId as string) : undefined;
  const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
  const status = req.query.status as string | undefined;

  let incidents = await db.select().from(incidentsTable);
  if (month && year) {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    incidents = incidents.filter(i => i.incidentDate.startsWith(prefix));
  }
  if (plantId) incidents = incidents.filter(i => i.plantId === plantId);
  if (categoryId) incidents = incidents.filter(i => i.categoryId === categoryId);
  if (status) incidents = incidents.filter(i => i.status === status);

  const result = await Promise.all(incidents.map(formatIncident));
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const incidents = await db.select().from(incidentsTable).where(eq(incidentsTable.id, id));
  if (!incidents[0]) { res.status(404).json({ message: "Not found" }); return; }
  res.json(await formatIncident(incidents[0]));
});

router.post("/", async (req, res) => {
  const { reporterId, plantId, categoryId, incidentDate, detail, actionId, needsFurtherAction } = req.body;
  const today = new Date().toISOString().split("T")[0]!;
  const [i] = await db.insert(incidentsTable).values({
    reporterId, plantId, categoryId, incidentDate, reportedDate: today,
    detail, actionId, needsFurtherAction,
  }).returning();
  if (!i) { res.status(500).json({ message: "Failed" }); return; }
  res.status(201).json(await formatIncident(i));
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { status, actionId, needsFurtherAction, detail } = req.body;
  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData.status = status;
  if (actionId !== undefined) updateData.actionId = actionId;
  if (needsFurtherAction !== undefined) updateData.needsFurtherAction = needsFurtherAction;
  if (detail !== undefined) updateData.detail = detail;
  if (status === "closed") updateData.closedAt = new Date().toISOString().split("T")[0];
  const [i] = await db.update(incidentsTable).set(updateData).where(eq(incidentsTable.id, id)).returning();
  if (!i) { res.status(404).json({ message: "Not found" }); return; }
  res.json(await formatIncident(i));
});

export default router;
