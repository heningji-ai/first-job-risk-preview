import { nanoid } from "nanoid";
import { calculateOrderAmount } from "./coupons.js";
import { db, runImmediateTransaction } from "./db.js";
import type {
  AccessMode,
  CouponCode,
  CreateOrderInput,
  OrderRecord,
  OrderStatus,
  PaymentMode,
  PaymentProvider
} from "./types.js";

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
  createdAt,
  updatedAt,
  paidAt
`;

function createOutTradeNo(): string {
  return `GF${Date.now()}${nanoid(10).toUpperCase()}`;
}

function toOrderRecord(row: unknown): OrderRecord | null {
  if (!row || typeof row !== "object") return null;
  return row as OrderRecord;
}

function getPaymentProvider(paymentMode: PaymentMode): PaymentProvider {
  return paymentMode === "mock" ? "mock" : "wechat";
}

export function createOrder(input: CreateOrderInput): OrderRecord {
  const now = new Date().toISOString();
  const amount = calculateOrderAmount(input.accessMode, input.couponCode);
  const order: OrderRecord = {
    id: nanoid(),
    outTradeNo: createOutTradeNo(),
    sessionId: input.sessionId,
    status: "pending",
    accessMode: input.accessMode,
    originalAmountCents: amount.originalAmountCents,
    discountAmountCents: amount.discountAmountCents,
    payAmountCents: amount.payAmountCents,
    couponCode: amount.couponCode,
    paymentProvider: getPaymentProvider(input.paymentMode),
    paymentMode: input.paymentMode,
    wechatPrepayId: null,
    wechatCodeUrl: null,
    wechatTransactionId: null,
    sourceReferralCode: input.sourceReferralCode ?? null,
    referralVisitId: input.referralVisitId ?? null,
    createdAt: now,
    updatedAt: now,
    paidAt: null
  };

  db.prepare(
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
        @createdAt,
        @updatedAt,
        @paidAt
      )
    `
  ).run(order);

  return order;
}

export function getOrder(orderId: string): OrderRecord | null {
  return toOrderRecord(db.prepare(`SELECT ${orderColumns} FROM orders WHERE id = ?`).get(orderId));
}

export function getReusablePendingOrder(input: CreateOrderInput): OrderRecord | null {
  const amount = calculateOrderAmount(input.accessMode, input.couponCode);

  return toOrderRecord(
    db
      .prepare(
        `
          SELECT ${orderColumns}
          FROM orders
          WHERE sessionId = @sessionId
            AND status = 'pending'
            AND accessMode = @accessMode
            AND paymentMode = @paymentMode
            AND payAmountCents = @payAmountCents
            AND COALESCE(couponCode, '') = COALESCE(@couponCode, '')
          ORDER BY createdAt DESC
          LIMIT 1
        `
      )
      .get({
        sessionId: input.sessionId,
        accessMode: input.accessMode,
        paymentMode: input.paymentMode,
        payAmountCents: amount.payAmountCents,
        couponCode: amount.couponCode
      })
  );
}

export function createOrReuseOrder(input: CreateOrderInput): OrderRecord {
  return runImmediateTransaction(() => {
    const existing = getReusablePendingOrder(input);
    if (existing) return existing;

    return createOrder(input);
  });
}

export function getOrderByOutTradeNo(outTradeNo: string): OrderRecord | null {
  return toOrderRecord(db.prepare(`SELECT ${orderColumns} FROM orders WHERE outTradeNo = ?`).get(outTradeNo));
}

export function updateOrderStatus(orderId: string, status: OrderStatus): OrderRecord | null {
  const now = new Date().toISOString();
  const paidAt = status === "paid" ? now : null;

  db.prepare(
    `
      UPDATE orders
      SET status = @status,
          updatedAt = @updatedAt,
          paidAt = COALESCE(@paidAt, paidAt)
      WHERE id = @orderId
    `
  ).run({
    orderId,
    status,
    updatedAt: now,
    paidAt
  });

  return getOrder(orderId);
}

export function saveWechatNativePayment(orderId: string, codeUrl: string): OrderRecord | null {
  const now = new Date().toISOString();

  db.prepare(
    `
      UPDATE orders
      SET paymentProvider = 'wechat',
          paymentMode = 'native',
          wechatCodeUrl = @codeUrl,
          status = 'pending',
          updatedAt = @updatedAt
      WHERE id = @orderId
    `
  ).run({
    orderId,
    codeUrl,
    updatedAt: now
  });

  return getOrder(orderId);
}

export function saveWechatJsapiPayment(orderId: string, prepayId: string): OrderRecord | null {
  const now = new Date().toISOString();

  db.prepare(
    `
      UPDATE orders
      SET paymentProvider = 'wechat',
          paymentMode = 'jsapi',
          wechatPrepayId = @prepayId,
          wechatCodeUrl = NULL,
          status = 'pending',
          updatedAt = @updatedAt
      WHERE id = @orderId
    `
  ).run({
    orderId,
    prepayId,
    updatedAt: now
  });

  return getOrder(orderId);
}

export function markOrderPaidByOutTradeNo(params: {
  outTradeNo: string;
  transactionId: string;
  paidAt: string;
}): OrderRecord | null {
  const existingOrder = getOrderByOutTradeNo(params.outTradeNo);
  if (!existingOrder) return null;

  if (existingOrder.status === "paid") return existingOrder;

  const now = new Date().toISOString();

  db.prepare(
    `
      UPDATE orders
      SET status = 'paid',
          wechatTransactionId = @transactionId,
          paidAt = @paidAt,
          updatedAt = @updatedAt
      WHERE outTradeNo = @outTradeNo
    `
  ).run({
    outTradeNo: params.outTradeNo,
    transactionId: params.transactionId,
    paidAt: params.paidAt,
    updatedAt: now
  });

  return getOrderByOutTradeNo(params.outTradeNo);
}

export function getPaidOrderBySessionId(sessionId: string): OrderRecord | null {
  return toOrderRecord(
    db
      .prepare(
        `
          SELECT ${orderColumns}
          FROM orders
          WHERE sessionId = ? AND status = 'paid'
          ORDER BY updatedAt DESC
          LIMIT 1
        `
      )
      .get(sessionId)
  );
}

export function isPaymentMode(value: unknown): value is PaymentMode {
  return value === "mock" || value === "native" || value === "jsapi" || value === "h5";
}
