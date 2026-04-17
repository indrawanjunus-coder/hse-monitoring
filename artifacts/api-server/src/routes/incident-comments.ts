import { Router } from "express";
import { db, incidentCommentsTable, incidentsTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router({ mergeParams: true });
router.use(authMiddleware);

// [SECURITY H17-H19] Shared helper: verify the incident belongs to the caller's company
async function requireOwnedIncident(incidentId: number, req: any, res: any): Promise<boolean> {
  const [incident] = await db.select({ companyId: incidentsTable.companyId })
    .from(incidentsTable).where(eq(incidentsTable.id, incidentId));
  if (!incident) { res.status(404).json({ error: "Incident tidak ditemukan" }); return false; }
  const user = req.user!;
  if (user.role !== "sysadmin" && user.companyId && incident.companyId !== user.companyId) {
    res.status(403).json({ error: "Akses ditolak" }); return false;
  }
  return true;
}

router.get("/", async (req, res) => {
  const incidentId = Number(req.params.incidentId);
  if (!incidentId) { res.status(400).json({ error: "incidentId diperlukan" }); return; }
  // [SECURITY H17] Prevent cross-tenant read of comments
  if (!await requireOwnedIncident(incidentId, req, res)) return;
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
  // [SECURITY H18] Prevent cross-tenant comment injection
  if (!await requireOwnedIncident(incidentId, req, res)) return;

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
  // [SECURITY H19] Verify comment's parent incident belongs to caller's company — admin bypass was cross-tenant
  if (!await requireOwnedIncident(row.incidentId, req, res)) return;
  if (row.userId !== user.id && user.role !== "admin") {
    res.status(403).json({ error: "Tidak bisa hapus komentar orang lain" }); return;
  }
  await db.delete(incidentCommentsTable).where(eq(incidentCommentsTable.id, commentId));
  res.json({ success: true });
});

export default router;
