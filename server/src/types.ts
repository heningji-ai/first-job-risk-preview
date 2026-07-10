export type OrderStatus = "pending" | "paid" | "expired" | "closed" | "failed";

export type AccessMode = "direct" | "share_coupon";

export type CouponCode = "share_card";

export type PaymentProvider = "mock" | "wechat";

export type PaymentMode = "native" | "jsapi" | "h5" | "mock";

export type OrderRecord = {
  id: string;
  outTradeNo: string;
  sessionId: string;
  status: OrderStatus;
  accessMode: AccessMode;
  originalAmountCents: number;
  discountAmountCents: number;
  payAmountCents: number;
  couponCode: CouponCode | null;
  paymentProvider: PaymentProvider;
  paymentMode: PaymentMode;
  wechatPrepayId: string | null;
  wechatCodeUrl: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
};

export type CreateOrderInput = {
  sessionId: string;
  accessMode: AccessMode;
  couponCode: CouponCode | null;
  paymentMode: PaymentMode;
};

export type AmountCalculation = {
  originalAmountCents: number;
  discountAmountCents: number;
  payAmountCents: number;
  couponCode: CouponCode | null;
};
