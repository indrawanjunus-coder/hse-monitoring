import { Router } from "express";
import { db, incidentsTable, categoriesTable, actionsTable, plantsTable,
  schedulesTable, scheduleGroupsTable, scheduleUsersTable,
  groupMembersTable, groupsTable, usersTable, inspectionsTable, templatesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

router.get("/summary", async (req, res) => {
  const now = new Date();
  const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
  const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();

  const allIncidents = await db.select().from(incidentsTable);
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const monthIncidents = allIncidents.filter(i => i.incidentDate.startsWith(prefix));
  const categories = await db.select().from(categoriesTable);
  const actions = await db.select().from(actionsTable);

  const openIncidents = monthIncidents.filter(i => i.status === "open" || i.status === "in_progress").length;
  const closedIncidents = monthIncidents.filter(i => i.status === "closed").length;

  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyIncidents: Record<string, number> = {};
  const dailyOpen: Record<string, number> = {};
  const dailyClosed: Record<string, number> = {};
  const dailyActions: Record<string, Record<string, number>> = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    dailyIncidents[dateStr] = 0;
    dailyOpen[dateStr] = 0;
    dailyClosed[dateStr] = 0;
    dailyActions[dateStr] = {};
  }

  for (const i of monthIncidents) {
    const d = i.incidentDate;
    if (dailyIncidents[d] !== undefined) {
      dailyIncidents[d]++;
      if (i.status === "closed") dailyClosed[d]++;
      else dailyOpen[d]++;

      if (i.actionId) {
        const act = actions.find(a => a.id === i.actionId);
        if (act) {
          if (!dailyActions[d]) dailyActions[d] = {};
          dailyActions[d]![act.name] = (dailyActions[d]![act.name] ?? 0) + 1;
        }
      }
    }
  }

  const riskMatrix = categories.map(cat => {
    const catIncidents = monthIncidents.filter(i => i.categoryId === cat.id);
    return {
      categoryId: cat.id, categoryName: cat.name,
      riskLevel: cat.riskLevel,
      fatal: cat.riskLevel === "fatal" ? catIncidents.length : 0,
      major: cat.riskLevel === "major" ? catIncidents.length : 0,
      moderate: cat.riskLevel === "moderate" ? catIncidents.length : 0,
      minor: cat.riskLevel === "minor" ? catIncidents.length : 0,
      total: catIncidents.length,
    };
  }).filter(r => r.total > 0);

  const categoryTrendMap: Record<string, Record<string, { categoryId: number; categoryName: string; count: number }>> = {};
  for (const i of monthIncidents) {
    const cat = categories.find(c => c.id === i.categoryId);
    if (!cat) continue;
    const d = i.incidentDate;
    if (!categoryTrendMap[d]) categoryTrendMap[d] = {};
    if (!categoryTrendMap[d]![cat.name]) {
      categoryTrendMap[d]![cat.name] = { categoryId: cat.id, categoryName: cat.name, count: 0 };
    }
    categoryTrendMap[d]![cat.name]!.count++;
  }
  const categoryTrend = Object.entries(categoryTrendMap).flatMap(([date, cats]) =>
    Object.values(cats).map(c => ({ date, ...c }))
  );

  const actionsPerDay = Object.entries(dailyActions).map(([date, actionMap]) => ({
    date,
    day: date.split("-")[2],
    ...actionMap,
    total: Object.values(actionMap).reduce((s, v) => s + v, 0),
  }));

  const actionNames = [...new Set(monthIncidents
    .filter(i => i.actionId)
    .map(i => actions.find(a => a.id === i.actionId)?.name)
    .filter(Boolean) as string[])];

  res.json({
    month, year,
    totalIncidents: monthIncidents.length, openIncidents, closedIncidents,
    dailyIncidents: Object.entries(dailyIncidents).map(([date, count]) => ({ date, count })),
    dailyStatus: Object.entries(dailyOpen).map(([date, open]) => ({ date, open, closed: dailyClosed[date] ?? 0 })),
    riskMatrix,
    categoryTrend,
    actionsPerDay,
    actionNames,
  });
});

