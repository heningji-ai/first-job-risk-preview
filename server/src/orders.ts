import { nanoid } from "nanoid";
import { calculateOrderAmount } from "./coupons.js";
import { db } from "./db.js";
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

export function isAccessMode(value: unknown): value is AccessMode {
  return value === "direct" || value === "share_coupon";
}

export function isCouponCode(value: unknown): value is CouponCode {
  return value === "share_card";
}

export function isPaymentMode(value: unknown): value is PaymentMode {
  return value === "mock" || value === "native" || value === "jsapi" || value === "h5";
}
