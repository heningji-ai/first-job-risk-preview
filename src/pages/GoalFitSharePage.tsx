import { useMemo, useState } from "react";
import GoalFitHeader from "../components/GoalFitHeader";
import { navigateTo } from "../lib/router";

const shareCopy = [
  "我开始对未来的职场有一点信心了。",
  "",
  "不是因为我已经知道自己一定适合什么，",
  "而是我终于开始看清：",
  "公司、岗位和我之间，到底要怎么判断。",
  "",
  "第一份工作不用一次决定一生，",
  "但至少可以少一点盲选。",
  "",
  "第一份工作风险预演"
].join("\n");

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
  const [copyState, setCopyState] = useState("复制链接，发给同学也测一下");
  const { couponUnlockPath, freeResultPath, isCouponMode, returnPath } = useMemo(
    () => getShareContext(),
    []
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareCopy);
      setCopyState("已复制，可以粘贴分享");
    } catch {
      setCopyState("复制失败，请手动选中文案");
    }
  };

  return (
    <main className="goal-fit-shell goal-fit-share-shell">
      <GoalFitHeader />

      <section className="goal-fit-share-layout">
        <div className="goal-fit-share-intro">
          <p className="goal-fit-eyebrow">分享海报</p>
          <h1>{isCouponMode ? "保存分享图，领取优惠" : "保存我的求职风险预演海报"}</h1>
          <p>
            {isCouponMode
              ? "保存或分享这张求职风险预演海报后，可领取 ¥10 优惠券，¥9.9 解锁完整报告。"
              : "这张海报适合手机截图或保存，用来表达你正在认真判断第一份工作的方向。"}
          </p>
          <p className="goal-fit-share-device-hint">
            {isCouponMode
              ? "这张求职风险预演海报更适合在手机上截图或保存。你也可以先复制分享文案，或领取优惠后继续解锁完整报告。"
              : "这张求职风险预演海报更适合在手机上截图或保存。你也可以先复制分享文案，或返回完整报告继续查看。"}
          </p>
        </div>

        <article className="goal-fit-share-card" aria-label="第一份工作风险预演分享海报">
          <img
            className="goal-fit-share-poster-image"
            src="/images/goal-fit-share-poster.png"
            alt="第一份工作风险预演分享海报"
          />
        </article>

        <div className="goal-fit-share-actions">
          {isCouponMode ? (
            <section className="goal-fit-share-coupon-panel">
              <p className="goal-fit-eyebrow">保存 / 分享后领取</p>
              <h2>¥10 优惠券</h2>
              <p>完整报告标准价 ¥19.9。</p>
              <p>保存或分享这张求职风险预演海报后，可领取 ¥10 优惠券，优惠后 ¥9.9 解锁完整报告。</p>
              <small>你可以先保存截图，也可以复制文案后再决定是否发布。</small>
            </section>
          ) : null}

          {isCouponMode ? (
            <button className="primary-button" type="button" onClick={() => navigateTo(couponUnlockPath)}>
              领取优惠券，¥9.9 解锁完整报告
            </button>
          ) : (
            <button className="primary-button" type="button" onClick={() => navigateTo(couponUnlockPath)}>
              领取优惠券，¥9.9 解锁完整报告
            </button>
          )}

          {isCouponMode ? (
            <button className="secondary-button" type="button" onClick={handleCopy}>
              {copyState}
            </button>
          ) : (
            <button className="secondary-button" type="button" onClick={() => navigateTo(returnPath)}>
              返回完整报告
            </button>
          )}

          {isCouponMode ? (
            <button className="secondary-button" type="button" onClick={() => navigateTo(freeResultPath)}>
              返回免费判断
            </button>
          ) : null}

          <button
            className="secondary-button goal-fit-share-link-button"
            type="button"
            onClick={handleCopy}
          >
            保存卡片，发给同学也测一下
          </button>
          <p>这张海报可以直接截图保存。它不会展示你的具体测试结果。</p>
        </div>
      </section>
    </main>
  );
}

export default GoalFitSharePage;
