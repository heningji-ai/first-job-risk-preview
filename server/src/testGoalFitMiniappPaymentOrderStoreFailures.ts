import assert from "node:assert/strict";
import fs from "node:fs";

process.env.GOAL_FIT_DB_PATH = `data/payment-order-failures-${Date.now()}.db`;

const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error
};
const captured: string[] = [];
const capture = (...values: unknown[]) => captured.push(values.map((value) => String(value)).join(" "));
console.log = capture;
console.info = capture;
console.warn = capture;
console.error = capture;

const { db, databasePath, initializeDatabase } = await import("./db.js");
const {
  GoalFitPaymentOrderError,
  createOrReuseGoalFitPaymentOrder,
  setGoalFitPaymentPriceReaderForTest
} = await import("./goalFitMiniappPaymentOrderStore.js");

const now = new Date("2026-01-02T00:00:00.000Z");
const sensitive = [
  "TEST_OPENID_SECRET",
  "TEST_REPORT_CIPHER_SECRET",
  "TEST_REPORT_HASH_SECRET",
  "TEST_PAYLOAD_CIPHER_SECRET",
  "TEST_SQLITE_INSERT_FAILURE"
];

function countOrders(): number {
  return Number((db.prepare("SELECT COUNT(*) AS count FROM orders").get() as { count: number }).count);
}

function snapshotState(assessmentId?: string, snapshotId?: string) {
  return {
    assessment: assessmentId
      ? db.prepare("SELECT * FROM assessments WHERE assessment_id = ?").get(assessmentId)
      : undefined,
    snapshot: snapshotId
      ? db.prepare("SELECT * FROM report_snapshots WHERE report_snapshot_id = ?").get(snapshotId)
      : undefined,
    orders: countOrders()
  };
}

