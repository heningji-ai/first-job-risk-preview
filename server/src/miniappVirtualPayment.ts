import crypto from "node:crypto";
import { serverConfig } from "./config.js";

export const VIRTUAL_PAYMENT_MODE = "short_series_goods" as const;
export const VIRTUAL_PAYMENT_PRODUCT_ID = "goal_fit_full_report" as const;

export class MiniappVirtualPaymentError extends Error {
  constructor(readonly code: "INVALID_PAYMENT_ENV" | "VIRTUAL_PAYMENT_NOT_CONFIGURED" | "VIRTUAL_PAYMENT_SIGNING_FAILED") {
    super(code);
    this.name = "MiniappVirtualPaymentError";
  }
}

export type VirtualPaymentSignInput = {
  offerId: string;
  env: 0 | 1;
  goodsPrice: number;
  providerOutTradeNo: string;
};

export type VirtualPaymentParams = {
  mode: typeof VIRTUAL_PAYMENT_MODE;
  signData: string;
  paySig: string;
  signature: string;
};

function configuredEnv(): 0 | 1 {
  const value = serverConfig.miniappVirtualPayment.env;
  if (value !== "0" && value !== "1") throw new MiniappVirtualPaymentError("INVALID_PAYMENT_ENV");
  return Number(value) as 0 | 1;
}

function configuredAppKey(env: 0 | 1): string {
  const key = env === 0
    ? serverConfig.miniappVirtualPayment.appKeyProd
    : serverConfig.miniappVirtualPayment.appKeySandbox;
  if (!serverConfig.miniappVirtualPayment.offerId || !key) throw new MiniappVirtualPaymentError("VIRTUAL_PAYMENT_NOT_CONFIGURED");
  return key;
}

export function buildGoalFitVirtualPaymentSignData(input: VirtualPaymentSignInput): string {
  if (!input.offerId || !Number.isInteger(input.goodsPrice) || input.goodsPrice < 0 || !input.providerOutTradeNo) {
    throw new MiniappVirtualPaymentError("VIRTUAL_PAYMENT_SIGNING_FAILED");
  }
  return JSON.stringify({
    offerId: input.offerId,
    buyQuantity: 1,
    env: input.env,
    currencyType: "CNY",
    productId: VIRTUAL_PAYMENT_PRODUCT_ID,
    goodsPrice: input.goodsPrice,
    outTradeNo: input.providerOutTradeNo,
    attach: input.providerOutTradeNo
  });
}

function hmacHex(secret: string, value: string): string {
  return crypto.createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

export function createGoalFitVirtualPaymentParams(input: { goodsPrice: number; providerOutTradeNo: string; sessionKey: string }): VirtualPaymentParams {
  try {
    if (!input.sessionKey) throw new MiniappVirtualPaymentError("VIRTUAL_PAYMENT_SIGNING_FAILED");
    const env = configuredEnv();
    const appKey = configuredAppKey(env);
    const offerId = serverConfig.miniappVirtualPayment.offerId;
    const signData = buildGoalFitVirtualPaymentSignData({ offerId, env, goodsPrice: input.goodsPrice, providerOutTradeNo: input.providerOutTradeNo });
    return {
      mode: VIRTUAL_PAYMENT_MODE,
      signData,
      paySig: hmacHex(appKey, `requestVirtualPayment&${signData}`),
      signature: hmacHex(input.sessionKey, signData)
    };
  } catch (error) {
    if (error instanceof MiniappVirtualPaymentError) throw error;
    throw new MiniappVirtualPaymentError("VIRTUAL_PAYMENT_SIGNING_FAILED");
  }
}

export function getConfiguredVirtualPaymentEnv(): 0 | 1 { return configuredEnv(); }

