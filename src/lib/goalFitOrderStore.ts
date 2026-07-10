import { buildApiUrl } from "../config/api";

const ORDER_STORAGE_PREFIX = "goalFitOrder:";

export type GoalFitOrderStatus = "pending" | "paid" | "expired" | "closed" | "failed" | "cancelled";

export type GoalFitAccessMode = "direct" | "share_coupon";

export type GoalFitPaymentMode = "mock" | "native" | "jsapi" | "h5";

export type GoalFitOrder = {
  id?: string;
  orderId?: string;
  outTradeNo?: string;
  sessionId: string;
  productCode?: "goal_fit_full_report";
  productName?: "完整目标适配报告";
  amount?: 1990;
  status: GoalFitOrderStatus;
  accessMode?: GoalFitAccessMode;
  originalAmountCents: number;
  discountAmountCents: number;
  payAmountCents: number;
  couponCode?: "share_card";
  paymentProvider?: "mock" | "wechat";
  paymentMode?: GoalFitPaymentMode;
  wechatPrepayId?: string | null;
  wechatCodeUrl?: string | null;
  currency: "CNY";
  createdAt: string;
  updatedAt?: string;
  paidAt?: string;
};

export type CreateGoalFitOrderRequest = {
  sessionId: string;
  accessMode: GoalFitAccessMode;
  couponCode: "share_card" | null;
  paymentMode: GoalFitPaymentMode;
};

export type GoalFitUnlockStatus = {
  unlocked: boolean;
  orderId: string | null;
  accessMode: GoalFitAccessMode | null;
};

function getStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;

  return (globalThis as { localStorage?: Storage }).localStorage;
}

function getOrderKey(sessionId: string): string {
  return `${ORDER_STORAGE_PREFIX}${sessionId}`;
}

function createOrderId(sessionId: string): string {
  return `goal_fit_order_${sessionId}_${Date.now().toString(36)}`;
}

function getOrderAmount(couponCode?: "share_card") {
  const originalAmountCents = 1990;
  const discountAmountCents = couponCode === "share_card" ? 1000 : 0;
  const payAmountCents = originalAmountCents - discountAmountCents;

  return {
    originalAmountCents,
    discountAmountCents,
    payAmountCents,
    couponCode
  };
}

export function createGoalFitOrder(sessionId: string, couponCode?: "share_card"): GoalFitOrder | null {
  const storage = getStorage();
  if (!storage || !sessionId) return null;

  const existingOrder = getGoalFitOrder(sessionId);
  if (existingOrder && existingOrder.couponCode === couponCode) return existingOrder;

  const amount = getOrderAmount(couponCode);

  const order: GoalFitOrder = {
    orderId: createOrderId(sessionId),
    sessionId,
    productCode: "goal_fit_full_report",
    productName: "完整目标适配报告",
    amount: 1990,
    ...amount,
    currency: "CNY",
    status: "pending",
    createdAt: new Date().toISOString()
  };

  storage.setItem(getOrderKey(sessionId), JSON.stringify(order));
  return order;
}

export function getGoalFitOrder(sessionId: string): GoalFitOrder | null {
  const storage = getStorage();
  if (!storage || !sessionId) return null;

  const rawOrder = storage.getItem(getOrderKey(sessionId));
  if (!rawOrder) return null;

  try {
    return JSON.parse(rawOrder) as GoalFitOrder;
  } catch {
    return null;
  }
}

function updateGoalFitOrderStatus(
  sessionId: string,
  status: GoalFitOrderStatus,
  couponCode?: "share_card"
): GoalFitOrder | null {
  const storage = getStorage();
  if (!storage || !sessionId) return null;

  const order = createGoalFitOrder(sessionId, couponCode);
  if (!order) return null;

  const updatedOrder: GoalFitOrder = {
    ...order,
    status,
    paidAt: status === "paid" ? new Date().toISOString() : order.paidAt
  };

  storage.setItem(getOrderKey(sessionId), JSON.stringify(updatedOrder));
  return updatedOrder;
}

export function markGoalFitOrderPaid(sessionId: string): GoalFitOrder | null {
  return updateGoalFitOrderStatus(sessionId, "paid");
}

export function markGoalFitOrderPaidWithCoupon(
  sessionId: string,
  couponCode: "share_card"
): GoalFitOrder | null {
  return updateGoalFitOrderStatus(sessionId, "paid", couponCode);
}

export function markGoalFitOrderFailed(sessionId: string): GoalFitOrder | null {
  return updateGoalFitOrderStatus(sessionId, "failed");
}

export function clearGoalFitOrder(sessionId: string): void {
  const storage = getStorage();
  if (!storage || !sessionId) return;

  storage.removeItem(getOrderKey(sessionId));
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function normalizeApiOrder(order: GoalFitOrder): GoalFitOrder {
  return {
    ...order,
    orderId: order.orderId ?? order.id,
    couponCode: order.couponCode ?? undefined,
    currency: order.currency ?? "CNY",
    productCode: order.productCode ?? "goal_fit_full_report",
    productName: order.productName ?? "完整目标适配报告",
    amount: order.amount ?? 1990
  };
}

export async function createGoalFitOrderFromApi(
  input: CreateGoalFitOrderRequest
): Promise<GoalFitOrder> {
  const order = await requestJson<GoalFitOrder>("/api/orders/create", {
    method: "POST",
    body: JSON.stringify(input)
  });

  return normalizeApiOrder(order);
}

export async function markGoalFitApiOrderPaid(orderId: string): Promise<GoalFitOrder> {
  const order = await requestJson<GoalFitOrder>(`/api/orders/${encodeURIComponent(orderId)}/mock-paid`, {
    method: "POST",
    body: JSON.stringify({})
  });

  return normalizeApiOrder(order);
}

export async function getGoalFitUnlockStatusFromApi(sessionId: string): Promise<GoalFitUnlockStatus> {
  return requestJson<GoalFitUnlockStatus>(
    `/api/unlock/status?sessionId=${encodeURIComponent(sessionId)}`
  );
}
