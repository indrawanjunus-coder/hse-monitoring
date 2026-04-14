import { Router } from "express";
import { db } from "@workspace/db";
import { incidentTypesTable, categoriesTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

function requireAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

function getPgCode(err: any): string | undefined {
  return err?.code ?? err?.cause?.code ?? err?.cause?.cause?.code;
}

function getErrMsg(err: any): string {
  return err?.cause?.message ?? err?.cause?.detail ?? err?.message ?? "Terjadi kesalahan";
}

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
    const cid = req.user!.companyId;

    let query = db
      .select({
        id: incidentTypesTable.id,
        code: incidentTypesTable.code,
        label: incidentTypesTable.label,
        description: incidentTypesTable.description,
        categoryId: incidentTypesTable.categoryId,
        categoryName: categoriesTable.name,
        isActive: incidentTypesTable.isActive,
        orderIndex: incidentTypesTable.orderIndex,
        createdAt: incidentTypesTable.createdAt,
      })
      .from(incidentTypesTable)
      .leftJoin(categoriesTable, eq(incidentTypesTable.categoryId, categoriesTable.id))
      .orderBy(asc(incidentTypesTable.orderIndex), asc(incidentTypesTable.id));

    const rows = cid
      ? await query.where(eq(incidentTypesTable.companyId, cid))
      : await query;

    const filtered = categoryId ? rows.filter(r => r.categoryId === categoryId) : rows;
    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: getErrMsg(err) });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  const { code, label, description, categoryId, isActive, orderIndex } = req.body;
  if (!code?.trim() || !label?.trim()) {
    res.status(400).json({ error: "Kode dan label wajib diisi" }); return;
  }

  const sanitizedCode = code.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "_");
  if (!sanitizedCode) { res.status(400).json({ error: "Kode tidak valid setelah sanitasi" }); return; }

  const companyId = req.user!.companyId;

  try {
    const whereCode = companyId
      ? and(eq(incidentTypesTable.code, sanitizedCode), eq(incidentTypesTable.companyId, companyId))
      : eq(incidentTypesTable.code, sanitizedCode);

    const existing = await db.select({ id: incidentTypesTable.id, code: incidentTypesTable.code, label: incidentTypesTable.label })
      .from(incidentTypesTable)
      .where(whereCode);
    if (existing.length) {
      const ex = existing[0];
      res.status(409).json({
        error: `Code "${sanitizedCode}" sudah digunakan oleh "${ex!.label}" (ID: ${ex!.id}). Hapus ID #${ex!.id} terlebih dahulu atau gunakan kode lain.`,
        existingId: ex!.id,
        existingLabel: ex!.label,
      }); return;
    }

    const catId = categoryId != null && categoryId !== "" && categoryId !== "none"
      ? parseInt(String(categoryId)) : null;
    const isActiveBool = isActive === true || isActive === "true" || isActive === 1;

    const [created] = await db.insert(incidentTypesTable).values({
      code: sanitizedCode,
      label: label.trim(),
      description: description?.trim() || null,
      categoryId: catId && !isNaN(catId) ? catId : null,
      isActive: isActiveBool,
      orderIndex: parseInt(String(orderIndex ?? 0)) || 0,
      companyId,
    }).returning();

    res.status(201).json(created);
  } catch (err: any) {
    const pgCode = getPgCode(err);
    if (pgCode === "23505") {
      res.status(409).json({ error: `Code "${sanitizedCode}" sudah digunakan, gunakan kode lain` }); return;
    }
    res.status(500).json({ error: getErrMsg(err) });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }
  const { label, description, categoryId, isActive, orderIndex } = req.body;
  const cid = req.user!.companyId;

  try {
    const catId = categoryId != null && categoryId !== "" && categoryId !== "none"
      ? parseInt(String(categoryId)) : null;
    const isActiveBool = isActive === true || isActive === "true" || isActive === 1;

    const whereClause = cid ? and(eq(incidentTypesTable.id, id), eq(incidentTypesTable.companyId, cid)) : eq(incidentTypesTable.id, id);
    const [updated] = await db.update(incidentTypesTable)
      .set({
        label: label?.trim(),
        description: description?.trim() || null,
        categoryId: catId && !isNaN(catId) ? catId : null,
        isActive: isActiveBool,
        orderIndex: parseInt(String(orderIndex ?? 0)) || 0,
      })
      .where(whereClause).returning();

    if (!updated) { res.status(404).json({ error: "Tipe incident tidak ditemukan" }); return; }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: getErrMsg(err) });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }
  const cid = req.user!.companyId;
  try {
    const whereClause = cid ? and(eq(incidentTypesTable.id, id), eq(incidentTypesTable.companyId, cid)) : eq(incidentTypesTable.id, id);
    await db.delete(incidentTypesTable).where(whereClause);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: getErrMsg(err) });
  }
});

export default router;
