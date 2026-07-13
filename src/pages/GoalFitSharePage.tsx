import { useMemo } from "react";
import GoalFitHeader from "../components/GoalFitHeader";
import { navigateTo } from "../lib/router";

function getShareContext() {
  const params = new URLSearchParams(window.location.search);
  const sample = params.get("sample");
  const sessionId = params.get("session");
  const isCouponMode = params.get("mode") === "coupon";

  if (sample === "high_fit") {
    return {
      isCouponMode,
      returnPath: "/result-goal-fit-preview?sample=high_fit&section=action",
      freeResultPath: "/result-goal-fit-free-preview?sample=high_fit",
      couponUnlockPath: "/goal-fit-unlock-preview?sample=high_fit&coupon=share_card"
    };
  }

  if (sessionId) {
    return {
      isCouponMode,
      returnPath: `/result-goal-fit-preview?session=${encodeURIComponent(sessionId)}&section=action`,
      freeResultPath: `/result-goal-fit-free-preview?session=${encodeURIComponent(sessionId)}`,
      couponUnlockPath: `/goal-fit-unlock-preview?session=${encodeURIComponent(sessionId)}&coupon=share_card`
    };
  }

  return {
    isCouponMode,
    returnPath: "/goal-fit-preview",
    freeResultPath: "/goal-fit-preview",
    couponUnlockPath: "/goal-fit-unlock-preview?coupon=share_card"
  };
}

function GoalFitSharePage() {
  const { couponUnlockPath, freeResultPath, isCouponMode, returnPath } = useMemo(
    () => getShareContext(),
    []
  );

  return (
    <main className="goal-fit-shell goal-fit-share-shell">
      <GoalFitHeader />

      <section className="goal-fit-share-layout">
        <div className="goal-fit-share-intro">
          <p className="goal-fit-eyebrow">领取优惠券</p>
          <h1>请确认你已经把测试链接分享给同学</h1>
          <p>
            {isCouponMode
              ? "分享后可领取 ¥10 优惠券，¥9.9 查看完整报告。"
              : "如果你已经把测试链接发给同学，可以继续返回完整报告。"}
          </p>
        </div>

        <div className="goal-fit-share-actions">
          {isCouponMode ? (
            <section className="goal-fit-share-coupon-panel">
              <p className="goal-fit-eyebrow">分享后优惠</p>
              <h2>¥9.9 查看完整报告</h2>
            </section>
          ) : null}

          {isCouponMode ? (
            <button className="primary-button" type="button" onClick={() => navigateTo(couponUnlockPath)}>
              我已分享，领取优惠券
            </button>
          ) : (
            <button className="primary-button" type="button" onClick={() => navigateTo(couponUnlockPath)}>
              我已分享，领取优惠券
            </button>
          )}

          {isCouponMode ? (
            <button className="secondary-button" type="button" onClick={() => navigateTo(freeResultPath)}>
              返回结果页
            </button>
          ) : (
            <button className="secondary-button" type="button" onClick={() => navigateTo(returnPath)}>
              返回完整报告
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

export default GoalFitSharePage;
