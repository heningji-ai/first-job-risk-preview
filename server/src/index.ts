import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { serverConfig } from "./config.js";
import { initializeDatabase } from "./db.js";
import {
  createOrder,
  getOrder,
  getPaidOrderBySessionId,
  isAccessMode,
  isCouponCode,
  isPaymentMode,
  updateOrderStatus
} from "./orders.js";
import { getWechatNotifyHeaders, handleWechatNotify } from "./wechatNotify.js";
import { createWechatNativeOrder } from "./wechatPay.js";
import type { CouponCode } from "./types.js";

dotenv.config();
initializeDatabase();

const app = express();
const port = serverConfig.port;
const nodeEnv = serverConfig.nodeEnv;
const frontendOrigin = serverConfig.frontendOrigin;

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

app.post("/api/orders/create", async (req, res) => {
  const { sessionId, accessMode, couponCode } = req.body as Record<string, unknown>;
  const requestedPaymentMode = (req.body as Record<string, unknown>).paymentMode ?? serverConfig.paymentMode;

  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  if (!isAccessMode(accessMode)) {
    res.status(400).json({ error: "accessMode must be direct or share_coupon" });
    return;
  }

  const normalizedCouponCode: CouponCode | null = isCouponCode(couponCode) ? couponCode : null;

  if (accessMode === "share_coupon" && normalizedCouponCode !== "share_card") {
    res.status(400).json({ error: "share_coupon requires share_card couponCode" });
    return;
  }

  if (!isPaymentMode(requestedPaymentMode)) {
    res.status(400).json({ error: "paymentMode is invalid" });
    return;
  }

  if (requestedPaymentMode === "mock" && nodeEnv === "production") {
    res.status(403).json({ error: "mock payment is not available in production" });
    return;
  }

  const order = createOrder({
    sessionId: sessionId.trim(),
    accessMode,
    couponCode: normalizedCouponCode,
    paymentMode: requestedPaymentMode
  });

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
