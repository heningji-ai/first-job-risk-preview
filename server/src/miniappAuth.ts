import crypto from "node:crypto";
import { db } from "./db.js";
export type MiniappAuth = { platformIdentityId: string; visitorId: string; miniappSessionId: string };
export class MiniappAuthError extends Error { constructor(readonly code: "MINIAPP_AUTH_REQUIRED" | "MINIAPP_SESSION_EXPIRED") { super(code); } }
export function authenticateMiniappSession(header: unknown): MiniappAuth {
  if (typeof header !== "string" || !/^Bearer [A-Za-z0-9_-]{16,}$/.test(header)) throw new MiniappAuthError("MINIAPP_AUTH_REQUIRED");
  const hash = crypto.createHash("sha256").update(header.slice(7)).digest("hex");
  const row = db.prepare("SELECT s.id,s.platform_identity_id,s.visitor_id,s.expires_at,s.revoked_at,p.platform FROM miniapp_sessions s JOIN platform_identities p ON p.id=s.platform_identity_id WHERE s.token_hash=?").get(hash) as any;
  if (!row || row.revoked_at || row.platform !== "wechat_miniapp") throw new MiniappAuthError("MINIAPP_AUTH_REQUIRED");
  if (new Date(row.expires_at).getTime() <= Date.now()) throw new MiniappAuthError("MINIAPP_SESSION_EXPIRED");
  return { platformIdentityId: row.platform_identity_id, visitorId: row.visitor_id, miniappSessionId: row.id };
}
