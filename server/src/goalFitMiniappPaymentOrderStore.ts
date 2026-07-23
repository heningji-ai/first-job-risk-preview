import { db, runImmediateTransaction } from "./db.js";
import { createOrder, getOrder, getGoalFitPaymentOrders, updateGoalFitPaymentOrderStatus } from "./orders.js";
import { calculateGoalFitOrderAmount } from "./pricing.js";

export const GOAL_FIT_PAYMENT_ORDER_TTL_MS = 30 * 60 * 1000;
const GOAL_FIT_FULL_REPORT_PURPOSE = "goal_fit_full_report";

type PaymentOrderErrorCode =
  | "ASSESSMENT_NOT_FOUND"
  | "REPORT_SNAPSHOT_NOT_FOUND"
  | "REPORT_NOT_PURCHASABLE"
  | "PRICE_NOT_AVAILABLE"
  | "ORDER_CREATE_FAILED"
  | "ALREADY_PURCHASED";

type GoalFitPaymentPrice = {
  productKey: string;
  amount: number;
  currency: string;
};

let paymentPriceReaderForTest: (() => GoalFitPaymentPrice) | null = null;

export function setGoalFitPaymentPriceReaderForTest(
  reader: (() => GoalFitPaymentPrice) | null
): void {
  paymentPriceReaderForTest = reader;
}

export class GoalFitPaymentOrderError extends Error {
  constructor(readonly code: PaymentOrderErrorCode) {
    super(code);
    this.name = "GoalFitPaymentOrderError";
  }
}

function getPaymentPrice(now: Date): GoalFitPaymentPrice {
  try {
    if (paymentPriceReaderForTest) return paymentPriceReaderForTest();
    const amount = calculateGoalFitOrderAmount("direct", null, now);
    return {
      productKey: GOAL_FIT_FULL_REPORT_PURPOSE,
      amount: amount.payAmountCents,
      currency: "CNY"
    };
  } catch {
    throw new GoalFitPaymentOrderError("PRICE_NOT_AVAILABLE");
  }
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toPublicOrder(order: ReturnType<typeof getOrder>, input: { assessmentId: string; reportSnapshotId: string }, reused: boolean) {
  if (!order || !hasNonEmptyString(order.expiresAt)) {
    throw new GoalFitPaymentOrderError("ORDER_CREATE_FAILED");
  }

  return {
    orderId: order.id,
    outTradeNo: order.outTradeNo,
    assessmentId: input.assessmentId,
    reportSnapshotId: input.reportSnapshotId,
    orderPurpose: GOAL_FIT_FULL_REPORT_PURPOSE,
    status: order.status,
    amount: order.payAmountCents,
    currency: "CNY",
    expiresAt: order.expiresAt,
    reused
  };
}

export function createOrReuseGoalFitPaymentOrder(input: {
  platformIdentityId: string;
  assessmentId: string;
  now: Date;
}) {
  try {
    return runImmediateTransaction(() => {
      const assessment = db
        .prepare(
          "SELECT assessment_id, status FROM assessments WHERE assessment_id = ? AND platform_identity_id = ?"
        )
        .get(input.assessmentId, input.platformIdentityId) as { assessment_id: string; status: string } | undefined;

      if (!assessment) throw new GoalFitPaymentOrderError("ASSESSMENT_NOT_FOUND");
      if (assessment.status !== "completed") throw new GoalFitPaymentOrderError("REPORT_NOT_PURCHASABLE");

      const snapshot = db
        .prepare(
          `
            SELECT rs.report_snapshot_id, rs.full_report_ciphertext, rs.full_report_hash, rs.report_version
            FROM report_snapshots rs
            JOIN assessments a ON a.id = rs.assessment_row_id
            WHERE a.assessment_id = ?
          `
        )
        .get(input.assessmentId) as
        | {
            report_snapshot_id: string;
            full_report_ciphertext: unknown;
            full_report_hash: unknown;
            report_version: unknown;
          }
        | undefined;

      if (!snapshot) throw new GoalFitPaymentOrderError("REPORT_SNAPSHOT_NOT_FOUND");
      if (
        !hasNonEmptyString(snapshot.full_report_ciphertext) ||
        !hasNonEmptyString(snapshot.full_report_hash) ||
        !hasNonEmptyString(snapshot.report_version)
      ) {
        throw new GoalFitPaymentOrderError("REPORT_NOT_PURCHASABLE");
      }

      const price = getPaymentPrice(input.now);
      if (
        price.productKey !== GOAL_FIT_FULL_REPORT_PURPOSE ||
        !Number.isInteger(price.amount) ||
        price.amount <= 0 ||
        price.currency !== "CNY"
      ) {
        throw new GoalFitPaymentOrderError("PRICE_NOT_AVAILABLE");
      }

      const historicalOrders = getGoalFitPaymentOrders({
        platformIdentityId: input.platformIdentityId,
        assessmentId: input.assessmentId,
        orderPurpose: GOAL_FIT_FULL_REPORT_PURPOSE
      });
      if (historicalOrders.some((order) => order.status === "paid")) {
        throw new GoalFitPaymentOrderError("ALREADY_PURCHASED");
      }
      const activePending = historicalOrders.find(
        (order) => order.status === "pending" && hasNonEmptyString(order.expiresAt) && Date.parse(order.expiresAt) > input.now.getTime()
      );
      if (activePending) {
        return toPublicOrder(activePending, { assessmentId: input.assessmentId, reportSnapshotId: snapshot.report_snapshot_id }, true);
      }
      for (const order of historicalOrders) {
        if (order.status === "pending" && (!hasNonEmptyString(order.expiresAt) || Date.parse(order.expiresAt) <= input.now.getTime())) {
          updateGoalFitPaymentOrderStatus(order.id, "expired", input.now.toISOString());
        }
      }

      const created = createOrder({
        sessionId: input.platformIdentityId,
        accessMode: "direct",
        couponCode: null,
        paymentMode: "jsapi"
      });
      const expiresAt = new Date(input.now.getTime() + GOAL_FIT_PAYMENT_ORDER_TTL_MS).toISOString();
      db.prepare(
        `
          UPDATE orders
          SET platformIdentityId = ?, assessmentId = ?, reportSnapshotId = ?, orderPurpose = ?, expiresAt = ?
          WHERE id = ?
        `
      ).run(
        input.platformIdentityId,
        input.assessmentId,
        snapshot.report_snapshot_id,
        GOAL_FIT_FULL_REPORT_PURPOSE,
        expiresAt,
        created.id
      );

      const order = getOrder(created.id);
      if (!order || order.payAmountCents !== price.amount) {
        throw new GoalFitPaymentOrderError("ORDER_CREATE_FAILED");
      }
      return toPublicOrder(order, { assessmentId: input.assessmentId, reportSnapshotId: snapshot.report_snapshot_id }, false);
    });
  } catch (error) {
    if (error instanceof GoalFitPaymentOrderError) throw error;
    throw new GoalFitPaymentOrderError("ORDER_CREATE_FAILED");
  }
}