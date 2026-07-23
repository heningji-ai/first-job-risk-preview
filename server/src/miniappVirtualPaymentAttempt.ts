import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { db, runImmediateTransactionWithBusyRetry } from "./db.js";

const GOAL_FIT_FULL_REPORT_PURPOSE = "goal_fit_full_report";
const REQUEST_ID_PATTERN = /^(?:req_[A-Za-z0-9_-]{8,128}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const PROVIDER_OUT_TRADE_NO_PATTERN = /^[A-Za-z0-9|*@_-]{8,32}$/;

/**
 * orders is the logical full-report purchase order.
 * An attempt is one provider invocation. The provider out_trade_no comes from
 * the attempt, never from orders.outTradeNo. The same requestId is HTTP retry
 * idempotency; a new payment retry must use a new requestId.
 */
export type GoalFitVirtualPaymentAttemptStatus = "prepared" | "paid" | "closed" | "failed" | "superseded";
export type GoalFitVirtualPaymentAttemptErrorCode =
  | "ORDER_NOT_FOUND"
  | "ORDER_NOT_PAYABLE"
  | "ORDER_OWNERSHIP_MISMATCH"
  | "INVALID_PAYMENT_REQUEST_ID"
  | "INVALID_PAYMENT_ENV"
  | "PAYMENT_ATTEMPT_CREATE_FAILED";

export class GoalFitVirtualPaymentAttemptError extends Error {
  constructor(readonly code: GoalFitVirtualPaymentAttemptErrorCode) {
    super(code);
    this.name = "GoalFitVirtualPaymentAttemptError";
  }
}

export type GoalFitVirtualPaymentAttempt = {
  id: string;
  orderId: string;
  requestId: string;
  providerOutTradeNo: string;
  platformIdentityId: string;
  assessmentId: string;
  env: number;
  status: GoalFitVirtualPaymentAttemptStatus;
  wxOrderId: string | null;
  channelOrderId: string | null;
  wxpayOrderId: string | null;
  orderType: number | null;
  paidFee: number | null;
  paidAt: string | null;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
  providerDeliveryState: "not_started" | "pending" | "succeeded" | "failed";
  providerDeliveryUpdatedAt: string | null;
  providerDeliveryFailureCode: string | null;
  reused: boolean;
};

function providerOutTradeNo(): string {
  return `GF${Date.now().toString(36)}${crypto.randomBytes(8).toString("base64url").replace(/[^A-Za-z0-9_-]/g, "")}`.slice(0, 32);
}

function mapAttempt(row: Record<string, unknown>, reused: boolean): GoalFitVirtualPaymentAttempt {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    requestId: String(row.request_id),
    providerOutTradeNo: String(row.provider_out_trade_no),
    platformIdentityId: String(row.platform_identity_id),
    assessmentId: String(row.assessment_id),
    env: Number(row.env),
    status: row.status as GoalFitVirtualPaymentAttemptStatus,
    wxOrderId: row.wx_order_id == null ? null : String(row.wx_order_id),
    channelOrderId: row.channel_order_id == null ? null : String(row.channel_order_id),
    wxpayOrderId: row.wxpay_order_id == null ? null : String(row.wxpay_order_id),
    orderType: row.order_type == null ? null : Number(row.order_type),
    paidFee: row.paid_fee == null ? null : Number(row.paid_fee),
    paidAt: row.paid_at == null ? null : String(row.paid_at),
    failureCode: row.failure_code == null ? null : String(row.failure_code),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    providerDeliveryState: (row.provider_delivery_state ?? "not_started") as GoalFitVirtualPaymentAttempt["providerDeliveryState"],
    providerDeliveryUpdatedAt: row.provider_delivery_updated_at == null ? null : String(row.provider_delivery_updated_at),
    providerDeliveryFailureCode: row.provider_delivery_failure_code == null ? null : String(row.provider_delivery_failure_code),
    reused,
  };
}

