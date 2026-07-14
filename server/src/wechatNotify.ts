import { serverConfig } from "./config.js";
import { decryptWechatResource, readWechatPayPublicKey, verifyWechatSignature } from "./crypto.js";
import { getOrderByOutTradeNo, markOrderPaidByOutTradeNo } from "./orders.js";
import { markReferralPaidForOrder } from "./referrals.js";
import type { WechatNotifyPayload, WechatTransaction } from "./types.js";
import { getWechatPlatformCertificate } from "./wechatPlatformCerts.js";

export type WechatNotifyHeaders = {
  timestamp: string;
  nonce: string;
  signature: string;
  serial: string;
};

export function getWechatNotifyHeaders(headers: Record<string, string | string[] | undefined>): WechatNotifyHeaders {
  const timestamp = headers["wechatpay-timestamp"];
  const nonce = headers["wechatpay-nonce"];
  const signature = headers["wechatpay-signature"];
  const serial = headers["wechatpay-serial"];

  if (
    typeof timestamp !== "string" ||
    typeof nonce !== "string" ||
    typeof signature !== "string" ||
    typeof serial !== "string"
  ) {
    throw new Error("Missing WeChat Pay notify headers.");
  }

  return {
    timestamp,
    nonce,
    signature,
    serial
  };
}

function isWechatPayPublicKeySerial(serial: string): boolean {
  return serial.startsWith("PUB_KEY_ID_");
}

function getWechatPayPublicKeyForNotify(serial: string): string {
  if (!serverConfig.wechatPay.publicKeyId || !serverConfig.wechatPay.publicKeyPath) {
    throw new Error("WeChat Pay public key is not configured.");
  }

  if (serial !== serverConfig.wechatPay.publicKeyId) {
    console.error(
      `[wechat-notify] WeChat Pay public key id mismatch: received=${serial} configured=${serverConfig.wechatPay.publicKeyId}`
    );
    throw new Error("WeChat Pay public key id mismatch.");
  }

  return readWechatPayPublicKey();
}

async function getVerifierKeyForNotify(serial: string): Promise<string> {
  if (isWechatPayPublicKeySerial(serial)) {
    return getWechatPayPublicKeyForNotify(serial);
  }

  const certificate = await getWechatPlatformCertificate(serial);
  if (!certificate) {
    throw new Error("WeChat platform certificate not found.");
  }

  return certificate;
}

export async function handleWechatNotify(rawBody: Buffer, headers: WechatNotifyHeaders): Promise<void> {
  console.log(`[wechat-notify] received serial=${headers.serial}`);

  const verifierKey = await getVerifierKeyForNotify(headers.serial);

  const verified = verifyWechatSignature({
    timestamp: headers.timestamp,
    nonce: headers.nonce,
    body: rawBody,
    signature: headers.signature,
    certificate: verifierKey
  });

  if (!verified) {
    throw new Error("WeChat Pay notify signature verification failed.");
  }

  const payload = JSON.parse(rawBody.toString("utf8")) as WechatNotifyPayload;
  const transaction = decryptWechatResource<WechatTransaction>(payload.resource);

  if (!transaction.out_trade_no) {
    throw new Error("WeChat transaction missing out_trade_no.");
  }

  const order = getOrderByOutTradeNo(transaction.out_trade_no);
  if (!order) {
    throw new Error("Order not found for out_trade_no.");
  }

  if (order.status === "paid") return;

  if (transaction.trade_state !== "SUCCESS") {
    throw new Error(`WeChat transaction state is not SUCCESS: ${transaction.trade_state ?? "unknown"}`);
  }

  const paidAmount = transaction.amount?.payer_total ?? transaction.amount?.total;
  if (paidAmount !== order.payAmountCents) {
    throw new Error("WeChat transaction amount does not match order amount.");
  }

  const paidOrder = markOrderPaidByOutTradeNo({
    outTradeNo: order.outTradeNo,
    transactionId: transaction.transaction_id ?? "",
    paidAt: transaction.success_time ?? new Date().toISOString()
  });

  if (paidOrder) {
    markReferralPaidForOrder(paidOrder.id);
  }
}
