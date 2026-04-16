import { Router } from "express";
import { db, testimonialsTable, usersTable, companiesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

router.get("/public", async (_req, res) => {
  const rows = await db.select().from(testimonialsTable).where(eq(testimonialsTable.isActive, true)).orderBy(desc(testimonialsTable.createdAt));
  res.json(rows);
});

router.use(authMiddleware);

router.get("/mine", async (req, res) => {
  const userId = (req as any).user.id;
  const [row] = await db.select().from(testimonialsTable).where(eq(testimonialsTable.userId, userId));
  res.json(row ?? null);
});

router.post("/", async (req, res) => {
  const user = (req as any).user;
  const { content, rating } = req.body;
  if (!content?.trim()) { res.status(400).json({ error: "Isi testimoni tidak boleh kosong" }); return; }

  const [dbUser] = await db.select({ name: usersTable.name, companyId: usersTable.companyId })
    .from(usersTable).where(eq(usersTable.id, user.id));
  
  let companyName = "";
  if (dbUser?.companyId) {
    const [co] = await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, dbUser.companyId));
    companyName = co?.name ?? "";
  }

  const [existing] = await db.select().from(testimonialsTable).where(eq(testimonialsTable.userId, user.id));
  if (existing) {
    const [updated] = await db.update(testimonialsTable).set({
      content: content.trim(),
      rating: Number(rating ?? 5),
      authorName: dbUser?.name ?? user.name,
      authorCompany: companyName,
      isActive: false,
    }).where(eq(testimonialsTable.userId, user.id)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(testimonialsTable).values({
      userId: user.id,
      companyId: dbUser?.companyId ?? null,
      authorName: dbUser?.name ?? user.name,
      authorRole: user.role,
      authorCompany: companyName,
      content: content.trim(),
      rating: Number(rating ?? 5),
      isActive: false,
    }).returning();
    res.json(created);
  }
});

export default router;
