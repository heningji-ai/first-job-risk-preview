export type OrderStatus = "pending" | "paid" | "expired" | "closed" | "failed";

export type AccessMode = "direct" | "share_coupon";

export type CouponCode = "share_card";

export type PaymentProvider = "mock" | "wechat" | "free_trial";

export type PaymentMode = "native" | "jsapi" | "h5" | "mock" | "free_trial";

export type PricingMode = "normal" | "sale" | "free_trial";

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
  sourceReferralCode: string | null;
  referralVisitId: string | null;
  analyticsVisitorId: string | null;
  analyticsSource: string | null;
  analyticsChannel: string | null;
  analyticsCampaign: string | null;
  analyticsReferralCode: string | null;
  basePriceCents: number | null;
  salePriceCents: number | null;
  discountCents: number | null;
  finalAmountCents: number | null;
  pricingRuleId: number | null;
  pricingSnapshotJson: string | null;
  pricingMode: PricingMode | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  platformIdentityId?: string | null;
  assessmentId?: string | null;
  reportSnapshotId?: string | null;
  orderPurpose?: string | null;
  expiresAt?: string | null;
};

export type CreateOrderInput = {
  sessionId: string;
  accessMode: AccessMode;
  couponCode: CouponCode | null;
  paymentMode: PaymentMode;
  sourceReferralCode?: string | null;
  referralVisitId?: string | null;
  analyticsVisitorId?: string | null;
  analyticsSource?: string | null;
  analyticsChannel?: string | null;
  analyticsCampaign?: string | null;
  analyticsReferralCode?: string | null;
};

export type AmountCalculation = {
  originalAmountCents: number;
  discountAmountCents: number;
  payAmountCents: number;
  couponCode: CouponCode | null;
  basePriceCents?: number;
  salePriceCents?: number;
  discountCents?: number;
  finalAmountCents?: number;
  pricingRuleId?: number;
  pricingSnapshotJson?: string;
  pricingMode?: PricingMode;
};

export type WechatNativeOrderResponse = {
  code_url: string;
};

export type WechatJsapiOrderResponse = {
  prepay_id: string;
};

export type WechatJsapiPaymentParams = {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: "RSA";
  paySign: string;
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
