import { Router } from "express";
import { db, gdriveSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  if (req.user?.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  const [s] = await db.select().from(gdriveSettingsTable);
  if (!s) {
    res.json({ clientEmail: "", privateKeySet: false, rootFolderId: "0AIi51ZRCyt6JUk9PVA", updatedAt: null });
    return;
  }
  res.json({
    id: s.id,
    clientEmail: s.clientEmail,
    privateKeySet: !!s.privateKey,
    rootFolderId: s.rootFolderId,
    updatedAt: s.updatedAt.toISOString(),
  });
});

router.put("/", async (req, res) => {
  if (req.user?.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  const { clientEmail, privateKey, rootFolderId } = req.body as {
    clientEmail?: string;
    privateKey?: string;
    rootFolderId?: string;
  };

  const [existing] = await db.select().from(gdriveSettingsTable);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (clientEmail !== undefined) updates.clientEmail = clientEmail;
  if (privateKey !== undefined && privateKey !== "") updates.privateKey = privateKey;
  if (rootFolderId !== undefined) updates.rootFolderId = rootFolderId;

  if (existing) {
    const [updated] = await db.update(gdriveSettingsTable).set(updates).where(eq(gdriveSettingsTable.id, existing.id)).returning();
    res.json({ success: true, privateKeySet: !!updated.privateKey });
  } else {
    const [created] = await db.insert(gdriveSettingsTable).values({
      clientEmail: clientEmail ?? "",
      privateKey: privateKey ?? "",
      rootFolderId: rootFolderId ?? "0AIi51ZRCyt6JUk9PVA",
    }).returning();
    res.json({ success: true, privateKeySet: !!created.privateKey });
  }
});

export default router;
