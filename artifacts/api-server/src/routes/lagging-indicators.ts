import { Router } from "express";
import { db, laggingIndicatorsTable, nonLtiSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

function calcNonLtiDays(resetDate: number, baseValue: number): number {
  const now = new Date();
  const reset = new Date(resetDate);
  const diffMs = now.getTime() - reset.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return baseValue + diffDays;
}

router.get("/", async (req, res) => {
  const cid = req.user!.companyId;
  if (!cid) { res.status(403).json({ error: "Akses ditolak" }); return; }

  const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

  const [indicator] = await db
    .select()
    .from(laggingIndicatorsTable)
    .where(and(eq(laggingIndicatorsTable.companyId, cid), eq(laggingIndicatorsTable.year, year)));

  const [nlt] = await db
    .select()
    .from(nonLtiSettingsTable)
    .where(eq(nonLtiSettingsTable.companyId, cid));

  const nonLtiDays = nlt ? calcNonLtiDays(nlt.resetDate, nlt.baseValue) : 0;
  const safeHours = nonLtiDays * 24;

  res.json({
    year,
    fatality: indicator?.fatality ?? 0,
    lti: indicator?.lti ?? 0,
    mti: indicator?.mti ?? 0,
    firstAid: indicator?.firstAid ?? 0,
    nearMisses: indicator?.nearMisses ?? 0,
    hazardId: indicator?.hazardId ?? 0,
    nonLtiDays,
    safeHours,
    resetDate: nlt?.resetDate ?? null,
    baseValue: nlt?.baseValue ?? 0,
  });
});

router.put("/", async (req, res) => {
  const role = req.user!.role;
  if (role !== "admin" && role !== "supervisor") {
    res.status(403).json({ error: "Hanya supervisor/admin yang dapat mengubah data ini" }); return;
  }
  const cid = req.user!.companyId;
  if (!cid) { res.status(403).json({ error: "Akses ditolak" }); return; }

  const year = req.body.year ?? new Date().getFullYear();
  const { fatality, lti, mti, firstAid, nearMisses, hazardId } = req.body;

  const [existing] = await db
    .select()
    .from(laggingIndicatorsTable)
    .where(and(eq(laggingIndicatorsTable.companyId, cid), eq(laggingIndicatorsTable.year, year)));

  if (existing) {
    await db
      .update(laggingIndicatorsTable)
      .set({ fatality, lti, mti, firstAid, nearMisses, hazardId, updatedAt: new Date() })
      .where(eq(laggingIndicatorsTable.id, existing.id));
  } else {
    await db.insert(laggingIndicatorsTable).values({
      companyId: cid, year, fatality, lti, mti, firstAid, nearMisses, hazardId,
    });
  }

  res.json({ ok: true });
});

router.put("/non-lti-reset", async (req, res) => {
  const role = req.user!.role;
  if (role !== "admin" && role !== "supervisor") {
    res.status(403).json({ error: "Hanya supervisor/admin yang dapat mereset counter ini" }); return;
  }
  const cid = req.user!.companyId;
  if (!cid) { res.status(403).json({ error: "Akses ditolak" }); return; }

  const now = Date.now();
  const baseValue = req.body.baseValue !== undefined ? parseInt(req.body.baseValue) : 0;
  const resetDate = req.body.resetDate ? new Date(req.body.resetDate).getTime() : now;

  const [existing] = await db
    .select()
    .from(nonLtiSettingsTable)
    .where(eq(nonLtiSettingsTable.companyId, cid));

  if (existing) {
    await db
      .update(nonLtiSettingsTable)
      .set({ resetDate, baseValue, updatedAt: new Date() })
      .where(eq(nonLtiSettingsTable.id, existing.id));
  } else {
    await db.insert(nonLtiSettingsTable).values({ companyId: cid, resetDate, baseValue });
  }

  res.json({ ok: true });
});

export default router;
