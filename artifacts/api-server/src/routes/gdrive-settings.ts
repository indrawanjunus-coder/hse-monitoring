import { Router } from "express";
import { db, gdriveSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

// Public (any auth user): just returns the max attachment size
router.get("/public", async (req, res) => {
  const cid = req.user?.companyId;
  const [s] = cid
    ? await db.select({ maxAttachmentSizeMb: gdriveSettingsTable.maxAttachmentSizeMb }).from(gdriveSettingsTable).where(eq(gdriveSettingsTable.companyId, cid))
    : await db.select({ maxAttachmentSizeMb: gdriveSettingsTable.maxAttachmentSizeMb }).from(gdriveSettingsTable);
  res.json({ maxAttachmentSizeMb: s?.maxAttachmentSizeMb ?? 1 });
});

router.get("/", async (req, res) => {
  if (req.user?.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  const cid = req.user!.companyId;
  const [s] = cid
    ? await db.select().from(gdriveSettingsTable).where(eq(gdriveSettingsTable.companyId, cid))
    : await db.select().from(gdriveSettingsTable);
  if (!s) {
    res.json({ clientEmail: "", privateKeySet: false, rootFolderId: "0AIi51ZRCyt6JUk9PVA", maxAttachmentSizeMb: 1, updatedAt: null });
    return;
  }
  res.json({
    id: s.id,
    clientEmail: s.clientEmail,
    privateKeySet: !!s.privateKey,
    rootFolderId: s.rootFolderId,
    maxAttachmentSizeMb: s.maxAttachmentSizeMb ?? 1,
    updatedAt: s.updatedAt.toISOString(),
  });
});

router.put("/", async (req, res) => {
  if (req.user?.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  const { clientEmail, privateKey, rootFolderId, maxAttachmentSizeMb } = req.body as {
    clientEmail?: string;
    privateKey?: string;
    rootFolderId?: string;
    maxAttachmentSizeMb?: number;
  };

  const cid = req.user!.companyId;
  const [existing] = cid
    ? await db.select().from(gdriveSettingsTable).where(eq(gdriveSettingsTable.companyId, cid))
    : await db.select().from(gdriveSettingsTable);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (clientEmail !== undefined) updates.clientEmail = clientEmail;
  if (privateKey !== undefined && privateKey !== "") updates.privateKey = privateKey;
  if (rootFolderId !== undefined) updates.rootFolderId = rootFolderId;
  if (maxAttachmentSizeMb !== undefined && maxAttachmentSizeMb >= 0.1) updates.maxAttachmentSizeMb = Math.round(maxAttachmentSizeMb);

  if (existing) {
    const [updated] = await db.update(gdriveSettingsTable).set(updates).where(eq(gdriveSettingsTable.id, existing.id)).returning();
    res.json({ success: true, privateKeySet: !!updated.privateKey });
  } else {
    const [created] = await db.insert(gdriveSettingsTable).values({
      clientEmail: clientEmail ?? "",
      privateKey: privateKey ?? "",
      rootFolderId: rootFolderId ?? "0AIi51ZRCyt6JUk9PVA",
      maxAttachmentSizeMb: maxAttachmentSizeMb ?? 1,
      companyId: cid,
    }).returning();
    res.json({ success: true, privateKeySet: !!created.privateKey });
  }
});

export default router;
