import { Router } from "express";
import { db, categoriesTable, groupsTable, usersTable, categoryGroupsTable, categoryUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

async function getCategoryGroups(categoryId: number) {
  return db.select({ id: groupsTable.id, name: groupsTable.name })
    .from(categoryGroupsTable)
    .innerJoin(groupsTable, eq(categoryGroupsTable.groupId, groupsTable.id))
    .where(eq(categoryGroupsTable.categoryId, categoryId));
}

async function getCategoryUsers(categoryId: number) {
  return db.select({ id: usersTable.id, name: usersTable.name, nik: usersTable.nik })
    .from(categoryUsersTable)
    .innerJoin(usersTable, eq(categoryUsersTable.userId, usersTable.id))
    .where(eq(categoryUsersTable.categoryId, categoryId));
}

async function upsertCategoryJunctions(categoryId: number, groupIds?: number[], userIds?: number[]) {
  if (groupIds !== undefined) {
    await db.delete(categoryGroupsTable).where(eq(categoryGroupsTable.categoryId, categoryId));
    if (groupIds.length) {
      await db.insert(categoryGroupsTable).values(groupIds.map(gid => ({ categoryId, groupId: gid })));
    }
  }
  if (userIds !== undefined) {
    await db.delete(categoryUsersTable).where(eq(categoryUsersTable.categoryId, categoryId));
    if (userIds.length) {
      await db.insert(categoryUsersTable).values(userIds.map(uid => ({ categoryId, userId: uid })));
    }
  }
}

async function formatCategory(c: typeof categoriesTable.$inferSelect) {
  const groups = await getCategoryGroups(c.id);
  const users = await getCategoryUsers(c.id);
  const picGroupName = groups[0]?.name ?? undefined;
  return {
    ...c,
    picGroupName,
    groups,
    users,
    groupIds: groups.map(g => g.id),
    userIds: users.map(u => u.id),
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/", async (_req, res) => {
  const cats = await db.select().from(categoriesTable);
  const result = await Promise.all(cats.map(formatCategory));
  res.json(result);
});

router.post("/", async (req, res) => {
  const { name, description, riskLevel, color, groupIds, userIds } = req.body;
  const picGroupId = (groupIds && groupIds.length > 0) ? groupIds[0] : null;
  const [c] = await db.insert(categoriesTable).values({ name, description, riskLevel, picGroupId, color }).returning();
  if (!c) { res.status(500).json({ message: "Failed" }); return; }
  await upsertCategoryJunctions(c.id, groupIds ?? [], userIds ?? []);
  res.status(201).json(await formatCategory(c));
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, riskLevel, color, groupIds, userIds } = req.body;
  const picGroupId = (groupIds && groupIds.length > 0) ? groupIds[0] : null;
  const [c] = await db.update(categoriesTable).set({ name, description, riskLevel, picGroupId, color }).where(eq(categoriesTable.id, id)).returning();
  if (!c) { res.status(404).json({ message: "Not found" }); return; }
  await upsertCategoryJunctions(id, groupIds, userIds);
  res.json(await formatCategory(c));
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.status(204).end();
});

export default router;
