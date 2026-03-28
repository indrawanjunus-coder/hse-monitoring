import { Router } from "express";
import { db, incidentsTable, categoriesTable, actionsTable, plantsTable } from "@workspace/db";
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

export default router;
