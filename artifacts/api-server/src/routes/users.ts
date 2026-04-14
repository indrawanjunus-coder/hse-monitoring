import { Router } from "express";
import { db, usersTable, departmentsTable, groupMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, hashPassword } from "../lib/auth";
import { sendEmail, newUserEmailHtml, passwordResetEmailHtml } from "../lib/email";

const router = Router();
router.use(authMiddleware);

function getPgCode(err: any): string | undefined {
  return err?.code ?? err?.cause?.code ?? err?.cause?.cause?.code;
}

function getConstraintName(err: any): string | undefined {
  return err?.constraint ?? err?.cause?.constraint ?? err?.cause?.cause?.constraint;
}

function getErrMsg(err: any): string {
  return err?.cause?.message ?? err?.cause?.detail ?? err?.message ?? "Terjadi kesalahan";
}

router.get("/", async (req, res) => {
  try {
    const cid = req.user!.companyId;
    const users = cid
      ? await db.select().from(usersTable).where(eq(usersTable.companyId, cid))
      : await db.select().from(usersTable);
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
  } catch (err: any) {
    res.status(500).json({ error: getErrMsg(err) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }
    const users = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!users[0]) { res.status(404).json({ error: "User tidak ditemukan" }); return; }
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
  } catch (err: any) {
    res.status(500).json({ error: getErrMsg(err) });
  }
});

