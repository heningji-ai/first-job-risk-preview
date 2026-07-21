process.env.GOAL_FIT_DB_PATH = `data/miniapp-identity-${Date.now()}.db`;
process.env.NODE_ENV = "test";
process.env.WECHAT_MINIAPP_APP_ID = "wx-test-app-id";
process.env.MINIAPP_IDENTITY_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const { initializeDatabase, db } = await import("./db.js");
const { createWechatMiniappSession, validateMiniappSessionRequest, MiniappIdentityError, encryptIdentity, decryptIdentity, isMiniappSessionExpired } = await import("./miniappIdentity.js");
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
initializeDatabase();
initializeDatabase();
const encryptedOne = encryptIdentity("mock-openid-encryption"); const encryptedTwo = encryptIdentity("mock-openid-encryption");
assert(encryptedOne !== encryptedTwo, "AES-GCM must use a fresh IV"); assert(decryptIdentity(encryptedOne) === "mock-openid-encryption" && decryptIdentity(encryptedTwo) === "mock-openid-encryption", "AES-GCM decrypts valid ciphertext");
try { decryptIdentity(`${encryptedOne.slice(0, -1)}x`); throw new Error("tampered ciphertext accepted"); } catch { /* expected */ }
assert(isMiniappSessionExpired(new Date(Date.now() - 1).toISOString()), "expired session detected"); assert(!isMiniappSessionExpired(new Date(Date.now() + 60_000).toISOString()), "active session detected");
const first = await createWechatMiniappSession({ code: "mock-code-123", visitorId: "visitor_12345678" });
const second = await createWechatMiniappSession({ code: "mock-code-123", visitorId: "visitor_12345678" });
assert(first.sessionToken !== second.sessionToken, "tokens must be fresh");
assert(db.prepare("SELECT COUNT(*) AS count FROM platform_identities").get() as { count: number }, "identity table exists");
const identity = db.prepare("SELECT openid_ciphertext, openid_hash FROM platform_identities").get() as { openid_ciphertext: string; openid_hash: string };
assert(!identity.openid_ciphertext.includes("mock-openid"), "openid must not be plaintext");
assert(identity.openid_hash.length === 64, "openid hash must be sha256");
const session = db.prepare("SELECT token_hash FROM miniapp_sessions LIMIT 1").get() as { token_hash: string };
assert(session.token_hash !== first.sessionToken && session.token_hash.length === 64, "raw token must not be stored");
try { validateMiniappSessionRequest("", "bad"); throw new Error("invalid input accepted"); } catch (error) { assert(error instanceof MiniappIdentityError && error.code === "INVALID_REQUEST", "invalid input error"); }
console.log("Miniapp identity tests passed.");
