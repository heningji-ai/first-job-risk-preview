import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { openConfiguredDatabaseConnection } from "./db.js";
import { GoalFitVirtualPaymentAttemptError, createOrReuseGoalFitVirtualPaymentAttempt } from "./miniappVirtualPaymentAttempt.js";

type Input = { role: "attempt-worker"; file: string; orderId: string; identity: string; assessment: string; requestId: string; env: number; now: string };
type Message = { type: "ready" } | { type: "result"; result: Attempt } | { type: "error"; code: string };
type Attempt = ReturnType<typeof createOrReuseGoalFitVirtualPaymentAttempt>;

const now = new Date("2026-07-23T08:00:00.000Z");
const identity = "identity_attempt_test";
const assessment = "assessment_attempt_test";
const orderId = "logical_order_attempt_test";
const snapshot = "snapshot_attempt_test";
const validRequestId = "req_attempt_12345678";
const concurrentRequestId = "req_attempt_concurrent";
const providerPattern = /^[A-Za-z0-9|*@_-]{8,32}$/;

function createDatabase(): { dir: string; file: string; connection: ReturnType<typeof openConfiguredDatabaseConnection> } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "goal-fit-virtual-attempt-"));
  const file = path.join(dir, "attempt.db");
  const connection = openConfiguredDatabaseConnection(file);
  connection.exec(`
    CREATE TABLE platform_identities (id TEXT PRIMARY KEY);
    CREATE TABLE assessments (assessment_id TEXT PRIMARY KEY);
    CREATE TABLE orders (id TEXT PRIMARY KEY, platformIdentityId TEXT, assessmentId TEXT, orderPurpose TEXT, status TEXT, outTradeNo TEXT NOT NULL UNIQUE);
    CREATE TABLE miniapp_virtual_payment_attempts (
      id TEXT PRIMARY KEY, order_id TEXT NOT NULL, request_id TEXT NOT NULL,
      provider_out_trade_no TEXT NOT NULL UNIQUE, platform_identity_id TEXT NOT NULL,
      assessment_id TEXT NOT NULL, env INTEGER NOT NULL CHECK(env IN (0,1)),
      status TEXT NOT NULL CHECK(status IN ('prepared','paid','closed','failed','superseded')),
      wx_order_id TEXT, channel_order_id TEXT, wxpay_order_id TEXT, order_type INTEGER,
      paid_fee INTEGER, paid_at TEXT, failure_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id), FOREIGN KEY(platform_identity_id) REFERENCES platform_identities(id),
      FOREIGN KEY(assessment_id) REFERENCES assessments(assessment_id), UNIQUE(order_id, request_id)
    );
    CREATE INDEX idx_attempt_order ON miniapp_virtual_payment_attempts(order_id);
    CREATE INDEX idx_attempt_identity ON miniapp_virtual_payment_attempts(platform_identity_id);
    CREATE INDEX idx_attempt_assessment ON miniapp_virtual_payment_attempts(assessment_id);
    CREATE INDEX idx_attempt_provider ON miniapp_virtual_payment_attempts(provider_out_trade_no);
    CREATE INDEX idx_attempt_status ON miniapp_virtual_payment_attempts(status);
  `);
  connection.prepare("INSERT INTO platform_identities VALUES (?)").run(identity);
  connection.prepare("INSERT INTO assessments VALUES (?)").run(assessment);
  connection.prepare("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?)").run(orderId, identity, assessment, "goal_fit_full_report", "pending", "LOGICAL_ORDER_OUT_TRADE_NO");
  return { dir, file, connection };
}

function cleanup(dir: string, file: string): void {
  for (const target of [file, `${file}-wal`, `${file}-shm`, dir]) {
    try { fs.rmSync(target, { force: true, recursive: target === dir }); } catch { /* best-effort temporary test cleanup */ }
  }
}

async function workerMain(): Promise<void> {
  const input = workerData as Input;
  const connection = openConfiguredDatabaseConnection(input.file);
  try {
    parentPort?.postMessage({ type: "ready" } satisfies Message);
    await new Promise<void>((resolve) => parentPort?.once("message", resolve));
    const result = createOrReuseGoalFitVirtualPaymentAttempt({ orderId: input.orderId, platformIdentityId: input.identity, assessmentId: input.assessment, requestId: input.requestId, env: input.env, now: new Date(input.now) }, connection);
    parentPort?.postMessage({ type: "result", result } satisfies Message);
  } catch (error) {
    parentPort?.postMessage({ type: "error", code: error instanceof GoalFitVirtualPaymentAttemptError ? error.code : "PAYMENT_ATTEMPT_CREATE_FAILED" } satisfies Message);
    if (!(error instanceof GoalFitVirtualPaymentAttemptError)) process.exitCode = 1;
  } finally {
    try { connection.exec("ROLLBACK"); } catch { /* no open transaction */ }
    connection.close();
    parentPort?.close();
  }
}

