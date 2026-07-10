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
  wechatTransactionId: string | null;
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

export type WechatNativeOrderResponse = {
  code_url: string;
};

export type WechatNotifyResource = {
  algorithm: "AEAD_AES_256_GCM";
  ciphertext: string;
  associated_data?: string;
  nonce: string;
  original_type?: string;
};

export type WechatNotifyPayload = {
  id: string;
  create_time: string;
  event_type: string;
  resource_type: string;
  resource: WechatNotifyResource;
  summary?: string;
};

export type WechatTransaction = {
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  success_time?: string;
  amount?: {
    total?: number;
    payer_total?: number;
    currency?: string;
    payer_currency?: string;
  };
};
