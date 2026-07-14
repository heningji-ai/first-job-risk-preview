import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { serverConfig } from "./config.js";
import { initializeDatabase } from "./db.js";
import {
  createOrReuseOrder,
  getOrder,
  getPaidOrderBySessionId,
  updateOrderStatus
} from "./orders.js";
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
const port = serverConfig.port;
const nodeEnv = serverConfig.nodeEnv;
const frontendOrigin = serverConfig.frontendOrigin;

function getShareOrigin(): string {
  return serverConfig.publicAppUrl || frontendOrigin || "http://127.0.0.1:5173";
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

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
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

  const requestedPaymentMode: PaymentMode =
    serverPaymentMode === "mock" ? "mock" : paymentMethod === "jsapi" ? "jsapi" : "native";

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
  const order = createOrReuseOrder({
    sessionId: sessionId.trim(),
    accessMode: effectiveAccessMode,
    couponCode: effectiveCouponCode,
    paymentMode: requestedPaymentMode,
    sourceReferralCode: sourceReferralCodeValue,
    referralVisitId: null
  });

  if (sourceReferralCodeValue && visitorIdValue) {
    attachReferralVisitToOrder({
      referralCode: sourceReferralCodeValue,
      visitorId: visitorIdValue,
      orderId: order.id
    });
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

app.listen(port, () => {
  console.log(`Goal Fit payment server listening on http://127.0.0.1:${port}`);
});
