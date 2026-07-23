import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

process.env.NODE_ENV = "test";
const databasePath = `data/miniapp-virtual-confirm-${Date.now()}.db`;
process.env.GOAL_FIT_DB_PATH = databasePath;
process.env.WECHAT_MINIAPP_APP_ID = "wx-confirm";
process.env.MINIAPP_IDENTITY_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");
process.env.ASSESSMENT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 12).toString("base64");
process.env.WECHAT_MINIAPP_VIRTUAL_PAYMENT_OFFER_ID = "offer-confirm";
process.env.WECHAT_MINIAPP_VIRTUAL_PAYMENT_ENV = "0";
process.env.WECHAT_MINIAPP_VIRTUAL_PAYMENT_APP_KEY_PROD = "prod-confirm-key";
process.env.WECHAT_MINIAPP_VIRTUAL_PAYMENT_APP_KEY_SANDBOX = "sandbox-confirm-key";

const { db, initializeDatabase } = await import("./db.js");
const { createWechatMiniappSession } = await import("./miniappIdentity.js");
const { encryptAssessmentData } = await import("./assessmentStore.js");
const { createOrReuseGoalFitPaymentOrder } = await import("./goalFitMiniappPaymentOrderStore.js");
const { createOrReuseGoalFitVirtualPaymentAttempt } = await import("./miniappVirtualPaymentAttempt.js");
const { queryWechatVirtualPaymentOrder } = await import("./miniappVirtualPaymentProvider.js");
const { fulfillGoalFitVirtualPayment } = await import("./goalFitVirtualPaymentFulfillment.js");

initializeDatabase();
const now = new Date("2026-07-23T08:00:00.000Z");
const session = await createWechatMiniappSession({ code: "mock-confirm-code", visitorId: "visitor_confirm_12345678" });
const identity = db.prepare("SELECT id FROM platform_identities WHERE app_id = ?").get("wx-confirm") as { id: string };
const assessmentId = "asm_confirm_1234567890123456";
const snapshotId = "rpt_confirm_1234567890123456";
db.prepare("INSERT INTO assessments (assessment_id,platform_identity_id,visitor_id,submission_id,target_company,target_role,question_set_version,question_bank_hash,scoring_version,payload_ciphertext,payload_hash,status,completed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(assessmentId, identity.id, "visitor_confirm_12345678", "sub_confirm_12345678", "D", "PM", "q", "h", "s", "payload", "ph", "completed", now.toISOString(), now.toISOString(), now.toISOString());
const row = db.prepare("SELECT id FROM assessments WHERE assessment_id = ?").get(assessmentId) as { id: number };
db.prepare("INSERT INTO report_snapshots (report_snapshot_id,assessment_row_id,report_version,free_result_json,full_report_ciphertext,full_report_hash,created_at) VALUES (?,?,?,?,?,?,?)").run(snapshotId, row.id, "report-v1", "{}", encryptAssessmentData({ assessmentId, conclusion: "frozen" }), "hash", now.toISOString());

try {
  const order = createOrReuseGoalFitPaymentOrder({ platformIdentityId: identity.id, assessmentId, now });
  const attempt = createOrReuseGoalFitVirtualPaymentAttempt({ orderId: order.orderId, platformIdentityId: identity.id, assessmentId, requestId: "req_confirm_12345678", env: 0, now });
  let sentBody = "";
  let sentUrl = "";
  const provider = await queryWechatVirtualPaymentOrder({ openid: "mock-openid-mock-confirm-code", env: 0, providerOutTradeNo: attempt.providerOutTradeNo }, { accessToken: "access-token-test", fetcher: async (url, init) => { sentUrl = url; sentBody = String(init.body); return new Response(JSON.stringify({ errcode: 0, order: { order_id: attempt.providerOutTradeNo, status: 2, order_fee: 1990, paid_fee: 1990, order_type: 0, paid_time: now.toISOString(), env_type: 1, wx_order_id: "wx-order", channel_order_id: "channel-order", wxpay_order_id: "wxpay-order", provide_time: null } }), { status: 200, headers: { "content-type": "application/json" } }); } });
  const parsedBody = JSON.parse(sentBody);
  assert.deepEqual(parsedBody, { openid: "mock-openid-mock-confirm-code", env: 0, order_id: attempt.providerOutTradeNo });
  assert.match(sentUrl, /access_token=access-token-test/);
  assert.match(sentUrl, /pay_sig=/);
  assert.equal(provider.orderId, attempt.providerOutTradeNo);

  const fulfilled = fulfillGoalFitVirtualPayment({ paymentAttemptId: attempt.id, trustedProviderResult: provider, now });
  assert.equal(fulfilled.reportAvailable, true);
  assert.equal((db.prepare("SELECT status FROM orders WHERE id = ?").get(order.orderId) as { status: string }).status, "paid");
  assert.equal((db.prepare("SELECT status FROM miniapp_virtual_payment_attempts WHERE id = ?").get(attempt.id) as { status: string }).status, "paid");
  assert.equal((db.prepare("SELECT COUNT(*) AS count FROM goal_fit_report_entitlements").get() as { count: number }).count, 1);
  const repeated = fulfillGoalFitVirtualPayment({ paymentAttemptId: attempt.id, trustedProviderResult: provider, now: new Date(now.getTime() + 1_000) });
  assert.equal(repeated.entitlementId, fulfilled.entitlementId);
  assert.equal((db.prepare("SELECT COUNT(*) AS count FROM goal_fit_report_entitlements").get() as { count: number }).count, 1);
  assert.equal(crypto.createHash("sha256").update(sentBody, "utf8").digest("hex").length, 64);
  console.log("Goal Fit virtual payment confirmation tests passed. provider-query-validation-fulfillment-entitlement-idempotency=ok");
} finally {
  db.close();
  for (const suffix of ["", "-wal", "-shm"]) { try { fs.rmSync(path.resolve(databasePath + suffix), { force: true }); } catch { /* cleanup best effort */ } }
}
