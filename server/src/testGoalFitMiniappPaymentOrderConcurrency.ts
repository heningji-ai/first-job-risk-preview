import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import {
  GOAL_FIT_PAYMENT_ORDER_TTL_MS,
  createGoalFitMiniappPaymentOrderStore,
} from "./goalFitMiniappPaymentOrderStore.js";
import { openConfiguredDatabaseConnection } from "./db.js";

type WorkerInput = {
  role: "goal-fit-order-worker";
  databasePath: string;
  platformIdentityId: string;
  assessmentId: string;
  now: string;
};

type WorkerMessage =
  | { type: "ready" }
  | { type: "result"; result: SafeResult }
  | { type: "error"; code: "ORDER_CREATE_FAILED" };

type SafeResult = {
  orderId: string;
  outTradeNo: string;
  reused: boolean;
  status: string;
  amount: number;
  currency: string;
  assessmentId: string;
  reportSnapshotId: string;
  expiresAt: string;
};

const NOW = new Date("2026-07-23T08:00:00.000Z");
const IDENTITY_ID = "identity_concurrency";
const ASSESSMENT_ID = "assessment_concurrency";
const SNAPSHOT_ID = "snapshot_concurrency";

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createDatabase(): { directory: string; databasePath: string; now: Date } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "goal-fit-order-concurrency-"));
  const databasePath = path.join(directory, "orders.db");
  const connection = openConfiguredDatabaseConnection(databasePath);

  connection.exec(`
    CREATE TABLE platform_identities (
      id TEXT PRIMARY KEY, platform TEXT NOT NULL, app_id TEXT NOT NULL,
      openid_ciphertext TEXT NOT NULL, openid_hash TEXT NOT NULL,
      unionid_ciphertext TEXT, unionid_hash TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, assessment_id TEXT NOT NULL UNIQUE,
      platform_identity_id TEXT NOT NULL, visitor_id TEXT NOT NULL, submission_id TEXT NOT NULL,
      target_company TEXT NOT NULL, target_role TEXT NOT NULL, question_set_version TEXT NOT NULL,
      question_bank_hash TEXT NOT NULL, scoring_version TEXT NOT NULL, payload_ciphertext TEXT NOT NULL,
      payload_hash TEXT NOT NULL, status TEXT NOT NULL CHECK(status = 'completed'),
      completed_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE report_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, report_snapshot_id TEXT NOT NULL UNIQUE,
      assessment_row_id INTEGER NOT NULL UNIQUE, report_version TEXT NOT NULL,
      free_result_json TEXT NOT NULL, full_report_ciphertext TEXT NOT NULL,
      full_report_hash TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE product_pricing_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT, product_key TEXT NOT NULL UNIQUE,
      base_price_cents INTEGER NOT NULL, sale_price_cents INTEGER NOT NULL,
      invite_discount_cents INTEGER NOT NULL, free_trial_enabled INTEGER NOT NULL DEFAULT 0,
      free_trial_start_at TEXT, free_trial_end_at TEXT,
      allow_invite_discount_stack INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE orders (
      id TEXT PRIMARY KEY, outTradeNo TEXT NOT NULL UNIQUE, sessionId TEXT NOT NULL,
      status TEXT NOT NULL, accessMode TEXT NOT NULL, originalAmountCents INTEGER NOT NULL,
      discountAmountCents INTEGER NOT NULL, payAmountCents INTEGER NOT NULL, couponCode TEXT,
      paymentProvider TEXT NOT NULL, paymentMode TEXT NOT NULL, wechatPrepayId TEXT,
      wechatCodeUrl TEXT, wechatTransactionId TEXT, sourceReferralCode TEXT, referralVisitId TEXT,
      analyticsVisitorId TEXT, analyticsSource TEXT, analyticsChannel TEXT, analyticsCampaign TEXT,
      analyticsReferralCode TEXT, basePriceCents INTEGER, salePriceCents INTEGER, discountCents INTEGER,
      finalAmountCents INTEGER, pricingRuleId INTEGER, pricingSnapshotJson TEXT, pricingMode TEXT,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, platformIdentityId TEXT, assessmentId TEXT,
      reportSnapshotId TEXT, orderPurpose TEXT, expiresAt TEXT, paidAt TEXT
    );
    CREATE UNIQUE INDEX uq_orders_goal_fit_pending
      ON orders (platformIdentityId, assessmentId, orderPurpose)
      WHERE orderPurpose = 'goal_fit_full_report'
        AND platformIdentityId IS NOT NULL AND assessmentId IS NOT NULL AND status = 'pending';
    CREATE TABLE report_entitlements (
      id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE, report_snapshot_id TEXT NOT NULL, created_at TEXT NOT NULL
    );
  `);

  const timestamp = NOW.toISOString();
  connection.prepare("INSERT INTO platform_identities (id, platform, app_id, openid_ciphertext, openid_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(IDENTITY_ID, "wechat_miniapp", "wx-test", "ciphertext", "hash", timestamp, timestamp);
  const assessment = connection.prepare("INSERT INTO assessments (assessment_id, platform_identity_id, visitor_id, submission_id, target_company, target_role, question_set_version, question_bank_hash, scoring_version, payload_ciphertext, payload_hash, status, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(ASSESSMENT_ID, IDENTITY_ID, "visitor", "submission", "D", "PM", "questions-v1", "question-hash", "scoring-v1", "payload-ciphertext", "payload-hash", "completed", timestamp, timestamp, timestamp);
  connection.prepare("INSERT INTO report_snapshots (report_snapshot_id, assessment_row_id, report_version, free_result_json, full_report_ciphertext, full_report_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(SNAPSHOT_ID, assessment.lastInsertRowid, "report-v1", "{}", "full-report-ciphertext", "full-report-hash", timestamp);
  connection.prepare("INSERT INTO product_pricing_rules (product_key, base_price_cents, sale_price_cents, invite_discount_cents, free_trial_enabled, allow_invite_discount_stack, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("goal_fit_report", 1990, 1990, 1000, 0, 1, 1, timestamp, timestamp);
  connection.close();
  return { directory, databasePath, now: NOW };
}

function cleanup(directory: string, databasePath: string): void {
  const targets = [databasePath, `${databasePath}-wal`, `${databasePath}-shm`, directory];
  for (const target of targets) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        fs.rmSync(target, { force: true, recursive: target === directory });
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * (attempt + 1));
      }
    }
    if (lastError) throw lastError;
  }
}

