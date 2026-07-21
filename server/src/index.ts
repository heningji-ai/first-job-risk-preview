import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import {
  createAdminChannelProfile,
  getAdminAnalyticsChannels,
  getAdminAnalyticsEvents,
  getAdminAnalyticsFunnel,
  getAdminAnalyticsSummary,
  getAdminChannels,
  getAdminRecentOrders,
  getAdminReferralRows,
  getAttributionForOrder,
  recordAnalyticsEvents,
  recordAnalyticsVisit,
  recordOrderPaidAnalytics,
  updateAdminChannelProfile
} from "./analytics.js";
import { loginAdmin, logoutAdmin, requireAdmin } from "./adminAuth.js";
import { serverConfig } from "./config.js";
import { initializeDatabase } from "./db.js";
import { createWechatMiniappSession, MiniappIdentityError } from "./miniappIdentity.js";
import {
  createOrReuseOrder,
  getOrder,
  getPaidOrderBySessionId,
  updateOrderStatus
} from "./orders.js";
import { getGoalFitPricingDisplay, updateGoalFitPricingRule } from "./pricing.js";
import {
  attachReferralVisitToOrder,
  buildReferralResponse,
  confirmReferralCopied,
  createOrGetReferral,
  getReferralDiscountStatus,
  markReferralPaidForOrder,
  markReferralVisitCompleted,
  markReferralVisitStarted,
  recordReferralVisit
} from "./referrals.js";
import {
  buildWechatOauthUrl,
  consumeWechatOpenidToken,
  createWechatOauthState,
  handleWechatOauthCallback,
  normalizeOauthReturnTo
} from "./wechatOAuth.js";
import { createWechatJsapiOrder } from "./wechatJsapiPay.js";
import { getWechatNotifyHeaders, handleWechatNotify } from "./wechatNotify.js";
import { createWechatNativeOrder } from "./wechatPay.js";
import type { CouponCode, PaymentMode } from "./types.js";

dotenv.config();
initializeDatabase();

const app = express();
app.set("trust proxy", process.env.TRUST_PROXY_HOPS === "1" ? 1 : false);
const port = serverConfig.port;
const nodeEnv = serverConfig.nodeEnv;
const frontendOrigin = serverConfig.frontendOrigin;

function getShareOrigin(): string {
  return serverConfig.publicAppUrl || frontendOrigin || "http://127.0.0.1:5173";
}

function getAdminPromotionOrigin(): string {
  return process.env.PUBLIC_APP_URL || "https://first-job-risk.jobeyes.com";
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

app.use(
  cors({
    origin: frontendOrigin,
    credentials: false
  })
);

app.post("/api/wechat/notify", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    const headers = getWechatNotifyHeaders(req.headers);
    await handleWechatNotify(rawBody, headers);

    res.json({
      code: "SUCCESS",
      message: "成功"
    });
  } catch (error) {
    console.error("[wechat-notify]", error instanceof Error ? error.message : error);
    res.status(400).json({
      code: "FAIL",
      message: "失败原因"
    });
  }
});

app.use(express.json({ limit: "16kb" }));

const miniappRateLimit = new Map<string, { count: number; resetAt: number }>();
export function resetMiniappRateLimitForTest(): void { miniappRateLimit.clear(); }
app.post("/api/miniapp/wechat/session", async (req, res) => {
  const ip = getIp(req) ?? "unknown"; const now = Date.now(); const current = miniappRateLimit.get(ip);
  if (current && current.resetAt > now && current.count >= 20) { res.status(429).json({ error: "RATE_LIMITED" }); return; }
  miniappRateLimit.set(ip, current && current.resetAt > now ? { ...current, count: current.count + 1 } : { count: 1, resetAt: now + 60_000 });
  try {
    const body = req.body as Record<string, unknown>;
    const result = await createWechatMiniappSession({ code: body.code as string, visitorId: body.visitorId as string });
    res.set("Cache-Control", "no-store").json(result);
  } catch (error) {
    const code = error instanceof MiniappIdentityError ? error.code : "SESSION_CREATION_FAILED";
    const status = code === "INVALID_REQUEST" ? 400 : code === "RATE_LIMITED" ? 429 : 500;
    console.error("[miniapp-session]", code);
    res.status(status).json({ error: code });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/pricing/goal-fit-report", (_req, res) => {
  res.json(getGoalFitPricingDisplay());
});

function getIp(req: express.Request): string | null {
  return req.ip || req.socket.remoteAddress || null;
}

function getAnalyticsQuery(req: express.Request) {
  return {
    range: getString(req.query.range),
    from: getString(req.query.from),
    to: getString(req.query.to),
    source: getString(req.query.source),
    channel: getString(req.query.channel),
    campaign: getString(req.query.campaign),
    platform: getString(req.query.platform),
    eventName: getString(req.query.eventName),
    status: getString(req.query.status),
    limit: req.query.limit ? Number(req.query.limit) : null
  };
}

function getSafeOrderAttribution(params: {
  visitorId?: string | null;
  sessionId?: string | null;
  fallbackReferralCode?: string | null;
}) {
  try {
    return getAttributionForOrder(params);
  } catch (error) {
    console.error("[analytics-order-attribution]", error instanceof Error ? error.message : error);
    return {
      visitorId: params.visitorId ?? "unknown",
      source: "direct",
      channel: "organic",
      campaign: "none",
      referralCode: params.fallbackReferralCode ?? null
    };
  }
}

app.post("/api/analytics/visit", (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const attribution = recordAnalyticsVisit({
      visitorId: getString(body.visitorId) ?? "",
      platform: getString(body.platform),
      sessionId: getString(body.sessionId),
      source: getString(body.source),
      channel: getString(body.channel),
      campaign: getString(body.campaign),
      referralCode: getString(body.referralCode),
      landingPath: getString(body.landingPath),
      landingUrl: getString(body.landingUrl),
      referrer: getString(body.referrer),
      userAgent: req.headers["user-agent"] ?? null,
      ip: getIp(req)
    });

    res.json({
      ok: true,
      visitorId: attribution.visitorId,
      attribution
    });
  } catch (error) {
    console.error("[analytics-visit]", error instanceof Error ? error.message : error);
    res.status(400).json({ error: "analytics visit failed" });
  }
});

