import { assertWechatPayConfig, serverConfig } from "./config.js";
import { buildAuthorizationHeader, buildWechatJsapiPaySign, createNonce, getTimestamp } from "./crypto.js";
import { saveWechatJsapiPayment, updateOrderStatus } from "./orders.js";
import type { OrderRecord, WechatJsapiOrderResponse, WechatJsapiPaymentParams } from "./types.js";

export type WechatJsapiPaymentResult = {
  status: "ok";
  paymentParams: WechatJsapiPaymentParams;
  order: OrderRecord;
};

function assertWechatJsapiConfig(): void {
  assertWechatPayConfig();

  if (!serverConfig.wechatPay.jsapiAppId) {
    throw new Error("WECHAT_PAY_JSAPI_APP_ID is required for JSAPI payment.");
  }
}

function buildJsapiPaymentParams(prepayId: string): WechatJsapiPaymentParams {
  const appId = serverConfig.wechatPay.jsapiAppId;
  const timeStamp = getTimestamp();
  const nonceStr = createNonce();
  const packageValue = `prepay_id=${prepayId}`;
  const paySign = buildWechatJsapiPaySign({
    appId,
    timeStamp,
    nonceStr,
    package: packageValue
  });

  return {
    appId,
    timeStamp,
    nonceStr,
    package: packageValue,
    signType: "RSA",
    paySign
  };
}

export async function createWechatJsapiOrder(
  order: OrderRecord,
  openid: string
): Promise<WechatJsapiPaymentResult> {
  assertWechatJsapiConfig();

  const method = "POST";
  const urlPathWithQuery = "/v3/pay/transactions/jsapi";
  const body = JSON.stringify({
    appid: serverConfig.wechatPay.jsapiAppId,
    mchid: serverConfig.wechatPay.mchId,
    description: serverConfig.wechatPay.description,
    out_trade_no: order.outTradeNo,
    notify_url: serverConfig.wechatPay.notifyUrl,
    amount: {
      total: order.payAmountCents,
      currency: "CNY"
    },
    payer: {
      openid
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
      "Accept-Language": "zh-CN",
      Authorization: authorization,
      "Content-Type": "application/json",
      "User-Agent": "first-job-risk-preview-server"
    },
    body
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[wechat-jsapi-order] WeChat JSAPI order failed: ${response.status} ${errorBody}`);
    await updateOrderStatus(order.id, "failed");
    throw new Error(`WeChat JSAPI order failed: ${response.status}`);
  }

  const result = (await response.json()) as WechatJsapiOrderResponse;
  if (!result.prepay_id) {
    await updateOrderStatus(order.id, "failed");
    throw new Error("WeChat JSAPI order response missing prepay_id.");
  }

  const updatedOrder = saveWechatJsapiPayment(order.id, result.prepay_id);
  if (!updatedOrder) {
    throw new Error("Order not found after WeChat JSAPI order creation.");
  }

  return {
    status: "ok",
    paymentParams: buildJsapiPaymentParams(result.prepay_id),
    order: updatedOrder
  };
}
