import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export interface AuthUser {
  id: number;
  nik: string;
  name: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

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

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ message: "Invalid token" });
    return;
  }
  req.user = user;
  next();
}

export async function hashPassword(password: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(password + "hse_salt_2024").digest("hex");
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}
