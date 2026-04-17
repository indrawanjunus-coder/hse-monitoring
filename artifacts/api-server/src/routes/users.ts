import { Router } from "express";
import { db, usersTable, departmentsTable, groupMembersTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { authMiddleware, hashPassword } from "../lib/auth";
import { sendEmail, newUserEmailHtml, passwordResetEmailHtml } from "../lib/email";
import { checkUserLimit } from "../lib/plan-limits";
import { validateBody } from "../lib/validate";
import { CreateUserBody } from "@workspace/api-zod";
import { z } from "zod";

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
        isActive: u.isActive,
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
    const authUser = req.user!;

    const users = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!users[0]) { res.status(404).json({ error: "User tidak ditemukan" }); return; }
    const u = users[0];

    // [SECURITY] Enforce tenant boundary — non-sysadmin cannot read users from another company
    if (authUser.role !== "sysadmin" && u.companyId !== authUser.companyId) {
      res.status(403).json({ error: "Akses ditolak" }); return;
    }

    const gms = await db.select().from(groupMembersTable).where(eq(groupMembersTable.userId, u.id));
    let departmentName: string | undefined;
    if (u.departmentId) {
      const depts = await db.select().from(departmentsTable).where(eq(departmentsTable.id, u.departmentId));
      departmentName = depts[0]?.name;
    }
    res.json({
      id: u.id, nik: u.nik, name: u.name, email: u.email, role: u.role,
      departmentId: u.departmentId, departmentName, isHead: u.isHead,
      isActive: u.isActive,
      groupIds: gms.map(g => g.groupId), createdAt: u.createdAt.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: getErrMsg(err) });
  }
});