// Identifikasi Bahaya per Area
router.get("/hazard-by-area", async (req, res) => {
  const now = new Date();
  const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
  const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();

  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const allIncidents = await db.select().from(incidentsTable);
  const plants = await db.select().from(plantsTable);
  const monthIncidents = allIncidents.filter(i => i.incidentDate.startsWith(prefix));

  const areaMap: Record<string, number> = {};
  for (const inc of monthIncidents) {
    const plant = plants.find(p => p.id === inc.plantId);
    const areaName = plant?.name ?? "Tidak Diketahui";
    areaMap[areaName] = (areaMap[areaName] ?? 0) + 1;
  }

  const total = Object.values(areaMap).reduce((s, v) => s + v, 0);
  const result = Object.entries(areaMap)
    .map(([area, count]) => ({
      area,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  res.json({ month, year, total, areas: result });
});

// Template Compliance per Departemen
router.get("/template-compliance", async (req, res) => {
  const now = new Date();
  const templateId = req.query.templateId ? parseInt(req.query.templateId as string) : null;
  const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
  const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();

  if (!templateId) {
    res.json({ departments: [] });
    return;
  }

  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const daysInMonth = new Date(year, month, 0).getDate();

  function freqMultiplier(freq: string): number {
    switch (freq) {
      case "daily": return daysInMonth;
      case "weekly": return 4;
      case "biweekly": return 2;
      case "monthly": return 1;
      default: return 1;
    }
  }

  // Get all schedules for this template
  const schedules = await db.select().from(schedulesTable).where(eq(schedulesTable.templateId, templateId));
  if (schedules.length === 0) {
    res.json({ departments: [] });
    return;
  }

  const scheduleIds = schedules.map(s => s.id);

  // Get all inspections for this month for those schedules
  const allInspections = await db.select().from(inspectionsTable)
    .where(inArray(inspectionsTable.scheduleId, scheduleIds));
  const monthInspections = allInspections.filter(i => i.inspectedAt.startsWith(prefix));

  // Get groups linked to schedules
  const schedGroups = await db.select().from(scheduleGroupsTable)
    .where(inArray(scheduleGroupsTable.scheduleId, scheduleIds));

  // Get direct users linked to schedules
  const schedUsers = await db.select().from(scheduleUsersTable)
    .where(inArray(scheduleUsersTable.scheduleId, scheduleIds));

  // Get all unique group IDs
  const groupIds = [...new Set([
    ...schedGroups.map(sg => sg.groupId),
    ...schedules.filter(s => s.groupId).map(s => s.groupId!),
  ])];

  const groups = groupIds.length > 0
    ? await db.select().from(groupsTable).where(inArray(groupsTable.id, groupIds))
    : [];

  // Get members for each group
  const allMembers = groupIds.length > 0
    ? await db.select().from(groupMembersTable).where(inArray(groupMembersTable.groupId, groupIds))
    : [];

  // Get all unique user IDs from scheduleUsers
  const directUserIds = [...new Set(schedUsers.map(u => u.userId))];
  const directUsers = directUserIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
        .where(inArray(usersTable.id, directUserIds))
    : [];

  // Build department map: groupId → { name, scheduleId, frequency, userIds }
  type DeptKey = string;
  const deptMap: Record<DeptKey, {
    name: string;
    frequency: string;
    targetUserIds: Set<number>;
    reporterUserIds: Set<number>;
    reportCount: number;
    targetReports: number;
  }> = {};

  // Per schedule, per group: compute target
  for (const sched of schedules) {
    const freq = sched.frequency;
    const mult = freqMultiplier(freq);

    // Groups via scheduleGroupsTable
    const linkedGroupIds = schedGroups
      .filter(sg => sg.scheduleId === sched.id)
      .map(sg => sg.groupId);

    // Also the legacy groupId field
    if (sched.groupId && !linkedGroupIds.includes(sched.groupId)) {
      linkedGroupIds.push(sched.groupId);
    }

    for (const gId of linkedGroupIds) {
      const group = groups.find(g => g.id === gId);
      const deptKey = `group_${gId}`;
      if (!deptMap[deptKey]) {
        deptMap[deptKey] = {
          name: group?.name ?? `Departemen #${gId}`,
          frequency: freq,
          targetUserIds: new Set(),
          reporterUserIds: new Set(),
          reportCount: 0,
          targetReports: 0,
        };
      }
      const members = allMembers.filter(m => m.groupId === gId);
      members.forEach(m => deptMap[deptKey]!.targetUserIds.add(m.userId));
      deptMap[deptKey]!.targetReports += members.length * mult;
    }

    // Direct users (grouped under "Pengguna Individual")
    const directForSched = schedUsers.filter(su => su.scheduleId === sched.id).map(su => su.userId);
    if (directForSched.length > 0) {
      const deptKey = "direct_users";
      if (!deptMap[deptKey]) {
        deptMap[deptKey] = {
          name: "Pengguna Individual",
          frequency: freq,
          targetUserIds: new Set(),
          reporterUserIds: new Set(),
          reportCount: 0,
          targetReports: 0,
        };
      }
      directForSched.forEach(uid => deptMap[deptKey]!.targetUserIds.add(uid));
      deptMap[deptKey]!.targetReports += directForSched.length * mult;
    }
  }

  // Now match inspections to departments
  for (const insp of monthInspections) {
    const sched = schedules.find(s => s.id === insp.scheduleId);
    if (!sched) continue;

    // Find which department(s) this inspection belongs to
    const linkedGroupIds = schedGroups
      .filter(sg => sg.scheduleId === sched.id)
      .map(sg => sg.groupId);
    if (sched.groupId && !linkedGroupIds.includes(sched.groupId)) {
      linkedGroupIds.push(sched.groupId);
    }

    // Check if reporter is in one of the groups
    let assigned = false;
    for (const gId of linkedGroupIds) {
      const isMember = allMembers.some(m => m.groupId === gId && m.userId === insp.supervisorId);
      if (isMember) {
        const deptKey = `group_${gId}`;
        if (deptMap[deptKey]) {
          deptMap[deptKey]!.reporterUserIds.add(insp.supervisorId);
          deptMap[deptKey]!.reportCount++;
          assigned = true;
        }
      }
    }

    // Check if direct user
    if (!assigned) {
      const isDirect = directUserIds.includes(insp.supervisorId);
      if (isDirect && deptMap["direct_users"]) {
        deptMap["direct_users"]!.reporterUserIds.add(insp.supervisorId);
        deptMap["direct_users"]!.reportCount++;
      }
    }
  }

  const departments = Object.values(deptMap).map(d => ({
    name: d.name,
    frequency: d.frequency,
    targetReporterCount: d.targetUserIds.size,
    reporterCount: d.reporterUserIds.size,
    pctReporter: d.targetUserIds.size > 0
      ? Math.round((d.reporterUserIds.size / d.targetUserIds.size) * 100)
      : 0,
    reportCount: d.reportCount,
    targetReports: d.targetReports,
    pctReport: d.targetReports > 0
      ? Math.round((d.reportCount / d.targetReports) * 100)
      : 0,
  }));

  res.json({ month, year, templateId, departments });
});

// List templates (for dropdown in compliance dashboard)
router.get("/templates", async (_req, res) => {
  const templates = await db.select({ id: templatesTable.id, name: templatesTable.name })
    .from(templatesTable);
  res.json(templates);
});

export default router;
