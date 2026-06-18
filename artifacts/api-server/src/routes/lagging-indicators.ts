import { Router } from "express";
import { db, laggingIndicatorsTable, nonLtiSettingsTable, safeHoursResetHistoryTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import type { NonLtiSettings } from "@workspace/db";

const router = Router();
router.use(authMiddleware);

// Simple formula: safeHours = (nonLtiDays × 24) + contractorHours
function calcSafeHoursAndDays(nlt: NonLtiSettings): { safeHours: number; nonLtiDays: number } {
  const now = new Date();
  const reset = new Date(nlt.resetDate);
  const diffMs = now.getTime() - reset.getTime();
  const elapsedHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  const totalHoursForDays = nlt.baseValue + elapsedHours;
  const nonLtiDays = Math.floor(totalHoursForDays / 24);
  const contractorHrs = nlt.contractorHours ?? 0;
  const safeHours = (nonLtiDays * 24) + contractorHrs;
  return { safeHours, nonLtiDays };
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

  const { safeHours, nonLtiDays } = nlt ? calcSafeHoursAndDays(nlt) : { safeHours: 0, nonLtiDays: 0 };

  res.json({
    year,
    fatality:   indicator?.fatality   ?? 0,
    lti:        indicator?.lti        ?? 0,
    mti:        indicator?.mti        ?? 0,
    firstAid:   indicator?.firstAid   ?? 0,
    nearMisses: indicator?.nearMisses ?? 0,
    hazardId:   indicator?.hazardId   ?? 0,
    nonLtiDays,
    safeHours,
    resetDate:  nlt?.resetDate  ?? null,
    baseValue:  nlt?.baseValue  ?? 0,
    walkTalkTemplateId: nlt?.walkTalkTemplateId ?? null,
    hazardTemplateId:   nlt?.hazardTemplateId   ?? null,
    contractorHours:        nlt?.contractorHours        ?? 0,
    monthlyHazardAllowance: nlt?.monthlyHazardAllowance ?? 0,
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
  const { fatality, lti, mti, firstAid, nearMisses, hazardId, contractorHours } = req.body;

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

  // Also save contractorHours to nonLtiSettings
  if (contractorHours !== undefined) {
    const contractorHrsVal = parseInt(contractorHours) || 0;
    const [nlt] = await db.select().from(nonLtiSettingsTable).where(eq(nonLtiSettingsTable.companyId, cid));
    if (nlt) {
      await db.update(nonLtiSettingsTable)
        .set({ contractorHours: contractorHrsVal, updatedAt: new Date() })
        .where(eq(nonLtiSettingsTable.id, nlt.id));
    } else {
      await db.insert(nonLtiSettingsTable).values({
        companyId: cid,
        resetDate: new Date().toISOString().slice(0, 16),
        baseValue: 0,
        contractorHours: contractorHrsVal,
      });
    }
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

// PUT /lagging-indicators/safe-hours-settings — save hazard allowance only
router.put("/safe-hours-settings", async (req, res) => {
  const role = req.user!.role;
  if (role !== "admin" && role !== "supervisor") {
    res.status(403).json({ error: "Hanya supervisor/admin yang dapat mengubah pengaturan ini" }); return;
  }
  const cid = req.user!.companyId;
  if (!cid) { res.status(403).json({ error: "Akses ditolak" }); return; }

  const { monthlyHazardAllowance } = req.body;

  const updates = {
    monthlyHazardAllowance: monthlyHazardAllowance != null ? parseInt(monthlyHazardAllowance) : 0,
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select()
    .from(nonLtiSettingsTable)
    .where(eq(nonLtiSettingsTable.companyId, cid));

  if (existing) {
    await db.update(nonLtiSettingsTable).set(updates).where(eq(nonLtiSettingsTable.id, existing.id));
  } else {
    await db.insert(nonLtiSettingsTable).values({
      companyId: cid,
      resetDate: new Date().toISOString().slice(0, 16),
      baseValue: 0,
      ...updates,
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
  const resetDate: string = req.body.resetDate
    ? String(req.body.resetDate)
    : new Date().toISOString().slice(0, 16);

  const [existing] = await db
    .select()
    .from(nonLtiSettingsTable)
    .where(eq(nonLtiSettingsTable.companyId, cid));

  // ── Snapshot current state into history before overwriting ──
  if (existing) {
    const { safeHours, nonLtiDays } = calcSafeHoursAndDays(existing);
    const currentYear = new Date().getFullYear();
    const [indicator] = await db
      .select()
      .from(laggingIndicatorsTable)
      .where(and(eq(laggingIndicatorsTable.companyId, cid), eq(laggingIndicatorsTable.year, currentYear)));

    await db.insert(safeHoursResetHistoryTable).values({
      companyId: cid,
      resetAt: new Date(),
      resetDate: existing.resetDate,
      baseValue: existing.baseValue,
      nonLtiDays,
      safeHours,
      fatality:   indicator?.fatality   ?? 0,
      lti:        indicator?.lti        ?? 0,
      mti:        indicator?.mti        ?? 0,
      firstAid:   indicator?.firstAid   ?? 0,
      nearMisses: indicator?.nearMisses ?? 0,
      hazardId:   indicator?.hazardId   ?? 0,
      resetByName: req.user!.name ?? null,
    });

    await db
      .update(nonLtiSettingsTable)
      .set({ resetDate, baseValue, updatedAt: new Date() })
      .where(eq(nonLtiSettingsTable.id, existing.id));
  } else {
    await db.insert(nonLtiSettingsTable).values({ companyId: cid, resetDate, baseValue });
  }

  res.json({ ok: true });
});

// GET /lagging-indicators/reset-history?limit=20&offset=0
router.get("/reset-history", async (req, res) => {
  const cid = req.user!.companyId;
  if (!cid) { res.status(403).json({ error: "Akses ditolak" }); return; }

  const limit  = Math.min(Math.max(parseInt(req.query.limit  as string) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  const rows = await db
    .select()
    .from(safeHoursResetHistoryTable)
    .where(eq(safeHoursResetHistoryTable.companyId, cid))
    .orderBy(desc(safeHoursResetHistoryTable.resetAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(safeHoursResetHistoryTable)
    .where(eq(safeHoursResetHistoryTable.companyId, cid));

  res.json({ total: Number(total), rows });
});

export default router;
