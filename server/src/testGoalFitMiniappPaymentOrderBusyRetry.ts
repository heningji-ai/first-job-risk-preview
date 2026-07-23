import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import {
  GOAL_FIT_ORDER_BUSY_RETRY_DELAYS_MS,
  db,
  isSqliteBusyOrLockedError,
  openConfiguredDatabaseConnection,
  runImmediateTransactionWithBusyRetry,
} from "./db.js";
import {
  createGoalFitMiniappPaymentOrderStore,
  GoalFitPaymentOrderError,
} from "./goalFitMiniappPaymentOrderStore.js";

type LockHolderMessage =
  | { type: "lock-acquired" }
  | { type: "lock-released" }
  | { type: "worker-error"; code: "LOCK_HOLDER_FAILED" };

type LockHolderData = {
  role: "sqlite-lock-holder";
  databasePath: string;
  holdMode: "timed-release" | "manual-release";
  holdMilliseconds?: number;
};

type CapturedConsole = {
  output: string[];
  restore: () => void;
};

const SENSITIVE_LOG_PATTERNS = [
  /SQLITE_BUSY/i,
  /SQLITE_LOCKED/i,
  /database is locked/i,
  /database table is locked/i,
  /\bBEGIN IMMEDIATE\b/i,
  /\bINSERT INTO\b/i,
  /\bstack\b/i,
  /\.db\b/i,
  /openid/i,
  /sessionToken/i,
  /Authorization/i,
  /answers/i,
  /selectedQuestionIds/i,
  /fullReport/i,
  /fullReportCiphertext/i,
  /fullReportHash/i,
  /payloadCiphertext/i,
  /encryption key/i,
  /sensitive-goal-fit/i,
];

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function captureConsole(): CapturedConsole {
  const output: string[] = [];
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
  const capture = (...args: unknown[]) => output.push(args.map(String).join(" "));

  console.log = capture;
  console.info = capture;
  console.warn = capture;
  console.error = capture;

  return {
    output,
    restore: () => {
      console.log = original.log;
      console.info = original.info;
      console.warn = original.warn;
      console.error = original.error;
    },
  };
}

async function workerMain(): Promise<void> {
  const data = workerData as LockHolderData;
  const connection = openConfiguredDatabaseConnection(data.databasePath);
  let failed = false;

  try {
    const releaseRequested =
      data.holdMode === "manual-release"
        ? new Promise<void>((resolve) => {
            parentPort?.on("message", (message) => {
              if ((message as { type?: string }).type === "release-lock") resolve();
            });
          })
        : undefined;

    connection.exec("BEGIN IMMEDIATE");
    parentPort?.postMessage({ type: "lock-acquired" } satisfies LockHolderMessage);

    if (data.holdMode === "timed-release") {
      await sleep(data.holdMilliseconds ?? 0);
    } else {
      await releaseRequested;
    }

    connection.exec("ROLLBACK");
    parentPort?.postMessage({ type: "lock-released" } satisfies LockHolderMessage);
    await sleep(10);
  } catch {
    failed = true;
    try {
      connection.exec("ROLLBACK");
    } catch {
      // The lock may never have been acquired.
    }
    parentPort?.postMessage({
      type: "worker-error",
      code: "LOCK_HOLDER_FAILED",
    } satisfies LockHolderMessage);
    process.exitCode = 1;
  } finally {
    if (!failed) process.exitCode = 0;
    connection.close();
    parentPort?.close();
    try {
      db.close();
    } catch {
      // This is the worker's module-level connection, not the main thread connection.
    }
  }
}

