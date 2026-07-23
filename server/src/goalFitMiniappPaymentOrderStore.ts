import { nanoid } from "nanoid";
import type { DatabaseSync } from "node:sqlite";
import { db, runImmediateTransactionWithBusyRetry } from "./db.js";
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

type GoalFitPaymentOrderInput = {
  platformIdentityId: string;
  assessmentId: string;
  now: Date;
};

type GoalFitPaymentOrderRecord = NonNullable<ReturnType<typeof getOrder>>;

type GoalFitPaymentOrderStore = {
  createOrReuseGoalFitPaymentOrder: (input: GoalFitPaymentOrderInput) => ReturnType<typeof toPublicOrder>;
};

type SqliteConstraintLike = {
  code?: unknown;
  errcode?: unknown;
  errno?: unknown;
  message?: unknown;
  cause?: unknown;
};

const orderColumns = `
  id,
  outTradeNo,
  sessionId,
  status,
  accessMode,
  originalAmountCents,
  discountAmountCents,
  payAmountCents,
  couponCode,
  paymentProvider,
  paymentMode,
  wechatPrepayId,
  wechatCodeUrl,
  wechatTransactionId,
  sourceReferralCode,
  referralVisitId,
  analyticsVisitorId,
  analyticsSource,
  analyticsChannel,
  analyticsCampaign,
  analyticsReferralCode,
  basePriceCents,
  salePriceCents,
  discountCents,
  finalAmountCents,
  pricingRuleId,
  pricingSnapshotJson,
  pricingMode,
  createdAt,
  updatedAt,
  platformIdentityId,
  assessmentId,
  reportSnapshotId,
  orderPurpose,
  expiresAt,
  paidAt
`;

function createOutTradeNo(): string {
  return `GF${Date.now()}${nanoid(10).toUpperCase()}`;
}

function mapOrder(row: unknown): GoalFitPaymentOrderRecord | null {
  if (!row || typeof row !== "object") return null;
  return row as GoalFitPaymentOrderRecord;
}

export function isGoalFitPendingUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as SqliteConstraintLike;
  const code = typeof value.code === "string" ? value.code : "";
  const errcode = typeof value.errcode === "number" ? value.errcode : undefined;
  const errno = typeof value.errno === "number" ? value.errno : undefined;
  const message = typeof value.message === "string" ? value.message : "";
  const cause = typeof value.cause === "object" && value.cause ? value.cause : undefined;

  const isConstraint =
    code === "SQLITE_CONSTRAINT" ||
    code === "ERR_SQLITE_ERROR" ||
    errcode === 19 ||
    errcode === 2067 ||
    errno === 19 ||
    errno === 2067 ||
    (cause ? isGoalFitPendingUniqueConstraintError(cause) : false);
  if (!isConstraint) return false;

  const normalized = message.replace(/\s+/g, " ").toLowerCase();
  const hasGoalFitPendingColumns =
    normalized.includes("orders.platformidentityid") &&
    normalized.includes("orders.assessmentid") &&
    normalized.includes("orders.orderpurpose");
  const hasGoalFitPendingIndex = normalized.includes("uq_orders_goal_fit_pending");

  return hasGoalFitPendingIndex || hasGoalFitPendingColumns;
}

function getInjectedPaymentPrice(connection: DatabaseSync, now: Date): GoalFitPaymentPrice {
  if (paymentPriceReaderForTest) return paymentPriceReaderForTest();

  const row = connection
    .prepare(
      `
        SELECT id, product_key, base_price_cents, sale_price_cents, invite_discount_cents,
               free_trial_enabled, free_trial_start_at, free_trial_end_at, enabled
        FROM product_pricing_rules
        WHERE product_key = ? AND enabled = 1
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `
    )
    .get("goal_fit_report") as
    | {
        product_key: string;
        base_price_cents: number;
        sale_price_cents: number;
        invite_discount_cents: number;
        free_trial_enabled: number;
        free_trial_start_at: string | null;
        free_trial_end_at: string | null;
        enabled: number;
      }
    | undefined;

  if (!row) throw new GoalFitPaymentOrderError("PRICE_NOT_AVAILABLE");

  const currentTime = now.getTime();
  const freeTrialActive =
    row.enabled === 1 &&
    row.free_trial_enabled === 1 &&
    (!row.free_trial_start_at || currentTime >= new Date(row.free_trial_start_at).getTime()) &&
    (!row.free_trial_end_at || currentTime <= new Date(row.free_trial_end_at).getTime());

  return {
    productKey: GOAL_FIT_FULL_REPORT_PURPOSE,
    amount: freeTrialActive ? 0 : Number(row.sale_price_cents),
    currency: "CNY"
  };
}