app.post("/api/analytics/events", (req, res) => {
  const body = req.body as Record<string, unknown>;
  const events = Array.isArray(body.events) ? body.events : [];
  const result = recordAnalyticsEvents(events as Parameters<typeof recordAnalyticsEvents>[0]);
  res.json({ ok: true, ...result });
});

app.post("/api/admin/login", (req, res) => {
  const body = req.body as Record<string, unknown>;
  loginAdmin(req, res, getString(body.username) ?? "", getString(body.password) ?? "");
});

app.post("/api/admin/logout", (_req, res) => {
  logoutAdmin(res);
});

app.get("/api/admin/me", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ ok: true, username: serverConfig.admin.username });
});

app.get("/api/admin/analytics/summary", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(getAdminAnalyticsSummary(getAnalyticsQuery(req)));
});

app.get("/api/admin/analytics/funnel", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ steps: getAdminAnalyticsFunnel(getAnalyticsQuery(req)) });
});

app.get("/api/admin/analytics/channels", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ channels: getAdminAnalyticsChannels(getAnalyticsQuery(req)) });
});

app.get("/api/admin/analytics/events", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ events: getAdminAnalyticsEvents(getAnalyticsQuery(req)) });
});

app.get("/api/admin/orders", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ orders: getAdminRecentOrders(getAnalyticsQuery(req)) });
});

app.get("/api/admin/channels", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ channels: getAdminChannels(getAdminPromotionOrigin()) });
});

app.get("/api/admin/pricing", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(getGoalFitPricingDisplay());
});

app.patch("/api/admin/pricing", (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    updateGoalFitPricingRule(req.body as Record<string, unknown>);
    res.json(getGoalFitPricingDisplay());
  } catch (error) {
    console.error("[admin-pricing]", error instanceof Error ? error.message : error);
    res.status(400).json({ error: "pricing update failed" });
  }
});

app.post("/api/admin/channels", (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const body = req.body as Record<string, unknown>;
    const channel = createAdminChannelProfile(
      {
        displayName: getString(body.displayName) ?? "",
        source: getString(body.source) ?? "",
        channel: getString(body.channel) ?? "",
        campaign: getString(body.campaign) ?? "",
        commissionType: body.commissionType === "percent" ? "percent" : "fixed",
        commissionValue: typeof body.commissionValue === "number" ? body.commissionValue : Number(body.commissionValue ?? 0),
        enabled: body.enabled !== false
      },
      getAdminPromotionOrigin()
    );
    res.status(201).json({ channel });
  } catch (error) {
    console.error("[admin-channels]", error instanceof Error ? error.message : error);
    res.status(400).json({ error: "channel creation failed" });
  }
});

