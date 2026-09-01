// Replaces Supabase Auth. Admin identity is a row in the `admin_users` table
// (email + bcrypt password hash), and a signed-in session is an HttpOnly JWT
// cookie — there is no third-party auth provider anymore.

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query, hasDatabaseUrl } from "./db";

export const SESSION_COOKIE_NAME = "b2bfiy_admin_session";

export interface AdminSessionPayload {
  userId: string;
  email: string;
}

function requireSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || "b2bfiy_default_jwt_secret_dev_fallback";
  return secret;
}

export function signSessionToken(payload: AdminSessionPayload): string {
  return jwt.sign(payload, requireSecret(), { expiresIn: "30d" });
}

export function verifySessionToken(token: string): AdminSessionPayload | null {
  try {
    return jwt.verify(token, requireSecret()) as AdminSessionPayload;
  } catch {
    return null;
  }
}

// Works for both Express (with cookie-parser) and Vercel Node functions
// (which parse `req.cookies` automatically), and falls back to manually
// parsing the raw Cookie header if neither populated it.
export function getSessionFromRequest(req: any): AdminSessionPayload | null {
  let token: string | undefined = req.cookies?.[SESSION_COOKIE_NAME];

  if (!token && typeof req.headers?.cookie === "string") {
    const match = req.headers.cookie
      .split(";")
      .map((c: string) => c.trim())
      .find((c: string) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (match) token = decodeURIComponent(match.split("=").slice(1).join("="));
  }

  if (!token) return null;
  return verifySessionToken(token);
}

export function setSessionCookie(res: any, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${
      isProd ? "; Secure" : ""
    }`
  );
}

export function clearSessionCookie(res: any) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

// On first-ever login attempt, if admin_users is empty, bootstrap one
// account from ADMIN_EMAIL + ADMIN_PASSWORD server env vars. Once you've
// signed in successfully you can remove ADMIN_PASSWORD from your env vars
// if you'd like — the hashed copy is what's checked from then on.
async function bootstrapAdminIfEmpty(): Promise<void> {
  if (!hasDatabaseUrl()) return;
  try {
    const rows = await query<{ count: string }>("SELECT COUNT(*)::text as count FROM admin_users");
    const count = parseInt(rows[0]?.count || "0", 10);
    if (count > 0) return;

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) return;

    const hash = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO admin_users (id, email, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [`admin_${Date.now()}`, email.toLowerCase().trim(), hash]
    );
  } catch (err) {
    console.warn("Bootstrap admin check skipped:", err);
  }
}

export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<AdminSessionPayload | null> {
  const normEmail = email.toLowerCase().trim();
  const envEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const envPassword = process.env.ADMIN_PASSWORD;

  if (!hasDatabaseUrl()) {
    if (envEmail && envPassword && normEmail === envEmail && password === envPassword) {
      return { userId: "admin_env", email: envEmail };
    }
    return null;
  }

  await bootstrapAdminIfEmpty();

  try {
    const rows = await query<{ id: string; email: string; password_hash: string }>(
      "SELECT id, email, password_hash FROM admin_users WHERE email = $1",
      [normEmail]
    );
    const user = rows[0];
    if (!user) {
      if (envEmail && envPassword && normEmail === envEmail && password === envPassword) {
        return { userId: "admin_env", email: envEmail };
      }
      return null;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return null;

    return { userId: user.id, email: user.email };
  } catch (err) {
    console.error("verifyAdminCredentials database error:", err);
    if (envEmail && envPassword && normEmail === envEmail && password === envPassword) {
      return { userId: "admin_env", email: envEmail };
    }
    return null;
  }
}

export async function updatePasswordForUser(userId: string, newPassword: string): Promise<void> {
  if (!hasDatabaseUrl()) return;
  const hash = await bcrypt.hash(newPassword, 10);
  await query("UPDATE admin_users SET password_hash = $1 WHERE id = $2", [hash, userId]);
}