function getInjectedGoalFitPaymentOrders(
  connection: DatabaseSync,
  input: { platformIdentityId: string; assessmentId: string; orderPurpose: string }
): GoalFitPaymentOrderRecord[] {
  return connection
    .prepare(
      `SELECT ${orderColumns} FROM orders WHERE platformIdentityId = ? AND assessmentId = ? AND orderPurpose = ? ORDER BY createdAt ASC, id ASC`
    )
    .all(input.platformIdentityId, input.assessmentId, input.orderPurpose) as GoalFitPaymentOrderRecord[];
}

function updateInjectedGoalFitPaymentOrderStatus(
  connection: DatabaseSync,
  orderId: string,
  status: string,
  now: string
): GoalFitPaymentOrderRecord | null {
  connection.prepare("UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?").run(status, now, orderId);
  return getInjectedOrder(connection, orderId);
}

function getInjectedOrder(connection: DatabaseSync, orderId: string): GoalFitPaymentOrderRecord | null {
  return mapOrder(connection.prepare(`SELECT ${orderColumns} FROM orders WHERE id = ?`).get(orderId));
}

function createInjectedOrder(
  connection: DatabaseSync,
  input: {
    platformIdentityId: string;
    assessmentId: string;
    reportSnapshotId: string;
    now: Date;
    price: GoalFitPaymentPrice;
    throwBeforeInsert?: () => void;
  }
): GoalFitPaymentOrderRecord {
  const now = input.now.toISOString();
  const expiresAt = new Date(input.now.getTime() + GOAL_FIT_PAYMENT_ORDER_TTL_MS).toISOString();
  const order = {
    id: nanoid(),
    outTradeNo: createOutTradeNo(),
    sessionId: input.platformIdentityId,
    status: "pending",
    accessMode: "direct",
    originalAmountCents: input.price.amount,
    discountAmountCents: 0,
    payAmountCents: input.price.amount,
    couponCode: null,
    paymentProvider: "wechat",
    paymentMode: "jsapi",
    wechatPrepayId: null,
    wechatCodeUrl: null,
    wechatTransactionId: null,
    sourceReferralCode: null,
    referralVisitId: null,
    analyticsVisitorId: null,
    analyticsSource: null,
    analyticsChannel: null,
    analyticsCampaign: null,
    analyticsReferralCode: null,
    basePriceCents: input.price.amount,
    salePriceCents: input.price.amount,
    discountCents: 0,
    finalAmountCents: input.price.amount,
    pricingRuleId: null,
    pricingSnapshotJson: null,
    pricingMode: "normal",
    createdAt: now,
    updatedAt: now,
    platformIdentityId: input.platformIdentityId,
    assessmentId: input.assessmentId,
    reportSnapshotId: input.reportSnapshotId,
    orderPurpose: GOAL_FIT_FULL_REPORT_PURPOSE,
    expiresAt,
    paidAt: null
  };

  input.throwBeforeInsert?.();
  connection
    .prepare(
      `
        INSERT INTO orders (
          ${orderColumns}
        ) VALUES (
          @id,
          @outTradeNo,
          @sessionId,
          @status,
          @accessMode,
          @originalAmountCents,
          @discountAmountCents,
          @payAmountCents,
          @couponCode,
          @paymentProvider,
          @paymentMode,
          @wechatPrepayId,
          @wechatCodeUrl,
          @wechatTransactionId,
          @sourceReferralCode,
          @referralVisitId,
          @analyticsVisitorId,
          @analyticsSource,
          @analyticsChannel,
          @analyticsCampaign,
          @analyticsReferralCode,
          @basePriceCents,
          @salePriceCents,
          @discountCents,
          @finalAmountCents,
          @pricingRuleId,
          @pricingSnapshotJson,
          @pricingMode,
          @createdAt,
          @updatedAt,
          @platformIdentityId,
          @assessmentId,
          @reportSnapshotId,
          @orderPurpose,
          @expiresAt,
          @paidAt
        )
      `
    )
    .run(order);

  return order as GoalFitPaymentOrderRecord;
}

