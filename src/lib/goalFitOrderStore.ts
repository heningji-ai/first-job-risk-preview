const ORDER_STORAGE_PREFIX = "goalFitOrder:";

export type GoalFitOrderStatus = "pending" | "paid" | "failed" | "cancelled";

export type GoalFitOrder = {
  orderId: string;
  sessionId: string;
  productCode: "goal_fit_full_report";
  productName: "完整目标适配报告";
  amount: 1990;
  originalAmountCents: number;
  discountAmountCents: number;
  payAmountCents: number;
  couponCode?: "share_card";
  currency: "CNY";
  status: GoalFitOrderStatus;
  createdAt: string;
  paidAt?: string;
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
