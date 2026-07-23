import crypto from "node:crypto";
import { serverConfig } from "./config.js";
import { db } from "./db.js";
import { verifyWechatMessageSignature, verifyWechatUrlSignature, decryptWechatMiniappMessage } from "./wechatMiniappMessageCrypto.js";
import { getGoalFitVirtualPaymentAttemptByProviderOutTradeNo, updateGoalFitVirtualPaymentAttemptProviderState } from "./miniappVirtualPaymentAttempt.js";
import { fulfillGoalFitVirtualPayment } from "./goalFitVirtualPaymentFulfillment.js";

export class MiniappMessagePushError extends Error { constructor(readonly code: "MESSAGE_PUSH_NOT_CONFIGURED" | "MESSAGE_PUSH_INVALID_REQUEST" | "MESSAGE_PUSH_SIGNATURE_INVALID" | "MESSAGE_PUSH_DECRYPT_FAILED" | "MINIAPP_IDENTITY_MISMATCH" | "PAYMENT_ATTEMPT_NOT_FOUND" | "PROVIDER_PAYMENT_MISMATCH") { super(code); } }

function config(): { token: string; aesKey: string; appId: string } {
  if (!serverConfig.miniapp.appId || !/^[A-Za-z0-9]{3,32}$/.test(serverConfig.miniapp.messageToken) || !/^[A-Za-z0-9]{43}$/.test(serverConfig.miniapp.messageEncodingAesKey)) throw new MiniappMessagePushError("MESSAGE_PUSH_NOT_CONFIGURED");
  return { token: serverConfig.miniapp.messageToken, aesKey: serverConfig.miniapp.messageEncodingAesKey, appId: serverConfig.miniapp.appId };
}

export function verifyMessagePushUrl(query: Record<string, unknown>): string {
  const current = config();
  if (typeof query.signature !== "string" || typeof query.timestamp !== "string" || typeof query.nonce !== "string" || typeof query.echostr !== "string") throw new MiniappMessagePushError("MESSAGE_PUSH_INVALID_REQUEST");
  if (!verifyWechatUrlSignature({ token: current.token, timestamp: query.timestamp, nonce: query.nonce, signature: query.signature })) throw new MiniappMessagePushError("MESSAGE_PUSH_SIGNATURE_INVALID");
  return query.echostr;
}

function safeString(value: unknown): string { if (typeof value !== "string" || value.length === 0 || value.length > 512) throw new MiniappMessagePushError("MESSAGE_PUSH_INVALID_REQUEST"); return value; }

export function handleEncryptedMessagePush(input: { timestamp: unknown; nonce: unknown; msgSignature: unknown; encrypted: unknown; encryptType?: unknown }): "success" {
  const current = config();
  if (typeof input.timestamp !== "string" || typeof input.nonce !== "string" || typeof input.msgSignature !== "string" || typeof input.encrypted !== "string" || !input.encrypted || (input.encryptType !== undefined && input.encryptType !== "aes")) throw new MiniappMessagePushError("MESSAGE_PUSH_INVALID_REQUEST");
  if (!verifyWechatMessageSignature({ token: current.token, timestamp: input.timestamp, nonce: input.nonce, encrypt: input.encrypted, signature: input.msgSignature })) throw new MiniappMessagePushError("MESSAGE_PUSH_SIGNATURE_INVALID");
  let parsed: unknown;
  try { parsed = JSON.parse(decryptWechatMiniappMessage({ encodingAesKey: current.aesKey, appId: current.appId, encrypted: input.encrypted })); } catch { throw new MiniappMessagePushError("MESSAGE_PUSH_DECRYPT_FAILED"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new MiniappMessagePushError("MESSAGE_PUSH_INVALID_REQUEST");
  const value = parsed as Record<string, any>;
  if (value.MsgType !== "event" || value.Event !== "xpay_goods_deliver_notify") return "success";
  return processGoodsDelivery(value);
}

function processGoodsDelivery(value: Record<string, any>): "success" {
  const openId = safeString(value.OpenId); const outTradeNo = safeString(value.OutTradeNo); const env = value.Env;
  const goods = value.GoodsInfo;
  if ((env !== 0 && env !== 1) || !goods || typeof goods !== "object" || goods.ProductId !== "goal_fit_full_report" || goods.Quantity !== 1 || goods.Attach !== outTradeNo || typeof goods.OrigPrice !== "number" || typeof goods.ActualPrice !== "number") throw new MiniappMessagePushError("PROVIDER_PAYMENT_MISMATCH");
  const attempt = getGoalFitVirtualPaymentAttemptByProviderOutTradeNo(outTradeNo);
  if (!attempt) throw new MiniappMessagePushError("PAYMENT_ATTEMPT_NOT_FOUND");
  const identity = db.prepare("SELECT id,platform,app_id,openid_hash FROM platform_identities WHERE id = ?").get(attempt.platformIdentityId) as { id: string; platform: string; app_id: string; openid_hash: string } | undefined;
  if (!identity || identity.platform !== "wechat_miniapp" || identity.app_id !== serverConfig.miniapp.appId || !crypto.timingSafeEqual(Buffer.from(identity.openid_hash, "utf8"), Buffer.from(crypto.createHash("sha256").update(openId, "utf8").digest("hex"), "utf8"))) throw new MiniappMessagePushError("MINIAPP_IDENTITY_MISMATCH");
  const order = db.prepare("SELECT payAmountCents FROM orders WHERE id = ? AND platformIdentityId = ? AND assessmentId = ? AND orderPurpose = 'goal_fit_full_report'").get(attempt.orderId, attempt.platformIdentityId, attempt.assessmentId) as { payAmountCents: number } | undefined;
  if (!order || goods.OrigPrice !== order.payAmountCents || goods.ActualPrice !== order.payAmountCents) throw new MiniappMessagePushError("PROVIDER_PAYMENT_MISMATCH");
  const payInfo = value.WeChatPayInfo && typeof value.WeChatPayInfo === "object" ? value.WeChatPayInfo : {};
  fulfillGoalFitVirtualPayment({ paymentAttemptId: attempt.id, trustedProviderResult: { orderId: outTradeNo, status: 4, orderFee: order.payAmountCents, paidFee: order.payAmountCents, orderType: 0, paidTime: typeof payInfo.PaidTime === "string" ? payInfo.PaidTime : new Date().toISOString(), envType: env === 0 ? 1 : 2, wxOrderId: typeof payInfo.MchOrderNo === "string" ? payInfo.MchOrderNo : null, channelOrderId: null, wxpayOrderId: typeof payInfo.TransactionId === "string" ? payInfo.TransactionId : null, provideTime: null } });
  updateGoalFitVirtualPaymentAttemptProviderState({ id: attempt.id, providerDeliveryState: "succeeded", now: new Date().toISOString() });
  return "success";
}
