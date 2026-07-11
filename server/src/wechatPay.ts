import { assertWechatPayConfig, serverConfig } from "./config.js";
import { buildAuthorizationHeader, createNonce, getTimestamp } from "./crypto.js";
import { saveWechatNativePayment, updateOrderStatus } from "./orders.js";
import type { OrderRecord, WechatNativeOrderResponse } from "./types.js";

export type WechatNativePaymentResult = {
  status: "ok";
  codeUrl: string;
  order: OrderRecord;
};

export async function createWechatNativeOrder(order: OrderRecord): Promise<WechatNativePaymentResult> {
  assertWechatPayConfig();

  const method = "POST";
  const urlPathWithQuery = "/v3/pay/transactions/native";
  const body = JSON.stringify({
    appid: serverConfig.wechatPay.appId,
    mchid: serverConfig.wechatPay.mchId,
    description: serverConfig.wechatPay.description,
    out_trade_no: order.outTradeNo,
    notify_url: serverConfig.wechatPay.notifyUrl,
    amount: {
      total: order.payAmountCents,
      currency: "CNY"
    }
  });
  const timestamp = getTimestamp();
  const nonce = createNonce();
  const authorization = buildAuthorizationHeader({
    method,
    urlPathWithQuery,
    timestamp,
    nonce,
    body
  });

  const response = await fetch(`https://api.mch.weixin.qq.com${urlPathWithQuery}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: authorization,
      "Content-Type": "application/json",
      "User-Agent": "first-job-risk-preview-server"
    },
    body
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[wechat-native-order] WeChat Native order failed: ${response.status} ${errorBody}`);
    await updateOrderStatus(order.id, "failed");
    throw new Error(`WeChat Native order failed: ${response.status}`);
  }

  const result = (await response.json()) as WechatNativeOrderResponse;
  if (!result.code_url) {
    await updateOrderStatus(order.id, "failed");
    throw new Error("WeChat Native order response missing code_url.");
  }

  const updatedOrder = saveWechatNativePayment(order.id, result.code_url);
  if (!updatedOrder) {
    throw new Error("Order not found after WeChat Native order creation.");
  }

  return {
    status: "ok",
    codeUrl: result.code_url,
    order: updatedOrder
  };
}
