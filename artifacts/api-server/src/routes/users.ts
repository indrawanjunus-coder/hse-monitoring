import { Router } from "express";
import { db, usersTable, departmentsTable, groupMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, hashPassword } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const users = await db.select().from(usersTable);
  const result = await Promise.all(users.map(async (u) => {
    const gms = await db.select().from(groupMembersTable).where(eq(groupMembersTable.userId, u.id));
    let departmentName: string | undefined;
    if (u.departmentId) {
      const depts = await db.select().from(departmentsTable).where(eq(departmentsTable.id, u.departmentId));
      departmentName = depts[0]?.name;
    }
    return {
      id: u.id, nik: u.nik, name: u.name, email: u.email, role: u.role,
      departmentId: u.departmentId, departmentName, isHead: u.isHead,
      groupIds: gms.map(g => g.groupId), createdAt: u.createdAt.toISOString(),
    };
  }));
  res.json(result);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const users = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!users[0]) { res.status(404).json({ message: "Not found" }); return; }
  const u = users[0];
  const gms = await db.select().from(groupMembersTable).where(eq(groupMembersTable.userId, u.id));
  let departmentName: string | undefined;
  if (u.departmentId) {
    const depts = await db.select().from(departmentsTable).where(eq(departmentsTable.id, u.departmentId));
    departmentName = depts[0]?.name;
  }
  res.json({
    id: u.id, nik: u.nik, name: u.name, email: u.email, role: u.role,
    departmentId: u.departmentId, departmentName, isHead: u.isHead,
    groupIds: gms.map(g => g.groupId), createdAt: u.createdAt.toISOString(),
  });
});

router.post("/", async (req, res) => {
  const { nik, name, email, password, role, departmentId, isHead, groupIds } = req.body;
  const passwordHash = await hashPassword(password);
  const [u] = await db.insert(usersTable).values({ nik, name, email, passwordHash, role, departmentId, isHead: isHead ?? false }).returning();
  if (!u) { res.status(500).json({ message: "Failed to create" }); return; }
  if (groupIds?.length) {
    await db.insert(groupMembersTable).values(groupIds.map((gid: number) => ({ groupId: gid, userId: u.id })));
  }
  res.status(201).json({
    id: u.id, nik: u.nik, name: u.name, email: u.email, role: u.role,
    departmentId: u.departmentId, isHead: u.isHead, groupIds: groupIds ?? [],
    createdAt: u.createdAt.toISOString(),
  });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, email, password, role, departmentId, isHead, groupIds } = req.body;
  const updateData: Record<string, unknown> = {};
  if (name) updateData.name = name;
  if (email) updateData.email = email;
  if (password) updateData.passwordHash = await hashPassword(password);
  if (role) updateData.role = role;
  if (departmentId !== undefined) updateData.departmentId = departmentId;
  if (isHead !== undefined) updateData.isHead = isHead;
  const [u] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
  if (!u) { res.status(404).json({ message: "Not found" }); return; }
  if (groupIds !== undefined) {
    await db.delete(groupMembersTable).where(eq(groupMembersTable.userId, id));
    if (groupIds.length) {
      await db.insert(groupMembersTable).values(groupIds.map((gid: number) => ({ groupId: gid, userId: id })));
    }
  }
  const gms = await db.select().from(groupMembersTable).where(eq(groupMembersTable.userId, id));
  res.json({
    id: u.id, nik: u.nik, name: u.name, email: u.email, role: u.role,
    departmentId: u.departmentId, isHead: u.isHead, groupIds: gms.map(g => g.groupId),
    createdAt: u.createdAt.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).end();
});

export default router;