function createProbeDatabase(): {
  directory: string;
  databasePath: string;
  connection: DatabaseSync;
} {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "goal-fit-busy-retry-"));
  const databasePath = path.join(directory, "busy-retry.db");
  const connection = openConfiguredDatabaseConnection(databasePath, false, { busyTimeoutMs: 0 });

  connection.exec(`
    CREATE TABLE busy_retry_probe (
      id TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE busy_retry_failure_probe (
      id TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  assert.equal((connection.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys, 1);
  assert.equal((connection.prepare("PRAGMA busy_timeout").get() as { timeout: number }).timeout, 0);

  return { directory, databasePath, connection };
}

function createGoalFitProbeDatabase(): {
  directory: string;
  databasePath: string;
  connection: DatabaseSync;
} {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "goal-fit-order-busy-"));
  const databasePath = path.join(directory, "goal-fit-order.db");
  const connection = openConfiguredDatabaseConnection(databasePath, false, { busyTimeoutMs: 0 });

  connection.exec(`
    CREATE TABLE platform_identities (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      app_id TEXT NOT NULL,
      openid_ciphertext TEXT NOT NULL,
      openid_hash TEXT NOT NULL,
      unionid_ciphertext TEXT,
      unionid_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (platform, app_id, openid_hash)
    );

    CREATE TABLE assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assessment_id TEXT NOT NULL UNIQUE,
      platform_identity_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      submission_id TEXT NOT NULL,
      target_company TEXT NOT NULL,
      target_role TEXT NOT NULL,
      question_set_version TEXT NOT NULL,
      question_bank_hash TEXT NOT NULL,
      scoring_version TEXT NOT NULL,
      payload_ciphertext TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status = 'completed'),
      completed_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(platform_identity_id, submission_id),
      FOREIGN KEY(platform_identity_id) REFERENCES platform_identities(id)
    );

    CREATE TABLE report_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_snapshot_id TEXT NOT NULL UNIQUE,
      assessment_row_id INTEGER NOT NULL UNIQUE,
      report_version TEXT NOT NULL,
      free_result_json TEXT NOT NULL,
      full_report_ciphertext TEXT NOT NULL,
      full_report_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(assessment_row_id) REFERENCES assessments(id)
    );

    CREATE TABLE product_pricing_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_key TEXT NOT NULL UNIQUE,
      base_price_cents INTEGER NOT NULL,
      sale_price_cents INTEGER NOT NULL,
      invite_discount_cents INTEGER NOT NULL,
      free_trial_enabled INTEGER NOT NULL DEFAULT 0,
      free_trial_start_at TEXT,
      free_trial_end_at TEXT,
      allow_invite_discount_stack INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      outTradeNo TEXT NOT NULL UNIQUE,
      sessionId TEXT NOT NULL,
      status TEXT NOT NULL,
      accessMode TEXT NOT NULL,
      originalAmountCents INTEGER NOT NULL,
      discountAmountCents INTEGER NOT NULL,
      payAmountCents INTEGER NOT NULL,
      couponCode TEXT,
      paymentProvider TEXT NOT NULL,
      paymentMode TEXT NOT NULL,
      wechatPrepayId TEXT,
      wechatCodeUrl TEXT,
      wechatTransactionId TEXT,
      sourceReferralCode TEXT,
      referralVisitId TEXT,
      analyticsVisitorId TEXT,
      analyticsSource TEXT,
      analyticsChannel TEXT,
      analyticsCampaign TEXT,
      analyticsReferralCode TEXT,
      basePriceCents INTEGER,
      salePriceCents INTEGER,
      discountCents INTEGER,
      finalAmountCents INTEGER,
      pricingRuleId INTEGER,
      pricingSnapshotJson TEXT,
      pricingMode TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      platformIdentityId TEXT,
      assessmentId TEXT,
      reportSnapshotId TEXT,
      orderPurpose TEXT,
      expiresAt TEXT,
      paidAt TEXT
    );

    CREATE UNIQUE INDEX uq_orders_goal_fit_pending
      ON orders (platformIdentityId, assessmentId, orderPurpose)
      WHERE orderPurpose = 'goal_fit_full_report'
        AND platformIdentityId IS NOT NULL
        AND assessmentId IS NOT NULL
        AND status = 'pending';

    CREATE TABLE report_entitlements (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      report_snapshot_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  return { directory, databasePath, connection };
}