export function createGoalFitMiniappPaymentOrderStore(options?: {
  connection?: DatabaseSync;
  onBusyRetry?: (event: { attempt: number; delayMs: number }) => void;
  throwBeforeOrderInsertForTest?: () => void;
  beforeWinnerRecoveryForTest?: () => void;
}): GoalFitPaymentOrderStore {
  const connection = options?.connection ?? db;
  const useInjectedConnection = Boolean(options?.connection);

  return {
    createOrReuseGoalFitPaymentOrder(input) {
      const recoverWinner = () => {
        const historicalOrders = useInjectedConnection
          ? getInjectedGoalFitPaymentOrders(connection, {
              platformIdentityId: input.platformIdentityId,
              assessmentId: input.assessmentId,
              orderPurpose: GOAL_FIT_FULL_REPORT_PURPOSE
            })
          : getGoalFitPaymentOrders({
              platformIdentityId: input.platformIdentityId,
              assessmentId: input.assessmentId,
              orderPurpose: GOAL_FIT_FULL_REPORT_PURPOSE
            });

        if (historicalOrders.some((order) => order.status === "paid")) {
          throw new GoalFitPaymentOrderError("ALREADY_PURCHASED");
        }

        const activePending = historicalOrders.find(
          (order) =>
            order.status === "pending" &&
            hasNonEmptyString(order.expiresAt) &&
            Date.parse(order.expiresAt) > input.now.getTime()
        );
        if (!activePending) return null;

        return toPublicOrder(
          activePending,
          { assessmentId: input.assessmentId, reportSnapshotId: activePending.reportSnapshotId ?? "" },
          true
        );
      };

      for (let createAttempt = 0; createAttempt < 2; createAttempt += 1) {
  try {
        return runImmediateTransactionWithBusyRetry(() => {
      const assessment = connection
        .prepare(
          "SELECT assessment_id, status FROM assessments WHERE assessment_id = ? AND platform_identity_id = ?"
        )
        .get(input.assessmentId, input.platformIdentityId) as { assessment_id: string; status: string } | undefined;

      if (!assessment) throw new GoalFitPaymentOrderError("ASSESSMENT_NOT_FOUND");
      if (assessment.status !== "completed") throw new GoalFitPaymentOrderError("REPORT_NOT_PURCHASABLE");

      const snapshot = connection
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

          const price = useInjectedConnection ? getInjectedPaymentPrice(connection, input.now) : getPaymentPrice(input.now);
      if (
        price.productKey !== GOAL_FIT_FULL_REPORT_PURPOSE ||
        !Number.isInteger(price.amount) ||
        price.amount <= 0 ||
        price.currency !== "CNY"
      ) {
        throw new GoalFitPaymentOrderError("PRICE_NOT_AVAILABLE");
      }

          const historicalOrders = useInjectedConnection
            ? getInjectedGoalFitPaymentOrders(connection, {
                platformIdentityId: input.platformIdentityId,
                assessmentId: input.assessmentId,
                orderPurpose: GOAL_FIT_FULL_REPORT_PURPOSE
              })
            : getGoalFitPaymentOrders({
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
              if (useInjectedConnection) updateInjectedGoalFitPaymentOrderStatus(connection, order.id, "expired", input.now.toISOString());
              else updateGoalFitPaymentOrderStatus(order.id, "expired", input.now.toISOString());
        }
      }

          const order = useInjectedConnection
            ? createInjectedOrder(connection, {
                platformIdentityId: input.platformIdentityId,
                assessmentId: input.assessmentId,
                reportSnapshotId: snapshot.report_snapshot_id,
                now: input.now,
                price,
                throwBeforeInsert: options?.throwBeforeOrderInsertForTest
              })
            : (() => {
                options?.throwBeforeOrderInsertForTest?.();
                const created = createOrder({
                  sessionId: input.platformIdentityId,
                  accessMode: "direct",
                  couponCode: null,
                  paymentMode: "jsapi"
                });
                const expiresAt = new Date(input.now.getTime() + GOAL_FIT_PAYMENT_ORDER_TTL_MS).toISOString();
                connection
                  .prepare(
                    `
                      UPDATE orders
                      SET platformIdentityId = ?, assessmentId = ?, reportSnapshotId = ?, orderPurpose = ?, expiresAt = ?
                      WHERE id = ?
                    `
                  )
                  .run(
                    input.platformIdentityId,
                    input.assessmentId,
                    snapshot.report_snapshot_id,
                    GOAL_FIT_FULL_REPORT_PURPOSE,
                    expiresAt,
                    created.id
                  );

                return getOrder(created.id);
              })();
      if (!order || order.payAmountCents !== price.amount) {
        throw new GoalFitPaymentOrderError("ORDER_CREATE_FAILED");
      }
      return toPublicOrder(order, { assessmentId: input.assessmentId, reportSnapshotId: snapshot.report_snapshot_id }, false);
    }, options?.onBusyRetry ? { onBusyRetry: options.onBusyRetry } : undefined, connection);
  } catch (error) {
    if (error instanceof GoalFitPaymentOrderError) throw error;
    if (isGoalFitPendingUniqueConstraintError(error)) {
      options?.beforeWinnerRecoveryForTest?.();
      const recovered = recoverWinner();
      if (recovered) return recovered;
      if (createAttempt === 0) continue;
    }
    throw new GoalFitPaymentOrderError("ORDER_CREATE_FAILED");
  }
      }

      throw new GoalFitPaymentOrderError("ORDER_CREATE_FAILED");
    }
  };
}

export function createOrReuseGoalFitPaymentOrder(input: GoalFitPaymentOrderInput) {
  return createGoalFitMiniappPaymentOrderStore().createOrReuseGoalFitPaymentOrder(input);
}
