import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { openConfiguredDatabaseConnection } from "./db.js";
import { GOAL_FIT_PAYMENT_ORDER_TTL_MS, GoalFitPaymentOrderError, createGoalFitMiniappPaymentOrderStore } from "./goalFitMiniappPaymentOrderStore.js";

type Input = { role: "expired-worker"; databasePath: string; identity: string; assessment: string; now: string };
type Result = { type: "ready" } | { type: "result"; result: SafeResult } | { type: "error"; code: string };
type SafeResult = { orderId: string; outTradeNo: string; reused: boolean; status: string; amount: number; currency: string; assessmentId: string; reportSnapshotId: string; expiresAt: string };

const now = new Date("2026-07-23T08:00:00.000Z");
const identity = "identity_expired_concurrency";
const assessment = "assessment_expired_concurrency";
const snapshot = "snapshot_expired_concurrency";
const oldOrderId = "expired_order_original";
const oldOutTradeNo = "GF_EXPIRED_ORIGINAL";

function schema(connection: ReturnType<typeof openConfiguredDatabaseConnection>): void {
  connection.exec(`
    CREATE TABLE platform_identities (id TEXT PRIMARY KEY, platform TEXT NOT NULL, app_id TEXT NOT NULL, openid_ciphertext TEXT NOT NULL, openid_hash TEXT NOT NULL, unionid_ciphertext TEXT, unionid_hash TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE assessments (id INTEGER PRIMARY KEY AUTOINCREMENT, assessment_id TEXT NOT NULL UNIQUE, platform_identity_id TEXT NOT NULL, visitor_id TEXT NOT NULL, submission_id TEXT NOT NULL, target_company TEXT NOT NULL, target_role TEXT NOT NULL, question_set_version TEXT NOT NULL, question_bank_hash TEXT NOT NULL, scoring_version TEXT NOT NULL, payload_ciphertext TEXT NOT NULL, payload_hash TEXT NOT NULL, status TEXT NOT NULL CHECK(status='completed'), completed_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE report_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, report_snapshot_id TEXT NOT NULL UNIQUE, assessment_row_id INTEGER NOT NULL UNIQUE, report_version TEXT NOT NULL, free_result_json TEXT NOT NULL, full_report_ciphertext TEXT NOT NULL, full_report_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE product_pricing_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, product_key TEXT NOT NULL UNIQUE, base_price_cents INTEGER NOT NULL, sale_price_cents INTEGER NOT NULL, invite_discount_cents INTEGER NOT NULL, free_trial_enabled INTEGER NOT NULL DEFAULT 0, free_trial_start_at TEXT, free_trial_end_at TEXT, allow_invite_discount_stack INTEGER NOT NULL DEFAULT 1, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE orders (id TEXT PRIMARY KEY, outTradeNo TEXT NOT NULL UNIQUE, sessionId TEXT NOT NULL, status TEXT NOT NULL, accessMode TEXT NOT NULL, originalAmountCents INTEGER NOT NULL, discountAmountCents INTEGER NOT NULL, payAmountCents INTEGER NOT NULL, couponCode TEXT, paymentProvider TEXT NOT NULL, paymentMode TEXT NOT NULL, wechatPrepayId TEXT, wechatCodeUrl TEXT, wechatTransactionId TEXT, sourceReferralCode TEXT, referralVisitId TEXT, analyticsVisitorId TEXT, analyticsSource TEXT, analyticsChannel TEXT, analyticsCampaign TEXT, analyticsReferralCode TEXT, basePriceCents INTEGER, salePriceCents INTEGER, discountCents INTEGER, finalAmountCents INTEGER, pricingRuleId INTEGER, pricingSnapshotJson TEXT, pricingMode TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, platformIdentityId TEXT, assessmentId TEXT, reportSnapshotId TEXT, orderPurpose TEXT, expiresAt TEXT, paidAt TEXT);
    CREATE UNIQUE INDEX uq_orders_goal_fit_pending ON orders (platformIdentityId, assessmentId, orderPurpose) WHERE orderPurpose='goal_fit_full_report' AND platformIdentityId IS NOT NULL AND assessmentId IS NOT NULL AND status='pending';
    CREATE TABLE report_entitlements (id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE, report_snapshot_id TEXT NOT NULL, created_at TEXT NOT NULL);
  `);
  const t = now.toISOString();
  connection.prepare("INSERT INTO platform_identities VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(identity, "wechat_miniapp", "wx", "cipher", "hash", null, null, t, t);
  const a = connection.prepare("INSERT INTO assessments (assessment_id,platform_identity_id,visitor_id,submission_id,target_company,target_role,question_set_version,question_bank_hash,scoring_version,payload_ciphertext,payload_hash,status,completed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(assessment, identity, "visitor", "submission", "D", "PM", "q", "qh", "s", "payload", "ph", "completed", t, t, t);
  connection.prepare("INSERT INTO report_snapshots (report_snapshot_id,assessment_row_id,report_version,free_result_json,full_report_ciphertext,full_report_hash,created_at) VALUES (?,?,?,?,?,?,?)").run(snapshot, a.lastInsertRowid, "report-v1", "{}", "ciphertext", "hash", t);
  connection.prepare("INSERT INTO product_pricing_rules (product_key,base_price_cents,sale_price_cents,invite_discount_cents,free_trial_enabled,allow_invite_discount_stack,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("goal_fit_report", 1990, 1990, 1000, 0, 1, 1, t, t);
}

function insertOrder(connection: ReturnType<typeof openConfiguredDatabaseConnection>, values: { id: string; outTradeNo: string; status: string; expiresAt: string }): void {
  const t = now.toISOString();
  connection.prepare(`INSERT INTO orders (id,outTradeNo,sessionId,status,accessMode,originalAmountCents,discountAmountCents,payAmountCents,paymentProvider,paymentMode,createdAt,updatedAt,platformIdentityId,assessmentId,reportSnapshotId,orderPurpose,expiresAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(values.id, values.outTradeNo, identity, values.status, "direct", 1990, 0, 1990, "wechat", "jsapi", t, t, identity, assessment, snapshot, "goal_fit_full_report", values.expiresAt);
}

function cleanup(directory: string, file: string): void {
  for (const target of [file, `${file}-wal`, `${file}-shm`, directory]) {
    try { fs.rmSync(target, { force: true, recursive: target === directory }); } catch { /* best-effort temp cleanup */ }
  }
}

async function workerMain(): Promise<void> {
  const input = workerData as Input;
  const connection = openConfiguredDatabaseConnection(input.databasePath);
  try {
    parentPort?.postMessage({ type: "ready" } satisfies Result);
    await new Promise<void>((resolve) => parentPort?.once("message", resolve));
    const result = createGoalFitMiniappPaymentOrderStore({ connection }).createOrReuseGoalFitPaymentOrder({ platformIdentityId: input.identity, assessmentId: input.assessment, now: new Date(input.now) });
    parentPort?.postMessage({ type: "result", result } satisfies Result);
  } catch (error) {
    parentPort?.postMessage({ type: "error", code: error instanceof GoalFitPaymentOrderError ? error.code : "ORDER_CREATE_FAILED" } satisfies Result);
    if (!(error instanceof GoalFitPaymentOrderError)) process.exitCode = 1;
  } finally {
    try { connection.exec("ROLLBACK"); } catch { /* no open transaction */ }
    connection.close();
    parentPort?.close();
  }
}

async function runScenario(withPaid: boolean): Promise<void> {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "goal-fit-expired-concurrency-"));
  const file = path.join(directory, "orders.db");
  const connection = openConfiguredDatabaseConnection(file);
  schema(connection);
  const oldExpiresAt = new Date(now.getTime() - 1000).toISOString();
  insertOrder(connection, { id: oldOrderId, outTradeNo: oldOutTradeNo, status: "pending", expiresAt: oldExpiresAt });
  if (withPaid) insertOrder(connection, { id: "paid_order", outTradeNo: "GF_PAID_ORDER", status: "paid", expiresAt: new Date(now.getTime() + 1800000).toISOString() });
  connection.close();
  const workers: Worker[] = [];
  const results: SafeResult[] = [];
  const errors: string[] = [];
  try {
    const ready: Promise<void>[] = [];
    const finished: Promise<void>[] = [];
    for (let i = 0; i < 3; i += 1) {
      const worker = new Worker(new URL(import.meta.url), { workerData: { role: "expired-worker", databasePath: file, identity, assessment, now: now.toISOString() } satisfies Input });
      workers.push(worker);
      ready.push(new Promise((resolve, reject) => { worker.once("message", (message: Result) => message.type === "ready" ? resolve() : reject(new Error("WORKER_NOT_READY"))); worker.once("error", () => reject(new Error("WORKER_FAILED"))); }));
      finished.push(new Promise((resolve, reject) => { worker.on("message", (message: Result) => { if (message.type === "result") results.push(message.result); if (message.type === "error") errors.push(message.code); }); worker.once("exit", (code) => code === 0 ? resolve() : reject(new Error("WORKER_FAILED"))); worker.once("error", () => reject(new Error("WORKER_FAILED"))); }));
    }
    await Promise.all(ready);
    for (const worker of workers) worker.postMessage({ type: "start" });
    await Promise.all(finished);
    const verify = openConfiguredDatabaseConnection(file);
    const orders = verify.prepare("SELECT id,outTradeNo,status,payAmountCents,platformIdentityId,assessmentId,reportSnapshotId,orderPurpose,expiresAt FROM orders ORDER BY createdAt,id").all() as Array<Record<string, unknown>>;
    assert.equal(orders.length, withPaid ? 2 : 2);
    const original = orders.find((order) => order.id === oldOrderId)!;
    assert.equal(original.status, withPaid ? "pending" : "expired");
    assert.equal(original.outTradeNo, oldOutTradeNo);
    if (withPaid) {
      assert.equal(errors.length, 3);
      assert.deepEqual(errors, ["ALREADY_PURCHASED", "ALREADY_PURCHASED", "ALREADY_PURCHASED"]);
      assert.equal(orders.filter((order) => order.status === "pending").length, 1);
      assert.equal(orders.filter((order) => order.status === "paid").length, 1);
    } else {
      assert.equal(results.length, 3);
      assert.equal(new Set(results.map((result) => result.orderId)).size, 1);
      assert.equal(new Set(results.map((result) => result.outTradeNo)).size, 1);
      assert.equal(results.filter((result) => !result.reused).length, 1);
      assert.equal(results.filter((result) => result.reused).length, 2);
      const fresh = orders.filter((order) => order.status === "pending");
      assert.equal(fresh.length, 1);
      assert.equal(fresh[0].payAmountCents, 1990);
      assert.equal(fresh[0].platformIdentityId, identity);
      assert.equal(fresh[0].assessmentId, assessment);
      assert.equal(fresh[0].reportSnapshotId, snapshot);
      assert.equal(fresh[0].orderPurpose, "goal_fit_full_report");
      assert.equal(fresh[0].expiresAt, new Date(now.getTime() + GOAL_FIT_PAYMENT_ORDER_TTL_MS).toISOString());
    }
    assert.equal((verify.prepare("SELECT COUNT(*) AS count FROM report_entitlements").get() as { count: number }).count, 0);
    verify.close();
    console.log(`Goal Fit expired concurrency scenario passed. paid=${withPaid} workers=3 orders=${orders.length} pending=${orders.filter((order) => order.status === "pending").length}`);
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
    cleanup(directory, file);
  }
}

async function main(): Promise<void> {
  await runScenario(false);
  await runScenario(true);
}

if (!isMainThread && (workerData as Input | undefined)?.role === "expired-worker") workerMain().catch(() => { parentPort?.postMessage({ type: "error", code: "ORDER_CREATE_FAILED" } satisfies Result); process.exitCode = 1; });
else main().catch((error) => { console.error(error); process.exitCode = 1; });
