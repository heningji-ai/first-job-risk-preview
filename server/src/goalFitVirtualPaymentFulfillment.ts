import crypto from "node:crypto";
import { db, runImmediateTransactionWithBusyRetry } from "./db.js";
import { decryptIdentity } from "./miniappIdentity.js";
import { TrustedVirtualPaymentOrder } from "./miniappVirtualPaymentProvider.js";
import { getGoalFitVirtualPaymentAttemptById, updateGoalFitVirtualPaymentAttemptProviderState } from "./miniappVirtualPaymentAttempt.js";
import { decryptFullReport } from "./assessmentStore.js";

export class GoalFitVirtualPaymentFulfillmentError extends Error {
  constructor(readonly code: "PROVIDER_PAYMENT_MISMATCH" | "PROVIDER_PAYMENT_CONFLICT" | "ENTITLEMENT_CREATE_FAILED") { super(code); }
}

export type FulfillmentResult = { status: "paid"; reportAvailable: true; entitlementId: string; assessmentId: string; orderId: string; paymentAttemptId: string };

export function fulfillGoalFitVirtualPayment(input: { paymentAttemptId: string; trustedProviderResult: TrustedVirtualPaymentOrder; now?: Date }, connection = db): FulfillmentResult {
  const now = (input.now ?? new Date()).toISOString();
  return runImmediateTransactionWithBusyRetry(() => {
    const attempt = getGoalFitVirtualPaymentAttemptById(input.paymentAttemptId, connection);
    if (!attempt) throw new GoalFitVirtualPaymentFulfillmentError("PROVIDER_PAYMENT_MISMATCH");
    const order = connection.prepare("SELECT id, platformIdentityId, assessmentId, reportSnapshotId, orderPurpose, status, payAmountCents, outTradeNo FROM orders WHERE id = ?").get(attempt.orderId) as any;
    if (!order || order.platformIdentityId !== attempt.platformIdentityId || order.assessmentId !== attempt.assessmentId || order.orderPurpose !== "goal_fit_full_report" || order.outTradeNo === attempt.providerOutTradeNo) throw new GoalFitVirtualPaymentFulfillmentError("PROVIDER_PAYMENT_MISMATCH");
    const provider = input.trustedProviderResult;
    if (provider.orderId !== attempt.providerOutTradeNo || provider.orderFee !== order.payAmountCents || provider.paidFee !== order.payAmountCents || provider.orderType !== 0 && provider.orderType !== 7 || provider.envType !== (attempt.env === 0 ? 1 : 2)) throw new GoalFitVirtualPaymentFulfillmentError("PROVIDER_PAYMENT_MISMATCH");
    if (![2, 3, 4].includes(provider.status)) throw new GoalFitVirtualPaymentFulfillmentError("PROVIDER_PAYMENT_MISMATCH");
    const snapshot = connection.prepare("SELECT report_snapshot_id, full_report_ciphertext, full_report_hash FROM report_snapshots WHERE report_snapshot_id = ?").get(order.reportSnapshotId) as any;
    if (!snapshot || !snapshot.full_report_hash || !snapshot.full_report_ciphertext || !decryptFullReport(snapshot.report_snapshot_id, connection)) throw new GoalFitVirtualPaymentFulfillmentError("PROVIDER_PAYMENT_MISMATCH");
    const existing = connection.prepare("SELECT id, platform_identity_id, assessment_id, report_snapshot_id, order_id, payment_attempt_id, status FROM goal_fit_report_entitlements WHERE platform_identity_id = ? AND assessment_id = ? AND status = 'active'").get(attempt.platformIdentityId, attempt.assessmentId) as any;
    if (existing) {
      if (existing.report_snapshot_id !== order.reportSnapshotId || existing.order_id !== order.id) throw new GoalFitVirtualPaymentFulfillmentError("PROVIDER_PAYMENT_CONFLICT");
      connection.prepare("UPDATE miniapp_virtual_payment_attempts SET status = 'paid', wx_order_id = COALESCE(?, wx_order_id), channel_order_id = COALESCE(?, channel_order_id), wxpay_order_id = COALESCE(?, wxpay_order_id), order_type = ?, paid_fee = ?, paid_at = COALESCE(?, paid_at), updated_at = ? WHERE id = ? AND (status = 'paid' OR status = 'prepared')").run(provider.wxOrderId, provider.channelOrderId, provider.wxpayOrderId, provider.orderType, provider.paidFee, provider.paidTime, now, attempt.id);
      return { status: "paid", reportAvailable: true, entitlementId: existing.id, assessmentId: attempt.assessmentId, orderId: order.id, paymentAttemptId: existing.payment_attempt_id };
    }
    const entitlementId = crypto.randomUUID();
    connection.prepare("UPDATE miniapp_virtual_payment_attempts SET status = 'paid', wx_order_id = ?, channel_order_id = ?, wxpay_order_id = ?, order_type = ?, paid_fee = ?, paid_at = ?, updated_at = ? WHERE id = ? AND status = 'prepared'").run(provider.wxOrderId, provider.channelOrderId, provider.wxpayOrderId, provider.orderType, provider.paidFee, provider.paidTime ?? now, now, attempt.id);
    connection.prepare("UPDATE orders SET status = 'paid', paidAt = COALESCE(?, paidAt), wechatTransactionId = COALESCE(?, wechatTransactionId), updatedAt = ? WHERE id = ? AND status IN ('pending','paid')").run(provider.paidTime ?? now, provider.wxpayOrderId, now, order.id);
    try { connection.prepare("INSERT INTO goal_fit_report_entitlements (id,platform_identity_id,assessment_id,report_snapshot_id,order_id,payment_attempt_id,status,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(entitlementId, attempt.platformIdentityId, attempt.assessmentId, order.reportSnapshotId, order.id, attempt.id, "active", "wechat_miniapp_virtual_payment", now, now); } catch { throw new GoalFitVirtualPaymentFulfillmentError("ENTITLEMENT_CREATE_FAILED"); }
    return { status: "paid", reportAvailable: true, entitlementId, assessmentId: attempt.assessmentId, orderId: order.id, paymentAttemptId: attempt.id };
  }, undefined, connection);
}

export function getCurrentMiniappIdentity(connection = db, platformIdentityId: string): { id: string; openid: string } | null {
  const row = connection.prepare("SELECT id, openid_ciphertext FROM platform_identities WHERE id = ? AND platform = 'wechat_miniapp'").get(platformIdentityId) as { id: string; openid_ciphertext: string } | undefined;
  if (!row) return null;
  return { id: row.id, openid: decryptIdentity(row.openid_ciphertext) };
}
