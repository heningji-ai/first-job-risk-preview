import cors from "cors";
import dotenv from "dotenv";
import express from "express";
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
import { createWechatNativePayment } from "./wechatPay.js";
import type { CouponCode } from "./types.js";

dotenv.config();
initializeDatabase();

const app = express();
const port = Number(process.env.PORT || 3001);
const nodeEnv = process.env.NODE_ENV || "development";
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173";

app.use(
  cors({
    origin: frontendOrigin,
    credentials: false
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/orders/create", async (req, res) => {
  const { sessionId, accessMode, couponCode, paymentMode } = req.body as Record<string, unknown>;

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

  if (!isPaymentMode(paymentMode)) {
    res.status(400).json({ error: "paymentMode is invalid" });
    return;
  }

  if (paymentMode === "mock" && nodeEnv === "production") {
    res.status(403).json({ error: "mock payment is not available in production" });
    return;
  }

  const order = createOrder({
    sessionId: sessionId.trim(),
    accessMode,
    couponCode: normalizedCouponCode,
    paymentMode
  });

  if (paymentMode === "native") {
    const payment = await createWechatNativePayment(order);
    res.status(202).json({
      ...order,
      payment
    });
    return;
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
