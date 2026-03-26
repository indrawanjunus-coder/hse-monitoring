import { Router } from "express";
import { db, groupsTable, groupMembersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

async function getGroupWithMembers(groupId: number) {
  const groups = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId));
  if (!groups[0]) return null;
  const g = groups[0];
  const members = await db.select({ gm: groupMembersTable, u: usersTable })
    .from(groupMembersTable)
    .leftJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
    .where(eq(groupMembersTable.groupId, groupId));
  return {
    ...g,
    members: members.map(m => ({
      userId: m.u!.id, name: m.u!.name, email: m.u!.email, nik: m.u!.nik
    })),
    createdAt: g.createdAt.toISOString(),
  };
}

router.get("/", async (_req, res) => {
  const groups = await db.select().from(groupsTable);
  const result = await Promise.all(groups.map(g => getGroupWithMembers(g.id)));
  res.json(result.filter(Boolean));
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const group = await getGroupWithMembers(id);
  if (!group) { res.status(404).json({ message: "Not found" }); return; }
  res.json(group);
});

router.post("/", async (req, res) => {
  const { name, description, memberIds } = req.body;
  const [g] = await db.insert(groupsTable).values({ name, description }).returning();
  if (!g) { res.status(500).json({ message: "Failed" }); return; }
  if (memberIds?.length) {
    await db.insert(groupMembersTable).values(memberIds.map((uid: number) => ({ groupId: g.id, userId: uid })));
  }
  const result = await getGroupWithMembers(g.id);
  res.status(201).json(result);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, memberIds } = req.body;
  const [g] = await db.update(groupsTable).set({ name, description }).where(eq(groupsTable.id, id)).returning();
  if (!g) { res.status(404).json({ message: "Not found" }); return; }
  if (memberIds !== undefined) {
    await db.delete(groupMembersTable).where(eq(groupMembersTable.groupId, id));
    if (memberIds.length) {
      await db.insert(groupMembersTable).values(memberIds.map((uid: number) => ({ groupId: id, userId: uid })));
    }
  }
  const result = await getGroupWithMembers(id);
  res.json(result);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(groupsTable).where(eq(groupsTable.id, id));
  res.status(204).end();
});

export default router;