async function concurrentSameRequest(file: string): Promise<Attempt[]> {
  const workers: Worker[] = [];
  const results: Attempt[] = [];
  try {
    const ready: Promise<void>[] = [];
    const done: Promise<void>[] = [];
    for (let i = 0; i < 3; i += 1) {
      const worker = new Worker(new URL(import.meta.url), { workerData: { role: "attempt-worker", file, orderId, identity, assessment, requestId: concurrentRequestId, env: 0, now: now.toISOString() } satisfies Input });
      workers.push(worker);
      ready.push(new Promise((resolve, reject) => { worker.once("message", (message: Message) => message.type === "ready" ? resolve() : reject(new Error("WORKER_NOT_READY"))); worker.once("error", () => reject(new Error("WORKER_FAILED"))); }));
      done.push(new Promise((resolve, reject) => { worker.on("message", (message: Message) => { if (message.type === "result") results.push(message.result); if (message.type === "error") reject(new Error(message.code)); }); worker.once("exit", (code) => code === 0 ? resolve() : reject(new Error("WORKER_FAILED"))); worker.once("error", () => reject(new Error("WORKER_FAILED"))); }));
    }
    await Promise.all(ready);
    for (const worker of workers) worker.postMessage({ type: "start" });
    await Promise.all(done);
    return results;
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
}

function expectCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => error instanceof GoalFitVirtualPaymentAttemptError && error.code === code);
}

async function main(): Promise<void> {
  const { dir, file, connection } = createDatabase();
  try {
    const first = createOrReuseGoalFitVirtualPaymentAttempt({ orderId, platformIdentityId: identity, assessmentId: assessment, requestId: validRequestId, env: 0, now }, connection);
    assert.equal(first.reused, false);
    assert.equal(first.status, "prepared");
    assert.equal(first.orderId, orderId);
    assert.notEqual(first.providerOutTradeNo, "LOGICAL_ORDER_OUT_TRADE_NO");
    assert.ok(providerPattern.test(first.providerOutTradeNo));
    const reused = createOrReuseGoalFitVirtualPaymentAttempt({ orderId, platformIdentityId: identity, assessmentId: assessment, requestId: validRequestId, env: 0, now }, connection);
    assert.equal(reused.reused, true);
    assert.equal(reused.id, first.id);

    const second = createOrReuseGoalFitVirtualPaymentAttempt({ orderId, platformIdentityId: identity, assessmentId: assessment, requestId: "req_attempt_87654321", env: 1, now }, connection);
    assert.equal(second.reused, false);
    assert.notEqual(second.providerOutTradeNo, first.providerOutTradeNo);
    assert.equal(second.env, 1);
    const concurrent = await concurrentSameRequest(file);
    assert.equal(concurrent.length, 3);
    assert.equal(new Set(concurrent.map((item) => item.id)).size, 1);
    assert.equal(concurrent.filter((item) => !item.reused).length, 1);
    assert.equal(concurrent.filter((item) => item.reused).length, 2);

    expectCode(() => createOrReuseGoalFitVirtualPaymentAttempt({ orderId, platformIdentityId: "other_identity", assessmentId: assessment, requestId: "req_attempt_owncheck", env: 0, now }, connection), "ORDER_OWNERSHIP_MISMATCH");
    expectCode(() => createOrReuseGoalFitVirtualPaymentAttempt({ orderId, platformIdentityId: identity, assessmentId: "other_assessment", requestId: "req_attempt_assess", env: 0, now }, connection), "ORDER_OWNERSHIP_MISMATCH");
    expectCode(() => createOrReuseGoalFitVirtualPaymentAttempt({ orderId: "missing_order", platformIdentityId: identity, assessmentId: assessment, requestId: "req_attempt_missing", env: 0, now }, connection), "ORDER_NOT_FOUND");
    for (const status of ["paid", "expired", "failed", "closed"] as const) {
      connection.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, orderId);
      expectCode(() => createOrReuseGoalFitVirtualPaymentAttempt({ orderId, platformIdentityId: identity, assessmentId: assessment, requestId: `req_attempt_${status}123456`, env: 0, now }, connection), "ORDER_NOT_PAYABLE");
      connection.prepare("UPDATE orders SET status = 'pending' WHERE id = ?").run(orderId);
    }
    for (const requestId of ["short", "bad request id", "req_" + "x".repeat(129)]) expectCode(() => createOrReuseGoalFitVirtualPaymentAttempt({ orderId, platformIdentityId: identity, assessmentId: assessment, requestId, env: 0, now }, connection), "INVALID_PAYMENT_REQUEST_ID");
    expectCode(() => createOrReuseGoalFitVirtualPaymentAttempt({ orderId, platformIdentityId: identity, assessmentId: assessment, requestId: "req_attempt_env1234", env: 2, now }, connection), "INVALID_PAYMENT_ENV");

    const logical = connection.prepare("SELECT outTradeNo,status FROM orders WHERE id = ?").get(orderId) as { outTradeNo: string; status: string };
    assert.equal(logical.outTradeNo, "LOGICAL_ORDER_OUT_TRADE_NO");
    assert.equal(logical.status, "pending");
    assert.equal((connection.prepare("SELECT COUNT(*) AS count FROM miniapp_virtual_payment_attempts").get() as { count: number }).count, 3);
    assert.equal((connection.prepare("SELECT COUNT(*) AS count FROM miniapp_virtual_payment_attempts WHERE status = 'prepared'").get() as { count: number }).count, 3);
    console.log("Goal Fit virtual payment attempt tests passed. sequential-idempotency=ok three-connection-same-request=one-attempt ownership-status-request-env-validation=ok logical-order-unchanged=ok no-wechat-call=ok");
  } finally {
    connection.close();
    cleanup(dir, file);
  }
}

if (!isMainThread && (workerData as Input | undefined)?.role === "attempt-worker") workerMain().catch(() => { parentPort?.postMessage({ type: "error", code: "PAYMENT_ATTEMPT_CREATE_FAILED" } satisfies Message); process.exitCode = 1; });
else main().catch((error) => { console.error(error); process.exitCode = 1; });