async function workerMain(): Promise<void> {
  const input = workerData as WorkerInput;
  const connection = openConfiguredDatabaseConnection(input.databasePath);
  try {
    parentPort?.postMessage({ type: "ready" } satisfies WorkerMessage);
    await new Promise<void>((resolve) => parentPort?.once("message", () => resolve()));
    const result = createGoalFitMiniappPaymentOrderStore({ connection }).createOrReuseGoalFitPaymentOrder({
      platformIdentityId: input.platformIdentityId,
      assessmentId: input.assessmentId,
      now: new Date(input.now),
    });
    parentPort?.postMessage({ type: "result", result } satisfies WorkerMessage);
  } catch {
    parentPort?.postMessage({ type: "error", code: "ORDER_CREATE_FAILED" } satisfies WorkerMessage);
    process.exitCode = 1;
  } finally {
    try { connection.exec("ROLLBACK"); } catch { /* no transaction or already rolled back */ }
    connection.close();
    parentPort?.close();
  }
}

function runWorker(input: WorkerInput): Promise<SafeResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: input });
    worker.once("message", (message: WorkerMessage) => {
      if (message.type === "result") resolve(message.result);
      else reject(new Error(message.type === "error" ? message.code : "WORKER_PROTOCOL_ERROR"));
    });
    worker.once("error", () => reject(new Error("WORKER_FAILED")));
  });
}

