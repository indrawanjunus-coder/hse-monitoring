import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, companiesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "crypto";

export interface AuthUser {
  id: number;
  nik: string;
  name: string;
  email: string | null;
  role: string;
  companyId: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const COOKIE_NAME = "hse_token";

function generateToken(user: AuthUser): string {
  const payload = JSON.stringify(user);
  const encoded = Buffer.from(payload).toString("base64");
  return `hse_${encoded}`;
}

function verifyToken(token: string): AuthUser | null {
  try {
    if (!token.startsWith("hse_")) return null;
    const encoded = token.slice(4);
    const payload = Buffer.from(encoded, "base64").toString("utf-8");
    return JSON.parse(payload) as AuthUser;
  } catch {
    return null;
  }
}

export function createToken(user: AuthUser): string {
  return generateToken(user);
}

export const TOKEN_COOKIE_NAME = COOKIE_NAME;

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "strict",
  });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ message: "Invalid token" });
    return;
  }
  req.user = user;
  next();
}

export function sysadminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ message: "Unauthorized" }); return;
  }
  const user = verifyToken(token);
  if (!user || user.role !== "sysadmin") {
    res.status(403).json({ message: "Sysadmin access required" }); return;
  }
  req.user = user;
  next();
}

// ── Paywall (subscription) middleware ──────────────────────────────────────
// Applied to all tenant-specific routes. Blocks expired/suspended companies.
// Results are cached 60 seconds per companyId to avoid a DB hit per request.
interface SubCacheEntry { ok: boolean; code?: string; exp: number }
const subCache = new Map<number, SubCacheEntry>();

/** Call this whenever sysadmin activates / approves payment for a company */
export function invalidateSubCache(companyId: number): void {
  subCache.delete(companyId);
}

export async function companySubscriptionMiddleware(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  const user = req.user;
  // Sysadmin users and users without a companyId always pass through
  if (!user || !user.companyId || user.role === "sysadmin") { next(); return; }

  const cid = user.companyId;
  const now = Date.now();
  const cached = subCache.get(cid);
  if (cached && cached.exp > now) {
    if (!cached.ok) {
      res.status(402).json({ message: "Akses ditolak: langganan tidak aktif", code: cached.code });
      return;
    }
    next(); return;
  }

  try {
    const [co] = await db
      .select({ status: companiesTable.status, subscriptionEndsAt: companiesTable.subscriptionEndsAt, trialEndsAt: companiesTable.trialEndsAt })
      .from(companiesTable).where(eq(companiesTable.id, cid));

    if (!co) {
      subCache.set(cid, { ok: false, code: "COMPANY_NOT_FOUND", exp: now + 60_000 });
      res.status(402).json({ message: "Company tidak ditemukan", code: "COMPANY_NOT_FOUND" }); return;
    }
    if (co.status === "suspended") {
      subCache.set(cid, { ok: false, code: "SUSPENDED", exp: now + 60_000 });
      res.status(402).json({ message: "Akun ditangguhkan. Hubungi admin sistem.", code: "SUSPENDED" }); return;
    }
    if (co.status === "pending") {
      subCache.set(cid, { ok: false, code: "PENDING_ACTIVATION", exp: now + 60_000 });
      res.status(402).json({ message: "Akun menunggu aktivasi.", code: "PENDING_ACTIVATION" }); return;
    }
    const endsAt = co.subscriptionEndsAt ?? co.trialEndsAt;
    if (endsAt && endsAt < new Date()) {
      subCache.set(cid, { ok: false, code: "SUBSCRIPTION_EXPIRED", exp: now + 60_000 });
      res.status(402).json({ message: "Langganan Anda telah berakhir.", code: "SUBSCRIPTION_EXPIRED" }); return;
    }
    subCache.set(cid, { ok: true, exp: now + 60_000 });
    next();
  } catch (err) {
    // Fail-closed on DB error: do not grant access when we cannot verify subscription status.
    // Return 503 so the client can distinguish a transient error from a permanent 402 paywall.
    res.status(503).json({ message: "Layanan sementara tidak tersedia. Silakan coba lagi.", code: "SERVICE_UNAVAILABLE" });
  }
}

const BCRYPT_ROUNDS = 12;

// [SECURITY H2] Use bcrypt (cost 12) instead of SHA-256 + fixed pepper
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// [SECURITY H3] Legacy SHA-256 verifier — only used during hash migration on login
// Uses AUTH_PEPPER env var; falls back to legacy pepper only if not set
function legacySha256Hash(password: string): string {
  const pepper = process.env["AUTH_PEPPER"] ?? "hse_salt_2024";
  return createHash("sha256").update(password + pepper).digest("hex");
}

function isLegacyHash(hash: string): boolean {
  // Legacy hashes are 64-char hex strings; bcrypt hashes start with $2b$
  return /^[0-9a-f]{64}$/.test(hash);
}

// [SECURITY H2] Verify password — handles both new bcrypt and legacy SHA-256 hashes
// Legacy hashes trigger automatic rehash (migration) on successful login
export async function verifyPassword(
  password: string,
  hash: string,
  userId?: number,
): Promise<boolean> {
  if (isLegacyHash(hash)) {
    // Old SHA-256 hash — verify with legacy method
    const legacy = legacySha256Hash(password);
    // [SECURITY M1] Use timingSafeEqual to prevent timing side-channel attacks
    const legacyBuf = Buffer.from(legacy, "hex");
    const hashBuf = Buffer.from(hash, "hex");
    if (legacyBuf.length !== hashBuf.length || !timingSafeEqual(legacyBuf, hashBuf)) return false;

    // [SECURITY H2] Automatically migrate to bcrypt on successful login
    if (userId) {
      const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, userId));
    }
    return true;
  }

  // New bcrypt hash
  return bcrypt.compare(password, hash);
}