router.post("/", async (req, res) => {
  const { nik, name, email, password, role, departmentId, isHead, groupIds } = req.body;

  if (!nik?.trim()) { res.status(400).json({ error: "NIK wajib diisi" }); return; }
  if (!name?.trim()) { res.status(400).json({ error: "Nama wajib diisi" }); return; }
  if (!password) { res.status(400).json({ error: "Password wajib diisi" }); return; }

  const deptId = departmentId != null && departmentId !== "" && departmentId !== "none"
    ? parseInt(String(departmentId)) : null;

  try {
    const passwordHash = await hashPassword(password);

    const [u] = await db.insert(usersTable).values({
      companyId: req.user!.companyId,
      nik: nik.trim(),
      name: name.trim(),
      email: email?.trim() || null,
      passwordHash,
      role: role ?? "employee",
      departmentId: deptId && !isNaN(deptId) ? deptId : null,
      isHead: isHead === true || isHead === "true" || false,
    }).returning();

    if (!u) { res.status(500).json({ error: "Gagal membuat user" }); return; }

    if (groupIds?.length) {
      try {
        await db.insert(groupMembersTable).values(
          groupIds.map((gid: number) => ({ groupId: gid, userId: u.id }))
        );
      } catch {
      }
    }

    if (u.email && password) {
      sendEmail(
        u.email,
        "Akun HSE Monitor Anda Telah Dibuat",
        newUserEmailHtml({ name: u.name, nik: u.nik, email: u.email, password, role: u.role }),
      ).catch(() => {});
    }

    res.status(201).json({
      id: u.id, nik: u.nik, name: u.name, email: u.email, role: u.role,
      departmentId: u.departmentId, isHead: u.isHead, groupIds: groupIds ?? [],
      createdAt: u.createdAt.toISOString(),
    });
  } catch (err: any) {
    const pgCode = getPgCode(err);
    if (pgCode === "23505") {
      const constraint = getConstraintName(err);
      if (constraint?.includes("nik")) {
        res.status(409).json({ error: `NIK "${nik}" sudah digunakan oleh user lain` }); return;
      }
      if (constraint?.includes("email")) {
        res.status(409).json({ error: `Email "${email}" sudah digunakan oleh user lain` }); return;
      }
      res.status(409).json({ error: "NIK atau Email sudah digunakan oleh user lain" }); return;
    }
    if (pgCode === "23503") {
      res.status(400).json({ error: "Departemen yang dipilih tidak valid" }); return;
    }
    if (pgCode === "23502") {
      res.status(400).json({ error: "Ada field wajib yang belum diisi" }); return;
    }
    console.error("POST /users error:", pgCode, getErrMsg(err), err);
    res.status(500).json({ error: getErrMsg(err) });
  }
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }

  const { name, email, password, role, departmentId, isHead, groupIds } = req.body;
  const authUser = req.user!;

  const deptId = departmentId != null && departmentId !== "" && departmentId !== "none"
    ? parseInt(String(departmentId)) : undefined;

  try {
    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (password) updateData.passwordHash = await hashPassword(password);
    if (role) updateData.role = role;
    if (departmentId !== undefined) {
      updateData.departmentId = deptId && !isNaN(deptId) ? deptId : null;
    }
    if (isHead !== undefined) updateData.isHead = isHead === true || isHead === "true";

    const [u] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
    if (!u) { res.status(404).json({ error: "User tidak ditemukan" }); return; }

    if (groupIds !== undefined) {
      await db.delete(groupMembersTable).where(eq(groupMembersTable.userId, id));
      if (groupIds.length) {
        await db.insert(groupMembersTable).values(groupIds.map((gid: number) => ({ groupId: gid, userId: id })));
      }
    }

    if (password && u.email && authUser.role === "admin" && authUser.id !== id) {
      sendEmail(
        u.email,
        "Password HSE Monitor Anda Telah Direset",
        passwordResetEmailHtml({ name: u.name, nik: u.nik, newPassword: password, resetBy: authUser.name }),
      ).catch(() => {});
    }

    const gms = await db.select().from(groupMembersTable).where(eq(groupMembersTable.userId, id));
    res.json({
      id: u.id, nik: u.nik, name: u.name, email: u.email, role: u.role,
      departmentId: u.departmentId, isHead: u.isHead, groupIds: gms.map(g => g.groupId),
      createdAt: u.createdAt.toISOString(),
    });
  } catch (err: any) {
    const pgCode = getPgCode(err);
    if (pgCode === "23505") {
      const constraint = getConstraintName(err);
      if (constraint?.includes("email")) {
        res.status(409).json({ error: "Email sudah digunakan oleh user lain" }); return;
      }
      res.status(409).json({ error: "Data sudah digunakan oleh user lain" }); return;
    }
    if (pgCode === "23503") {
      res.status(400).json({ error: "Departemen yang dipilih tidak valid" }); return;
    }
    console.error("PUT /users/:id error:", pgCode, getErrMsg(err), err);
    res.status(500).json({ error: getErrMsg(err) });
  }
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }
  try {
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.status(204).end();
  } catch (err: any) {
    const pgCode = getPgCode(err);
    if (pgCode === "23503") {
      res.status(409).json({ error: "User tidak bisa dihapus karena masih terhubung ke data lain" }); return;
    }
    console.error("DELETE /users/:id error:", pgCode, getErrMsg(err), err);
    res.status(500).json({ error: getErrMsg(err) });
  }
});

router.post("/:id/change-password", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }
  const { currentPassword, newPassword } = req.body;
  const authUser = req.user!;
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "Password baru minimal 6 karakter" }); return;
  }
  try {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!u) { res.status(404).json({ error: "User tidak ditemukan" }); return; }
    if (authUser.role !== "admin") {
      if (authUser.id !== id) { res.status(403).json({ error: "Forbidden" }); return; }
      if (!currentPassword) { res.status(400).json({ error: "Password saat ini diperlukan" }); return; }
      const expectedHash = await hashPassword(currentPassword);
      if (u.passwordHash !== expectedHash) { res.status(400).json({ error: "Password saat ini tidak sesuai" }); return; }
    }
    const passwordHash = await hashPassword(newPassword);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id));
    if (authUser.role === "admin" && authUser.id !== id && u.email) {
      sendEmail(
        u.email,
        "Password HSE Monitor Anda Telah Direset",
        passwordResetEmailHtml({ name: u.name, nik: u.nik, newPassword, resetBy: authUser.name }),
      ).catch(() => {});
    }
    res.json({ message: "Password berhasil diubah" });
  } catch (err: any) {
    console.error("change-password error:", getErrMsg(err), err);
    res.status(500).json({ error: getErrMsg(err) });
  }
});

export default router;
