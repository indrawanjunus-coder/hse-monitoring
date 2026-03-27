import { Router } from "express";
import { db, incidentsTable, usersTable, categoriesTable, actionsTable, groupsTable, plantsTable } from "@workspace/db";
import { eq, desc, gte, lte, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

// H&I Followup report — incidents bucketed by hours since creation with enhanced details
router.get("/followup", async (req, res) => {
  const { from, to } = req.query;
  let whereClause = undefined as ReturnType<typeof and> | undefined;
  if (from && to) {
    whereClause = and(gte(incidentsTable.incidentDate, String(from)), lte(incidentsTable.incidentDate, String(to)));
  } else if (from) {
    whereClause = gte(incidentsTable.incidentDate, String(from));
  } else if (to) {
    whereClause = lte(incidentsTable.incidentDate, String(to));
  }

  const query = db.select({
    inc: incidentsTable,
    reporter: usersTable,
    cat: categoriesTable,
    action: actionsTable,
    assignedGroup: groupsTable,
    plant: plantsTable,
  })
    .from(incidentsTable)
    .leftJoin(usersTable, eq(incidentsTable.reporterId, usersTable.id))
    .leftJoin(categoriesTable, eq(incidentsTable.categoryId, categoriesTable.id))
    .leftJoin(actionsTable, eq(incidentsTable.actionId, actionsTable.id))
    .leftJoin(groupsTable, eq(incidentsTable.assignedGroupId, groupsTable.id))
    .leftJoin(plantsTable, eq(incidentsTable.plantId, plantsTable.id))
    .orderBy(desc(incidentsTable.createdAt));

  const rawIncidents = whereClause ? await query.where(whereClause) : await query;

  const now = Date.now();

  type IncRow = {
    id: number; status: string; incidentDate: string; categoryName: string;
    plantName: string; reporterName: string; assignedGroupName: string | null;
    actionName: string | null; followupNote: string | null; needsFurtherAction: boolean;
    ageHours: number; createdAt: string; closedAt: string | null;
    detail: string;
  };
  type Bucket = { label: string; key: string; count: number; incidents: IncRow[] };
  const buckets: Record<string, Bucket> = {
    lt_24h: { label: "Kurang dari 24 jam", key: "lt_24h", count: 0, incidents: [] },
    b_24_48h: { label: "24 – 48 jam", key: "b_24_48h", count: 0, incidents: [] },
    b_48_72h: { label: "48 – 72 jam", key: "b_48_72h", count: 0, incidents: [] },
    gt_72h: { label: "Lebih dari 72 jam", key: "gt_72h", count: 0, incidents: [] },
  };

  for (const row of rawIncidents) {
    const ageH = (now - new Date(row.inc.createdAt).getTime()) / 3_600_000;
    let bucket: string;
    if (ageH < 24) bucket = "lt_24h";
    else if (ageH < 48) bucket = "b_24_48h";
    else if (ageH < 72) bucket = "b_48_72h";
    else bucket = "gt_72h";

    const b = buckets[bucket]!;
    b.count++;
    b.incidents.push({
      id: row.inc.id,
      status: row.inc.status,
      incidentDate: row.inc.incidentDate,
      categoryName: row.cat?.name ?? "",
      plantName: row.plant?.name ?? "",
      reporterName: row.reporter?.name ?? "",
      assignedGroupName: row.assignedGroup?.name ?? null,
      actionName: row.action?.name ?? null,
      followupNote: row.inc.followupNote ?? null,
      needsFurtherAction: row.inc.needsFurtherAction,
      ageHours: Math.round(ageH),
      createdAt: row.inc.createdAt.toISOString(),
      closedAt: row.inc.closedAt ?? null,
      detail: row.inc.detail.length > 120 ? row.inc.detail.slice(0, 120) + "…" : row.inc.detail,
    });
  }

  res.json({
    buckets: Object.values(buckets),
    total: rawIncidents.length,
    open: rawIncidents.filter(r => r.inc.status === "open").length,
    inProgress: rawIncidents.filter(r => r.inc.status === "in_progress").length,
    closed: rawIncidents.filter(r => r.inc.status === "closed").length,
  });
});

// Monthly / date-range report
router.get("/monthly", async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) { res.status(400).json({ message: "from and to required (YYYY-MM-DD)" }); return; }

  const whereClause = and(
    gte(incidentsTable.incidentDate, String(from)),
    lte(incidentsTable.incidentDate, String(to))
  );

  const rawIncidents = await db.select({
    inc: incidentsTable,
    cat: categoriesTable,
    plant: plantsTable,
    action: actionsTable,
    assignedGroup: groupsTable,
    reporter: usersTable,
  })
    .from(incidentsTable)
    .leftJoin(categoriesTable, eq(incidentsTable.categoryId, categoriesTable.id))
    .leftJoin(plantsTable, eq(incidentsTable.plantId, plantsTable.id))
    .leftJoin(actionsTable, eq(incidentsTable.actionId, actionsTable.id))
    .leftJoin(groupsTable, eq(incidentsTable.assignedGroupId, groupsTable.id))
    .leftJoin(usersTable, eq(incidentsTable.reporterId, usersTable.id))
    .where(whereClause)
    .orderBy(desc(incidentsTable.createdAt));

  const total = rawIncidents.length;
  const closed = rawIncidents.filter(r => r.inc.status === "closed").length;
  const inProgress = rawIncidents.filter(r => r.inc.status === "in_progress").length;
  const open = rawIncidents.filter(r => r.inc.status === "open").length;
  const withAction = rawIncidents.filter(r => r.inc.actionId).length;

  // By category
  const byCategory: Record<string, { categoryId: number; categoryName: string; total: number; closed: number; open: number; inProgress: number }> = {};
  for (const r of rawIncidents) {
    const key = String(r.inc.categoryId);
    if (!byCategory[key]) byCategory[key] = { categoryId: r.inc.categoryId, categoryName: r.cat?.name ?? "", total: 0, closed: 0, open: 0, inProgress: 0 };
    byCategory[key]!.total++;
    if (r.inc.status === "closed") byCategory[key]!.closed++;
    else if (r.inc.status === "in_progress") byCategory[key]!.inProgress++;
    else byCategory[key]!.open++;
  }

  // By plant
  const byPlant: Record<string, { plantId: number; plantName: string; total: number; closed: number }> = {};
  for (const r of rawIncidents) {
    const key = String(r.inc.plantId);
    if (!byPlant[key]) byPlant[key] = { plantId: r.inc.plantId, plantName: r.plant?.name ?? "", total: 0, closed: 0 };
    byPlant[key]!.total++;
    if (r.inc.status === "closed") byPlant[key]!.closed++;
  }

  // Time bucket distribution
  const now = Date.now();
  const timeBuckets = { lt_24h: 0, b_24_48h: 0, b_48_72h: 0, gt_72h: 0 };
  for (const r of rawIncidents) {
    const ageH = (now - new Date(r.inc.createdAt).getTime()) / 3_600_000;
    if (ageH < 24) timeBuckets.lt_24h++;
    else if (ageH < 48) timeBuckets.b_24_48h++;
    else if (ageH < 72) timeBuckets.b_48_72h++;
    else timeBuckets.gt_72h++;
  }

  // All incidents with detail for the table
  const incidents = rawIncidents.map(r => ({
    id: r.inc.id,
    incidentDate: r.inc.incidentDate,
    reportedDate: r.inc.reportedDate,
    status: r.inc.status,
    categoryName: r.cat?.name ?? "",
    plantName: r.plant?.name ?? "",
    reporterName: r.reporter?.name ?? "",
    assignedGroupName: r.assignedGroup?.name ?? null,
    actionName: r.action?.name ?? null,
    followupNote: r.inc.followupNote ?? null,
    needsFurtherAction: r.inc.needsFurtherAction,
    detail: r.inc.detail,
    closedAt: r.inc.closedAt ?? null,
  }));

  res.json({
    period: { from, to },
    summary: {
      total, closed, inProgress, open,
      withAction,
      resolutionRate: total > 0 ? Math.round((closed / total) * 100) : 0,
    },
    byCategory: Object.values(byCategory),
    byPlant: Object.values(byPlant),
    timeBuckets: [
      { label: "< 24 jam", key: "lt_24h", count: timeBuckets.lt_24h, pct: total > 0 ? Math.round((timeBuckets.lt_24h / total) * 100) : 0 },
      { label: "24–48 jam", key: "b_24_48h", count: timeBuckets.b_24_48h, pct: total > 0 ? Math.round((timeBuckets.b_24_48h / total) * 100) : 0 },
      { label: "48–72 jam", key: "b_48_72h", count: timeBuckets.b_48_72h, pct: total > 0 ? Math.round((timeBuckets.b_48_72h / total) * 100) : 0 },
      { label: "> 72 jam", key: "gt_72h", count: timeBuckets.gt_72h, pct: total > 0 ? Math.round((timeBuckets.gt_72h / total) * 100) : 0 },
    ],
    incidents,
  });
});

export default router;