app.patch("/api/admin/channels/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "channel id is invalid" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const channel = updateAdminChannelProfile(
      id,
      {
        displayName: getString(body.displayName) ?? undefined,
        source: getString(body.source) ?? undefined,
        channel: getString(body.channel) ?? undefined,
        campaign: body.campaign === "" ? "" : (getString(body.campaign) ?? undefined),
        commissionType: body.commissionType === "percent" ? "percent" : body.commissionType === "fixed" ? "fixed" : undefined,
        commissionValue: body.commissionValue === undefined ? undefined : Number(body.commissionValue),
        enabled: body.enabled === undefined ? undefined : body.enabled !== false
      },
      getAdminPromotionOrigin()
    );
    res.json({ channel });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not found")) {
      res.status(404).json({ error: "channel not found" });
      return;
    }
    if (message.includes("identity is locked")) {
      res.status(409).json({ error: "channel identity is locked" });
      return;
    }
    console.error("[admin-channel-update]", message || error);
    res.status(400).json({ error: "channel update failed" });
  }
});

app.get("/api/admin/referrals", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ referrals: getAdminReferralRows() });
});

app.post("/api/referrals/create", (req, res) => {
  const sessionId = getString((req.body as Record<string, unknown>).sessionId);
  const visitorId = getString((req.body as Record<string, unknown>).visitorId);

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const referral = createOrGetReferral({
    sessionId,
    visitorId
  });

  res.json(buildReferralResponse(referral, getShareOrigin()));
});

app.post("/api/referrals/create-or-copy", (req, res) => {
  const sessionId = getString((req.body as Record<string, unknown>).sessionId);
  const visitorId = getString((req.body as Record<string, unknown>).visitorId);

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const referral = confirmReferralCopied({
    sessionId,
    visitorId
  });

  res.json(buildReferralResponse(referral, getShareOrigin()));
});

app.get("/api/referrals/discount-status", (req, res) => {
  const sessionId = getString(req.query.sessionId);

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  res.json(getReferralDiscountStatus(sessionId));
});

app.post("/api/referrals/visit", (req, res) => {
  const body = req.body as Record<string, unknown>;
  const referralCode = getString(body.referralCode);
  const visitorId = getString(body.visitorId);
  const landingPath = getString(body.landingPath) ?? "/";

  if (!referralCode || !visitorId) {
    res.status(400).json({ error: "referralCode and visitorId are required" });
    return;
  }

  const visit = recordReferralVisit({
    referralCode,
    visitorId,
    landingPath
  });

  res.json({
    ok: true,
    recorded: Boolean(visit)
  });
});

app.post("/api/referrals/start", (req, res) => {
  const body = req.body as Record<string, unknown>;
  const referralCode = getString(body.referralCode);
  const visitorId = getString(body.visitorId);

  if (!referralCode || !visitorId) {
    res.status(400).json({ error: "referralCode and visitorId are required" });
    return;
  }

  const visit = markReferralVisitStarted({
    referralCode,
    visitorId
  });

  res.json({
    ok: true,
    recorded: Boolean(visit)
  });
});

app.post("/api/referrals/complete", (req, res) => {
  const body = req.body as Record<string, unknown>;
  const referralCode = getString(body.referralCode);
  const visitorId = getString(body.visitorId);
  const resultSessionId = getString(body.resultSessionId);

  if (!referralCode || !visitorId || !resultSessionId) {
    res.status(400).json({ error: "referralCode, visitorId and resultSessionId are required" });
    return;
  }

  const visit = markReferralVisitCompleted({
    referralCode,
    visitorId,
    resultSessionId
  });

  res.json({
    ok: true,
    recorded: Boolean(visit)
  });
});

app.get("/api/wechat/oauth/start", (req, res) => {
  try {
    const returnTo = normalizeOauthReturnTo(req.query.returnTo);
    if (!returnTo) {
      res.status(400).json({ error: "returnTo must be a local path" });
      return;
    }

    const state = createWechatOauthState(returnTo);
    res.redirect(buildWechatOauthUrl(state));
  } catch (error) {
    console.error("[wechat-oauth-start]", error instanceof Error ? error.message : error);
    res.status(500).json({ error: "WeChat OAuth start failed" });
  }
});

app.get("/api/wechat/oauth/callback", async (req, res) => {
  const { code, state } = req.query;

  if (typeof code !== "string" || typeof state !== "string") {
    res.status(400).json({ error: "code and state are required" });
    return;
  }

  try {
    res.redirect(await handleWechatOauthCallback(code, state));
  } catch (error) {
    console.error("[wechat-oauth-callback]", error instanceof Error ? error.message : error);
    res.status(400).json({ error: "WeChat OAuth callback failed" });
  }
});

