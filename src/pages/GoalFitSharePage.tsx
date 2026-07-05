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
  "专为应届生量身定做的职场适应度测试"
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
  const [copyState, setCopyState] = useState("复制分享文案");
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
          <p className="goal-fit-eyebrow">求职方向卡</p>
          <h1>{isCouponMode ? "生成求职方向卡，领取优惠" : "生成我的求职方向卡"}</h1>
          <p>
            {isCouponMode
              ? "这张卡不会展示你的具体分数、公司类型、岗位方向和风险点。保存或分享后，可领取 ¥10 优惠券，¥9.9 解锁完整报告。"
              : "这张卡不会展示你的具体分数、公司类型、岗位方向和风险点，只保留一段适合表达的求职状态。"}
          </p>
          <p className="goal-fit-share-device-hint">
            {isCouponMode
              ? "这张求职方向卡更适合在手机上截图或保存。你也可以先复制分享文案，或领取优惠后继续解锁完整报告。"
              : "这张求职方向卡更适合在手机上截图或保存。你也可以先复制分享文案，或返回完整报告继续查看。"}
          </p>
        </div>

        <article className="goal-fit-share-card" aria-label="求职方向卡">
          <div className="goal-fit-share-card-tag">第一份工作风险预演</div>
          <h2>我开始对未来的职场有一点信心了。</h2>
          <div className="goal-fit-share-card-body">
            <p>不是因为我已经知道自己一定适合什么，</p>
            <p>而是我终于开始看清：</p>
            <p>公司、岗位和我之间，到底要怎么判断。</p>
            <p>第一份工作不用一次决定一生，</p>
            <p>但至少可以少一点盲选。</p>
          </div>
          <div className="goal-fit-share-card-footer">
            <strong>专为应届生量身定做的职场适应度测试</strong>
            <span>猎头季哥｜21年招聘经验</span>
            <small>
              {isCouponMode ? "也可以做一次测试，领取 ¥10 优惠券。" : "先预演一次，再决定要不要投。"}
            </small>
          </div>
        </article>

        <div className="goal-fit-share-actions">
          {isCouponMode ? (
            <section className="goal-fit-share-coupon-panel">
              <p className="goal-fit-eyebrow">保存 / 分享后领取</p>
              <h2>¥10 优惠券</h2>
              <p>完整报告标准价 ¥19.9。</p>
              <p>保存或分享这张求职方向卡后，可领取 ¥10 优惠券，优惠后 ¥9.9 解锁完整报告。</p>
              <small>你可以先保存截图，也可以复制文案后再决定是否发布。</small>
            </section>
          ) : null}

          {isCouponMode ? (
            <button className="primary-button" type="button" onClick={() => navigateTo(couponUnlockPath)}>
              我已保存或分享，领取 ¥10 优惠券
            </button>
          ) : (
            <button className="primary-button" type="button" onClick={handleCopy}>
              {copyState}
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
            onClick={() => navigateTo("/goal-fit-preview")}
          >
            让同学也测一次
          </button>
          <p>这张卡可以直接截图保存。它不会展示你的具体测试结果。</p>
        </div>
      </section>
    </main>
  );
}

export default GoalFitSharePage;