async function main(): Promise<void> {
  const { directory, databasePath, now } = createDatabase();
  const workers: Worker[] = [];
  let verifyConnection: ReturnType<typeof openConfiguredDatabaseConnection> | undefined;
  const safeOutput: string[] = [];
  const originalConsole = console.error;
  console.error = (...args: unknown[]) => safeOutput.push(args.map(String).join(" "));

  try {
    const readyPromises: Promise<void>[] = [];
    const resultPromises: Promise<SafeResult>[] = [];
    const exitPromises: Promise<void>[] = [];
    for (let index = 0; index < 3; index += 1) {
      const worker = new Worker(new URL(import.meta.url), {
        workerData: {
          role: "goal-fit-order-worker",
          databasePath,
          platformIdentityId: IDENTITY_ID,
          assessmentId: ASSESSMENT_ID,
          now: now.toISOString(),
        } satisfies WorkerInput,
      });
      workers.push(worker);
      exitPromises.push(new Promise<void>((resolve, reject) => {
        worker.once("exit", (code) => code === 0 ? resolve() : reject(new Error("WORKER_FAILED")));
      }));
      readyPromises.push(new Promise<void>((resolve, reject) => {
        worker.once("message", (message: WorkerMessage) => message.type === "ready" ? resolve() : reject(new Error("WORKER_NOT_READY")));
        worker.once("error", () => reject(new Error("WORKER_FAILED")));
      }));
      resultPromises.push(new Promise<SafeResult>((resolve, reject) => {
        worker.on("message", (message: WorkerMessage) => {
          if (message.type === "result") resolve(message.result);
          if (message.type === "error") reject(new Error(message.code));
        });
        worker.once("error", () => reject(new Error("WORKER_FAILED")));
      }));
    }

    await Promise.all(readyPromises);
    for (const worker of workers) worker.postMessage({ type: "start" });
    const results = await Promise.all(resultPromises);
    await Promise.all(exitPromises);
    const orderIds = new Set(results.map((result) => result.orderId));
    const outTradeNos = new Set(results.map((result) => result.outTradeNo));
    assert.equal(orderIds.size, 1);
    assert.equal(outTradeNos.size, 1);
    assert.equal(results.filter((result) => result.reused === false).length, 1);
    assert.equal(results.filter((result) => result.reused === true).length, 2);
    for (const result of results) {
      assert.equal(result.assessmentId, ASSESSMENT_ID);
      assert.equal(result.reportSnapshotId, SNAPSHOT_ID);
      assert.equal(result.amount, 1990);
      assert.equal(result.currency, "CNY");
      assert.equal(result.status, "pending");
      assert.equal(result.expiresAt, new Date(now.getTime() + GOAL_FIT_PAYMENT_ORDER_TTL_MS).toISOString());
    }

    verifyConnection = openConfiguredDatabaseConnection(databasePath);
    const orders = verifyConnection.prepare("SELECT id, outTradeNo, status, platformIdentityId, assessmentId, reportSnapshotId, orderPurpose, payAmountCents FROM orders").all() as Array<Record<string, unknown>>;
    const assessments = verifyConnection.prepare("SELECT * FROM assessments").all();
    const snapshots = verifyConnection.prepare("SELECT * FROM report_snapshots").all();
    assert.equal(orders.length, 1);
    assert.equal(orders[0].id, [...orderIds][0]);
    assert.equal(orders[0].outTradeNo, [...outTradeNos][0]);
    assert.equal(orders[0].status, "pending");
    assert.equal(orders[0].platformIdentityId, IDENTITY_ID);
    assert.equal(orders[0].assessmentId, ASSESSMENT_ID);
    assert.equal(orders[0].reportSnapshotId, SNAPSHOT_ID);
    assert.equal(orders[0].orderPurpose, "goal_fit_full_report");
    assert.equal(orders[0].payAmountCents, 1990);
    assert.equal((verifyConnection.prepare("SELECT COUNT(*) AS count FROM report_entitlements").get() as { count: number }).count, 0);
    assert.equal(assessments.length, 1);
    assert.equal(snapshots.length, 1);
    verifyConnection.close();
    verifyConnection = undefined;
    console.log(`Goal Fit concurrency tests passed. workers=3 connections=3 orders=1 pending=1 reused=false:1 reused=true:2 orderId=${[...orderIds][0]}`);
  } finally {
    console.error = originalConsole;
    try { verifyConnection?.close(); } catch { /* cleanup */ }
    await Promise.all(workers.map(async (worker) => { try { await worker.terminate(); } catch { /* cleanup */ } }));
    cleanup(directory, databasePath);
    assert.equal(safeOutput.some((line) => /SQLITE|SQL|stack|openid|answers|fullReport|databasePath|\.db/i.test(line)), false);
  }
}

if (!isMainThread && (workerData as WorkerInput | undefined)?.role === "goal-fit-order-worker") {
  workerMain().catch(() => { parentPort?.postMessage({ type: "error", code: "ORDER_CREATE_FAILED" } satisfies WorkerMessage); process.exitCode = 1; });
} else {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