export function getGoalFitVirtualPaymentAttemptById(id: string, connection: DatabaseSync = db): GoalFitVirtualPaymentAttempt | null {
  const row = connection.prepare("SELECT * FROM miniapp_virtual_payment_attempts WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? mapAttempt(row, false) : null;
}

export function updateGoalFitVirtualPaymentAttemptProviderState(input: { id: string; status?: GoalFitVirtualPaymentAttemptStatus; providerDeliveryState?: "not_started" | "pending" | "succeeded" | "failed"; failureCode?: string | null; now: string }, connection: DatabaseSync = db): void {
  connection.prepare("UPDATE miniapp_virtual_payment_attempts SET status = COALESCE(?, status), provider_delivery_state = COALESCE(?, provider_delivery_state), provider_delivery_failure_code = ?, provider_delivery_updated_at = ?, updated_at = ? WHERE id = ?").run(input.status ?? null, input.providerDeliveryState ?? null, input.failureCode ?? null, input.now, input.now, input.id);
}

function getAttempt(connection: DatabaseSync, orderId: string, requestId: string): GoalFitVirtualPaymentAttempt | null {
  const row = connection.prepare("SELECT * FROM miniapp_virtual_payment_attempts WHERE order_id = ? AND request_id = ?").get(orderId, requestId) as Record<string, unknown> | undefined;
  return row ? mapAttempt(row, true) : null;
}

function getOrder(connection: DatabaseSync, orderId: string): { id: string; platformIdentityId: string | null; assessmentId: string | null; orderPurpose: string | null; status: string } | undefined {
  return connection.prepare("SELECT id, platformIdentityId, assessmentId, orderPurpose, status FROM orders WHERE id = ?").get(orderId) as { id: string; platformIdentityId: string | null; assessmentId: string | null; orderPurpose: string | null; status: string } | undefined;
}

export function isValidGoalFitVirtualPaymentRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

export function isValidGoalFitVirtualPaymentEnv(value: unknown): value is number {
  return value === 0 || value === 1;
}

export function createOrReuseGoalFitVirtualPaymentAttempt(input: {
  orderId: string;
  platformIdentityId: string;
  assessmentId: string;
  requestId: string;
  env: number;
  now: Date;
}, connection: DatabaseSync = db): GoalFitVirtualPaymentAttempt {
  if (!isValidGoalFitVirtualPaymentRequestId(input.requestId)) throw new GoalFitVirtualPaymentAttemptError("INVALID_PAYMENT_REQUEST_ID");
  if (!isValidGoalFitVirtualPaymentEnv(input.env)) throw new GoalFitVirtualPaymentAttemptError("INVALID_PAYMENT_ENV");

  try {
    return runImmediateTransactionWithBusyRetry(() => {
      const order = getOrder(connection, input.orderId);
      if (!order) throw new GoalFitVirtualPaymentAttemptError("ORDER_NOT_FOUND");
      if (order.platformIdentityId !== input.platformIdentityId || order.assessmentId !== input.assessmentId) {
        throw new GoalFitVirtualPaymentAttemptError("ORDER_OWNERSHIP_MISMATCH");
      }
      if (order.orderPurpose !== GOAL_FIT_FULL_REPORT_PURPOSE || order.status !== "pending") {
        throw new GoalFitVirtualPaymentAttemptError("ORDER_NOT_PAYABLE");
      }

      const existing = getAttempt(connection, input.orderId, input.requestId);
      if (existing) return existing;

      const timestamp = input.now.toISOString();
      const attempt = {
        id: crypto.randomUUID(),
        orderId: input.orderId,
        requestId: input.requestId,
        providerOutTradeNo: providerOutTradeNo(),
        platformIdentityId: input.platformIdentityId,
        assessmentId: input.assessmentId,
        env: input.env,
        status: "prepared" as const,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      connection.prepare(`
        INSERT INTO miniapp_virtual_payment_attempts (
          id, order_id, request_id, provider_out_trade_no, platform_identity_id,
          assessment_id, env, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(attempt.id, attempt.orderId, attempt.requestId, attempt.providerOutTradeNo, attempt.platformIdentityId, attempt.assessmentId, attempt.env, attempt.status, attempt.createdAt, attempt.updatedAt);
      const created = connection.prepare("SELECT * FROM miniapp_virtual_payment_attempts WHERE id = ?").get(attempt.id) as Record<string, unknown> | undefined;
      if (!created) throw new GoalFitVirtualPaymentAttemptError("PAYMENT_ATTEMPT_CREATE_FAILED");
      return mapAttempt(created, false);
    }, undefined, connection);
  } catch (error) {
    if (error instanceof GoalFitVirtualPaymentAttemptError) throw error;
    const existing = getAttempt(connection, input.orderId, input.requestId);
    if (existing) return existing;
    throw new GoalFitVirtualPaymentAttemptError("PAYMENT_ATTEMPT_CREATE_FAILED");
  }
}
