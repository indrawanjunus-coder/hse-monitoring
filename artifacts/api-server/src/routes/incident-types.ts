import { Router } from "express";
import { db } from "@workspace/db";
import { incidentTypesTable, categoriesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

function requireAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;

  const rows = await db
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

  const filtered = categoryId
    ? rows.filter(r => r.categoryId === categoryId)
    : rows;

  res.json(filtered);
});

router.post("/", requireAdmin, async (req, res) => {
  const { code, label, description, categoryId, isActive, orderIndex } = req.body;
  if (!code?.trim() || !label?.trim()) return res.status(400).json({ error: "code and label required" });
  const existing = await db.select().from(incidentTypesTable).where(eq(incidentTypesTable.code, code.trim()));
  if (existing.length) return res.status(409).json({ error: "Code already exists" });
  const [created] = await db.insert(incidentTypesTable).values({
    code: code.trim().toLowerCase().replace(/\s+/g, "_"),
    label: label.trim(),
    description: description?.trim() || null,
    categoryId: categoryId ? parseInt(categoryId) : null,
    isActive: isActive ?? true,
    orderIndex: orderIndex ?? 0,
  }).returning();
  res.status(201).json(created);
});

router.put("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { label, description, categoryId, isActive, orderIndex } = req.body;
  const [updated] = await db.update(incidentTypesTable)
    .set({
      label,
      description: description?.trim() || null,
      categoryId: categoryId ? parseInt(categoryId) : null,
      isActive,
      orderIndex,
    })
    .where(eq(incidentTypesTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(incidentTypesTable).where(eq(incidentTypesTable.id, id));
  res.json({ ok: true });
});

export default router;
