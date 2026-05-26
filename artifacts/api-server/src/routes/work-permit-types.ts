import { Router } from "express";
import { db, workPermitTypesTable, workPermitTypeApproversTable, usersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
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

// GET /:id/approvers — list approvers for a type
router.get("/:id/approvers", async (req, res) => {
  try {
    const typeId = Number(req.params.id);
    const cid = req.user!.companyId;
    const rows = await db
      .select({
        id: workPermitTypeApproversTable.id,
        userId: workPermitTypeApproversTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userRole: usersTable.role,
      })
      .from(workPermitTypeApproversTable)
      .innerJoin(usersTable, eq(workPermitTypeApproversTable.userId, usersTable.id))
      .where(and(
        eq(workPermitTypeApproversTable.workPermitTypeId, typeId),
        cid ? eq(workPermitTypeApproversTable.companyId, cid) : undefined,
      ))
      .orderBy(workPermitTypeApproversTable.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data approver" });
  }
});

// PUT /:id/approvers — replace full approver list (admin only)
router.put("/:id/approvers", async (req, res) => {
  if (req.user!.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  try {
    const typeId = Number(req.params.id);
    const cid = req.user!.companyId;
    const { userIds } = req.body as { userIds: number[] };
    if (!Array.isArray(userIds)) { res.status(400).json({ error: "userIds harus berupa array" }); return; }

    const [typeRow] = await db.select({ id: workPermitTypesTable.id })
      .from(workPermitTypesTable)
      .where(and(eq(workPermitTypesTable.id, typeId), cid ? eq(workPermitTypesTable.companyId, cid) : undefined));
    if (!typeRow) { res.status(404).json({ error: "Tipe tidak ditemukan" }); return; }

    await db.delete(workPermitTypeApproversTable).where(and(
      eq(workPermitTypeApproversTable.workPermitTypeId, typeId),
      cid ? eq(workPermitTypeApproversTable.companyId, cid) : undefined,
    ));

    if (userIds.length > 0) {
      const validUsers = await db.select({ id: usersTable.id }).from(usersTable)
        .where(and(inArray(usersTable.id, userIds), cid ? eq(usersTable.companyId, cid) : undefined));
      const validIds = validUsers.map(u => u.id);
      if (validIds.length > 0) {
        await db.insert(workPermitTypeApproversTable).values(
          validIds.map(uid => ({ companyId: cid, workPermitTypeId: typeId, userId: uid }))
        );
      }
    }

    const result = await db
      .select({
        id: workPermitTypeApproversTable.id,
        userId: workPermitTypeApproversTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userRole: usersTable.role,
      })
      .from(workPermitTypeApproversTable)
      .innerJoin(usersTable, eq(workPermitTypeApproversTable.userId, usersTable.id))
      .where(eq(workPermitTypeApproversTable.workPermitTypeId, typeId));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Gagal menyimpan approver" });
  }
});

export default router;