function cleanupProbeDatabase(directory: string, databasePath: string, connection?: DatabaseSync): void {
  try {
    connection?.exec("ROLLBACK");
  } catch {
    // No active transaction is expected after successful tests.
  }
  connection?.close();

  for (const filePath of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    fs.rmSync(filePath, { force: true });
  }
  fs.rmSync(directory, { recursive: true, force: true });
}

function getRows(connection: DatabaseSync, sql: string): unknown[] {
  return JSON.parse(JSON.stringify(connection.prepare(sql).all()));
}

function seedGoalFitOrderData(connection: DatabaseSync): {
  platformIdentityId: string;
  assessmentId: string;
  reportSnapshotId: string;
  now: Date;
} {
  const now = new Date("2026-07-23T08:00:00.000Z");
  const platformIdentityId = "identity_sensitive-goal-fit-openid-marker";
  const assessmentId = "assessment_sensitive-goal-fit-answers-marker";
  const reportSnapshotId = "snapshot_sensitive-goal-fit-fullReport-marker";

  connection
    .prepare(
      `
        INSERT INTO platform_identities (
          id, platform, app_id, openid_ciphertext, openid_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      platformIdentityId,
      "weixin",
      "wx-test",
      "sensitive-goal-fit-openid-ciphertext",
      "sensitive-goal-fit-openid-hash",
      now.toISOString(),
      now.toISOString()
    );

  const insertedAssessment = connection
    .prepare(
      `
        INSERT INTO assessments (
          assessment_id,
          platform_identity_id,
          visitor_id,
          submission_id,
          target_company,
          target_role,
          question_set_version,
          question_bank_hash,
          scoring_version,
          payload_ciphertext,
          payload_hash,
          status,
          completed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      assessmentId,
      platformIdentityId,
      "visitor_sensitive-goal-fit-token-marker",
      "submission-001",
      "PLATFORM",
      "PRODUCT_OPS",
      "goal-fit-v1",
      "question-bank-hash",
      "scoring-v1",
      "sensitive-goal-fit-payloadCiphertext",
      "sensitive-goal-fit-payload-hash",
      "completed",
      now.toISOString(),
      now.toISOString(),
      now.toISOString()
    );

  connection
    .prepare(
      `
        INSERT INTO report_snapshots (
          report_snapshot_id,
          assessment_row_id,
          report_version,
          free_result_json,
          full_report_ciphertext,
          full_report_hash,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      reportSnapshotId,
      insertedAssessment.lastInsertRowid,
      "report-v1",
      JSON.stringify({ summary: "free-result" }),
      "sensitive-goal-fit-fullReportCiphertext",
      "sensitive-goal-fit-fullReportHash",
      now.toISOString()
    );

  connection
    .prepare(
      `
        INSERT INTO product_pricing_rules (
          product_key,
          base_price_cents,
          sale_price_cents,
          invite_discount_cents,
          free_trial_enabled,
          allow_invite_discount_stack,
          enabled,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run("goal_fit_report", 1990, 1990, 1000, 0, 1, 1, now.toISOString(), now.toISOString());

  return { platformIdentityId, assessmentId, reportSnapshotId, now };
}

function startLockHolder(databasePath: string, holdMode: LockHolderData["holdMode"], holdMilliseconds?: number): Worker {
  return new Worker(new URL(import.meta.url), {
    workerData: {
      role: "sqlite-lock-holder",
      databasePath,
      holdMode,
      holdMilliseconds,
    } satisfies LockHolderData,
  });
}

async function waitForWorkerMessage(worker: Worker, type: LockHolderMessage["type"], timeoutMs = 3000): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for worker message: ${type}`));
    }, timeoutMs);

    const onMessage = (message: LockHolderMessage) => {
      if (message.type === "worker-error") {
        cleanup();
        reject(new Error(message.code));
        return;
      }
      if (message.type === type) {
        cleanup();
        resolve();
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    function cleanup() {
      clearTimeout(timer);
      worker.off("message", onMessage);
      worker.off("error", onError);
    }

    worker.on("message", onMessage);
    worker.on("error", onError);
  });
}

async function waitForWorkerExit(worker: Worker): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    worker.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error("Worker exited with failure."));
    });
  });
}

async function releaseAndWait(worker: Worker, workerExit: Promise<void>): Promise<void> {
  const lockReleased = waitForWorkerMessage(worker, "lock-released").catch(() => undefined);
  worker.postMessage({ type: "release-lock" });
  await Promise.race([lockReleased, workerExit]);
  await workerExit;
}

async function runTimedReleaseSuccessScenario(): Promise<void> {
  const { directory, databasePath, connection } = createProbeDatabase();
  let worker: Worker | undefined;

  try {
    worker = startLockHolder(databasePath, "timed-release", 120);
    const workerExit = waitForWorkerExit(worker);
    workerExit.catch(() => undefined);
    await waitForWorkerMessage(worker, "lock-acquired");

    const observedRetries: Array<{ attempt: number; delayMs: number }> = [];
    runImmediateTransactionWithBusyRetry(
      () => {
        connection.prepare("INSERT INTO busy_retry_probe (id, value) VALUES (?, ?)").run("success-after-retry", "ok");
      },
      { onBusyRetry: (event) => observedRetries.push(event) },
      connection
    );

    assert.ok(observedRetries.length >= 1);
    assert.ok(observedRetries.length <= GOAL_FIT_ORDER_BUSY_RETRY_DELAYS_MS.length);
    assert.equal((connection.prepare("SELECT COUNT(*) AS count FROM busy_retry_probe").get() as { count: number }).count, 1);

    await workerExit;
    worker = undefined;
  } finally {
    if (worker) await worker.terminate();
    cleanupProbeDatabase(directory, databasePath, connection);
  }
}

async function runManualReleaseBoundedFailureAndRecoveryScenario(): Promise<{
  retryCount: number;
  delayMs: number[];
  failedRecordCount: number;
  recoveredId: string;
}> {
  const { directory, databasePath, connection } = createProbeDatabase();
  let worker: Worker | undefined;

  try {
    worker = startLockHolder(databasePath, "manual-release");
    const workerExit = waitForWorkerExit(worker);
    workerExit.catch(() => undefined);
    await waitForWorkerMessage(worker, "lock-acquired");

    const observedRetries: Array<{ attempt: number; delayMs: number }> = [];
    let transactionBodyCallCount = 0;
    const startedAt = Date.now();

    assert.throws(() => {
      runImmediateTransactionWithBusyRetry(
        () => {
          transactionBodyCallCount += 1;
          connection
            .prepare("INSERT INTO busy_retry_failure_probe (id, value) VALUES (?, ?)")
            .run("must-not-commit", "locked-transaction");
        },
        { onBusyRetry: (event) => observedRetries.push(event) },
        connection
      );
    });

    assert.ok(Date.now() - startedAt < 1500);
    assert.equal(observedRetries.length, 3);
    assert.deepEqual(
      observedRetries.map((event) => event.delayMs),
      [25, 50, 100]
    );
    assert.deepEqual(
      observedRetries.map((event) => event.attempt),
      [1, 2, 3]
    );
    assert.equal(transactionBodyCallCount, 0);
    assert.equal(
      (connection.prepare("SELECT COUNT(*) AS count FROM busy_retry_failure_probe").get() as { count: number }).count,
      0
    );
    assert.equal(
      (connection.prepare("SELECT COUNT(*) AS count FROM busy_retry_failure_probe WHERE id = ?").get("must-not-commit") as {
        count: number;
      }).count,
      0
    );

    await releaseAndWait(worker, workerExit);
    worker = undefined;

    runImmediateTransactionWithBusyRetry(
      () => {
        connection
          .prepare("INSERT INTO busy_retry_failure_probe (id, value) VALUES (?, ?)")
          .run("success-after-lock-release", "connection-recovered");
      },
      undefined,
      connection
    );

    const rows = connection.prepare("SELECT id FROM busy_retry_failure_probe ORDER BY id").all() as Array<{ id: string }>;
    assert.deepEqual(rows.map((row) => row.id), ["success-after-lock-release"]);
    connection.prepare("SELECT COUNT(*) AS count FROM busy_retry_failure_probe").get();

    return {
      retryCount: observedRetries.length,
      delayMs: observedRetries.map((event) => event.delayMs),
      failedRecordCount: 0,
      recoveredId: rows[0].id,
    };
  } finally {
    if (worker) {
      try {
        worker.postMessage({ type: "release-lock" });
      } catch {
        // The worker may already be closed.
      }
      await worker.terminate();
    }
    cleanupProbeDatabase(directory, databasePath, connection);
  }
}

function runNonBusyConstraintFailureScenario(): {
  transactionBodyCallCount: number;
  busyRetryCount: number;
} {
  const { directory, databasePath, connection } = createProbeDatabase();

  try {
    connection.prepare("INSERT INTO busy_retry_probe (id, value) VALUES (?, ?)").run("duplicate-id", "original");

    let transactionBodyCallCount = 0;
    let busyRetryCount = 0;

    assert.throws(() => {
      runImmediateTransactionWithBusyRetry(
        () => {
          transactionBodyCallCount += 1;
          connection.prepare("INSERT INTO busy_retry_probe (id, value) VALUES (?, ?)").run("duplicate-id", "duplicate");
        },
        { onBusyRetry: () => (busyRetryCount += 1) },
        connection
      );
    });

    assert.equal(transactionBodyCallCount, 1);
    assert.equal(busyRetryCount, 0);
    assert.equal((connection.prepare("SELECT COUNT(*) AS count FROM busy_retry_probe").get() as { count: number }).count, 1);
    assert.equal((connection.prepare("SELECT value FROM busy_retry_probe WHERE id = ?").get("duplicate-id") as { value: string }).value, "original");

    const notNullError = assert.throws(() => {
      connection.prepare("INSERT INTO busy_retry_probe (id, value) VALUES (?, ?)").run("not-null-probe", null);
    });
    assert.equal(isSqliteBusyOrLockedError(notNullError), false);

    connection.exec(`
      CREATE TABLE check_probe (
        id TEXT PRIMARY KEY,
        value INTEGER NOT NULL CHECK(value > 0)
      );
      CREATE TABLE foreign_parent (
        id TEXT PRIMARY KEY
      );
      CREATE TABLE foreign_child (
        id TEXT PRIMARY KEY,
        parent_id TEXT NOT NULL,
        FOREIGN KEY(parent_id) REFERENCES foreign_parent(id)
      );
    `);

    const checkError = assert.throws(() => {
      connection.prepare("INSERT INTO check_probe (id, value) VALUES (?, ?)").run("check-probe", 0);
    });
    assert.equal(isSqliteBusyOrLockedError(checkError), false);

    const foreignKeyError = assert.throws(() => {
      connection.prepare("INSERT INTO foreign_child (id, parent_id) VALUES (?, ?)").run("fk-probe", "missing-parent");
    });
    assert.equal(isSqliteBusyOrLockedError(foreignKeyError), false);

    connection.prepare("SELECT COUNT(*) AS count FROM busy_retry_probe").get();

    return { transactionBodyCallCount, busyRetryCount };
  } finally {
    cleanupProbeDatabase(directory, databasePath, connection);
  }
}

async function runGoalFitDomainLockExhaustionScenario(): Promise<{
  publicErrorCode: string;
  busyRetryCount: number;
  orderCountAfterFailure: number;
  assessmentUnchanged: boolean;
  snapshotUnchanged: boolean;
  consoleOutputCount: number;
  recoveredOrderId: string;
  recoveredAmount: number;
  recoveredCurrency: string;
}> {
  const { directory, databasePath, connection } = createGoalFitProbeDatabase();
  const seeded = seedGoalFitOrderData(connection);
  const observedDomainRetries: Array<{ attempt: number; delayMs: number }> = [];
  const store = createGoalFitMiniappPaymentOrderStore({
    connection,
    onBusyRetry: (event) => observedDomainRetries.push(event),
  });
  let worker: Worker | undefined;
  const capturedConsole = captureConsole();

  const assessmentBefore = getRows(connection, "SELECT * FROM assessments ORDER BY id");
  const snapshotBefore = getRows(connection, "SELECT * FROM report_snapshots ORDER BY id");
  const ordersBefore = getRows(connection, "SELECT * FROM orders ORDER BY createdAt, id");

  try {
    worker = startLockHolder(databasePath, "manual-release");
    const workerExit = waitForWorkerExit(worker);
    workerExit.catch(() => undefined);
    await waitForWorkerMessage(worker, "lock-acquired");

    let publicError: unknown;
    assert.throws(() => {
      try {
        store.createOrReuseGoalFitPaymentOrder({
          platformIdentityId: seeded.platformIdentityId,
          assessmentId: seeded.assessmentId,
          now: seeded.now,
        });
      } catch (error) {
        publicError = error;
        throw error;
      }
    });

    assert.ok(publicError instanceof GoalFitPaymentOrderError);
    assert.equal(publicError.code, "ORDER_CREATE_FAILED");
    assert.equal(publicError.message, "ORDER_CREATE_FAILED");
    assert.equal(observedDomainRetries.length, 3);
    assert.deepEqual(
      observedDomainRetries.map((event) => event.delayMs),
      [25, 50, 100]
    );
    assert.deepEqual(
      observedDomainRetries.map((event) => event.attempt),
      [1, 2, 3]
    );

    const assessmentAfterFailure = getRows(connection, "SELECT * FROM assessments ORDER BY id");
    const snapshotAfterFailure = getRows(connection, "SELECT * FROM report_snapshots ORDER BY id");
    const ordersAfterFailure = getRows(connection, "SELECT * FROM orders ORDER BY createdAt, id");
    assert.deepEqual(assessmentAfterFailure, assessmentBefore);
    assert.deepEqual(snapshotAfterFailure, snapshotBefore);
    assert.deepEqual(ordersAfterFailure, ordersBefore);
    assert.equal((connection.prepare("SELECT COUNT(*) AS count FROM orders").get() as { count: number }).count, 0);
    assert.equal(
      (connection.prepare("SELECT COUNT(*) AS count FROM orders WHERE status IN ('pending', 'paid', 'failed', 'closed', 'expired')").get() as {
        count: number;
      }).count,
      0
    );
    assert.equal((connection.prepare("SELECT COUNT(*) AS count FROM report_entitlements").get() as { count: number }).count, 0);

    await releaseAndWait(worker, workerExit);
    worker = undefined;

    const order = store.createOrReuseGoalFitPaymentOrder({
      platformIdentityId: seeded.platformIdentityId,
      assessmentId: seeded.assessmentId,
      now: seeded.now,
    });

    assert.equal(order.reused, false);
    assert.equal(order.status, "pending");
    assert.equal(order.amount, 1990);
    assert.equal(order.currency, "CNY");
    assert.equal(order.orderPurpose, "goal_fit_full_report");
    assert.equal(order.assessmentId, seeded.assessmentId);
    assert.equal(order.reportSnapshotId, seeded.reportSnapshotId);
    assert.equal(order.expiresAt, new Date(seeded.now.getTime() + 30 * 60 * 1000).toISOString());

    const persistedOrders = getRows(connection, "SELECT * FROM orders ORDER BY createdAt, id") as Array<{ id: string; status: string }>;
    assert.equal(persistedOrders.length, 1);
    assert.equal(persistedOrders[0].id, order.orderId);
    assert.equal(persistedOrders[0].status, "pending");
    assert.deepEqual(getRows(connection, "SELECT * FROM assessments ORDER BY id"), assessmentBefore);
    assert.deepEqual(getRows(connection, "SELECT * FROM report_snapshots ORDER BY id"), snapshotBefore);
    connection.prepare("SELECT COUNT(*) AS count FROM orders").get();

    return {
      publicErrorCode: publicError.code,
      busyRetryCount: observedDomainRetries.length,
      orderCountAfterFailure: ordersAfterFailure.length,
      assessmentUnchanged: true,
      snapshotUnchanged: true,
      consoleOutputCount: capturedConsole.output.length,
      recoveredOrderId: order.orderId,
      recoveredAmount: order.amount,
      recoveredCurrency: order.currency,
    };
  } finally {
    capturedConsole.restore();
    if (worker) {
      try {
        worker.postMessage({ type: "release-lock" });
      } catch {
        // The worker may already be closed.
      }
      await worker.terminate();
    }

    for (const line of capturedConsole.output) {
      for (const pattern of SENSITIVE_LOG_PATTERNS) {
        assert.equal(pattern.test(line), false, `Sensitive log content was captured: ${line}`);
      }
    }

    cleanupProbeDatabase(directory, databasePath, connection);
  }
}

async function main(): Promise<void> {
  const capturedConsole = captureConsole();
  let manualReleaseResult: Awaited<ReturnType<typeof runManualReleaseBoundedFailureAndRecoveryScenario>>;
  let nonBusyResult: ReturnType<typeof runNonBusyConstraintFailureScenario>;
  let goalFitDomainResult: Awaited<ReturnType<typeof runGoalFitDomainLockExhaustionScenario>>;

  try {
    await runTimedReleaseSuccessScenario();
    manualReleaseResult = await runManualReleaseBoundedFailureAndRecoveryScenario();
    nonBusyResult = runNonBusyConstraintFailureScenario();
    goalFitDomainResult = await runGoalFitDomainLockExhaustionScenario();
  } finally {
    capturedConsole.restore();
  }

  for (const line of capturedConsole.output) {
    for (const pattern of SENSITIVE_LOG_PATTERNS) {
      assert.equal(pattern.test(line), false, `Sensitive log content was captured: ${line}`);
    }
  }

  console.log(
    [
      "Goal Fit busy retry tests passed.",
      `manual retries=${manualReleaseResult.retryCount}`,
      `manual delays=${manualReleaseResult.delayMs.join(",")}`,
      `failed records=${manualReleaseResult.failedRecordCount}`,
      `recovered=${manualReleaseResult.recoveredId}`,
      `non-busy body calls=${nonBusyResult.transactionBodyCallCount}`,
      `non-busy retries=${nonBusyResult.busyRetryCount}`,
      `goal-fit error=${goalFitDomainResult.publicErrorCode}`,
      `goal-fit orders-after-failure=${goalFitDomainResult.orderCountAfterFailure}`,
      `goal-fit recovered-amount=${goalFitDomainResult.recoveredAmount}`,
      `goal-fit recovered-currency=${goalFitDomainResult.recoveredCurrency}`,
    ].join(" ")
  );
}

if (!isMainThread && (workerData as LockHolderData | undefined)?.role === "sqlite-lock-holder") {
  workerMain().catch(() => {
    parentPort?.postMessage({
      type: "worker-error",
      code: "LOCK_HOLDER_FAILED",
    } satisfies LockHolderMessage);
    process.exitCode = 1;
  });
} else {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
