import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "goal-fit-virtual-params-"));
process.env.NODE_ENV = "test";
process.env.GOAL_FIT_DB_PATH = path.join(dir, "params.db");
process.env.WECHAT_MINIAPP_APP_ID = "wx-test-app-id";
process.env.MINIAPP_IDENTITY_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.ASSESSMENT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64");
process.env.WECHAT_MINIAPP_VIRTUAL_PAYMENT_OFFER_ID = "offer-test";
process.env.WECHAT_MINIAPP_VIRTUAL_PAYMENT_ENV = "1";
process.env.WECHAT_MINIAPP_VIRTUAL_PAYMENT_APP_KEY_PROD = "prod-key-test";
process.env.WECHAT_MINIAPP_VIRTUAL_PAYMENT_APP_KEY_SANDBOX = "sandbox-key-test";

const { app } = await import("./index.js");
const { db } = await import("./db.js");
const { createWechatMiniappSession } = await import("./miniappIdentity.js");
const { buildGoalFitVirtualPaymentSignData } = await import("./miniappVirtualPayment.js");
const server = app.listen(0);
const address = server.address() as { port: number };
const base = `http://127.0.0.1:${address.port}`;
const post = (url: string, options: { headers?: Record<string, string>; body: Record<string, unknown> }) => fetch(`${base}${url}`, { method: "POST", headers: { "content-type": "application/json", ...options.headers }, body: JSON.stringify(options.body) });

const session = await createWechatMiniappSession({ code: "mock-code-123", visitorId: "visitor_params_12345678" });
const identity = db.prepare("SELECT id FROM platform_identities WHERE app_id = ?").get("wx-test-app-id") as { id: string };
const assessmentId = "asm_params_1234567890123456";
const snapshotId = "rpt_params_1234567890123456";
const now = new Date().toISOString();
db.prepare(`INSERT INTO assessments (assessment_id,platform_identity_id,visitor_id,submission_id,target_company,target_role,question_set_version,question_bank_hash,scoring_version,payload_ciphertext,payload_hash,status,completed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(assessmentId, identity.id, "visitor_params_12345678", "sub_params_12345678", "enterprise", "operations", "q", "hash", "score", "cipher", "payload", "completed", now, now, now);
const assessmentRow = db.prepare("SELECT id FROM assessments WHERE assessment_id = ?").get(assessmentId) as { id: number };
db.prepare("INSERT INTO report_snapshots (report_snapshot_id,assessment_row_id,report_version,free_result_json,full_report_ciphertext,full_report_hash,created_at) VALUES (?,?,?,?,?,?,?)").run(snapshotId, assessmentRow.id, "report", "{}", "cipher", "hash", now);

try {
  const unauthorized = await post(`/api/miniapp/goal-fit/assessments/${assessmentId}/virtual-payment-params`, { body: { code: "mock-code-123", requestId: "req_params_12345678" } });
  assert.equal(unauthorized.status, 401);

  const response = await post(`/api/miniapp/goal-fit/assessments/${assessmentId}/virtual-payment-params`, { headers: { Authorization: `Bearer ${session.sessionToken}` }, body: { code: "mock-code-123", requestId: "req_params_12345678" } });
  const responseBody = await response.json() as Record<string, any>;
  assert.equal(response.status, 200, JSON.stringify(responseBody));
  assert.deepEqual(Object.keys(responseBody).sort(), ["mode", "orderId", "paymentAttemptId", "paySig", "signData", "signature"].sort());
  assert.equal(responseBody.mode, "short_series_goods");
  assert.equal(typeof responseBody.signData, "string");
  const expected = buildGoalFitVirtualPaymentSignData({ offerId: "offer-test", env: 1, goodsPrice: 1990, providerOutTradeNo: JSON.parse(responseBody.signData).outTradeNo });
  assert.equal(responseBody.signData, expected);
  assert.equal(responseBody.paySig, crypto.createHmac("sha256", "sandbox-key-test").update(`requestVirtualPayment&${responseBody.signData}`, "utf8").digest("hex"));
  assert.equal(responseBody.signature, crypto.createHmac("sha256", "mock-session-key-mock-code-123").update(responseBody.signData, "utf8").digest("hex"));
  for (const forbidden of ["sessionKey", "session_key", "openid", "platformIdentityId", "appKey", "AppSecret"]) assert.equal(Object.hasOwn(responseBody, forbidden), false);

  const retry = await post(`/api/miniapp/goal-fit/assessments/${assessmentId}/virtual-payment-params`, { headers: { Authorization: `Bearer ${session.sessionToken}` }, body: { code: "mock-code-123", requestId: "req_params_12345678" } });
  const retryBody = await retry.json() as Record<string, any>;
  assert.equal(retry.status, 200);
  assert.equal(retryBody.paymentAttemptId, responseBody.paymentAttemptId);
  assert.equal(retryBody.orderId, responseBody.orderId);
  assert.equal(retryBody.signData, responseBody.signData);
  assert.equal(retryBody.paySig, responseBody.paySig);

  const unknown = await post(`/api/miniapp/goal-fit/assessments/${assessmentId}/virtual-payment-params`, { headers: { Authorization: `Bearer ${session.sessionToken}` }, body: { code: "mock-code-123", requestId: "req_params_87654321", env: 1 } });
  assert.equal(unknown.status, 400);

  const attempts = db.prepare("SELECT COUNT(*) AS count FROM miniapp_virtual_payment_attempts").get() as { count: number };
  const orders = db.prepare("SELECT COUNT(*) AS count FROM orders WHERE assessmentId = ?").get(assessmentId) as { count: number };
  assert.equal(attempts.count, 1);
  assert.equal(orders.count, 1);
  console.log("Goal Fit virtual payment params tests passed. auth-signing-whitelist-idempotent-side-effects=ok");
} finally {
  server.close();
  db.close();
  for (const target of [path.join(dir, "params.db"), path.join(dir, "params.db-wal"), path.join(dir, "params.db-shm"), dir]) {
    try { fs.rmSync(target, { force: true, recursive: target === dir }); } catch { /* temporary test cleanup */ }
  }
}
