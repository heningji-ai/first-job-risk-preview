import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { nanoid } from "nanoid";
import { openConfiguredDatabaseConnection } from "./db.js";
import {
  createGoalFitMiniappPaymentOrderStore,
  GoalFitPaymentOrderError,
  isGoalFitPendingUniqueConstraintError,
} from "./goalFitMiniappPaymentOrderStore.js";

const GOAL_FIT_PURPOSE = "goal_fit_full_report";
const NOW = new Date("2026-07-23T08:30:00.000Z");
const EXPIRES_AT = new Date(NOW.getTime() + 30 * 60 * 1000).toISOString();

const SENSITIVE_PATTERNS = [
  /SQLITE_CONSTRAINT/i,
  /UNIQUE constraint failed/i,
  /orders\.platformIdentityId/i,
  /orders\.assessmentId/i,
  /orders\.orderPurpose/i,
  /\bINSERT INTO\b/i,
  /\bstack\b/i,
  /\.db\b/i,
  /openid/i,
  /token/i,
  /Authorization/i,
  /answers/i,
  /fullReport/i,
  /payloadCiphertext/i,
  /encryption key/i,
  /sensitive-winner/i,
];

type CapturedConsole = {
  output: string[];
  restore: () => void;
};

function captureConsole(): CapturedConsole {
  const output: string[] = [];
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
  const capture = (...args: unknown[]) => output.push(args.map((arg) => String(arg)).join(" "));

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

function catchThrown(callback: () => void): unknown {
  try {
    callback();
  } catch (error) {
    return error;
  }
  assert.fail("Expected callback to throw");
}

function createDatabase(): { directory: string; databasePath: string; connection: DatabaseSync } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "goal-fit-winner-recovery-"));
  const databasePath = path.join(directory, "winner-recovery.db");
  const connection = openConfiguredDatabaseConnection(databasePath, false, { busyTimeoutMs: 0 });

  connection.exec(`
    CREATE TABLE platform_identities (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      app_id TEXT NOT NULL,
      openid_ciphertext TEXT NOT NULL,
      openid_hash TEXT NOT NULL,
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

function cleanup(directory: string, databasePath: string, connection?: DatabaseSync): void {
  try {
    connection?.exec("ROLLBACK");
  } catch {
    // No active transaction is expected after successful test cases.
  }
  connection?.close();
  for (const filePath of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    fs.rmSync(filePath, { force: true });
  }
  fs.rmSync(directory, { recursive: true, force: true });
}

function stableRows(connection: DatabaseSync, sql: string): unknown[] {
  return JSON.parse(JSON.stringify(connection.prepare(sql).all()));
}

function seedAssessment(connection: DatabaseSync, suffix = nanoid(6)): {
  platformIdentityId: string;
  assessmentId: string;
  reportSnapshotId: string;
} {
  const platformIdentityId = `identity_${suffix}`;
  const assessmentId = `assessment_${suffix}`;
  const reportSnapshotId = `snapshot_${suffix}`;
  const now = NOW.toISOString();

  connection
    .prepare(
      "INSERT INTO platform_identities (id, platform, app_id, openid_ciphertext, openid_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(platformIdentityId, "weixin", "wx-test", `sensitive-winner-openid-${suffix}`, `openid-hash-${suffix}`, now, now);

  const assessment = connection
    .prepare(
      `
        INSERT INTO assessments (
          assessment_id, platform_identity_id, visitor_id, submission_id, target_company, target_role,
          question_set_version, question_bank_hash, scoring_version, payload_ciphertext, payload_hash,
          status, completed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      assessmentId,
      platformIdentityId,
      `visitor_${suffix}`,
      `submission_${suffix}`,
      "PLATFORM",
      "PRODUCT_OPS",
      "goal-fit-v1",
      "question-bank-hash",
      "scoring-v1",
      `sensitive-winner-payloadCiphertext-${suffix}`,
      `payload-hash-${suffix}`,
      "completed",
      now,
      now,
      now
    );

  connection
    .prepare(
      `
        INSERT INTO report_snapshots (
          report_snapshot_id, assessment_row_id, report_version, free_result_json,
          full_report_ciphertext, full_report_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      reportSnapshotId,
      assessment.lastInsertRowid,
      "report-v1",
      JSON.stringify({ summary: "free-result" }),
      `sensitive-winner-fullReportCiphertext-${suffix}`,
      `sensitive-winner-fullReportHash-${suffix}`,
      now
    );

  connection
    .prepare(
      `
        INSERT INTO product_pricing_rules (
          product_key, base_price_cents, sale_price_cents, invite_discount_cents,
          free_trial_enabled, allow_invite_discount_stack, enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(product_key) DO NOTHING
      `
    )
    .run("goal_fit_report", 1990, 1990, 1000, 0, 1, 1, now, now);

  return { platformIdentityId, assessmentId, reportSnapshotId };
}

function insertOrder(
  connection: DatabaseSync,
  input: {
    id?: string;
    outTradeNo?: string;
    platformIdentityId: string | null;
    assessmentId: string | null;
    reportSnapshotId?: string | null;
    orderPurpose?: string | null;
    status?: string;
    expiresAt?: string | null;
    amount?: number;
    createdAt?: string;
  }
): { id: string; outTradeNo: string } {
  const id = input.id ?? `order_${nanoid(8)}`;
  const outTradeNo = input.outTradeNo ?? `GFTEST${nanoid(10).toUpperCase()}`;
  const createdAt = input.createdAt ?? NOW.toISOString();
  const amount = input.amount ?? 1990;

  connection
    .prepare(
      `
        INSERT INTO orders (
          id, outTradeNo, sessionId, status, accessMode, originalAmountCents, discountAmountCents,
          payAmountCents, couponCode, paymentProvider, paymentMode, wechatPrepayId, wechatCodeUrl,
          wechatTransactionId, sourceReferralCode, referralVisitId, analyticsVisitorId, analyticsSource,
          analyticsChannel, analyticsCampaign, analyticsReferralCode, basePriceCents, salePriceCents,
          discountCents, finalAmountCents, pricingRuleId, pricingSnapshotJson, pricingMode, createdAt,
          updatedAt, platformIdentityId, assessmentId, reportSnapshotId, orderPurpose, expiresAt, paidAt
        ) VALUES (
          @id, @outTradeNo, @sessionId, @status, 'direct', @amount, 0,
          @amount, NULL, 'wechat', 'jsapi', NULL, NULL,
          NULL, NULL, NULL, NULL, NULL,
          NULL, NULL, NULL, @amount, @amount,
          0, @amount, NULL, NULL, 'normal', @createdAt,
          @createdAt, @platformIdentityId, @assessmentId, @reportSnapshotId, @orderPurpose, @expiresAt, @paidAt
        )
      `
    )
    .run({
      id,
      outTradeNo,
      sessionId: input.platformIdentityId ?? "session_without_goal_fit_identity",
      status: input.status ?? "pending",
      amount,
      createdAt,
      platformIdentityId: input.platformIdentityId,
      assessmentId: input.assessmentId,
      reportSnapshotId: input.reportSnapshotId ?? null,
      orderPurpose: input.orderPurpose ?? GOAL_FIT_PURPOSE,
      expiresAt: input.expiresAt ?? EXPIRES_AT,
      paidAt: input.status === "paid" ? createdAt : null,
    });

  return { id, outTradeNo };
}

function captureGoalFitPendingUniqueError(): { error: unknown; fields: Record<string, unknown> } {
  const { directory, databasePath, connection } = createDatabase();

  try {
    const seeded = seedAssessment(connection, "unique_probe");
    insertOrder(connection, {
      platformIdentityId: seeded.platformIdentityId,
      assessmentId: seeded.assessmentId,
      reportSnapshotId: seeded.reportSnapshotId,
    });

    const error = catchThrown(() => {
      insertOrder(connection, {
        platformIdentityId: seeded.platformIdentityId,
        assessmentId: seeded.assessmentId,
        reportSnapshotId: seeded.reportSnapshotId,
      });
    });

    const value = error as { code?: unknown; errcode?: unknown; errno?: unknown; cause?: unknown; message?: unknown };
    assert.equal(
      isGoalFitPendingUniqueConstraintError(error),
      true,
      JSON.stringify({
        code: value.code,
        errcode: value.errcode,
        errno: value.errno,
        message: value.message,
        own: Object.getOwnPropertyNames(error as object),
      })
    );

    return {
      error,
      fields: {
        code: value.code,
        errcode: value.errcode,
        errno: value.errno,
        cause: typeof value.cause,
        messageIncludesColumns:
          typeof value.message === "string" &&
          value.message.includes("orders.platformIdentityId") &&
          value.message.includes("orders.assessmentId") &&
          value.message.includes("orders.orderPurpose"),
      },
    };
  } finally {
    cleanup(directory, databasePath, connection);
  }
}

function assertNonGoalFitConstraintClassification(): void {
  const { directory, databasePath, connection } = createDatabase();

  try {
    const seeded = seedAssessment(connection, "non_goal_fit");
    const first = insertOrder(connection, {
      id: "duplicate-primary-key",
      outTradeNo: "GF_DUPLICATE_OUT_TRADE_NO",
      platformIdentityId: seeded.platformIdentityId,
      assessmentId: seeded.assessmentId,
      reportSnapshotId: seeded.reportSnapshotId,
    });

    const other = seedAssessment(connection, "non_goal_fit_other");
    const outTradeNoError = catchThrown(() => {
      insertOrder(connection, {
        outTradeNo: first.outTradeNo,
        platformIdentityId: other.platformIdentityId,
        assessmentId: other.assessmentId,
        reportSnapshotId: other.reportSnapshotId,
      });
    });
    assert.equal(isGoalFitPendingUniqueConstraintError(outTradeNoError), false);

    const idError = catchThrown(() => {
      insertOrder(connection, {
        id: "duplicate-primary-key",
        outTradeNo: "GF_DIFFERENT_OUT_TRADE_NO",
        platformIdentityId: other.platformIdentityId,
        assessmentId: other.assessmentId,
        reportSnapshotId: other.reportSnapshotId,
        orderPurpose: "another_order_purpose",
      });
    });
    assert.equal(isGoalFitPendingUniqueConstraintError(idError), false);

    const notNullError = catchThrown(() => {
      connection
        .prepare(
          "INSERT INTO orders (id, outTradeNo, sessionId, status, accessMode, originalAmountCents, discountAmountCents, payAmountCents, paymentProvider, paymentMode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(`bad_not_null_${nanoid(4)}`, null, "session", "pending", "direct", 1990, 0, 1990, "wechat", "jsapi", NOW.toISOString(), NOW.toISOString());
    });
    assert.equal(isGoalFitPendingUniqueConstraintError(notNullError), false);

    const checkError = catchThrown(() => {
      connection
        .prepare(
          `
            INSERT INTO assessments (
              assessment_id, platform_identity_id, visitor_id, submission_id, target_company, target_role,
              question_set_version, question_bank_hash, scoring_version, payload_ciphertext, payload_hash,
              status, completed_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          "bad_check",
          seeded.platformIdentityId,
          "visitor",
          "submission_bad_check",
          "PLATFORM",
          "PRODUCT_OPS",
          "goal-fit-v1",
          "question-bank-hash",
          "scoring-v1",
          "payload",
          "hash",
          "draft",
          NOW.toISOString(),
          NOW.toISOString(),
          NOW.toISOString()
        );
    });
    assert.equal(isGoalFitPendingUniqueConstraintError(checkError), false);

    const foreignKeyError = catchThrown(() => {
      connection
        .prepare(
          `
            INSERT INTO assessments (
              assessment_id, platform_identity_id, visitor_id, submission_id, target_company, target_role,
              question_set_version, question_bank_hash, scoring_version, payload_ciphertext, payload_hash,
              status, completed_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          "bad_fk",
          "missing_identity",
          "visitor",
          "submission_bad_fk",
          "PLATFORM",
          "PRODUCT_OPS",
          "goal-fit-v1",
          "question-bank-hash",
          "scoring-v1",
          "payload",
          "hash",
          "completed",
          NOW.toISOString(),
          NOW.toISOString(),
          NOW.toISOString()
        );
    });
    assert.equal(isGoalFitPendingUniqueConstraintError(foreignKeyError), false);

    const syntaxError = catchThrown(() => {
      connection.exec("INSERT INTO");
    });
    assert.equal(isGoalFitPendingUniqueConstraintError(syntaxError), false);
  } finally {
    cleanup(directory, databasePath, connection);
  }
}

function assertWinnerRecovery(capturedUniqueError: unknown): void {
  const { directory, databasePath, connection } = createDatabase();
  const capturedConsole = captureConsole();

  try {
    const seeded = seedAssessment(connection, "winner_recovery");
    const assessmentBefore = stableRows(connection, "SELECT * FROM assessments ORDER BY id");
    const snapshotBefore = stableRows(connection, "SELECT * FROM report_snapshots ORDER BY id");
    const winner = insertOrder(connection, {
      id: "winner_order_id",
      outTradeNo: "GF_WINNER_OUT_TRADE_NO",
      platformIdentityId: seeded.platformIdentityId,
      assessmentId: seeded.assessmentId,
      reportSnapshotId: seeded.reportSnapshotId,
      amount: 1234,
      expiresAt: EXPIRES_AT,
      createdAt: "2026-07-23T08:31:00.000Z",
    });

    connection.prepare("DELETE FROM orders WHERE id = ?").run(winner.id);

    const store = createGoalFitMiniappPaymentOrderStore({
      connection,
      throwBeforeOrderInsertForTest: () => {
        throw capturedUniqueError;
      },
      beforeWinnerRecoveryForTest: () => {
        if ((connection.prepare("SELECT COUNT(*) AS count FROM orders WHERE id = ?").get(winner.id) as { count: number }).count === 0) {
          insertOrder(connection, {
            id: winner.id,
            outTradeNo: winner.outTradeNo,
            platformIdentityId: seeded.platformIdentityId,
            assessmentId: seeded.assessmentId,
            reportSnapshotId: seeded.reportSnapshotId,
            amount: 1234,
            expiresAt: EXPIRES_AT,
            createdAt: "2026-07-23T08:31:00.000Z",
          });
        }
      },
    });

    const order = store.createOrReuseGoalFitPaymentOrder({
      platformIdentityId: seeded.platformIdentityId,
      assessmentId: seeded.assessmentId,
      now: NOW,
    });

    assert.equal(order.reused, true);
    assert.equal(order.orderId, winner.id);
    assert.equal(order.outTradeNo, winner.outTradeNo);
    assert.equal(order.amount, 1234);
    assert.equal(order.reportSnapshotId, seeded.reportSnapshotId);
    assert.equal(order.expiresAt, EXPIRES_AT);
    assert.deepEqual(stableRows(connection, "SELECT * FROM assessments ORDER BY id"), assessmentBefore);
    assert.deepEqual(stableRows(connection, "SELECT * FROM report_snapshots ORDER BY id"), snapshotBefore);
    assert.equal((connection.prepare("SELECT COUNT(*) AS count FROM orders").get() as { count: number }).count, 1);
    assert.equal((connection.prepare("SELECT COUNT(*) AS count FROM report_entitlements").get() as { count: number }).count, 0);
  } finally {
    capturedConsole.restore();
    for (const line of capturedConsole.output) {
      for (const pattern of SENSITIVE_PATTERNS) {
        assert.equal(pattern.test(line), false, `Sensitive console output: ${line}`);
      }
    }
    cleanup(directory, databasePath, connection);
  }
}

function assertPaidWinsBeforePending(capturedUniqueError: unknown): void {
  const { directory, databasePath, connection } = createDatabase();
  try {
    const seeded = seedAssessment(connection, "paid_wins");
    const store = createGoalFitMiniappPaymentOrderStore({
      connection,
      throwBeforeOrderInsertForTest: () => {
        throw capturedUniqueError;
      },
      beforeWinnerRecoveryForTest: () => {
        connection.exec("DROP INDEX uq_orders_goal_fit_pending");
        insertOrder(connection, {
          id: "paid_wins_pending_a",
          outTradeNo: "GF_PAID_WINS_PENDING_A",
          platformIdentityId: seeded.platformIdentityId,
          assessmentId: seeded.assessmentId,
          reportSnapshotId: seeded.reportSnapshotId,
          amount: 1555,
          expiresAt: EXPIRES_AT,
          createdAt: "2026-07-23T08:31:00.000Z",
        });
        insertOrder(connection, {
          id: "paid_wins_pending_b",
          outTradeNo: "GF_PAID_WINS_PENDING_B",
          platformIdentityId: seeded.platformIdentityId,
          assessmentId: seeded.assessmentId,
          reportSnapshotId: seeded.reportSnapshotId,
          amount: 1666,
          expiresAt: EXPIRES_AT,
          createdAt: "2026-07-23T08:32:00.000Z",
        });
        insertOrder(connection, {
          platformIdentityId: seeded.platformIdentityId,
          assessmentId: seeded.assessmentId,
          reportSnapshotId: seeded.reportSnapshotId,
          status: "paid",
          expiresAt: EXPIRES_AT,
        });
      },
    });

    const error = catchThrown(() => {
      store.createOrReuseGoalFitPaymentOrder({
        platformIdentityId: seeded.platformIdentityId,
        assessmentId: seeded.assessmentId,
        now: NOW,
      });
    });

    assert.ok(error instanceof GoalFitPaymentOrderError);
    assert.equal(error.code, "ALREADY_PURCHASED");
    assert.equal((connection.prepare("SELECT COUNT(*) AS count FROM orders WHERE platformIdentityId = ? AND assessmentId = ?").get(seeded.platformIdentityId, seeded.assessmentId) as { count: number }).count, 3);
    assert.equal((connection.prepare("SELECT COUNT(*) AS count FROM report_entitlements").get() as { count: number }).count, 0);
  } finally {
    cleanup(directory, databasePath, connection);
  }
}

function assertNoWinnerFails(capturedUniqueError: unknown): void {
  const { directory, databasePath, connection } = createDatabase();
  try {
    const seeded = seedAssessment(connection, "no_winner");
    const store = createGoalFitMiniappPaymentOrderStore({
      connection,
      throwBeforeOrderInsertForTest: () => {
        throw capturedUniqueError;
      },
    });

    const error = catchThrown(() => {
      store.createOrReuseGoalFitPaymentOrder({
        platformIdentityId: seeded.platformIdentityId,
        assessmentId: seeded.assessmentId,
        now: NOW,
      });
    });

    assert.ok(error instanceof GoalFitPaymentOrderError);
    assert.equal(error.code, "ORDER_CREATE_FAILED");
    assert.equal((connection.prepare("SELECT COUNT(*) AS count FROM orders").get() as { count: number }).count, 0);
    assert.equal((connection.prepare("SELECT COUNT(*) AS count FROM report_entitlements").get() as { count: number }).count, 0);
  } finally {
    cleanup(directory, databasePath, connection);
  }
}

function assertDeterministicPendingWinnerSelection(): void {
  const { directory, databasePath, connection } = createDatabase();
  try {
    connection.exec("DROP INDEX uq_orders_goal_fit_pending");

    const differentTime = seedAssessment(connection, "deterministic_pending_time");
    insertOrder(connection, {
      id: "z_pending_newer_id",
      outTradeNo: "GF_PENDING_NEWER_TIME",
      platformIdentityId: differentTime.platformIdentityId,
      assessmentId: differentTime.assessmentId,
      reportSnapshotId: differentTime.reportSnapshotId,
      amount: 1111,
      expiresAt: EXPIRES_AT,
      createdAt: "2026-07-23T08:32:00.000Z",
    });
    insertOrder(connection, {
      id: "a_pending_older_id",
      outTradeNo: "GF_PENDING_OLDER_TIME",
      platformIdentityId: differentTime.platformIdentityId,
      assessmentId: differentTime.assessmentId,
      reportSnapshotId: differentTime.reportSnapshotId,
      amount: 1222,
      expiresAt: EXPIRES_AT,
      createdAt: "2026-07-23T08:31:00.000Z",
    });

    const store = createGoalFitMiniappPaymentOrderStore({ connection });
    const timeWinner = store.createOrReuseGoalFitPaymentOrder({
      platformIdentityId: differentTime.platformIdentityId,
      assessmentId: differentTime.assessmentId,
      now: NOW,
    });
    assert.equal(timeWinner.reused, true);
    assert.equal(timeWinner.orderId, "a_pending_older_id");
    assert.equal(timeWinner.outTradeNo, "GF_PENDING_OLDER_TIME");
    assert.equal(timeWinner.amount, 1222);

    const sameTime = seedAssessment(connection, "deterministic_pending_id");
    insertOrder(connection, {
      id: "z_pending_inserted_first",
      outTradeNo: "GF_PENDING_Z",
      platformIdentityId: sameTime.platformIdentityId,
      assessmentId: sameTime.assessmentId,
      reportSnapshotId: sameTime.reportSnapshotId,
      amount: 1333,
      expiresAt: EXPIRES_AT,
      createdAt: "2026-07-23T08:33:00.000Z",
    });
    insertOrder(connection, {
      id: "a_pending_inserted_second",
      outTradeNo: "GF_PENDING_A",
      platformIdentityId: sameTime.platformIdentityId,
      assessmentId: sameTime.assessmentId,
      reportSnapshotId: sameTime.reportSnapshotId,
      amount: 1444,
      expiresAt: EXPIRES_AT,
      createdAt: "2026-07-23T08:33:00.000Z",
    });
    const sameTimeWinner = store.createOrReuseGoalFitPaymentOrder({
      platformIdentityId: sameTime.platformIdentityId,
      assessmentId: sameTime.assessmentId,
      now: NOW,
    });
    assert.equal(sameTimeWinner.reused, true);
    assert.equal(sameTimeWinner.orderId, "a_pending_inserted_second");
    assert.equal(sameTimeWinner.outTradeNo, "GF_PENDING_A");
    assert.equal(sameTimeWinner.amount, 1444);

    assert.equal((connection.prepare("SELECT COUNT(*) AS count FROM orders WHERE platformIdentityId = ? AND assessmentId = ?").get(differentTime.platformIdentityId, differentTime.assessmentId) as { count: number }).count, 2);
    assert.equal((connection.prepare("SELECT COUNT(*) AS count FROM orders WHERE platformIdentityId = ? AND assessmentId = ?").get(sameTime.platformIdentityId, sameTime.assessmentId) as { count: number }).count, 2);
  } finally {
    cleanup(directory, databasePath, connection);
  }
}

function main(): void {
  const captured = captureGoalFitPendingUniqueError();
  assertNonGoalFitConstraintClassification();
  assertWinnerRecovery(captured.error);
  assertPaidWinsBeforePending(captured.error);
  assertNoWinnerFails(captured.error);
  assertDeterministicPendingWinnerSelection();

  console.log(
    [
      "Goal Fit payment order winner recovery tests passed.",
      `constraint-code=${String(captured.fields.code)}`,
      `constraint-errcode=${String(captured.fields.errcode)}`,
      `constraint-errno=${String(captured.fields.errno)}`,
      `constraint-cause=${String(captured.fields.cause)}`,
      `message-columns=${String(captured.fields.messageIncludesColumns)}`,
      "classification=message columns orders.platformIdentityId/orders.assessmentId/orders.orderPurpose plus sqlite constraint code",
    ].join(" ")
  );
}

main();
