import { Router } from "express";
import {
  db, incidentsTable, incidentEscalationsTable, incidentCommentsTable,
  groupsTable, groupMembersTable, usersTable,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { sendEmail } from "../lib/email";

const router = Router({ mergeParams: true });
router.use(authMiddleware);

// GET /api/incidents/:incidentId/escalations
router.get("/", async (req, res) => {
  const incidentId = Number(req.params.incidentId);
  if (!incidentId) { res.status(400).json({ error: "incidentId diperlukan" }); return; }

  const rows = await db
    .select({
      id: incidentEscalationsTable.id,
      incidentId: incidentEscalationsTable.incidentId,
      fromGroupId: incidentEscalationsTable.fromGroupId,
      fromGroupName: groupsTable.name,
      toGroupId: incidentEscalationsTable.toGroupId,
      reason: incidentEscalationsTable.reason,
      escalatedByUserId: incidentEscalationsTable.escalatedByUserId,
      escalatedByUserName: incidentEscalationsTable.escalatedByUserName,
      escalatedAt: incidentEscalationsTable.escalatedAt,
    })
    .from(incidentEscalationsTable)
    .leftJoin(groupsTable, eq(incidentEscalationsTable.fromGroupId, groupsTable.id))
    .where(eq(incidentEscalationsTable.incidentId, incidentId))
    .orderBy(asc(incidentEscalationsTable.escalatedAt));

  // Fetch toGroup names separately (can't join same table twice easily with drizzle select)
  const result = await Promise.all(rows.map(async r => {
    const [toGroup] = await db.select({ name: groupsTable.name }).from(groupsTable).where(eq(groupsTable.id, r.toGroupId));
    return { ...r, toGroupName: toGroup?.name ?? `Group #${r.toGroupId}`, escalatedAt: r.escalatedAt.toISOString() };
  }));

  res.json(result);
});

// POST /api/incidents/:incidentId/escalations
router.post("/", async (req, res) => {
  const incidentId = Number(req.params.incidentId);
  if (!incidentId) { res.status(400).json({ error: "incidentId diperlukan" }); return; }

  const user = req.user!;

  const { toGroupId, reason } = req.body as { toGroupId?: number; reason?: string };
  if (!toGroupId) { res.status(400).json({ error: "toGroupId diperlukan" }); return; }
  if (!reason?.trim()) { res.status(400).json({ error: "Alasan eskalasi diperlukan" }); return; }

  // Load incident
  const [incident] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, incidentId));
  if (!incident) { res.status(404).json({ error: "Tiket tidak ditemukan" }); return; }
  // [SECURITY H20] Verify incident belongs to caller's company — prevent cross-tenant escalation creation
  if (user.role !== "sysadmin" && user.companyId && incident.companyId !== user.companyId) {
    res.status(403).json({ error: "Akses ditolak" }); return;
  }
  if (incident.status === "closed") { res.status(400).json({ error: "Tiket yang sudah ditutup tidak dapat dieskalasi" }); return; }
  if (incident.assignedGroupId === toGroupId) { res.status(400).json({ error: "Group tujuan sama dengan group saat ini" }); return; }

  // Load target group
  const [toGroup] = await db.select().from(groupsTable).where(eq(groupsTable.id, toGroupId));
  if (!toGroup) { res.status(404).json({ error: "Group tujuan tidak ditemukan" }); return; }

  const fromGroupId = incident.assignedGroupId;
  let fromGroupName = "Tidak ada group";
  if (fromGroupId) {
    const [fg] = await db.select().from(groupsTable).where(eq(groupsTable.id, fromGroupId));
    fromGroupName = fg?.name ?? fromGroupName;
  }

  // Record escalation
  await db.insert(incidentEscalationsTable).values({
    incidentId,
    fromGroupId,
    toGroupId,
    reason: reason.trim(),
    escalatedByUserId: user.id,
    escalatedByUserName: user.name,
  });

  // Update incident's assigned group
  await db.update(incidentsTable)
    .set({ assignedGroupId: toGroupId })
    .where(eq(incidentsTable.id, incidentId));

  // Auto-comment
  const commentText = `🔁 Tiket dieskalasi ke Group **${toGroup.name}** (dari: ${fromGroupName}).\nAlasan: ${reason.trim()}\n— ${user.name}`;
  await db.insert(incidentCommentsTable).values({
    incidentId,
    userId: user.id,
    userName: user.name,
    content: commentText,
  });

  // Send email to new group members
  try {
    const members = await db
      .select({ email: usersTable.email, name: usersTable.name })
      .from(groupMembersTable)
      .innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
      .where(eq(groupMembersTable.groupId, toGroupId));

    const emails = members.map(m => m.email).filter(Boolean) as string[];
    if (emails.length > 0) {
      sendEmail(
        emails,
        `[HSE] Tiket #${incidentId} Dieskalasi ke ${toGroup.name}`,
        `<p>Halo,</p>
        <p>Tiket Hazard &amp; Incident <strong>#${incidentId}</strong> telah dieskalasi ke group <strong>${toGroup.name}</strong>.</p>
        <p><strong>Dari group:</strong> ${fromGroupName}<br/>
        <strong>Alasan:</strong> ${reason.trim()}<br/>
        <strong>Dieskalasi oleh:</strong> ${user.name}</p>
        <p>Silakan tindaklanjuti tiket ini sesegera mungkin.</p>`,
      );
    }
  } catch (e) {
    console.error("[Eskalasi] Gagal kirim email:", e);
  }

  res.json({ success: true, toGroupName: toGroup.name });
});

export default router;
