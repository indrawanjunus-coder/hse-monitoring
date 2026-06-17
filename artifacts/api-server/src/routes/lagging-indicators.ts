import { Router } from "express";
import { db, laggingIndicatorsTable, nonLtiSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

// Calculate safe hours from the exact reset datetime (with sub-day precision)
// baseValue = base hours to add on top of elapsed hours
function calcSafeHours(resetDatetime: string, baseHours: number): number {
  const now = new Date();
  const reset = new Date(resetDatetime);
  const diffMs = now.getTime() - reset.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  return baseHours + Math.max(0, diffHours);
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

  const safeHours = nlt ? calcSafeHours(nlt.resetDate, nlt.baseValue) : 0;
  const nonLtiDays = Math.floor(safeHours / 24);

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
    walkTalkTemplateId: nlt?.walkTalkTemplateId ?? null,
    hazardTemplateId: nlt?.hazardTemplateId ?? null,
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

router.put("/dashboard-templates", async (req, res) => {
  const role = req.user!.role;
  if (role !== "admin" && role !== "supervisor") {
    res.status(403).json({ error: "Hanya supervisor/admin yang dapat mengubah pengaturan ini" }); return;
  }
  const cid = req.user!.companyId;
  if (!cid) { res.status(403).json({ error: "Akses ditolak" }); return; }

  const walkTalkTemplateId = req.body.walkTalkTemplateId != null ? parseInt(req.body.walkTalkTemplateId) || null : null;
  const hazardTemplateId   = req.body.hazardTemplateId   != null ? parseInt(req.body.hazardTemplateId)   || null : null;

  const [existing] = await db
    .select()
    .from(nonLtiSettingsTable)
    .where(eq(nonLtiSettingsTable.companyId, cid));

  if (existing) {
    await db
      .update(nonLtiSettingsTable)
      .set({ walkTalkTemplateId, hazardTemplateId, updatedAt: new Date() })
      .where(eq(nonLtiSettingsTable.id, existing.id));
  } else {
    // Create row with placeholder resetDate if none exists
    await db.insert(nonLtiSettingsTable).values({
      companyId: cid,
      resetDate: new Date().toISOString().slice(0, 16),
      baseValue: 0,
      walkTalkTemplateId,
      hazardTemplateId,
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

  const baseValue = req.body.baseValue !== undefined ? parseInt(req.body.baseValue) : 0;
  // Preserve full datetime (including time component) for hour-precision calculation
  const resetDate: string = req.body.resetDate
    ? String(req.body.resetDate)
    : new Date().toISOString().slice(0, 16);

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
