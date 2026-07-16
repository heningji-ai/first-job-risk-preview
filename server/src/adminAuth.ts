import crypto from "node:crypto";
import type { Request, Response } from "express";
import { serverConfig } from "./config.js";

const COOKIE_NAME = "goal_fit_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function isAdminConfigured(): boolean {
  return Boolean(serverConfig.admin.username && serverConfig.admin.password && serverConfig.admin.sessionSecret);
}

function sign(payload: string): string {
  if (!serverConfig.admin.sessionSecret) throw new Error("admin session secret is not configured");
  return crypto.createHmac("sha256", serverConfig.admin.sessionSecret).update(payload).digest("hex");
}

function encodeSession(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      expiresAt: Date.now() + SESSION_TTL_MS
    }),
    "utf8"
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((cookie) => {
      const [name, ...rest] = cookie.trim().split("=");
      return [name, decodeURIComponent(rest.join("="))];
    })
  );
}

export function isAdminRequest(req: Request): boolean {
  if (!isAdminConfigured()) return false;

  const session = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!session) return false;

  const [payload, signature] = session.split(".");
  if (!payload || !signature || sign(payload) !== signature) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      username?: string;
      expiresAt?: number;
    };
    return parsed.username === serverConfig.admin.username && typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export function requireAdmin(req: Request, res: Response): boolean {
  if (isAdminRequest(req)) return true;
  res.status(401).json({ error: "admin login required" });
  return false;
}

export function loginAdmin(req: Request, res: Response, username: string, password: string): void {
  if (!isAdminConfigured()) {
    res.status(503).json({ error: "admin login is not configured" });
    return;
  }

  if (username !== serverConfig.admin.username || password !== serverConfig.admin.password) {
    res.status(401).json({ error: "invalid admin credentials" });
    return;
  }

  res.cookie(COOKIE_NAME, encodeSession(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: serverConfig.nodeEnv === "production",
    maxAge: SESSION_TTL_MS,
    path: "/"
  });
  res.json({ ok: true });
}

export function logoutAdmin(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: serverConfig.nodeEnv === "production",
    path: "/"
  });
  res.json({ ok: true });
}