// [SECURITY M3] Allow sysadmin role too for sysadmin-initiated creation
const CreateUserBodyExtended = CreateUserBody.extend({ role: z.enum(["admin", "supervisor", "employee", "sysadmin"]).optional() });
router.post("/", validateBody(CreateUserBodyExtended), async (req, res) => {
  const authUser = req.user!;
  // [SECURITY] Only admin/sysadmin may create users
  if (authUser.role !== "admin" && authUser.role !== "sysadmin") {
    res.status(403).json({ error: "Hanya admin yang dapat membuat user" }); return;
  }

  const { nik, name, email, password, role, departmentId, isHead, groupIds } = req.body;

  if (!nik?.trim()) { res.status(400).json({ error: "NIK wajib diisi" }); return; }
  if (!name?.trim()) { res.status(400).json({ error: "Nama wajib diisi" }); return; }
  if (!password) { res.status(400).json({ error: "Password wajib diisi" }); return; }

  // [SECURITY] Non-sysadmin cannot create sysadmin accounts
  const allowedRoles = ["employee", "admin"];
  const safeRole = allowedRoles.includes(role) ? role : "employee";
  if (role === "sysadmin" && authUser.role !== "sysadmin") {
    res.status(403).json({ error: "Tidak diizinkan membuat akun sysadmin" }); return;
  }

  const deptId = departmentId != null && departmentId !== "" && departmentId !== "none"
    ? parseInt(String(departmentId)) : null;

  // Check plan user limit
  const companyId = req.user!.companyId;
  if (companyId) {
    const limitCheck = await checkUserLimit(companyId);
    if (!limitCheck.allowed) {
      res.status(403).json({
        error: `Batas maksimal user paket ini telah tercapai (${limitCheck.current}/${limitCheck.max}). Upgrade paket untuk menambah lebih banyak user.`,
        code: "USER_LIMIT_REACHED",
        current: limitCheck.current,
        max: limitCheck.max,
      });
      return;
    }
  }

  try {
    const passwordHash = await hashPassword(password);

    const [u] = await db.insert(usersTable).values({
      companyId: authUser.companyId,
      nik: nik.trim(),
      name: name.trim(),
      email: email?.trim() || null,
      passwordHash,
      role: safeRole ?? "employee",
      departmentId: deptId && !isNaN(deptId) ? deptId : null,
      isHead: isHead === true || isHead === "true" || false,
      isActive: true,
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
      departmentId: u.departmentId, isHead: u.isHead, isActive: u.isActive,
      groupIds: groupIds ?? [],
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

  try {
    // [SECURITY] Fetch target user first — verify existence and company boundary
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target) { res.status(404).json({ error: "User tidak ditemukan" }); return; }

    // [SECURITY] Enforce tenant boundary
    if (authUser.role !== "sysadmin" && target.companyId !== authUser.companyId) {
      res.status(403).json({ error: "Akses ditolak" }); return;
    }

    // [SECURITY] Non-admin/non-sysadmin can only edit their own profile
    const isSelf = authUser.id === id;
    const isAdminOrAbove = authUser.role === "admin" || authUser.role === "sysadmin";
    if (!isSelf && !isAdminOrAbove) {
      res.status(403).json({ error: "Tidak diizinkan mengedit user lain" }); return;
    }

    // [SECURITY] Only sysadmin can change role
    if (role !== undefined && authUser.role !== "sysadmin") {
      res.status(403).json({ error: "Tidak diizinkan mengubah role user" }); return;
    }

    // [SECURITY] Validate role value — prevent setting invalid/unknown roles
    const validRoles = ["employee", "admin", "sysadmin"];
    if (role !== undefined && !validRoles.includes(role)) {
      res.status(400).json({ error: "Role tidak valid" }); return;
    }

    // [SECURITY] Non-admin cannot change departmentId, isHead, groupIds of other users
    const canEditAdminFields = isAdminOrAbove;

    const deptId = departmentId != null && departmentId !== "" && departmentId !== "none"
      ? parseInt(String(departmentId)) : undefined;

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email?.trim() || null;
    // [SECURITY] Password change via PUT is admin-only for other users; self can use change-password endpoint
    if (password && isAdminOrAbove) updateData.passwordHash = await hashPassword(password);
    if (role !== undefined && authUser.role === "sysadmin") updateData.role = role;
    if (canEditAdminFields && departmentId !== undefined) {
      updateData.departmentId = deptId && !isNaN(deptId) ? deptId : null;
    }
    if (canEditAdminFields && isHead !== undefined) {
      updateData.isHead = isHead === true || isHead === "true";
    }

    // [SECURITY] UPDATE scoped to both id AND company_id to prevent cross-tenant writes
    const whereClause = authUser.role === "sysadmin"
      ? eq(usersTable.id, id)
      : and(eq(usersTable.id, id), eq(usersTable.companyId, authUser.companyId!));

    const [u] = await db.update(usersTable).set(updateData).where(whereClause).returning();
    if (!u) { res.status(404).json({ error: "User tidak ditemukan" }); return; }

    if (canEditAdminFields && groupIds !== undefined) {
      await db.delete(groupMembersTable).where(eq(groupMembersTable.userId, id));
      if (groupIds.length) {
        await db.insert(groupMembersTable).values(groupIds.map((gid: number) => ({ groupId: gid, userId: id })));
      }
    }

    if (password && u.email && authUser.role === "admin" && !isSelf) {
      sendEmail(
        u.email,
        "Password HSE Monitor Anda Telah Direset",
        passwordResetEmailHtml({ name: u.name, nik: u.nik, newPassword: password, resetBy: authUser.name }),
      ).catch(() => {});
    }

    const gms = await db.select().from(groupMembersTable).where(eq(groupMembersTable.userId, id));
    res.json({
      id: u.id, nik: u.nik, name: u.name, email: u.email, role: u.role,
      departmentId: u.departmentId, isHead: u.isHead, isActive: u.isActive,
      groupIds: gms.map(g => g.groupId),
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

// Toggle user active/inactive status (admin only)
router.post("/:id/toggle-active", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }
  const authUser = req.user!;

  // [SECURITY] Only admin/sysadmin can toggle user status
  if (authUser.role !== "admin" && authUser.role !== "sysadmin") {
    res.status(403).json({ error: "Hanya admin yang dapat mengubah status user" }); return;
  }

  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!u) { res.status(404).json({ error: "User tidak ditemukan" }); return; }

  // [SECURITY] Enforce tenant boundary
  if (authUser.role !== "sysadmin" && u.companyId !== authUser.companyId) {
    res.status(403).json({ error: "Akses ditolak" }); return;
  }

  // If activating, check limit first
  if (!u.isActive && u.companyId) {
    const limitCheck = await checkUserLimit(u.companyId);
    if (!limitCheck.allowed) {
      res.status(403).json({
        error: `Batas maksimal user paket ini telah tercapai (${limitCheck.current}/${limitCheck.max}). Nonaktifkan user lain atau upgrade paket.`,
        code: "USER_LIMIT_REACHED",
        current: limitCheck.current,
        max: limitCheck.max,
      });
      return;
    }
  }

  // [SECURITY] Scoped UPDATE — include company_id in WHERE for non-sysadmin
  const whereClause = authUser.role === "sysadmin"
    ? eq(usersTable.id, id)
    : and(eq(usersTable.id, id), eq(usersTable.companyId, authUser.companyId!));

  const [updated] = await db.update(usersTable).set({ isActive: !u.isActive }).where(whereClause).returning();
  if (!updated) { res.status(404).json({ error: "User tidak ditemukan" }); return; }
  res.json({ id: updated.id, isActive: updated.isActive });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID tidak valid" }); return; }
  const authUser = req.user!;

  // [SECURITY] Only admin/sysadmin can delete users
  if (authUser.role !== "admin" && authUser.role !== "sysadmin") {
    res.status(403).json({ error: "Hanya admin yang dapat menghapus user" }); return;
  }

  // [SECURITY] Prevent self-deletion
  if (authUser.id === id) {
    res.status(400).json({ error: "Tidak dapat menghapus akun sendiri" }); return;
  }

  try {
    // [SECURITY] Fetch target first to enforce tenant boundary
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target) { res.status(404).json({ error: "User tidak ditemukan" }); return; }

    if (authUser.role !== "sysadmin" && target.companyId !== authUser.companyId) {
      res.status(403).json({ error: "Akses ditolak" }); return;
    }

    // [SECURITY] Scoped DELETE — include company_id in WHERE for non-sysadmin
    const whereClause = authUser.role === "sysadmin"
      ? eq(usersTable.id, id)
      : and(eq(usersTable.id, id), eq(usersTable.companyId, authUser.companyId!));

    await db.delete(usersTable).where(whereClause);
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

    // [SECURITY] Enforce tenant boundary — admin cannot reset password of user from another company
    if (authUser.role !== "sysadmin" && u.companyId !== authUser.companyId) {
      res.status(403).json({ error: "Akses ditolak" }); return;
    }

    const isAdminOrAbove = authUser.role === "admin" || authUser.role === "sysadmin";
    const isSelf = authUser.id === id;

    if (!isAdminOrAbove) {
      // Non-admin: can only change own password and must provide current password
      if (!isSelf) { res.status(403).json({ error: "Tidak diizinkan mengubah password user lain" }); return; }
      if (!currentPassword) { res.status(400).json({ error: "Password saat ini diperlukan" }); return; }
      const expectedHash = await hashPassword(currentPassword);
      if (u.passwordHash !== expectedHash) { res.status(400).json({ error: "Password saat ini tidak sesuai" }); return; }
    }

    // [SECURITY] Scoped UPDATE — include company_id in WHERE for non-sysadmin
    const whereClause = authUser.role === "sysadmin"
      ? eq(usersTable.id, id)
      : and(eq(usersTable.id, id), eq(usersTable.companyId, authUser.companyId!));

    const passwordHash = await hashPassword(newPassword);
    await db.update(usersTable).set({ passwordHash }).where(whereClause);

    if (isAdminOrAbove && !isSelf && u.email) {
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
