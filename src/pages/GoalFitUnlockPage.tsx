import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import GoalFitHeader from "../components/GoalFitHeader";
import { buildApiUrl } from "../config/api";
import { trackGoalFitEvent, trackGoalFitVisit } from "../lib/goalFitAnalytics";
import { buildGoalFitResult } from "../lib/goalFitResultBuilder";
import { goalFitQuestionBank } from "../lib/goalFitQuestionBank";
import {
  createGoalFitOrderFromApi,
  getGoalFitOrderFromApi,
  markGoalFitApiOrderPaid,
  type GoalFitJsapiPaymentParams,
  type GoalFitOrder
} from "../lib/goalFitOrderStore";
import { selectGoalFitQuestions } from "../lib/goalFitQuestionSelector";
import {
  getGoalFitDiscountStatus,
  getGoalFitReferralContext,
  type GoalFitDiscountStatus
} from "../lib/goalFitReferralStore";
import { getGoalFitSession } from "../lib/goalFitSessionStore";
import { isGoalFitReportUnlocked, markGoalFitReportUnlocked } from "../lib/goalFitUnlockStore";
import { getGoalFitVisitorId } from "../lib/goalFitVisitorStore";
import { navigateTo } from "../lib/router";
import type { CompanyType, GoalFitAnswerMap, GoalFitResult, RoleType } from "../lib/goalFitTypes";

type UnlockContext = {
  result: GoalFitResult | null;
  sessionId: string | null;
  isSample: boolean;
  isUnlocked: boolean;
  wechatOpenidToken: string | null;
};

function GoalFitPageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="goal-fit-shell goal-fit-result-shell">
      <GoalFitHeader />
      {children}
    </main>
  );
}

function createSampleResult(): GoalFitResult {
  const targetCompany: CompanyType = "D";
  const targetRole: RoleType = "TECH";
  const selectedQuestions = selectGoalFitQuestions(goalFitQuestionBank, targetRole);
  const answers = Object.fromEntries(
    selectedQuestions.map((question) => [question.id, question.options[0]?.id ?? ""])
  ) as GoalFitAnswerMap;

  return buildGoalFitResult({
    questionBank: goalFitQuestionBank,
    answers,
    targetCompany,
    targetRole
  });
}

function getUnlockContextFromUrl(): UnlockContext {
  const params = new URLSearchParams(window.location.search);
  const sample = params.get("sample");
  const sessionId = params.get("session");
  const wechatOpenidToken = params.get("wechatOpenidToken");

  if (sample === "high_fit") {
    return {
      result: createSampleResult(),
      sessionId: "sample_high_fit",
      isSample: true,
      isUnlocked: false,
      wechatOpenidToken
    };
  }

  if (!sessionId) {
    return { result: null, sessionId: null, isSample: false, isUnlocked: false, wechatOpenidToken };
  }

  return {
    result: getGoalFitSession(sessionId)?.result ?? null,
    sessionId,
    isSample: false,
    isUnlocked: isGoalFitReportUnlocked(sessionId),
    wechatOpenidToken
  };
}

function buildFreeResultPath(context: UnlockContext): string {
  if (context.isSample) return "/result-goal-fit-free-preview?sample=high_fit";
  return `/result-goal-fit-free-preview?session=${encodeURIComponent(context.sessionId ?? "")}`;
}

function buildFullResultPath(context: UnlockContext): string {
  if (context.isSample) return "/result-goal-fit-preview?sample=high_fit";
  return `/result-goal-fit-preview?session=${encodeURIComponent(context.sessionId ?? "")}`;
}

function buildShareCouponPath(context: UnlockContext): string {
  if (context.isSample) return "/goal-fit-share-preview?sample=high_fit&mode=coupon";
  return `/goal-fit-share-preview?session=${encodeURIComponent(context.sessionId ?? "")}&mode=coupon`;
}

function formatYuan(amountCents: number): string {
  return `¥${(amountCents / 100).toFixed(1)}`;
}

function isWechatBrowser(): boolean {
  return /MicroMessenger/i.test(navigator.userAgent);
}

