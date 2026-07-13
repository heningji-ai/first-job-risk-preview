import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import GoalFitHeader from "../components/GoalFitHeader";
import { buildApiUrl } from "../config/api";
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
import { getGoalFitSession } from "../lib/goalFitSessionStore";
import { isGoalFitReportUnlocked, markGoalFitReportUnlocked } from "../lib/goalFitUnlockStore";
import { navigateTo } from "../lib/router";
import type { CompanyType, GoalFitAnswerMap, GoalFitResult, RoleType } from "../lib/goalFitTypes";

type UnlockContext = {
  result: GoalFitResult | null;
  sessionId: string | null;
  isSample: boolean;
  isUnlocked: boolean;
  hasShareCardCoupon: boolean;
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
  const hasShareCardCoupon = params.get("coupon") === "share_card";
  const wechatOpenidToken = params.get("wechatOpenidToken");

  if (sample === "high_fit") {
    return {
      result: createSampleResult(),
      sessionId: "sample_high_fit",
      isSample: true,
      isUnlocked: false,
      hasShareCardCoupon,
      wechatOpenidToken
    };
  }

  if (!sessionId) {
    return { result: null, sessionId: null, isSample: false, isUnlocked: false, hasShareCardCoupon, wechatOpenidToken };
  }

  return {
    result: getGoalFitSession(sessionId)?.result ?? null,
    sessionId,
    isSample: false,
    isUnlocked: isGoalFitReportUnlocked(sessionId),
    hasShareCardCoupon,
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
  const [orderError, setOrderError] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const isWechatInAppBrowser = isWechatBrowser();
  const fullResultPath = buildFullResultPath(context);
  const freeResultPath = buildFreeResultPath(context);
  const shareCouponPath = buildShareCouponPath(context);

  useEffect(() => {
    if (!context.result || !context.sessionId || isUnlocked) return;
    if (isWechatInAppBrowser && !context.wechatOpenidToken) return;

    let ignore = false;

    async function createOrder(): Promise<void> {
      if (!context.sessionId) return;

      setIsCreatingOrder(true);
      setOrderError("");

      try {
        const createdOrder = await createGoalFitOrderFromApi({
          sessionId: context.sessionId,
          accessMode: context.hasShareCardCoupon ? "share_coupon" : "direct",
          couponCode: context.hasShareCardCoupon ? "share_card" : null,
          paymentMethod: isWechatInAppBrowser ? "jsapi" : "native",
          wechatOpenidToken: context.wechatOpenidToken ?? undefined
        });

        if (!ignore) setOrder(createdOrder);
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
    context.hasShareCardCoupon,
    context.result,
    context.sessionId,
    context.wechatOpenidToken,
    isWechatInAppBrowser,
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

  if (!context.result || !context.sessionId) return <MissingUnlockPage />;

  const isMockOrder = Boolean(
    order &&
      !order.wechatCodeUrl &&
      (order.paymentMode === "mock" || order.paymentProvider === "mock")
  );
  const displayedOriginalAmount = order?.originalAmountCents ?? 1990;
  const displayedPayAmount = order?.payAmountCents ?? (context.hasShareCardCoupon ? 990 : 1990);
  const payAmountLabel = formatYuan(displayedPayAmount);
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

  async function waitForPaidOrder(orderId: string): Promise<void> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 800 : 1500));
      const latestOrder = await getGoalFitOrderFromApi(orderId);
      setOrder(latestOrder);

      if (latestOrder.status === "paid") {
        if (!context.isSample && context.sessionId) {
          markGoalFitReportUnlocked(context.sessionId);
        }
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
          <h1>{context.hasShareCardCoupon ? "恭喜你获得 ¥10 优惠券" : "解锁完整目标适配报告"}</h1>
          <p>
            {context.hasShareCardCoupon
              ? "优惠后仅需 ¥9.9，即可查看完整报告。"
              : "免费判断已经帮你看到了总方向。完整报告会继续帮你判断这份选择是否值得继续投递。"}
          </p>
        </header>

        <div className="goal-fit-unlock-layout">
          <section className="goal-fit-unlock-main-card">
            <div className="goal-fit-unlock-product">
              <span>产品名称</span>
              <strong>完整目标适配报告</strong>
            </div>
            <div className="goal-fit-unlock-price-detail">
              <span>完整报告原价 {formatYuan(displayedOriginalAmount)}</span>
              {context.hasShareCardCoupon ? <span>已享 ¥10 优惠</span> : null}
              <strong>{context.hasShareCardCoupon ? "优惠后仅需" : "应付"} {payAmountLabel}</strong>
            </div>
            <div className="goal-fit-unlock-price">
              <span>{context.hasShareCardCoupon ? "本次支付" : "应付"}</span>
              <strong>{payAmountLabel}</strong>
            </div>
          </section>

          <aside className="goal-fit-unlock-summary-card">
            <p className="goal-fit-eyebrow">当前预演</p>
            <p className="goal-fit-unlock-note">根据你的选择，预演你在职场可能遇到的问题。</p>
            <strong>你选择的是：</strong>
            <div className="goal-fit-result-path">
              <span>公司类型：{context.result.targetCompanyLabel}</span>
              <span>岗位方向：{context.result.targetRoleLabel}</span>
            </div>
            {isCreatingOrder ? <p className="goal-fit-unlock-note">正在创建订单...</p> : null}
            {order ? (
              <div className="goal-fit-unlock-order-summary">
                <span>订单状态：待支付</span>
                <span>订单号：{order.outTradeNo}</span>
              </div>
            ) : null}
            {orderError ? <p className="goal-fit-unlock-error">{orderError}</p> : null}
            {isWechatInAppBrowser && !context.wechatOpenidToken ? (
              <div className="goal-fit-unlock-wechat-pay">
                <strong>微信支付</strong>
                <p>当前在微信内打开，可直接唤起微信支付。</p>
                <button className="primary-button" type="button" onClick={handleStartWechatOauth}>
                  微信内支付
                </button>
              </div>
            ) : null}
            {isWaitingForJsapiPaymentParams ? (
              <div className="goal-fit-unlock-wechat-pay">
                <strong>微信支付</strong>
                <p>正在准备支付...</p>
                <button className="primary-button" type="button" disabled>
                  支付准备中
                </button>
              </div>
            ) : null}
            {!context.hasShareCardCoupon ? (
              <div className="goal-fit-unlock-coupon-reminder">
                <strong>完整报告 ¥19.9</strong>
                <p>保存并分享海报，可 ¥9.9 查看完整报告。</p>
                <button className="secondary-button" type="button" onClick={() => navigateTo(shareCouponPath)}>
                  返回保存并分享海报
                </button>
              </div>
            ) : null}
            {order?.jsapiPaymentParams ? (
              <div className="goal-fit-unlock-wechat-pay">
                <strong>微信支付</strong>
                <p>当前在微信内打开，可直接唤起微信支付。</p>
                <p className="goal-fit-unlock-pay-amount">实际支付金额：{payAmountLabel}</p>
                <button
                  className="primary-button"
                  type="button"
                  disabled={isInvokingJsapiPay}
                  onClick={handleWechatJsapiPay}
                >
                  {isInvokingJsapiPay ? "正在确认支付" : `${payAmountLabel} 支付后查看完整报告`}
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
              <button className="primary-button" type="button" disabled>
                支付准备中
              </button>
            ) : (
              <p className="goal-fit-unlock-note">正在准备支付...</p>
            )}
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