function insertIdentity(id: string): void {
  db.prepare(
    "INSERT INTO platform_identities (id, platform, app_id, openid_ciphertext, openid_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, "wechat_miniapp", "wx-test", "TEST_OPENID_SECRET", `hash-${id}`, now.toISOString(), now.toISOString());
}

function insertAssessment(id: string, identityId: string, status = "completed"): void {
  if (status !== "completed") db.exec("PRAGMA ignore_check_constraints = ON");
  try {
    db.prepare(
      `INSERT INTO assessments (
        assessment_id, platform_identity_id, visitor_id, submission_id, target_company, target_role,
        question_set_version, question_bank_hash, scoring_version, payload_ciphertext, payload_hash,
        status, completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      identityId,
      "visitor_test",
      `sub_${id}`,
      "D",
      "PM",
      "question-v1",
      "question-hash",
      "score-v1",
      "TEST_PAYLOAD_CIPHER_SECRET",
      `payload-hash-${id}`,
      status,
      now.toISOString(),
      now.toISOString(),
      now.toISOString()
    );
  } finally {
    if (status !== "completed") db.exec("PRAGMA ignore_check_constraints = OFF");
  }
}

function insertSnapshot(
  id: string,
  assessmentId: string,
  overrides: Partial<{ cipher: string; hash: string; version: string }> = {}
): void {
  const assessment = db.prepare("SELECT id FROM assessments WHERE assessment_id = ?").get(assessmentId) as { id: number };
  db.prepare(
    "INSERT INTO report_snapshots (report_snapshot_id, assessment_row_id, report_version, free_result_json, full_report_ciphertext, full_report_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    assessment.id,
    overrides.version ?? "report-v1",
    "{}",
    overrides.cipher ?? "TEST_REPORT_CIPHER_SECRET",
    overrides.hash ?? "TEST_REPORT_HASH_SECRET",
    now.toISOString()
  );
}

function assertFailure(code: string, input: { platformIdentityId: string; assessmentId: string }, assessmentId?: string, snapshotId?: string): void {
  const before = snapshotState(assessmentId, snapshotId);
  assert.throws(
    () => createOrReuseGoalFitPaymentOrder({ ...input, now }),
    (error: unknown) => {
      assert.ok(error instanceof GoalFitPaymentOrderError);
      assert.equal(error.code, code);
      assert.equal(error.message, code);
      assert.equal(error.stack?.includes("TEST_"), false);
      return true;
    }
  );
  assert.deepEqual(snapshotState(assessmentId, snapshotId), before);
}

try {
  initializeDatabase();
  insertIdentity("identity_a");
  insertIdentity("identity_b");

  assertFailure("ASSESSMENT_NOT_FOUND", { platformIdentityId: "identity_a", assessmentId: "asm_missing" });

  insertAssessment("asm_other", "identity_a");
  insertSnapshot("rpt_other", "asm_other");
  assertFailure("ASSESSMENT_NOT_FOUND", { platformIdentityId: "identity_b", assessmentId: "asm_other" }, "asm_other", "rpt_other");

  insertAssessment("asm_not_completed", "identity_a", "pending");
  insertSnapshot("rpt_not_completed", "asm_not_completed");
  assertFailure("REPORT_NOT_PURCHASABLE", { platformIdentityId: "identity_a", assessmentId: "asm_not_completed" }, "asm_not_completed", "rpt_not_completed");

  insertAssessment("asm_no_snapshot", "identity_a");
  assertFailure("REPORT_SNAPSHOT_NOT_FOUND", { platformIdentityId: "identity_a", assessmentId: "asm_no_snapshot" }, "asm_no_snapshot");

  for (const nullableColumn of ["full_report_ciphertext", "full_report_hash", "report_version"]) {
    const beforeNullInsert = snapshotState("asm_no_snapshot");
    assert.throws(() => {
      db.prepare(
        `INSERT INTO report_snapshots (report_snapshot_id, assessment_row_id, report_version, free_result_json, full_report_ciphertext, full_report_hash, created_at)
         SELECT ?, id, ?, ?, ?, ?, ? FROM assessments WHERE assessment_id = ?`
      ).run(
        `rpt_null_${nullableColumn}`,
        nullableColumn === "report_version" ? null : "report-v1",
        "{}",
        nullableColumn === "full_report_ciphertext" ? null : "TEST_REPORT_CIPHER_SECRET",
        nullableColumn === "full_report_hash" ? null : "TEST_REPORT_HASH_SECRET",
        now.toISOString(),
        "asm_no_snapshot"
      );
    });
    assert.deepEqual(snapshotState("asm_no_snapshot"), beforeNullInsert);
  }

  for (const [suffix, overrides] of [
    ["cipher_empty", { cipher: "" }],
    ["hash_empty", { hash: "" }],
    ["version_empty", { version: "" }]
  ] as const) {
    const assessmentId = `asm_${suffix}`;
    const snapshotId = `rpt_${suffix}`;
    insertAssessment(assessmentId, "identity_a");
    insertSnapshot(snapshotId, assessmentId, overrides);
    assertFailure("REPORT_NOT_PURCHASABLE", { platformIdentityId: "identity_a", assessmentId }, assessmentId, snapshotId);
  }

  const pricingAssessment = "asm_bad_price";
  const pricingSnapshot = "rpt_bad_price";
  insertAssessment(pricingAssessment, "identity_a");
  insertSnapshot(pricingSnapshot, pricingAssessment);
  for (const price of [
    { productKey: "missing_product", amount: 1990, currency: "CNY" },
    { productKey: "goal_fit_full_report", amount: 1990.5, currency: "CNY" },
    { productKey: "goal_fit_full_report", amount: 0, currency: "CNY" },
    { productKey: "goal_fit_full_report", amount: 1990, currency: "USD" },
    { productKey: "goal_fit_full_report", amount: 1990, currency: "" }
  ]) {
    setGoalFitPaymentPriceReaderForTest(() => price);
    assertFailure("PRICE_NOT_AVAILABLE", { platformIdentityId: "identity_a", assessmentId: pricingAssessment }, pricingAssessment, pricingSnapshot);
  }
  setGoalFitPaymentPriceReaderForTest(null);

  const missingPriceAssessment = "asm_no_price";
  const missingPriceSnapshot = "rpt_no_price";
  insertAssessment(missingPriceAssessment, "identity_a");
  insertSnapshot(missingPriceSnapshot, missingPriceAssessment);
  db.prepare("DELETE FROM product_pricing_rules WHERE product_key = ?").run("goal_fit_report");
  assertFailure("PRICE_NOT_AVAILABLE", { platformIdentityId: "identity_a", assessmentId: missingPriceAssessment }, missingPriceAssessment, missingPriceSnapshot);

  db.prepare(
    "INSERT INTO product_pricing_rules (product_key, base_price_cents, sale_price_cents, invite_discount_cents, free_trial_enabled, allow_invite_discount_stack, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run("goal_fit_report", 1990, 1990, 0, 0, 1, 1, now.toISOString(), now.toISOString());
  const insertFailureAssessment = "asm_insert_failure";
  const insertFailureSnapshot = "rpt_insert_failure";
  insertAssessment(insertFailureAssessment, "identity_a");
  insertSnapshot(insertFailureSnapshot, insertFailureAssessment);
  db.exec("CREATE TRIGGER force_goal_fit_order_failure BEFORE INSERT ON orders BEGIN SELECT RAISE(ABORT, 'TEST_SQLITE_INSERT_FAILURE'); END;");
  try {
    assertFailure("ORDER_CREATE_FAILED", { platformIdentityId: "identity_a", assessmentId: insertFailureAssessment }, insertFailureAssessment, insertFailureSnapshot);
  } finally {
    db.exec("DROP TRIGGER IF EXISTS force_goal_fit_order_failure");
  }

  const beforeRecovery = countOrders();
  const recovery = createOrReuseGoalFitPaymentOrder({ platformIdentityId: "identity_a", assessmentId: insertFailureAssessment, now });
  assert.equal(recovery.reused, false);
  assert.equal(countOrders(), beforeRecovery + 1);

  for (const line of captured) {
    for (const value of sensitive) assert.equal(line.includes(value), false);
    assert.equal(/sqlite|select |insert |stack/i.test(line), false);
  }
} finally {
  setGoalFitPaymentPriceReaderForTest(null);
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  db.close();
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${databasePath}${suffix}`, { force: true });
}

console.log("Goal Fit miniapp payment order failure-path tests passed.");