function isMobileBrowser(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function getCurrentOauthReturnTo(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function invokeWechatJsapiPay(params: GoalFitJsapiPaymentParams): Promise<"ok" | "cancel" | "fail"> {
  return new Promise((resolve) => {
    if (!window.WeixinJSBridge) {
      resolve("fail");
      return;
    }

    window.WeixinJSBridge.invoke("getBrandWCPayRequest", params, (response) => {
      const message = response.err_msg ?? "";
      if (message.endsWith(":ok")) {
        resolve("ok");
        return;
      }
      if (message.endsWith(":cancel")) {
        resolve("cancel");
        return;
      }
      resolve("fail");
    });
  });
}

function MissingUnlockPage() {
  return (
    <GoalFitPageFrame>
      <section className="goal-fit-panel goal-fit-result-empty goal-fit-unlock-empty">
        <p className="goal-fit-eyebrow">结果未找到</p>
        <h1>没有找到你的测试结果</h1>
        <p>请先完成测试，再解锁完整报告。</p>
        <button className="primary-button" type="button" onClick={() => navigateTo("/test-goal-fit-preview")}>
          重新开始路径预演
        </button>
      </section>
    </GoalFitPageFrame>
  );
}

function GoalFitUnlockPage() {
  const context = useMemo(() => getUnlockContextFromUrl(), []);
  const [isUnlocked, setIsUnlocked] = useState(context.isUnlocked);
  const [order, setOrder] = useState<GoalFitOrder | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isInvokingJsapiPay, setIsInvokingJsapiPay] = useState(false);
  const [hasAutoInvokedJsapiPay, setHasAutoInvokedJsapiPay] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [discountStatus, setDiscountStatus] = useState<GoalFitDiscountStatus | null>(null);
  const [copiedPageLink, setCopiedPageLink] = useState(false);
  const isWechatInAppBrowser = isWechatBrowser();
  const isMobileExternalBrowser = isMobileBrowser() && !isWechatInAppBrowser;
  const fullResultPath = buildFullResultPath(context);
  const freeResultPath = buildFreeResultPath(context);
  const shareCouponPath = buildShareCouponPath(context);

  useEffect(() => {
    if (!context.sessionId) return;
    let ignore = false;

    async function loadDiscountStatus(): Promise<void> {
      if (!context.sessionId || context.isSample) return;

      try {
        const status = await getGoalFitDiscountStatus(context.sessionId);
        if (!ignore) setDiscountStatus(status);
      } catch {
        if (!ignore) setDiscountStatus(null);
      }
    }

    void loadDiscountStatus();

    return () => {
      ignore = true;
    };
  }, [context.isSample, context.sessionId]);

  useEffect(() => {
    trackGoalFitVisit(context.sessionId);
    trackGoalFitEvent({
      eventName: "unlock_page_view",
      sessionId: context.sessionId,
      metadata: {
        isSample: context.isSample,
        hasWechatOpenidToken: Boolean(context.wechatOpenidToken)
      }
    });
  }, [context.isSample, context.sessionId, context.wechatOpenidToken]);

  useEffect(() => {
    if (!context.result || !context.sessionId || isUnlocked) return;
    if (isWechatInAppBrowser && !context.wechatOpenidToken) return;
    if (isMobileExternalBrowser) return;

    let ignore = false;

    async function createOrder(): Promise<void> {
      if (!context.sessionId) return;

      setIsCreatingOrder(true);
      setOrderError("");
      trackGoalFitEvent({
        eventName: "order_create_start",
        sessionId: context.sessionId,
        metadata: {
          paymentMethod: isWechatInAppBrowser ? "jsapi" : "native"
        }
      });

      try {
        const referralContext = getGoalFitReferralContext();
        const createdOrder = await createGoalFitOrderFromApi({
          sessionId: context.sessionId,
          paymentMethod: isWechatInAppBrowser ? "jsapi" : "native",
          wechatOpenidToken: context.wechatOpenidToken ?? undefined,
          sourceReferralCode: referralContext?.referralCode,
          visitorId: referralContext?.visitorId ?? getGoalFitVisitorId()
        });

        if (!ignore) {
          setOrder(createdOrder);
          trackGoalFitEvent({
            eventName: "order_create_success",
            sessionId: context.sessionId,
            orderId: createdOrder.orderId,
            eventValue: createdOrder.payAmountCents,
            metadata: {
              paymentMode: createdOrder.paymentMode,
              payAmountCents: createdOrder.payAmountCents
            }
          });
        }
      } catch {
        if (!ignore) setOrderError("订单创建暂时失败，请稍后重试。");
      } finally {
        if (!ignore) setIsCreatingOrder(false);
      }
    }

    void createOrder();

    return () => {
      ignore = true;
    };
  }, [
    context.result,
    context.sessionId,
    context.wechatOpenidToken,
    isWechatInAppBrowser,
    isMobileExternalBrowser,
    isUnlocked
  ]);

  useEffect(() => {
    let ignore = false;

    async function buildQrCode(): Promise<void> {
      if (!order?.wechatCodeUrl) {
        setQrCodeDataUrl("");
        return;
      }

      try {
        const QRCode = await import("qrcode");
        const dataUrl = await QRCode.toDataURL(order.wechatCodeUrl, {
          margin: 1,
          width: 220,
          color: {
            dark: "#24372f",
            light: "#fffaf0"
          }
        });

        if (!ignore) setQrCodeDataUrl(dataUrl);
      } catch {
        if (!ignore) setOrderError("二维码生成失败，请稍后刷新重试。");
      }
    }

    void buildQrCode();

    return () => {
      ignore = true;
    };
  }, [order?.wechatCodeUrl]);

  useEffect(() => {
    if (!order?.orderId || !order.wechatCodeUrl || isUnlocked) return;

    const orderId = order.orderId;
    const startedAt = Date.now();
    const maxPollingMs = 10 * 60 * 1000;
    let ignore = false;

    async function pollOrder(): Promise<void> {
      if (ignore) return;
      if (Date.now() - startedAt > maxPollingMs) return;

      try {
        const latestOrder = await getGoalFitOrderFromApi(orderId);
        if (ignore) return;
        setOrder(latestOrder);

        if (latestOrder.status === "paid" && context.sessionId) {
          if (!context.isSample) {
            markGoalFitReportUnlocked(context.sessionId);
          }
          setIsUnlocked(true);
          navigateTo(fullResultPath);
        }
      } catch {
        // Keep polling quiet; the manual refresh button still exposes a recoverable path.
      }
    }

    const intervalId = window.setInterval(() => {
      void pollOrder();
    }, 2000);

    void pollOrder();

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [context.isSample, context.sessionId, fullResultPath, isUnlocked, order?.orderId]);

  useEffect(() => {
    if (!context.wechatOpenidToken || !order?.orderId || !order.jsapiPaymentParams) return;
    if (hasAutoInvokedJsapiPay || isInvokingJsapiPay || isUnlocked) return;

    setHasAutoInvokedJsapiPay(true);
    void handleWechatJsapiPay();
  }, [
    context.wechatOpenidToken,
    hasAutoInvokedJsapiPay,
    isInvokingJsapiPay,
    isUnlocked,
    order?.orderId,
    order?.jsapiPaymentParams
  ]);

  if (!context.result || !context.sessionId) return <MissingUnlockPage />;

  const isMockOrder = Boolean(
    order &&
      !order.wechatCodeUrl &&
      (order.paymentMode === "mock" || order.paymentProvider === "mock")
  );
  const displayedOriginalAmount = order?.originalAmountCents ?? 1990;
  const hasDiscount = Boolean(order ? order.discountAmountCents > 0 : discountStatus?.discountGranted);
  const displayedPayAmount = order?.payAmountCents ?? discountStatus?.payAmountCents ?? 1990;
  const payAmountLabel = formatYuan(displayedPayAmount);
  const primaryPayLabel = hasDiscount ? `${payAmountLabel} 支付后查看完整报告` : `${payAmountLabel} 查看完整报告`;
  const isWaitingForJsapiPaymentParams = Boolean(isWechatInAppBrowser && context.wechatOpenidToken && !order?.jsapiPaymentParams);
  const isWaitingForNativeCodeUrl = Boolean(!isWechatInAppBrowser && !isMockOrder && !order?.wechatCodeUrl);

  async function handleMarkPaid(): Promise<void> {
    if (!context.sessionId || !order?.orderId) return;

    setIsMarkingPaid(true);
    setOrderError("");

    try {
      await markGoalFitApiOrderPaid(order.orderId);
      if (!context.isSample) {
        markGoalFitReportUnlocked(context.sessionId);
      }
      trackGoalFitEvent({
        eventName: "report_unlocked",
        sessionId: context.sessionId,
        orderId: order.orderId
      });
      setIsUnlocked(true);
      navigateTo(fullResultPath);
    } catch {
      setOrderError("支付状态更新失败，请稍后重试。");
    } finally {
      setIsMarkingPaid(false);
    }
  }

  async function handleRefreshOrderStatus(): Promise<void> {
    if (!context.sessionId || !order?.orderId) return;

    setIsMarkingPaid(true);
    setOrderError("");

    try {
      const latestOrder = await getGoalFitOrderFromApi(order.orderId);
      setOrder(latestOrder);

      if (latestOrder.status === "paid") {
        if (!context.isSample) {
          markGoalFitReportUnlocked(context.sessionId);
        }
        trackGoalFitEvent({
          eventName: "report_unlocked",
          sessionId: context.sessionId,
          orderId: latestOrder.orderId
        });
        setIsUnlocked(true);
        navigateTo(fullResultPath);
      }
    } catch {
      setOrderError("暂时无法刷新订单状态，请稍后重试。");
    } finally {
      setIsMarkingPaid(false);
    }
  }

  function handleStartWechatOauth(): void {
    const returnTo = getCurrentOauthReturnTo();
    window.location.assign(buildApiUrl(`/api/wechat/oauth/start?returnTo=${encodeURIComponent(returnTo)}`));
  }

  async function handleCopyCurrentLink(): Promise<void> {
    try {
      await navigator.clipboard?.writeText(window.location.href);
      setCopiedPageLink(true);
    } catch {
      setCopiedPageLink(false);
    }
  }

  async function waitForPaidOrder(orderId: string): Promise<void> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 800 : 1500));
      const latestOrder = await getGoalFitOrderFromApi(orderId);
      setOrder(latestOrder);

      if (latestOrder.status === "paid") {
        if (!context.isSample && context.sessionId) {
          markGoalFitReportUnlocked(context.sessionId);
        }
        trackGoalFitEvent({
          eventName: "report_unlocked",
          sessionId: context.sessionId,
          orderId: latestOrder.orderId
        });
        setIsUnlocked(true);
        navigateTo(fullResultPath);
        return;
      }
    }

    setOrderError("支付结果正在确认中，请稍后刷新状态。");
  }

  async function handleWechatJsapiPay(): Promise<void> {
    if (!order?.orderId || !order.jsapiPaymentParams) return;

    setIsInvokingJsapiPay(true);
    setOrderError("");
    trackGoalFitEvent({
      eventName: "payment_start",
      sessionId: context.sessionId,
      orderId: order.orderId,
      eventValue: order.payAmountCents,
      metadata: { paymentMode: "jsapi" }
    });

    try {
      const result = await invokeWechatJsapiPay(order.jsapiPaymentParams);
      if (result === "cancel") {
        setOrderError("支付未完成，可重新发起支付。");
        return;
      }
      if (result !== "ok") {
        setOrderError("暂时无法唤起微信支付，请稍后重试。");
        return;
      }

      await waitForPaidOrder(order.orderId);
    } catch {
      setOrderError("暂时无法确认支付状态，请稍后重试。");
    } finally {
      setIsInvokingJsapiPay(false);
    }
  }

  function handlePrimaryPay(): void {
    trackGoalFitEvent({
      eventName: "payment_start",
      sessionId: context.sessionId,
      orderId: order?.orderId,
      eventValue: displayedPayAmount,
      metadata: {
        paymentMode: order?.paymentMode ?? (isWechatInAppBrowser ? "jsapi" : "native")
      }
    });

    if (isWechatInAppBrowser && !context.wechatOpenidToken) {
      handleStartWechatOauth();
      return;
    }

    if (order?.jsapiPaymentParams) {
      void handleWechatJsapiPay();
    }
  }

  if (isUnlocked) {
    return (
      <GoalFitPageFrame>
        <section className="goal-fit-panel goal-fit-unlock-success">
          <p className="goal-fit-eyebrow">解锁完成</p>
          <h1>完整报告已解锁</h1>
          <p>
            {context.isUnlocked
              ? "你已经解锁过这份报告，可以直接继续查看。"
              : "你现在可以查看完整报告，先确认这份报告讲的是你的当前选择。"}
          </p>
          <div className="goal-fit-unlock-actions">
            <button className="primary-button" type="button" onClick={() => navigateTo(fullResultPath)}>
              查看完整报告
            </button>
            <button className="secondary-button" type="button" onClick={() => navigateTo(freeResultPath)}>
              返回免费判断
            </button>
          </div>
        </section>
      </GoalFitPageFrame>
    );
  }

  return (
    <GoalFitPageFrame>
      <section className="goal-fit-panel goal-fit-unlock-frame">
        <header className="goal-fit-unlock-header">
          <p className="goal-fit-eyebrow">完整报告确认</p>
          <h1>{hasDiscount ? "已获得 ¥10 邀请优惠" : "完整报告 ¥19.9"}</h1>
          <p>
            {hasDiscount
              ? "确认优惠金额后即可付款查看完整报告。"
              : "确认标准价后即可付款查看完整报告。"}
          </p>
        </header>

        <div className="goal-fit-unlock-layout">
          <section className="goal-fit-unlock-main-card">
            <div className="goal-fit-unlock-product">
              <span>{hasDiscount ? "邀请优惠" : "标准解锁"}</span>
              <strong>{hasDiscount ? "已获得 ¥10 邀请优惠" : "完整报告 ¥19.9"}</strong>
            </div>
            <div className="goal-fit-unlock-price-detail goal-fit-unlock-price-decision">
              <span>{hasDiscount ? `原价 ${formatYuan(displayedOriginalAmount)}` : "完整报告 ¥19.9"}</span>
              {hasDiscount ? <span>优惠 -¥10</span> : null}
              <strong>{hasDiscount ? "本次支付" : "应付"} {payAmountLabel}</strong>
            </div>
            <div className="goal-fit-unlock-price goal-fit-unlock-pay-hero">
              <span>{hasDiscount ? "本次支付" : "应付"}</span>
              <strong>{payAmountLabel}</strong>
            </div>
            {orderError ? <p className="goal-fit-unlock-error">{orderError}</p> : null}
            {isMobileExternalBrowser ? (
              <div className="goal-fit-unlock-wechat-pay">
                <strong>请使用微信打开当前页面完成支付。</strong>
                <p>手机外部浏览器暂不生成二维码订单，避免出现本机无法扫码的支付体验。</p>
                <button className="primary-button goal-fit-pay-primary" type="button" onClick={handleCopyCurrentLink}>
                  复制当前页面链接
                </button>
                {copiedPageLink ? <p className="goal-fit-unlock-note">链接已复制，请发送到微信内打开。</p> : null}
              </div>
            ) : isWechatInAppBrowser && !context.wechatOpenidToken ? (
              <div className="goal-fit-unlock-wechat-pay">
                <button className="primary-button goal-fit-pay-primary" type="button" onClick={handlePrimaryPay}>
                  {primaryPayLabel}
                </button>
              </div>
            ) : null}
            {isWaitingForJsapiPaymentParams ? (
              <div className="goal-fit-unlock-wechat-pay">
                <p>正在准备支付...</p>
                <button className="primary-button goal-fit-pay-primary" type="button" disabled>
                  支付准备中
                </button>
              </div>
            ) : null}
            {order?.jsapiPaymentParams ? (
              <div className="goal-fit-unlock-wechat-pay">
                {isInvokingJsapiPay ? <p className="goal-fit-unlock-pay-amount">正在唤起微信支付...</p> : null}
                <button
                  className="primary-button goal-fit-pay-primary"
                  type="button"
                  disabled={isInvokingJsapiPay}
                  onClick={handlePrimaryPay}
                >
                  {isInvokingJsapiPay ? "正在确认支付" : primaryPayLabel}
                </button>
              </div>
            ) : order?.wechatCodeUrl ? (
              <div className="goal-fit-unlock-wechat-pay">
                <strong>微信扫码支付</strong>
                <p className="goal-fit-unlock-pay-amount">实际支付金额：{payAmountLabel}</p>
                <p>请使用微信扫码完成支付，支付成功后页面会自动进入完整报告。</p>
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} alt="微信支付二维码" />
                ) : (
                  <div className="goal-fit-unlock-qrcode-placeholder">正在生成二维码...</div>
                )}
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!order || isMarkingPaid}
                  onClick={handleRefreshOrderStatus}
                >
                  {isMarkingPaid ? "正在刷新状态" : "我已支付，刷新状态"}
                </button>
              </div>
            ) : isMockOrder ? (
              <button
                className="secondary-button"
                type="button"
                disabled={!order || isMarkingPaid}
                onClick={handleMarkPaid}
              >
                {isMarkingPaid ? "正在确认解锁状态" : "确认解锁完整报告"}
              </button>
            ) : isWechatInAppBrowser && !context.wechatOpenidToken ? null : isWaitingForJsapiPaymentParams ? null : isWaitingForNativeCodeUrl || isCreatingOrder ? (
              <button className="primary-button goal-fit-pay-primary" type="button" disabled>
                支付准备中
              </button>
            ) : (
              <p className="goal-fit-unlock-note">正在准备支付...</p>
            )}

            <div className="goal-fit-unlock-target-mini">
              <strong>当前预演</strong>
              <span>公司类型：{context.result.targetCompanyLabel}</span>
              <span>岗位方向：{context.result.targetRoleLabel}</span>
              <p>根据你的选择，报告将预演你在这类工作环境中可能遇到的问题。</p>
            </div>
          </section>

          <aside className="goal-fit-unlock-summary-card">
            <p className="goal-fit-eyebrow">当前预演</p>
            <strong>你选择的是：</strong>
            <div className="goal-fit-result-path">
              <span>公司类型：{context.result.targetCompanyLabel}</span>
              <span>岗位方向：{context.result.targetRoleLabel}</span>
            </div>
            <p className="goal-fit-unlock-note">根据你的选择，报告将预演你在这类工作环境中可能遇到的问题。</p>
            {isCreatingOrder ? <p className="goal-fit-unlock-note">正在创建订单...</p> : null}
            {order ? (
              <div className="goal-fit-unlock-order-summary">
                <span>订单状态：待支付</span>
                <span>订单号：{order.outTradeNo}</span>
              </div>
            ) : null}
            {!hasDiscount ? (
              <div className="goal-fit-unlock-coupon-reminder">
                <strong>完整报告 ¥19.9</strong>
                <p>复制邀请链接，可优惠至 ¥9.9。</p>
                <button className="secondary-button" type="button" onClick={() => navigateTo(shareCouponPath)}>
                  复制邀请链接，可优惠至 ¥9.9
                </button>
              </div>
            ) : null}
            <p className="goal-fit-unlock-note">解锁后可查看完整报告，并可在当前设备上再次打开。</p>
            <button className="secondary-button" type="button" onClick={() => navigateTo(freeResultPath)}>
              返回免费判断
            </button>
          </aside>
        </div>
      </section>
    </GoalFitPageFrame>
  );
}

export default GoalFitUnlockPage;
