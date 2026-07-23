import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { db, runImmediateTransaction } from "./db.js";

const PLATFORM = "wechat_miniapp";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const visitorPattern = /^visitor_[A-Za-z0-9_-]{8,128}$/;

export type WechatMiniappCodeExchange = { openid: string; unionid?: string; sessionKey?: string };
type WechatIdentity = { openid: string; unionid?: string };
type ExchangeProvider = (code: string) => Promise<WechatIdentity>;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new MiniappIdentityError("WECHAT_CONFIGURATION_MISSING");
  return value;
}

function key(): Buffer {
  const value = Buffer.from(requiredEnv("MINIAPP_IDENTITY_ENCRYPTION_KEY"), "base64");
  if (value.length !== 32) throw new MiniappIdentityError("WECHAT_CONFIGURATION_MISSING");
  return value;
}

function hash(value: string): string { return crypto.createHash("sha256").update(value, "utf8").digest("hex"); }
export function encryptIdentity(value: string): string {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64")}`;
}
export function decryptIdentity(value: string): string {
  if (!value.startsWith("v1.")) throw new Error("Unsupported identity ciphertext version");
  const packed = Buffer.from(value.slice(3), "base64"); if (packed.length < 29) throw new Error("Invalid identity ciphertext");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8");
}
export function isMiniappSessionExpired(expiresAt: string, now = Date.now()): boolean { return new Date(expiresAt).getTime() <= now; }

export async function exchangeWechatMiniappCode(code: string): Promise<WechatMiniappCodeExchange> {
  if (process.env.NODE_ENV === "test") {
    if (code === "mock_exchange_failure") throw new MiniappIdentityError("WECHAT_CODE_EXCHANGE_FAILED");
    return { openid: `mock-openid-${code}`, sessionKey: `mock-session-key-${code}` };
  }
  const appId = requiredEnv("WECHAT_MINIAPP_APP_ID"); const secret = requiredEnv("WECHAT_MINIAPP_APP_SECRET");
  let response: Response;
  try { response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`); } catch { throw new MiniappIdentityError("WECHAT_CODE_EXCHANGE_FAILED"); }
  const data = await response.json().catch(() => null) as { openid?: unknown; unionid?: unknown; session_key?: unknown; errcode?: unknown } | null;
  if (!response.ok || !data || typeof data.openid !== "string" || !data.openid || typeof data.session_key !== "string" || !data.session_key) throw new MiniappIdentityError("WECHAT_CODE_EXCHANGE_FAILED");
  return { openid: data.openid, unionid: typeof data.unionid === "string" ? data.unionid : undefined, sessionKey: data.session_key };
}

const exchangeWechatCode = async (code: string): Promise<WechatIdentity> => {
  const identity = await exchangeWechatMiniappCode(code);
  return { openid: identity.openid, unionid: identity.unionid };
};

export class MiniappIdentityError extends Error { constructor(readonly code: "INVALID_REQUEST" | "WECHAT_CODE_EXCHANGE_FAILED" | "WECHAT_CONFIGURATION_MISSING" | "SESSION_CREATION_FAILED" | "RATE_LIMITED") { super(code); } }

export function validateMiniappSessionRequest(code: unknown, visitorId: unknown): { code: string; visitorId: string } {
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{8,512}$/.test(code) || typeof visitorId !== "string" || !visitorPattern.test(visitorId)) throw new MiniappIdentityError("INVALID_REQUEST");
  return { code, visitorId };
}

export async function createWechatMiniappSession(input: { code: string; visitorId: string }, provider: ExchangeProvider = exchangeWechatCode): Promise<{ sessionToken: string; expiresAt: string; visitorId: string }> {
  const { code, visitorId } = validateMiniappSessionRequest(input.code, input.visitorId);
  const identity = await provider(code);
  if (!identity.openid) throw new MiniappIdentityError("WECHAT_CODE_EXCHANGE_FAILED");
  try {
    const now = new Date(); const nowText = now.toISOString(); const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
    const sessionToken = crypto.randomBytes(32).toString("base64url"); const tokenHash = hash(sessionToken); const appId = requiredEnv("WECHAT_MINIAPP_APP_ID"); const openidHash = hash(identity.openid);
    runImmediateTransaction(() => {
      const existing = db.prepare("SELECT id FROM platform_identities WHERE platform=@platform AND app_id=@appId AND openid_hash=@openidHash").get({ platform: PLATFORM, appId, openidHash }) as { id: string } | undefined;
      const identityId = existing?.id ?? nanoid();
      if (existing) db.prepare("UPDATE platform_identities SET updated_at=@now WHERE id=@id").run({ now: nowText, id: identityId });
      else db.prepare("INSERT INTO platform_identities (id,platform,app_id,openid_ciphertext,openid_hash,unionid_ciphertext,unionid_hash,created_at,updated_at) VALUES (@id,@platform,@appId,@cipher,@hash,@unionCipher,@unionHash,@now,@now)").run({ id: identityId, platform: PLATFORM, appId, cipher: encryptIdentity(identity.openid), hash: openidHash, unionCipher: identity.unionid ? encryptIdentity(identity.unionid) : null, unionHash: identity.unionid ? hash(identity.unionid) : null, now: nowText });
      db.prepare("INSERT INTO miniapp_sessions (id,token_hash,platform_identity_id,visitor_id,expires_at,revoked_at,created_at,last_seen_at) VALUES (@id,@tokenHash,@identityId,@visitorId,@expiresAt,NULL,@now,@now)").run({ id: nanoid(), tokenHash, identityId, visitorId, expiresAt, now: nowText });
    });
    return { sessionToken, expiresAt, visitorId };
  } catch (error) { if (error instanceof MiniappIdentityError) throw error; throw new MiniappIdentityError("SESSION_CREATION_FAILED"); }
}
