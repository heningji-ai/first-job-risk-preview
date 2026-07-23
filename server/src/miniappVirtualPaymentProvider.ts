import crypto from "node:crypto";
import { serverConfig } from "./config.js";

type ProviderRequest = (url: string, init: RequestInit) => Promise<Response>;
export type TrustedVirtualPaymentOrder = {
  orderId: string;
  status: number;
  orderFee: number;
  paidFee: number;
  orderType: number;
  paidTime: string | null;
  envType: number;
  wxOrderId: string | null;
  channelOrderId: string | null;
  wxpayOrderId: string | null;
  provideTime: string | null;
};

export class VirtualPaymentProviderError extends Error {
  constructor(readonly code: "WECHAT_ACCESS_TOKEN_UNAVAILABLE" | "VIRTUAL_PAYMENT_QUERY_FAILED" | "VIRTUAL_PAYMENT_QUERY_TRANSIENT" | "VIRTUAL_PAYMENT_QUERY_INVALID_RESPONSE" | "PROVIDER_ORDER_STATUS_UNSUPPORTED") { super(code); }
}

let accessTokenCache: { value: string; expiresAt: number } | null = null;
let accessTokenInFlight: Promise<string> | null = null;
let accessTokenProviderForTest: (() => Promise<string>) | null = null;
export function setVirtualPaymentAccessTokenProviderForTest(provider: (() => Promise<string>) | null): void { accessTokenProviderForTest = provider; accessTokenCache = null; }

async function getAccessToken(fetcher: ProviderRequest): Promise<string> {
  if (accessTokenProviderForTest) return accessTokenProviderForTest();
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) return accessTokenCache.value;
  if (accessTokenInFlight) return accessTokenInFlight;
  if (!serverConfig.miniapp.appId || !serverConfig.miniapp.appSecret) throw new VirtualPaymentProviderError("WECHAT_ACCESS_TOKEN_UNAVAILABLE");
  accessTokenInFlight = (async () => {
    let response: Response;
    try { response = await fetcher(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(serverConfig.miniapp.appId)}&secret=${encodeURIComponent(serverConfig.miniapp.appSecret)}`, { method: "GET" }); } catch { throw new VirtualPaymentProviderError("WECHAT_ACCESS_TOKEN_UNAVAILABLE"); }
    const body = await response.json().catch(() => null) as { access_token?: unknown; expires_in?: unknown; errcode?: unknown } | null;
    if (!response.ok || !body || typeof body.access_token !== "string" || typeof body.expires_in !== "number") throw new VirtualPaymentProviderError("WECHAT_ACCESS_TOKEN_UNAVAILABLE");
    accessTokenCache = { value: body.access_token, expiresAt: Date.now() + Math.max(30_000, (body.expires_in - 60) * 1000) };
    return body.access_token;
  })();
  try { return await accessTokenInFlight; } finally { accessTokenInFlight = null; }
}

function appKey(env: 0 | 1): string {
  const key = env === 0 ? serverConfig.miniappVirtualPayment.appKeyProd : serverConfig.miniappVirtualPayment.appKeySandbox;
  if (!key) throw new VirtualPaymentProviderError("VIRTUAL_PAYMENT_QUERY_FAILED");
  return key;
}

function queryBody(openid: string, env: 0 | 1, providerOutTradeNo: string): string { return JSON.stringify({ openid, env, order_id: providerOutTradeNo }); }
function sign(key: string, body: string): string { return crypto.createHmac("sha256", key).update(`/xpay/query_order&${body}`, "utf8").digest("hex"); }

function parseOrder(body: unknown, expected: { providerOutTradeNo: string; env: 0 | 1 }): TrustedVirtualPaymentOrder {
  if (!body || typeof body !== "object") throw new VirtualPaymentProviderError("VIRTUAL_PAYMENT_QUERY_INVALID_RESPONSE");
  const root = body as { errcode?: unknown; order?: Record<string, unknown> };
  if (root.errcode !== undefined && root.errcode !== 0) throw new VirtualPaymentProviderError("VIRTUAL_PAYMENT_QUERY_FAILED");
  const order = root.order;
  if (!order || typeof order.order_id !== "string" || order.order_id !== expected.providerOutTradeNo || typeof order.status !== "number" || typeof order.order_fee !== "number" || typeof order.paid_fee !== "number" || typeof order.order_type !== "number" || typeof order.env_type !== "number") throw new VirtualPaymentProviderError("VIRTUAL_PAYMENT_QUERY_INVALID_RESPONSE");
  if (order.env_type !== (expected.env === 0 ? 1 : 2) || (order.order_type !== 0 && order.order_type !== 7)) throw new VirtualPaymentProviderError("VIRTUAL_PAYMENT_QUERY_INVALID_RESPONSE");
  if (![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(order.status)) throw new VirtualPaymentProviderError("PROVIDER_ORDER_STATUS_UNSUPPORTED");
  return { orderId: order.order_id, status: order.status, orderFee: order.order_fee, paidFee: order.paid_fee, orderType: order.order_type, paidTime: typeof order.paid_time === "string" ? order.paid_time : null, envType: order.env_type, wxOrderId: typeof order.wx_order_id === "string" ? order.wx_order_id : null, channelOrderId: typeof order.channel_order_id === "string" ? order.channel_order_id : null, wxpayOrderId: typeof order.wxpay_order_id === "string" ? order.wxpay_order_id : null, provideTime: typeof order.provide_time === "string" ? order.provide_time : null };
}

export async function queryWechatVirtualPaymentOrder(input: { openid: string; env: 0 | 1; providerOutTradeNo: string }, dependencies?: { fetcher?: ProviderRequest; accessToken?: string }): Promise<TrustedVirtualPaymentOrder> {
  const fetcher = dependencies?.fetcher ?? fetch;
  const body = queryBody(input.openid, input.env, input.providerOutTradeNo);
  const token = dependencies?.accessToken ?? await getAccessToken(fetcher);
  let response: Response;
  const url = `https://api.weixin.qq.com/xpay/query_order?access_token=${encodeURIComponent(token)}&pay_sig=${encodeURIComponent(sign(appKey(input.env), body))}`;
  try { response = await fetcher(url, { method: "POST", headers: { "Content-Type": "application/json" }, body }); } catch { throw new VirtualPaymentProviderError("VIRTUAL_PAYMENT_QUERY_TRANSIENT"); }
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new VirtualPaymentProviderError("VIRTUAL_PAYMENT_QUERY_FAILED");
  return parseOrder(result, input);
}

export function resetVirtualPaymentProviderForTest(): void { accessTokenCache = null; accessTokenInFlight = null; accessTokenProviderForTest = null; }

export async function notifyWechatVirtualPaymentGoods(input: { env: 0 | 1; providerOutTradeNo: string }, dependencies?: { fetcher?: ProviderRequest; accessToken?: string }): Promise<boolean> {
  const fetcher = dependencies?.fetcher ?? fetch;
  const token = dependencies?.accessToken ?? await getAccessToken(fetcher);
  const body = JSON.stringify({ order_id: input.providerOutTradeNo, env: input.env });
  let response: Response;
  try { response = await fetcher(`https://api.weixin.qq.com/xpay/notify_provide_goods?access_token=${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body }); } catch { return false; }
  const result = await response.json().catch(() => null) as { errcode?: unknown } | null;
  return response.ok && (!result || result.errcode === undefined || result.errcode === 0);
}