app.post("/api/orders/create", async (req, res) => {
  const {
    sessionId,
    paymentMethod,
    wechatOpenidToken,
    sourceReferralCode,
    visitorId
  } = req.body as Record<string, unknown>;
  const serverPaymentMode = serverConfig.paymentMode;

  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const discountStatus = getReferralDiscountStatus(sessionId.trim());
  const effectiveAccessMode = discountStatus.discountGranted ? "share_coupon" : "direct";
  const effectiveCouponCode: CouponCode | null = discountStatus.discountGranted ? "share_card" : null;

  if (serverPaymentMode !== "mock" && serverPaymentMode !== "native") {
    res.status(400).json({ error: "paymentMode is invalid" });
    return;
  }

  if (serverPaymentMode === "mock" && nodeEnv === "production") {
    res.status(403).json({ error: "mock payment is not available in production" });
    return;
  }

  const pricingDisplay = getGoalFitPricingDisplay();
  const requestedPaymentMode: PaymentMode = pricingDisplay.freeTrialActive
    ? "free_trial"
    : serverPaymentMode === "mock"
      ? "mock"
      : paymentMethod === "jsapi"
        ? "jsapi"
        : "native";

  let jsapiOpenid = "";
  if (requestedPaymentMode === "jsapi") {
    if (typeof wechatOpenidToken !== "string" || wechatOpenidToken.trim().length === 0) {
      res.status(400).json({ error: "wechatOpenidToken is required for JSAPI payment" });
      return;
    }

    try {
      jsapiOpenid = consumeWechatOpenidToken(wechatOpenidToken.trim());
    } catch {
      res.status(401).json({ error: "wechatOpenidToken is invalid or expired" });
      return;
    }
  }

  const sourceReferralCodeValue = getString(sourceReferralCode);
  const visitorIdValue = getString(visitorId);
  const orderAttribution = getSafeOrderAttribution({
    visitorId: visitorIdValue,
    sessionId: sessionId.trim(),
    fallbackReferralCode: sourceReferralCodeValue
  });
  const order = createOrReuseOrder({
    sessionId: sessionId.trim(),
    accessMode: effectiveAccessMode,
    couponCode: effectiveCouponCode,
    paymentMode: requestedPaymentMode,
    sourceReferralCode: sourceReferralCodeValue,
    referralVisitId: null,
    analyticsVisitorId: orderAttribution.visitorId,
    analyticsSource: orderAttribution.source,
    analyticsChannel: orderAttribution.channel,
    analyticsCampaign: orderAttribution.campaign,
    analyticsReferralCode: orderAttribution.referralCode
  });

  if (sourceReferralCodeValue && visitorIdValue) {
    attachReferralVisitToOrder({
      referralCode: sourceReferralCodeValue,
      visitorId: visitorIdValue,
      orderId: order.id
    });
  }

  if (order.payAmountCents === 0 || order.paymentProvider === "free_trial" || order.paymentMode === "free_trial") {
    res.json(order);
    return;
  }

  if (requestedPaymentMode === "jsapi") {
    try {
      const payment = await createWechatJsapiOrder(order, jsapiOpenid);
      res.status(202).json({
        ...payment.order,
        jsapiPaymentParams: payment.paymentParams
      });
      return;
    } catch (error) {
      console.error("[wechat-jsapi-order]", error instanceof Error ? error.message : error);
      res.status(502).json({ error: "支付订单创建失败，请稍后重试。" });
      return;
    }
  }

  if (requestedPaymentMode === "native") {
    try {
      const payment = await createWechatNativeOrder(order);
      res.status(202).json({
        ...payment.order,
        wechatCodeUrl: payment.codeUrl
      });
      return;
    } catch (error) {
      console.error("[wechat-native-order]", error instanceof Error ? error.message : error);
      res.status(502).json({ error: "支付订单创建失败，请稍后重试。" });
      return;
    }
  }

  res.json(order);
});

app.get("/api/orders/:orderId", (req, res) => {
  const order = getOrder(req.params.orderId);

  if (!order) {
    res.status(404).json({ error: "order not found" });
    return;
  }

  res.json(order);
});

app.post("/api/orders/:orderId/mock-paid", (req, res) => {
  if (nodeEnv === "production") {
    res.status(403).json({ error: "mock payment is not available in production" });
    return;
  }

  const order = updateOrderStatus(req.params.orderId, "paid");

  if (!order) {
    res.status(404).json({ error: "order not found" });
    return;
  }

  markReferralPaidForOrder(order.id);
  recordOrderPaidAnalytics(order);

  res.json(order);
});

app.get("/api/unlock/status", (req, res) => {
  const sessionId = req.query.sessionId;

  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const paidOrder = getPaidOrderBySessionId(sessionId.trim());

  res.json({
    unlocked: Boolean(paidOrder),
    orderId: paidOrder?.id ?? null,
    accessMode: paidOrder?.accessMode ?? null
  });
});

export { app };
if (process.env.NODE_ENV !== "test") app.listen(port, () => {
  console.log(`Goal Fit payment server listening on http://127.0.0.1:${port}`);
});
