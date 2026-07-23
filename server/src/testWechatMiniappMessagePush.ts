import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

process.env.NODE_ENV = "test";
const databasePath = `data/message-push-${Date.now()}.db`;
process.env.GOAL_FIT_DB_PATH = databasePath;
process.env.WECHAT_MINIAPP_APP_ID = "wx-message-push";
process.env.MINIAPP_IDENTITY_ENCRYPTION_KEY = Buffer.alloc(32, 13).toString("base64");
process.env.ASSESSMENT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 14).toString("base64");
process.env.WECHAT_MINIAPP_MESSAGE_TOKEN = "messagetokentest";
process.env.WECHAT_MINIAPP_MESSAGE_ENCODING_AES_KEY = Buffer.alloc(32, 15).toString("base64").replace(/=+$/, "").slice(0, 43);

const { app } = await import("./index.js");
const { db } = await import("./db.js");
const { createWechatMiniappSession } = await import("./miniappIdentity.js");
const { encryptAssessmentData } = await import("./assessmentStore.js");
const { createOrReuseGoalFitPaymentOrder } = await import("./goalFitMiniappPaymentOrderStore.js");
const { createOrReuseGoalFitVirtualPaymentAttempt } = await import("./miniappVirtualPaymentAttempt.js");

function sha1(value: string): string { return crypto.createHash("sha1").update(value, "utf8").digest("hex"); }
function encryptMessage(message: string): string {
  const key = Buffer.from(`${process.env.WECHAT_MINIAPP_MESSAGE_ENCODING_AES_KEY}=`, "base64");
  const raw = Buffer.concat([crypto.randomBytes(16), Buffer.alloc(4), Buffer.from(message, "utf8"), Buffer.from(process.env.WECHAT_MINIAPP_APP_ID!, "utf8")]);
  raw.writeUInt32BE(Buffer.byteLength(message, "utf8"), 16);
  const padding = 32 - (raw.length % 32 || 32);
  const padded = Buffer.concat([raw, Buffer.alloc(padding, padding)]);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded), cipher.final()]).toString("base64");
}

const identitySession = await createWechatMiniappSession({ code: "mock-push-code", visitorId: "visitor_push_12345678" });
const identity = db.prepare("SELECT id FROM platform_identities WHERE app_id = ?").get("wx-message-push") as { id: string };
const assessmentId = "asm_push_1234567890123456";
const now = new Date("2026-07-23T08:00:00.000Z");
db.prepare("INSERT INTO assessments (assessment_id,platform_identity_id,visitor_id,submission_id,target_company,target_role,question_set_version,question_bank_hash,scoring_version,payload_ciphertext,payload_hash,status,completed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(assessmentId, identity.id, "visitor_push_12345678", "sub_push_12345678", "D", "PM", "q", "h", "s", "payload", "ph", "completed", now.toISOString(), now.toISOString(), now.toISOString());
const row = db.prepare("SELECT id FROM assessments WHERE assessment_id = ?").get(assessmentId) as { id: number };
db.prepare("INSERT INTO report_snapshots (report_snapshot_id,assessment_row_id,report_version,free_result_json,full_report_ciphertext,full_report_hash,created_at) VALUES (?,?,?,?,?,?,?)").run("rpt_push_1234567890123456", row.id, "report", "{}", encryptAssessmentData({ ok: true }), "hash", now.toISOString());
const order = createOrReuseGoalFitPaymentOrder({ platformIdentityId: identity.id, assessmentId, now });
const attempt = createOrReuseGoalFitVirtualPaymentAttempt({ orderId: order.orderId, platformIdentityId: identity.id, assessmentId, requestId: "req_push_12345678", env: 0, now });
const timestamp = "1784803200";
const nonce = "pushnonce";
const event = JSON.stringify({ MsgType: "event", Event: "xpay_goods_deliver_notify", OpenId: "mock-openid-mock-push-code", OutTradeNo: attempt.providerOutTradeNo, Env: 0, GoodsInfo: { ProductId: "goal_fit_full_report", Quantity: 1, OrigPrice: 1990, ActualPrice: 1990, Attach: attempt.providerOutTradeNo }, WeChatPayInfo: { TransactionId: "wx-tx-push", PaidTime: now.toISOString() }, TeamInfo: { ignored: true } });
const encrypted = encryptMessage(event);
const signature = sha1([process.env.WECHAT_MINIAPP_MESSAGE_TOKEN!, timestamp, nonce, encrypted].sort().join(""));
const server = app.listen(0);
const address = server.address() as { port: number };
const base = `http://127.0.0.1:${address.port}`;

try {
  const getSignature = sha1([process.env.WECHAT_MINIAPP_MESSAGE_TOKEN!, timestamp, nonce].sort().join(""));
  const getResponse = await fetch(`${base}/api/miniapp/wechat/message-push?signature=${getSignature}&timestamp=${timestamp}&nonce=${nonce}&echostr=echo-test`);
  assert.equal(getResponse.status, 200); assert.equal(await getResponse.text(), "echo-test"); assert.match(getResponse.headers.get("content-type") ?? "", /text\/plain/);
  const postUrl = `${base}/api/miniapp/wechat/message-push?msg_signature=${signature}&timestamp=${timestamp}&nonce=${nonce}&encrypt_type=aes`;
  const post = () => fetch(postUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ToUserName: "ignored", Encrypt: encrypted }) });
  const first = await post(); assert.equal(first.status, 200); assert.equal(await first.text(), "success");
  const second = await post(); assert.equal(second.status, 200); assert.equal(await second.text(), "success");
  assert.equal((db.prepare("SELECT COUNT(*) AS count FROM goal_fit_report_entitlements").get() as { count: number }).count, 1);
  assert.equal((db.prepare("SELECT status, provider_delivery_state FROM miniapp_virtual_payment_attempts WHERE id = ?").get(attempt.id) as { status: string; provider_delivery_state: string }).status, "paid");
  const bad = await fetch(`${base}/api/miniapp/wechat/message-push?msg_signature=bad&timestamp=${timestamp}&nonce=${nonce}&encrypt_type=aes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ Encrypt: encrypted }) });
  assert.equal(bad.status, 403);
  console.log("Wechat miniapp message push tests passed. get-signature-aes-appid-event-validation-idempotent-fulfillment=ok");
} finally {
  server.close(); db.close();
  for (const suffix of ["", "-wal", "-shm"]) { try { fs.rmSync(path.resolve(databasePath + suffix), { force: true }); } catch { /* cleanup best effort */ } }
}
