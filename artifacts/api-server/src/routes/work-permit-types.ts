import { Router } from "express";
import { db, workPermitTypesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const cid = req.user!.companyId;
  const rows = await db.select().from(workPermitTypesTable)
    .where(cid ? eq(workPermitTypesTable.companyId, cid) : undefined)
    .orderBy(workPermitTypesTable.id);
  res.json(rows);
});

router.post("/", async (req, res) => {
  if (req.user!.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  const { type, description } = req.body;
  if (!type || !description) { res.status(400).json({ error: "type dan description wajib diisi" }); return; }
  const cid = req.user!.companyId;
  const [row] = await db.insert(workPermitTypesTable).values({ companyId: cid, type, description }).returning();
  res.json(row);
});

router.put("/:id", async (req, res) => {
  if (req.user!.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  const id = Number(req.params.id);
  const cid = req.user!.companyId;
  const { type, description } = req.body;
  const where = cid ? and(eq(workPermitTypesTable.id, id), eq(workPermitTypesTable.companyId, cid)) : eq(workPermitTypesTable.id, id);
  const [row] = await db.update(workPermitTypesTable).set({ type, description }).where(where).returning();
  if (!row) { res.status(404).json({ error: "Tidak ditemukan" }); return; }
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  if (req.user!.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  const id = Number(req.params.id);
  const cid = req.user!.companyId;
  const where = cid ? and(eq(workPermitTypesTable.id, id), eq(workPermitTypesTable.companyId, cid)) : eq(workPermitTypesTable.id, id);
  await db.delete(workPermitTypesTable).where(where);
  res.json({ success: true });
});

export default router;
