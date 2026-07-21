process.env.GOAL_FIT_DB_PATH = `data/miniapp-route-${Date.now()}.db`;
process.env.NODE_ENV = "test"; process.env.WECHAT_MINIAPP_APP_ID = "wx-test-app-id"; process.env.WECHAT_MINIAPP_APP_SECRET = "TEST_SENSITIVE_APP_SECRET"; process.env.MINIAPP_IDENTITY_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
const sensitive = ["TEST_SENSITIVE_LOGIN_CODE", "TEST_SENSITIVE_OPENID", "TEST_SENSITIVE_UNIONID", "TEST_SENSITIVE_SESSION_TOKEN", "TEST_SENSITIVE_APP_SECRET", "TEST_SENSITIVE_ENCRYPTION_KEY"];
const logs: string[] = []; const originals = { log: console.log, info: console.info, warn: console.warn, error: console.error };
for (const key of Object.keys(originals) as Array<keyof typeof originals>) console[key] = (...args: unknown[]) => logs.push(args.map(String).join(" "));
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
try {
  const { app, resetMiniappRateLimitForTest } = await import("./index.js"); const server = app.listen(0); const address = server.address(); const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  const post = (body: unknown) => fetch(`${base}/api/miniapp/wechat/session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  try {
    let response = await post({ code: "TEST_SENSITIVE_LOGIN_CODE", visitorId: "visitor_12345678" }); let payload = await response.json() as Record<string, unknown>;
    assert(response.status === 200 && response.headers.get("cache-control") === "no-store", "success must be 200 no-store"); assert(typeof payload.sessionToken === "string" && typeof payload.expiresAt === "string" && payload.visitorId === "visitor_12345678", "safe response fields"); for (const key of ["openid", "unionid", "openidHash", "unionidHash", "platformIdentityId", "identityId", "id"]) assert(!(key in payload), `response leaks ${key}`);
    for (const invalid of [{ code: "bad", visitorId: "visitor_12345678" }, { code: "mock-valid-code", visitorId: "bad" }]) { response = await post(invalid); payload = await response.json() as Record<string, unknown>; assert(response.status === 400 && payload.error === "INVALID_REQUEST", "invalid request must be 400 INVALID_REQUEST"); }
    response = await post({ code: "mock_exchange_failure", visitorId: "visitor_12345678" }); payload = await response.json() as Record<string, unknown>; assert(response.status === 500 && payload.error === "WECHAT_CODE_EXCHANGE_FAILED", "exchange failure is safe");
    const appId = process.env.WECHAT_MINIAPP_APP_ID; delete process.env.WECHAT_MINIAPP_APP_ID; response = await post({ code: "mock-configuration", visitorId: "visitor_12345678" }); payload = await response.json() as Record<string, unknown>; assert(response.status === 500 && payload.error === "WECHAT_CONFIGURATION_MISSING", "configuration failure is safe"); process.env.WECHAT_MINIAPP_APP_ID = appId;
    resetMiniappRateLimitForTest(); for (let index = 0; index < 20; index++) { response = await post({ code: `mock-limit-${index}`, visitorId: "visitor_12345678" }); assert(response.status === 200, `request ${index + 1} should pass`); }
    response = await post({ code: "mock-limit-21", visitorId: "visitor_12345678" }); payload = await response.json() as Record<string, unknown>; assert(response.status === 429 && payload.error === "RATE_LIMITED", "21st request rate limited"); assert(!("stack" in payload) && !sensitive.some(value => JSON.stringify(payload).includes(value)), "error response leaks sensitive data");
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  assert(!logs.some(line => sensitive.some(value => line.includes(value))), "sensitive identity data leaked to logs");
} finally { for (const key of Object.keys(originals) as Array<keyof typeof originals>) console[key] = originals[key]; }
console.log("Miniapp session HTTP route and sensitive log tests passed.");
