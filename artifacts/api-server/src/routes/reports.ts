import { Router } from "express";
import { db, incidentsTable, usersTable, categoriesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

// H&I Followup report — incidents bucketed by hours since creation
router.get("/followup", async (_req, res) => {
  const rawIncidents = await db.select({
    inc: incidentsTable,
    cat: categoriesTable,
  })
    .from(incidentsTable)
    .leftJoin(categoriesTable, eq(incidentsTable.categoryId, categoriesTable.id))
    .orderBy(desc(incidentsTable.createdAt));

  const now = Date.now();

  type Bucket = { label: string; key: string; count: number; incidents: object[] };
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
      detail: row.inc.detail.length > 100 ? row.inc.detail.slice(0, 100) + "…" : row.inc.detail,
      needsFurtherAction: row.inc.needsFurtherAction,
      ageHours: Math.round(ageH),
      createdAt: row.inc.createdAt.toISOString(),
    });
  }

  res.json({
    buckets: Object.values(buckets),
    total: rawIncidents.length,
    open: rawIncidents.filter(r => r.inc.status === "open").length,
  });
});

export default router;
