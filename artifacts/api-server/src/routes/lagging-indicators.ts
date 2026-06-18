import { Router } from "express";
import { db, laggingIndicatorsTable, nonLtiSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import type { NonLtiSettings } from "@workspace/db";

const router = Router();
router.use(authMiddleware);

// Calculate safe hours using new formula:
// (jamKerja × numShifts × (numEmployees + numOutsource)) + contractorHours
// Where jamKerja = workHoursManual if set, else nonLtiDays × 24
function calcSafeHoursAndDays(nlt: NonLtiSettings): { safeHours: number; nonLtiDays: number } {
  const now = new Date();
  const reset = new Date(nlt.resetDate);
  const diffMs = now.getTime() - reset.getTime();
  const elapsedHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

  // nonLtiDays from baseValue + elapsed hours since reset
  const totalHoursForDays = nlt.baseValue + elapsedHours;
  const nonLtiDays = Math.floor(totalHoursForDays / 24);

  const numEmployees  = nlt.numEmployees  ?? 0;
  const numOutsource  = nlt.numOutsource  ?? 0;
  const numShifts     = Math.max(1, nlt.numShifts ?? 1);
  const contractorHrs = nlt.contractorHours ?? 0;
  const people        = numEmployees + numOutsource;

  // If parameters not configured yet, fall back to simple elapsed-hours mode
  if (people === 0 && contractorHrs === 0) {
    return { safeHours: totalHoursForDays, nonLtiDays };
  }

  // jam kerja: manual override or auto from nonLtiDays × 24
  const jamKerja = (nlt.workHoursManual ?? 0) > 0
    ? (nlt.workHoursManual ?? 0)
    : nonLtiDays * 24;

  const safeHours = (jamKerja * numShifts * people) + contractorHrs;
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
    // Safe-hours parameters
    workHoursManual:        nlt?.workHoursManual        ?? 0,
    numShifts:              nlt?.numShifts              ?? 1,
    numEmployees:           nlt?.numEmployees           ?? 0,
    numOutsource:           nlt?.numOutsource           ?? 0,
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

// PUT /lagging-indicators/safe-hours-settings — save safe hours parameters + hazard allowance
router.put("/safe-hours-settings", async (req, res) => {
  const role = req.user!.role;
  if (role !== "admin" && role !== "supervisor") {
    res.status(403).json({ error: "Hanya supervisor/admin yang dapat mengubah pengaturan ini" }); return;
  }
  const cid = req.user!.companyId;
  if (!cid) { res.status(403).json({ error: "Akses ditolak" }); return; }

  const {
    workHoursManual, numShifts, numEmployees, numOutsource,
    contractorHours, monthlyHazardAllowance,
  } = req.body;

  const updates = {
    workHoursManual:        workHoursManual        != null ? parseInt(workHoursManual)        : 0,
    numShifts:              numShifts              != null ? parseInt(numShifts)              : 1,
    numEmployees:           numEmployees           != null ? parseInt(numEmployees)           : 0,
    numOutsource:           numOutsource           != null ? parseInt(numOutsource)           : 0,
    contractorHours:        contractorHours        != null ? parseInt(contractorHours)        : 0,
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
