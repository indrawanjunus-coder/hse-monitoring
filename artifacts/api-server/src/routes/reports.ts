import { Router } from "express";
import { db, incidentsTable, usersTable, categoriesTable, actionsTable, groupsTable, plantsTable, indicatorsTable, indicatorQuestionsTable, questionsTable, inspectionAnswersTable, inspectionsTable, schedulesTable, scheduleGroupsTable, scheduleUsersTable, templatesTable } from "@workspace/db";
import { eq, desc, gte, lte, and, inArray, sql, count } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

// H&I Followup report — incidents bucketed by hours since creation with enhanced details
router.get("/followup", async (req, res) => {
  const { from, to } = req.query;
  const cid = req.user!.companyId;
  let whereClause = cid ? eq(incidentsTable.companyId, cid) : undefined as ReturnType<typeof and> | undefined;
  if (from && to) {
    whereClause = whereClause ? and(whereClause, gte(incidentsTable.incidentDate, String(from)), lte(incidentsTable.incidentDate, String(to))) : and(gte(incidentsTable.incidentDate, String(from)), lte(incidentsTable.incidentDate, String(to)));
  } else if (from) {
    whereClause = whereClause ? and(whereClause, gte(incidentsTable.incidentDate, String(from))) : gte(incidentsTable.incidentDate, String(from));
  } else if (to) {
    whereClause = whereClause ? and(whereClause, lte(incidentsTable.incidentDate, String(to))) : lte(incidentsTable.incidentDate, String(to));
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
  const cid = req.user!.companyId;

  const whereClause = cid
    ? and(eq(incidentsTable.companyId, cid), gte(incidentsTable.incidentDate, String(from)), lte(incidentsTable.incidentDate, String(to)))
    : and(gte(incidentsTable.incidentDate, String(from)), lte(incidentsTable.incidentDate, String(to)));

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

  // By incident type vs category matrix
  const incidentTypes = ["near_miss", "accident", "unsafe_act", "unsafe_condition"] as const;
  const typeLabels: Record<string, string> = { near_miss: "Near Miss", accident: "Accident", unsafe_act: "Unsafe Act", unsafe_condition: "Unsafe Condition" };
  type ByTypeCat = Record<string, Record<string, number>>;
  const byTypeCat: ByTypeCat = {};
  for (const type of incidentTypes) byTypeCat[type] = {};

  for (const r of rawIncidents) {
    const type = (r.inc as Record<string, unknown>).incidentType as string ?? "near_miss";
    const catName = r.cat?.name ?? "—";
    if (!byTypeCat[type]) byTypeCat[type] = {};
    byTypeCat[type]![catName] = (byTypeCat[type]![catName] ?? 0) + 1;
  }

  const typeCategories = [...new Set(rawIncidents.map(r => r.cat?.name ?? "—"))].sort();
  const typeMatrix = incidentTypes.map(type => {
    const row: Record<string, number | string> = { type, label: typeLabels[type] ?? type };
    let rowTotal = 0;
    for (const cat of typeCategories) {
      const v = byTypeCat[type]?.[cat] ?? 0;
      row[cat] = v;
      rowTotal += v;
    }
    row._total = rowTotal;
    return row;
  }).filter(r => (r._total as number) > 0);

  // By type summary
  const byType: Record<string, { type: string; label: string; total: number; open: number; closed: number; inProgress: number }> = {};
  for (const type of incidentTypes) {
    byType[type] = { type, label: typeLabels[type] ?? type, total: 0, open: 0, closed: 0, inProgress: 0 };
  }
  for (const r of rawIncidents) {
    const type = (r.inc as Record<string, unknown>).incidentType as string ?? "near_miss";
    if (!byType[type]) byType[type] = { type, label: typeLabels[type] ?? type, total: 0, open: 0, closed: 0, inProgress: 0 };
    byType[type]!.total++;
    if (r.inc.status === "closed") byType[type]!.closed++;
    else if (r.inc.status === "in_progress") byType[type]!.inProgress++;
    else byType[type]!.open++;
  }

  // Risk matrix by severity level × category
  const riskMatrix = Object.values(byCategory).map(cat => {
    const catRows = rawIncidents.filter(r => String(r.inc.categoryId) === String(cat.categoryId));
    const riskLevel = catRows[0]?.cat?.riskLevel ?? null;
    return {
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      riskLevel,
      fatal: catRows.filter(r => r.cat?.riskLevel === "fatal").length,
      major: catRows.filter(r => r.cat?.riskLevel === "major").length,
      moderate: catRows.filter(r => r.cat?.riskLevel === "moderate").length,
      minor: catRows.filter(r => r.cat?.riskLevel === "minor").length,
      total: cat.total,
    };
  }).filter(r => r.total > 0);

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
    riskMatrix,
    byType: Object.values(byType).filter(t => t.total > 0),
    typeMatrix,
    typeCategories,
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

// Action matrix per plant
router.get("/action-matrix", async (req, res) => {
  const { from, to } = req.query;
  const cid = req.user!.companyId;
  let whereClause = cid ? eq(incidentsTable.companyId, cid) : undefined as ReturnType<typeof and> | undefined;
  if (from && to) {
    whereClause = whereClause ? and(whereClause, gte(incidentsTable.incidentDate, String(from)), lte(incidentsTable.incidentDate, String(to))) : and(gte(incidentsTable.incidentDate, String(from)), lte(incidentsTable.incidentDate, String(to)));
  } else if (from) {
    whereClause = whereClause ? and(whereClause, gte(incidentsTable.incidentDate, String(from))) : gte(incidentsTable.incidentDate, String(from));
  } else if (to) {
    whereClause = whereClause ? and(whereClause, lte(incidentsTable.incidentDate, String(to))) : lte(incidentsTable.incidentDate, String(to));
  }

  const query = db.select({
    inc: incidentsTable,
    plant: plantsTable,
    action: actionsTable,
  })
    .from(incidentsTable)
    .leftJoin(plantsTable, eq(incidentsTable.plantId, plantsTable.id))
    .leftJoin(actionsTable, eq(incidentsTable.actionId, actionsTable.id));

  const rows = whereClause ? await query.where(whereClause) : await query;

  const plantSet = new Map<number, string>();
  const actionSet = new Map<number | null, string>();
  const matrix: Record<string, Record<string, number>> = {};

  for (const r of rows) {
    const plantId = r.inc.plantId;
    const plantName = r.plant?.name ?? "Unknown";
    const actionId = r.inc.actionId ?? 0;
    const actionName = r.action?.name ?? "(Tanpa Tindakan)";

    plantSet.set(plantId, plantName);
    actionSet.set(actionId, actionName);

    if (!matrix[actionName]) matrix[actionName] = {};
    matrix[actionName]![plantName] = (matrix[actionName]![plantName] ?? 0) + 1;
  }

  const plants = [...plantSet.values()].sort();
  const actions = [...actionSet.values()].sort((a, b) => {
    if (a === "(Tanpa Tindakan)") return 1;
    if (b === "(Tanpa Tindakan)") return -1;
    return a.localeCompare(b);
  });

  const matrixRows = actions.map(actionName => {
    const row: Record<string, number | string> = { actionName };
    let rowTotal = 0;
    for (const plantName of plants) {
      const count = matrix[actionName]?.[plantName] ?? 0;
      row[plantName] = count;
      rowTotal += count;
    }
    row["_total"] = rowTotal;
    return row;
  }).filter(r => r["_total"] > 0);

  const plantTotals: Record<string, number> = {};
  for (const plantName of plants) {
    plantTotals[plantName] = matrixRows.reduce((s, r) => s + (Number(r[plantName]) || 0), 0);
  }

  res.json({ plants, actions: actions.filter(a => matrixRows.find(r => r.actionName === a)), rows: matrixRows, plantTotals, grandTotal: rows.length });
});

// Indicator HSE achievement report
router.get("/indicators", async (req, res) => {
  const { month, year } = req.query;
  const cid = req.user!.companyId;
  const indicators = cid
    ? await db.select().from(indicatorsTable).where(eq(indicatorsTable.companyId, cid)).orderBy(indicatorsTable.type, indicatorsTable.id)
    : await db.select().from(indicatorsTable).orderBy(indicatorsTable.type, indicatorsTable.id);

  const result = await Promise.all(indicators.map(async (ind) => {
    const links = await db.select().from(indicatorQuestionsTable).where(eq(indicatorQuestionsTable.indicatorId, ind.id));
    if (links.length === 0) return { ...ind, percentage: null, questionCount: 0, totalAnswers: 0, correctAnswers: 0 };

    const questionIds = links.map(l => l.questionId);
    const qs = await db.select().from(questionsTable).where(inArray(questionsTable.id, questionIds));

    // Join answers with inspections to filter by month/year
    let answersQuery = db.select({
      id: inspectionAnswersTable.id,
      questionId: inspectionAnswersTable.questionId,
      answerYesNo: inspectionAnswersTable.answerYesNo,
      answerText: inspectionAnswersTable.answerText,
      inspectedAt: inspectionsTable.inspectedAt,
    })
      .from(inspectionAnswersTable)
      .leftJoin(inspectionsTable, eq(inspectionAnswersTable.inspectionId, inspectionsTable.id))
      .where(inArray(inspectionAnswersTable.questionId, questionIds));

    const answers = await answersQuery;

    // Filter by month/year if provided
    const filtered = (month && year)
      ? answers.filter(a => {
          if (!a.inspectedAt) return false;
          const d = new Date(a.inspectedAt);
          return d.getMonth() + 1 === parseInt(String(month)) && d.getFullYear() === parseInt(String(year));
        })
      : year
        ? answers.filter(a => {
            if (!a.inspectedAt) return false;
            return new Date(a.inspectedAt).getFullYear() === parseInt(String(year));
          })
        : answers;

    let totalWeight = 0;
    let correctWeight = 0;
    for (const link of links) {
      const q = qs.find(q => q.id === link.questionId);
      if (!q) continue;
      const qAnswers = filtered.filter(a => a.questionId === link.questionId);
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

    const percentage = totalWeight > 0 ? Math.round((correctWeight / totalWeight) * 100) : null;
    return { ...ind, percentage, questionCount: links.length, totalAnswers: filtered.length, correctAnswers: correctWeight };
  }));

  // Group by type
  const byType: Record<string, typeof result> = {};
  for (const r of result) {
    if (!byType[r.type]) byType[r.type] = [];
    byType[r.type].push(r);
  }

  const totalWithData = result.filter(r => r.percentage !== null);
  const avgPercentage = totalWithData.length > 0
    ? Math.round(totalWithData.reduce((s, r) => s + (r.percentage ?? 0), 0) / totalWithData.length)
    : null;
  const metTarget = result.filter(r => r.percentage !== null && r.percentage >= r.targetPercentage).length;

  res.json({
    indicators: result,
    byType,
    summary: {
      total: result.length,
      withData: totalWithData.length,
      avgPercentage,
      metTarget,
      notMet: totalWithData.length - metTarget,
    },
  });
});

// ─── Schedule Compliance Report ─────────────────────────────────────────────
router.get("/schedule-compliance", async (req, res) => {
  const toDate = req.query.to ? new Date(String(req.query.to) + "T23:59:59") : new Date();

  // Helper: count weekday occurrences between two dates (inclusive)
  function countWeekday(from: Date, to: Date, dow: number): number {
    const diffDays = Math.max(0, Math.round((to.getTime() - from.getTime()) / 86400000));
    const firstOcc = (dow - from.getDay() + 7) % 7;
    if (firstOcc > diffDays) return 0;
    return Math.floor((diffDays - firstOcc) / 7) + 1;
  }

  // Helper: count how many times dayOfMonth occurred from start to end
  function countMonthDay(from: Date, to: Date, dom: number): number {
    let cnt = 0;
    const d = new Date(from.getFullYear(), from.getMonth(), dom);
    if (d < from) d.setMonth(d.getMonth() + 1);
    while (d <= to) { cnt++; d.setMonth(d.getMonth() + 1); }
    return cnt;
  }

  function calcExpected(freq: string, createdAt: Date, dayOfWeek: number | null, dayOfMonth: number | null, customDays: string | null): number {
    const from = new Date(createdAt);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    if (to < from) return 0;
    const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000);
    switch (freq) {
      case "daily": return diffDays + 1;
      case "weekly":
        return dayOfWeek != null ? countWeekday(from, to, dayOfWeek) : Math.floor(diffDays / 7) + 1;
      case "biweekly": return Math.floor(diffDays / 14) + 1;
      case "monthly":
        return dayOfMonth != null ? countMonthDay(from, to, dayOfMonth) : Math.floor(diffDays / 30) + 1;
      case "custom": {
        if (!customDays) return 0;
        const days = customDays.split(",").map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d >= 0 && d <= 6);
        return days.reduce((sum, dow) => sum + countWeekday(from, to, dow), 0);
      }
      default: return 0;
    }
  }

  const FREQ_LABELS: Record<string, string> = {
    daily: "Harian", weekly: "Mingguan", biweekly: "2 Mingguan", monthly: "Bulanan", custom: "Custom",
  };

  // Load all schedules (company-filtered)
  const cid = req.user!.companyId;
  const schedules = cid
    ? await db.select().from(schedulesTable).where(eq(schedulesTable.companyId, cid))
    : await db.select().from(schedulesTable);

  // Load templates, plants
  const [templates, plants] = await Promise.all([
    db.select().from(templatesTable),
    db.select().from(plantsTable),
  ]);
  const tmplMap = Object.fromEntries(templates.map(t => [t.id, t.name]));
  const plantMap = Object.fromEntries(plants.map(p => [p.id, p.name]));

  // Load all inspections grouped by scheduleId (include supervisorId for unique reporter count)
  const allInspections = await db.select({
    scheduleId: inspectionsTable.scheduleId,
    inspectedAt: inspectionsTable.inspectedAt,
    supervisorId: inspectionsTable.supervisorId,
  }).from(inspectionsTable);

  // Build per-schedule maps filtered to toDate
  const inspBySchedule: Record<number, string[]> = {};
  const reportersBySchedule: Record<number, Set<number>> = {};
  for (const insp of allInspections) {
    if (new Date(insp.inspectedAt) > toDate) continue;
    if (!inspBySchedule[insp.scheduleId]) inspBySchedule[insp.scheduleId] = [];
    inspBySchedule[insp.scheduleId].push(insp.inspectedAt);
    if (!reportersBySchedule[insp.scheduleId]) reportersBySchedule[insp.scheduleId] = new Set();
    if (insp.supervisorId) reportersBySchedule[insp.scheduleId].add(insp.supervisorId);
  }

  // Load schedule users and groups
  const allSchedUsers = await db.select({
    scheduleId: scheduleUsersTable.scheduleId,
    userId: scheduleUsersTable.userId,
    userName: usersTable.name,
    userNik: usersTable.nik,
  }).from(scheduleUsersTable).innerJoin(usersTable, eq(scheduleUsersTable.userId, usersTable.id));

  const allSchedGroups = await db.select({
    scheduleId: scheduleGroupsTable.scheduleId,
    groupName: groupsTable.name,
  }).from(scheduleGroupsTable).innerJoin(groupsTable, eq(scheduleGroupsTable.groupId, groupsTable.id));

  // Also load legacy supervisor column
  const supervisors = await db.select({ id: usersTable.id, name: usersTable.name, nik: usersTable.nik }).from(usersTable);
  const supervisorMap = Object.fromEntries(supervisors.map(u => [u.id, u]));

  const schedUserMap: Record<number, { type: "user"; name: string; nik?: string }[]> = {};
  for (const su of allSchedUsers) {
    if (!schedUserMap[su.scheduleId]) schedUserMap[su.scheduleId] = [];
    schedUserMap[su.scheduleId].push({ type: "user", name: su.userName, nik: su.userNik ?? undefined });
  }

  const schedGroupMap: Record<number, { type: "group"; name: string }[]> = {};
  for (const sg of allSchedGroups) {
    if (!schedGroupMap[sg.scheduleId]) schedGroupMap[sg.scheduleId] = [];
    schedGroupMap[sg.scheduleId].push({ type: "group", name: sg.groupName });
  }

  const rows = schedules.map(s => {
    const inspDates = inspBySchedule[s.id] ?? [];
    const actualCount = inspDates.length;
    const lastInspectedAt = inspDates.length > 0 ? inspDates.slice().sort().at(-1)! : null;

    // Unique reporters (distinct supervisorId within the period) — already filtered in map above
    const uniqueReporterCount = (reportersBySchedule[s.id] ?? new Set()).size;

    const expected = calcExpected(s.frequency, s.createdAt, s.dayOfWeek, s.dayOfMonth, s.customDays);

    // Assigned to: combine groups + users + legacy supervisorId
    const assigned: { type: "user" | "group"; name: string; nik?: string }[] = [
      ...(schedGroupMap[s.id] ?? []),
      ...(schedUserMap[s.id] ?? []),
    ];
    if (s.supervisorId && !schedUserMap[s.id]?.length && !schedGroupMap[s.id]?.length) {
      const sup = supervisorMap[s.supervisorId];
      if (sup) assigned.push({ type: "user", name: sup.name, nik: sup.nik ?? undefined });
    }

    // Count assigned individual users (not groups); used to compute % pelapor
    const assignedUserCount = (schedUserMap[s.id] ?? []).length
      + (s.supervisorId && !schedUserMap[s.id]?.length && !schedGroupMap[s.id]?.length ? 1 : 0);

    const complianceRate = expected === 0 ? 100 : Math.min(100, (actualCount / expected) * 100);

    // % Pelapor: if we have assigned users, use uniqueReporterCount/assignedUserCount
    // Otherwise (only groups or no assignment), fall back to whether anyone submitted at all
    const reporterRate = assignedUserCount > 0
      ? Math.min(100, (uniqueReporterCount / assignedUserCount) * 100)
      : actualCount > 0 ? 100 : 0;

    const status: "compliant" | "partial" | "none" =
      actualCount >= expected ? "compliant" : actualCount > 0 ? "partial" : "none";

    return {
      scheduleId: s.id,
      title: s.title ?? tmplMap[s.templateId] ?? `Jadwal #${s.id}`,
      frequency: s.frequency,
      frequencyLabel: FREQ_LABELS[s.frequency] ?? s.frequency,
      plantName: plantMap[s.plantId] ?? "—",
      templateName: tmplMap[s.templateId] ?? "—",
      createdAt: s.createdAt.toISOString(),
      isActive: s.isActive === 1,
      assignedTo: assigned,
      expectedCount: expected,
      actualCount,
      complianceRate,
      reporterRate,
      uniqueReporterCount,
      assignedUserCount,
      lastInspectedAt,
      status,
    };
  });

  rows.sort((a, b) => a.complianceRate - b.complianceRate);

  const compliant = rows.filter(r => r.status === "compliant").length;
  const partial = rows.filter(r => r.status === "partial").length;
  const none = rows.filter(r => r.status === "none").length;
  const avgRate = rows.length > 0 ? rows.reduce((s, r) => s + r.complianceRate, 0) / rows.length : 0;

  res.json({ rows, summary: { total: rows.length, compliant, partial, none, avgRate } });
});

export default router;
