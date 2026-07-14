process.env.GOAL_FIT_DB_PATH = "data/referral-discount-test.db";
process.env.NODE_ENV = "development";
process.env.PAYMENT_MODE = "mock";

const { initializeDatabase, db, databasePath } = await import("./db.js");
const {
  attachReferralVisitToOrder,
  confirmReferralCopied,
  createOrGetReferral,
  getReferralDiscountStatus,
  markReferralPaidForOrder,
  recordReferralVisit
} = await import("./referrals.js");
const {
  createOrReuseOrder,
  getOrderByOutTradeNo,
  markOrderPaidByOutTradeNo,
  updateOrderStatus
} = await import("./orders.js");

initializeDatabase();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function count(sql: string, params: Record<string, string | number | null> = {}): number {
  const row = db.prepare(sql).get(params) as { count: number } | undefined;
  return row?.count ?? 0;
}

const runId = `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const sourceSessionId = `${runId}_source_session`;
const sourceVisitorId = `${runId}_source_visitor`;
const invitedVisitorId = `${runId}_invited_visitor`;
const resultSessionId = `${runId}_result_session`;

const [referralA, referralB] = await Promise.all([
  Promise.resolve().then(() => createOrGetReferral({ sessionId: sourceSessionId, visitorId: sourceVisitorId })),
  Promise.resolve().then(() => createOrGetReferral({ sessionId: sourceSessionId, visitorId: sourceVisitorId }))
]);

assert(referralA.referralCode === referralB.referralCode, "concurrent referral creation must reuse one referralCode");
assert(
  count("SELECT COUNT(*) AS count FROM goal_fit_referrals WHERE sourceSessionId = @sourceSessionId", {
    sourceSessionId
  }) === 1,
  "sourceSessionId must map to one referral"
);

await Promise.all([
  Promise.resolve().then(() => confirmReferralCopied({ sessionId: sourceSessionId, visitorId: sourceVisitorId })),
  Promise.resolve().then(() => confirmReferralCopied({ sessionId: sourceSessionId, visitorId: sourceVisitorId }))
]);

const discountAfterCopy = getReferralDiscountStatus(sourceSessionId);
assert(discountAfterCopy.discountGranted, "copied referral must grant an active discount");
assert(discountAfterCopy.payAmountCents === 990, "active referral discount must reduce pay amount to 990 cents");
assert(
  count(
    "SELECT COUNT(*) AS count FROM goal_fit_referrals WHERE sourceSessionId = @sourceSessionId AND discountGrantedAt IS NOT NULL",
    { sourceSessionId }
  ) === 1,
  "one session must receive one referral discount record"
);

const fullPriceOrderBeforeDiscountUse = createOrReuseOrder({
  sessionId: sourceSessionId,
  accessMode: "direct",
  couponCode: null,
  paymentMode: "mock"
});
updateOrderStatus(fullPriceOrderBeforeDiscountUse.id, "paid");
markReferralPaidForOrder(fullPriceOrderBeforeDiscountUse.id);
assert(
  getReferralDiscountStatus(sourceSessionId).discountGranted,
  "a paid full-price order must not consume an active referral discount"
);

await Promise.all([
  Promise.resolve().then(() =>
    recordReferralVisit({
      referralCode: referralA.referralCode,
      visitorId: invitedVisitorId,
      landingPath: `/goal-fit-preview?ref=${referralA.referralCode}`
    })
  ),
  Promise.resolve().then(() =>
    recordReferralVisit({
      referralCode: referralA.referralCode,
      visitorId: invitedVisitorId,
      landingPath: `/goal-fit-preview?ref=${referralA.referralCode}`
    })
  )
]);

assert(
  count(
    `
      SELECT COUNT(*) AS count
      FROM goal_fit_referral_visits visit
      JOIN goal_fit_referrals referral ON referral.id = visit.referralId
      WHERE referral.referralCode = @referralCode AND visit.visitorId = @visitorId
    `,
    {
      referralCode: referralA.referralCode,
      visitorId: invitedVisitorId
    }
  ) === 1,
  "same referralId and visitorId must map to one referral visit"
);

const discountedOrderInput = {
  sessionId: sourceSessionId,
  accessMode: "share_coupon" as const,
  couponCode: "share_card" as const,
  paymentMode: "mock" as const,
  sourceReferralCode: referralA.referralCode,
  referralVisitId: null
};

const [orderA, orderB] = await Promise.all([
  Promise.resolve().then(() => createOrReuseOrder(discountedOrderInput)),
  Promise.resolve().then(() => createOrReuseOrder(discountedOrderInput))
]);

assert(orderA.id === orderB.id, "concurrent equivalent order creation must reuse one pending order");
assert(orderA.payAmountCents === 990, "discounted order must be 990 cents");

updateOrderStatus(orderA.id, "failed");
const discountAfterFailedOrder = getReferralDiscountStatus(sourceSessionId);
assert(discountAfterFailedOrder.discountGranted, "failed payment must not consume referral discount");

const retryOrder = createOrReuseOrder(discountedOrderInput);
assert(retryOrder.id !== orderA.id, "failed order must not block a new discounted payment attempt");
assert(retryOrder.payAmountCents === 990, "retry after failed payment must keep discounted amount");

attachReferralVisitToOrder({
  referralCode: referralA.referralCode,
  visitorId: invitedVisitorId,
  orderId: retryOrder.id
});

const paidOnce = markOrderPaidByOutTradeNo({
  outTradeNo: retryOrder.outTradeNo,
  transactionId: `${runId}_tx_1`,
  paidAt: new Date().toISOString()
});
assert(paidOnce?.status === "paid", "successful callback must mark order paid");
markReferralPaidForOrder(retryOrder.id);

const paidTwice = markOrderPaidByOutTradeNo({
  outTradeNo: retryOrder.outTradeNo,
  transactionId: `${runId}_tx_2`,
  paidAt: new Date().toISOString()
});
markReferralPaidForOrder(retryOrder.id);
const storedPaidOrder = getOrderByOutTradeNo(retryOrder.outTradeNo);

assert(paidTwice?.id === retryOrder.id, "duplicate callback must return the same paid order");
assert(storedPaidOrder?.wechatTransactionId === `${runId}_tx_1`, "duplicate callback must not overwrite paid transaction");
assert(
  count(
    "SELECT COUNT(*) AS count FROM goal_fit_referrals WHERE sourceSessionId = @sourceSessionId AND discountUsedOrderId = @orderId",
    {
      sourceSessionId,
      orderId: retryOrder.id
    }
  ) === 1,
  "paid order must consume the referral discount once"
);
assert(
  count("SELECT COUNT(*) AS count FROM goal_fit_referral_visits WHERE orderId = @orderId AND paidAt IS NOT NULL", {
    orderId: retryOrder.id
  }) === 1,
  "paid referral visit conversion must be recorded once"
);

const discountAfterPaid = getReferralDiscountStatus(sourceSessionId);
assert(!discountAfterPaid.discountGranted, "paid referral discount must no longer be active");
assert(discountAfterPaid.discountUsed, "paid referral discount must be marked used");
assert(discountAfterPaid.payAmountCents === 1990, "used referral discount must not reduce future pay amount");

const directAfterPaid = createOrReuseOrder({
  sessionId: sourceSessionId,
  accessMode: "direct",
  couponCode: null,
  paymentMode: "mock"
});
assert(directAfterPaid.payAmountCents === 1990, "after paid discount, future order must use standard price");

console.log("Goal Fit referral discount concurrency tests passed.");
console.log(`databasePath: ${databasePath}`);
