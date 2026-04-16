import { Router } from "express";
import { db, incidentCommentsTable, usersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router({ mergeParams: true });
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const incidentId = Number(req.params.incidentId);
  if (!incidentId) { res.status(400).json({ error: "incidentId diperlukan" }); return; }
  const rows = await db
    .select()
    .from(incidentCommentsTable)
    .where(eq(incidentCommentsTable.incidentId, incidentId))
    .orderBy(asc(incidentCommentsTable.createdAt));
  res.json(rows);
});

router.post("/", async (req, res) => {
  const incidentId = Number(req.params.incidentId);
  if (!incidentId) { res.status(400).json({ error: "incidentId diperlukan" }); return; }
  const { content } = req.body as { content?: string };
  if (!content?.trim()) { res.status(400).json({ error: "Komentar tidak boleh kosong" }); return; }

  const user = req.user!;
  const [saved] = await db.insert(incidentCommentsTable).values({
    incidentId,
    userId: user.id,
    userName: user.name,
    content: content.trim(),
  }).returning();

  res.json(saved);
});

router.delete("/:commentId", async (req, res) => {
  const commentId = Number(req.params.commentId);
  const user = req.user!;
  const [row] = await db.select().from(incidentCommentsTable).where(eq(incidentCommentsTable.id, commentId));
  if (!row) { res.status(404).json({ error: "Komentar tidak ditemukan" }); return; }
  if (row.userId !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Tidak bisa hapus komentar orang lain" }); return;
  }
  await db.delete(incidentCommentsTable).where(eq(incidentCommentsTable.id, commentId));
  res.json({ success: true });
});

export default router;
