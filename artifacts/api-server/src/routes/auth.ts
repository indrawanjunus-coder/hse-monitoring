import { Router } from "express";
import { db, usersTable, departmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, createToken, hashPassword, verifyPassword } from "../lib/auth";

const router = Router();

router.post("/login", async (req, res) => {
  const { nik, password } = req.body;
  if (!nik || !password) {
    res.status(400).json({ message: "NIK and password required" });
    return;
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.nik, nik));
  if (users.length === 0) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }
  const user = users[0]!;
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const tokenUser = { id: user.id, nik: user.nik, name: user.name, email: user.email, role: user.role };
  const token = createToken(tokenUser);
  res.json({ token, user: { ...tokenUser, departmentId: user.departmentId, isHead: user.isHead, groupIds: [], createdAt: user.createdAt.toISOString() } });
});

router.get("/me", authMiddleware, async (req, res) => {
  const user = req.user!;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  if (users.length === 0) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  const u = users[0]!;
  const { groupMembersTable } = await import("@workspace/db");
  const groupMembers = await db.select().from(groupMembersTable).where(eq(groupMembersTable.userId, u.id));
  const groupIds = groupMembers.map((gm) => gm.groupId);

  let departmentName: string | undefined;
  if (u.departmentId) {
    const depts = await db.select().from(departmentsTable).where(eq(departmentsTable.id, u.departmentId));
    departmentName = depts[0]?.name;
  }

  res.json({
    id: u.id,
    nik: u.nik,
    name: u.name,
    email: u.email,
    role: u.role,
    departmentId: u.departmentId,
    departmentName,
    isHead: u.isHead,
    groupIds,
    createdAt: u.createdAt.toISOString(),
  });
});

export default router;
