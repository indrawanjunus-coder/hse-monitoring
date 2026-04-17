import { Router } from "express";
import { db, templatesTable, questionsTable, categoriesTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { checkTemplateLimit } from "../lib/plan-limits";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const cid = req.user!.companyId;
  const whereClause = cid ? eq(templatesTable.companyId, cid) : undefined;
  const templates = whereClause
    ? await db.select().from(templatesTable).where(whereClause)
    : await db.select().from(templatesTable);

  const result = await Promise.all(templates.map(async (t) => {
    const [cnt] = await db.select({ count: count() }).from(questionsTable).where(eq(questionsTable.templateId, t.id));
    return { ...t, questionCount: cnt?.count ?? 0, createdAt: t.createdAt.toISOString() };
  }));
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const templates = await db.select().from(templatesTable).where(eq(templatesTable.id, id));
  if (!templates[0]) { res.status(404).json({ message: "Not found" }); return; }
  const t = templates[0];
  const questions = await db.select({ q: questionsTable, c: categoriesTable })
    .from(questionsTable)
    .leftJoin(categoriesTable, eq(questionsTable.categoryId, categoriesTable.id))
    .where(eq(questionsTable.templateId, id));
  res.json({
    ...t,
    questions: questions.map(({ q, c }) => ({
      ...q, categoryName: c?.name, createdAt: q.createdAt.toISOString()
    })),
    createdAt: t.createdAt.toISOString(),
  });
});

router.post("/", async (req, res) => {
  const { name, description } = req.body;
  const companyId = req.user!.companyId ?? undefined;

  // Check plan template limit
  if (companyId) {
    const limitCheck = await checkTemplateLimit(companyId);
    if (!limitCheck.allowed) {
      res.status(403).json({
        error: `Batas maksimal template paket ini telah tercapai (${limitCheck.current}/${limitCheck.max}). Upgrade paket untuk membuat lebih banyak template.`,
        code: "TEMPLATE_LIMIT_REACHED",
        current: limitCheck.current,
        max: limitCheck.max,
      });
      return;
    }
  }

  const [t] = await db.insert(templatesTable).values({ name, description, companyId, isActive: true }).returning();
  if (!t) { res.status(500).json({ message: "Failed" }); return; }
  res.status(201).json({ ...t, questionCount: 0, createdAt: t.createdAt.toISOString() });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description } = req.body;
  const [t] = await db.update(templatesTable).set({ name, description }).where(eq(templatesTable.id, id)).returning();
  if (!t) { res.status(404).json({ message: "Not found" }); return; }
  const [cnt] = await db.select({ count: count() }).from(questionsTable).where(eq(questionsTable.templateId, id));
  res.json({ ...t, questionCount: cnt?.count ?? 0, createdAt: t.createdAt.toISOString() });
});

// Toggle template active/inactive
router.post("/:id/toggle-active", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }
  const authUser = req.user!;
  if (authUser.role !== "admin" && authUser.role !== "supervisor") {
    res.status(403).json({ error: "Tidak memiliki akses" }); return;
  }

  const [t] = await db.select().from(templatesTable).where(eq(templatesTable.id, id));
  if (!t) { res.status(404).json({ error: "Template tidak ditemukan" }); return; }

  // If activating, check limit first
  if (!t.isActive && t.companyId) {
    const limitCheck = await checkTemplateLimit(t.companyId);
    if (!limitCheck.allowed) {
      res.status(403).json({
        error: `Batas maksimal template paket ini telah tercapai (${limitCheck.current}/${limitCheck.max}). Nonaktifkan template lain atau upgrade paket.`,
        code: "TEMPLATE_LIMIT_REACHED",
        current: limitCheck.current,
        max: limitCheck.max,
      });
      return;
    }
  }

  const [updated] = await db.update(templatesTable).set({ isActive: !t.isActive }).where(eq(templatesTable.id, id)).returning();
  res.json({ id: updated!.id, isActive: updated!.isActive });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const authUser = req.user!;
  // [SECURITY H16] Only admin/sysadmin can delete templates; scope DELETE to company
  if (authUser.role !== "admin" && authUser.role !== "sysadmin") {
    res.status(403).json({ error: "Hanya admin yang dapat menghapus template" }); return;
  }
  const whereClause = authUser.role === "sysadmin"
    ? eq(templatesTable.id, id)
    : and(eq(templatesTable.id, id), eq(templatesTable.companyId, authUser.companyId!));
  const [deleted] = await db.delete(templatesTable).where(whereClause).returning({ id: templatesTable.id });
  if (!deleted) { res.status(404).json({ error: "Template tidak ditemukan" }); return; }
  res.status(204).end();
});

export default router;
