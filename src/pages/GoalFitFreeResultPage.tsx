import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import GoalFitHeader from "../components/GoalFitHeader";
import { trackGoalFitEvent, trackGoalFitVisit } from "../lib/goalFitAnalytics";
import { buildGoalFitResult } from "../lib/goalFitResultBuilder";
import { goalFitQuestionBank } from "../lib/goalFitQuestionBank";
import { selectGoalFitQuestions } from "../lib/goalFitQuestionSelector";
import {
  confirmGoalFitReferralCopied,
  createGoalFitReferralLink,
  getGoalFitDiscountStatus,
  type GoalFitReferralResponse
} from "../lib/goalFitReferralStore";
import {
  formatGoalFitYuan,
  getGoalFitPricingDisplay,
  type GoalFitPricingDisplay
} from "../lib/goalFitPricing";
import { getGoalFitSession } from "../lib/goalFitSessionStore";
import { navigateTo } from "../lib/router";
import type { CompanyType, GoalFitAnswerMap, GoalFitResult, RoleType } from "../lib/goalFitTypes";

type FreeRisk = {
  title: string;
  description: string;
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

function getResultFromUrl(): { result: GoalFitResult | null; sessionId: string | null; isSample: boolean } {
  const params = new URLSearchParams(window.location.search);
  const sample = params.get("sample");
  const sessionId = params.get("session");

  if (sample === "high_fit") {
    return { result: createSampleResult(), sessionId: null, isSample: true };
  }

  if (!sessionId) return { result: null, sessionId: null, isSample: false };

  return {
    result: getGoalFitSession(sessionId)?.result ?? null,
    sessionId,
    isSample: false
  };
}

function getFallbackRisk(result: GoalFitResult): FreeRisk {
  const scores = result.scores;
  const scorePairs = [
    { key: "roleEntryScore", value: scores.roleEntryScore },
    { key: "rolePersonalityScore", value: scores.rolePersonalityScore },
    { key: "roleBehaviorScore", value: scores.roleBehaviorScore },
    { key: "companyEntryScore", value: scores.companyEntryScore },
    { key: "companyPersonalityScore", value: scores.companyPersonalityScore },
    { key: "companyBehaviorScore", value: scores.companyBehaviorScore }
  ].sort((a, b) => a.value - b.value);
  const weakest = scorePairs[0]?.key;

  if (weakest === "roleEntryScore") {
    return {
      title: "岗位准备风险",
      description:
        "你不是完全没有机会，但目前还缺少足够清晰的岗位证据。投递和面试时，如果讲不出具体项目、结果和迁移理由，反馈会被明显影响。"
    };
  }

  if (weakest === "rolePersonalityScore" || weakest === "roleBehaviorScore") {
    return {
      title: "岗位理解风险",
      description:
        "你可能对这个岗位有兴趣，但还没有足够清晰它真实每天在做什么。如果这点没弄明白，后面容易出现简历写不准、面试说不深、入职后发现和想象不一样。"
    };
  }

  if (weakest === "companyEntryScore") {
    return {
      title: "公司入场门槛风险",
      description:
        "这类公司通常会先看学历、经历、项目和表达证据。你目前的问题不是完全没有机会，而是需要把现有经历整理成更容易被筛选通过的材料。"
    };
  }

  if (weakest === "companyPersonalityScore" || weakest === "companyBehaviorScore") {
    return {
      title: "公司环境消耗风险",
      description:
        "你选择的公司类型可能有机会，但也可能放大压力、节奏和协作成本。如果不提前确认，后面容易出现短期能进、长期消耗大的问题。"
    };
  }

  return {
    title: "岗位理解风险",
    description:
      "你需要进一步确认这个岗位每天处理什么问题、如何评价新人，以及你现在的经历能不能支撑这个方向。"
  };
}

function getPrimaryRisk(result: GoalFitResult): FreeRisk {
  const firstRisk = result.riskInsights[0];
  if (firstRisk) {
    return {
      title: firstRisk.title,
      description: firstRisk.description
    };
  }

  return getFallbackRisk(result);
}

function getRiskPoints(result: GoalFitResult, primaryRisk: FreeRisk): FreeRisk[] {
  const risks = result.riskInsights.map((risk) => ({
    title: risk.title,
    description: risk.description
  }));

  if (risks.length > 0) return risks.slice(0, 3);

  return [primaryRisk];
}

function getActionReminder(result: GoalFitResult, riskTitle: string): string {
  const firstRecommendation = result.recommendations[0];

  if (firstRecommendation) {
    return `${firstRecommendation.title}：${firstRecommendation.description}`;
  }

  if (riskTitle.includes("岗位理解")) {
    return "先确认这个岗位真实每天在处理什么问题。";
  }

  if (riskTitle.includes("公司环境")) {
    return "先确认这类公司真实的节奏、反馈方式和协作压力。";
  }

  if (riskTitle.includes("岗位准备")) {
    return "先准备 1–2 个能证明自己适合这个岗位的项目或经历。";
  }

  if (riskTitle.includes("入场门槛")) {
    return "先把学历、实习、项目和经历整理成更容易通过初筛的表达。";
  }

  return "先确认这个方向最影响反馈的一项，再决定是否扩大投递。";
}

function getAdviceLabel(score: number): string {
  if (score >= 80) return "建议优先尝试";
  if (score >= 65) return "可以尝试，但需确认风险";
  return "当前不建议优先投递";
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

function MissingFreeResultPage() {
  return (
    <GoalFitPageFrame>
      <section className="goal-fit-panel goal-fit-result-empty">
        <p className="goal-fit-eyebrow">结果未找到</p>
        <h1>没有找到本次判断</h1>
        <p>可能是浏览器记录被清理，或者你打开的链接已经失效。你可以重新完成一次目标适配判断。</p>
        <button className="primary-button" type="button" onClick={() => navigateTo("/test-goal-fit-preview")}>
          重新开始路径预演
        </button>
      </section>
    </GoalFitPageFrame>
  );
}

function GoalFitFreeResultPage() {
  const { result, sessionId, isSample } = getResultFromUrl();
  const [isInvitePanelOpen, setIsInvitePanelOpen] = useState(false);
  const [referral, setReferral] = useState<GoalFitReferralResponse | null>(null);
  const [inviteStatus, setInviteStatus] = useState<
    "idle" | "copying" | "share_prompt" | "manual" | "confirm_failed" | "error"
  >("idle");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteQrCodeDataUrl, setInviteQrCodeDataUrl] = useState("");
  const [inviteQrCodeError, setInviteQrCodeError] = useState("");
  const [pricing, setPricing] = useState<GoalFitPricingDisplay | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("invite") === "1") setIsInvitePanelOpen(true);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadPricing(): Promise<void> {
      try {
        const nextPricing = await getGoalFitPricingDisplay();
        if (!ignore) setPricing(nextPricing);
      } catch {
        if (!ignore) setPricing(null);
      }
    }

    void loadPricing();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    trackGoalFitVisit(sessionId);
    if (!result) return;

    trackGoalFitEvent({
      eventName: "free_result_view",
      sessionId,
      metadata: {
        isSample,
        overallScore: result.scores.overallScore
      }
    });
  }, [isSample, result, sessionId]);

  if (!result) return <MissingFreeResultPage />;

  const judgement = result.overallConclusion;
  const primaryRisk = getPrimaryRisk(result);
  const riskPoints = getRiskPoints(result, primaryRisk);
  const actionReminder = getActionReminder(result, primaryRisk.title);
  const judgementSentence = `这个方向可以继续投递，但需要重点注意「${primaryRisk.title}」。`;
  const riskSentence = `你当前最容易卡在：${primaryRisk.title}。`;

  const standardPriceCents = pricing?.finalStandardPriceCents ?? 1990;
  const basePriceCents = pricing?.basePriceCents ?? 1990;
  const inviteDiscountCents = pricing?.inviteDiscountCents ?? 1000;
  const freeTrialActive = Boolean(pricing?.freeTrialActive);
  const standardPriceLabel = formatGoalFitYuan(standardPriceCents);
  const basePriceLabel = formatGoalFitYuan(basePriceCents);
  const inviteDiscountLabel = formatGoalFitYuan(inviteDiscountCents);
  const primaryUnlockLabel = freeTrialActive ? "限时免费查看完整报告" : `查看完整报告 ${standardPriceLabel}`;
  const priceLineLabel = freeTrialActive ? "限时免费试用" : `完整报告 ${standardPriceLabel}`;
  const inviteButtonLabel = `复制邀请链接，立减 ${inviteDiscountLabel}`;
  const invitePanelTitle = referral?.shareUrl
    ? "你的专属邀请已生成"
    : freeTrialActive
      ? "分享测试，邀请好友一起预演"
      : `分享测试，报告立减 ${inviteDiscountLabel}`;
  const invitePanelDescription = referral?.shareUrl
    ? "复制链接或截图二维码，分享给微信好友、微信群或朋友圈。对方打开后即可完成测试，你也可以继续领取本次优惠。"
    : freeTrialActive
      ? "生成你的专属测试链接，分享给同学或朋友一起提前看看第一份工作的适应情况。"
      : `生成你的专属测试链接，完整报告由 ${basePriceLabel} 最多优惠 ${inviteDiscountLabel}。`;

  function handleUnlock(): void {
    trackGoalFitEvent({
      eventName: "pay_cta_click",
      sessionId,
      metadata: { isSample, entry: "free_result" }
    });

    if (isSample) {
      navigateTo("/goal-fit-unlock-preview?sample=high_fit");
      return;
    }

    if (!sessionId) return;

    navigateTo(`/goal-fit-unlock-preview?session=${encodeURIComponent(sessionId)}`);
  }

  function handleOpenInvitePanel(): void {
    setInviteStatus("idle");
    setInviteMessage("");
    setInviteQrCodeDataUrl("");
    setInviteQrCodeError("");
    trackGoalFitEvent({
      eventName: "coupon_cta_click",
      sessionId,
      metadata: { isSample }
    });
    setIsInvitePanelOpen(true);
  }

  async function generateInviteQrCode(shareUrl: string): Promise<void> {
    setInviteQrCodeDataUrl("");
    setInviteQrCodeError("");

    try {
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(shareUrl, {
        margin: 1,
        width: 192,
        color: {
          dark: "#253a33",
          light: "#fffaf0"
        }
      });
      setInviteQrCodeDataUrl(dataUrl);
      trackGoalFitEvent({
        eventName: "referral_qr_shown",
        sessionId,
        metadata: { hasQrCode: true }
      });
    } catch {
      setInviteQrCodeError("二维码暂时生成失败，但不影响复制链接和领取优惠。");
    }
  }

  async function handleConfirmReferralCopied(): Promise<void> {
    if (isSample) {
      setInviteStatus("error");
      setInviteMessage("示例结果不能领取专属优惠，请完成一次正式测试。");
      return;
    }

    if (!sessionId) return;

    setInviteStatus("copying");
    setInviteMessage("");

    try {
      const confirmed = await confirmGoalFitReferralCopied(sessionId);
      const discount = await getGoalFitDiscountStatus(sessionId);

      if (!discount.discountGranted) {
        setReferral(confirmed);
        setInviteStatus("confirm_failed");
        setInviteMessage("链接已复制，但服务端还没有确认优惠。请点击下方按钮重试。");
        return;
      }

      setReferral({
        ...confirmed,
        discountGranted: true,
        discountAmountCents: discount.discountAmountCents,
        payAmountCents: discount.payAmountCents
      });
      setInviteStatus("share_prompt");
      trackGoalFitEvent({
        eventName: "referral_link_copied",
        sessionId,
        metadata: { referralCode: confirmed.referralCode }
      });
      trackGoalFitEvent({
        eventName: "coupon_confirmed",
        sessionId,
        metadata: {
          referralCode: confirmed.referralCode,
          payAmountCents: discount.payAmountCents
        }
      });
      setInviteMessage("专属邀请链接已复制。请分享给微信好友或朋友圈，然后继续查看你的优惠。");
    } catch {
      setInviteStatus("confirm_failed");
      setInviteMessage("链接已复制，但优惠确认失败。请不要重新生成链接，点击下方按钮重试确认。");
    }
  }

  async function handleCopyReferralLink(): Promise<void> {
    if (isSample) {
      setInviteStatus("error");
      setInviteMessage("示例结果不能领取专属优惠，请完成一次正式测试。");
      return;
    }

    if (!sessionId) return;

    setInviteStatus("copying");
    setInviteMessage("");

    try {
      const nextReferral = await createGoalFitReferralLink(sessionId);
      setReferral(nextReferral);
      trackGoalFitEvent({
        eventName: "referral_link_created",
        sessionId,
        metadata: { referralCode: nextReferral.referralCode }
      });
      await generateInviteQrCode(nextReferral.shareUrl);
      const copied = await copyTextToClipboard(nextReferral.shareUrl);

      if (!copied) {
        setInviteStatus("manual");
        setInviteMessage("复制没有成功。你可以手动选择链接复制，复制成功后再点击按钮确认。");
        return;
      }

      await handleConfirmReferralCopied();
    } catch {
      setInviteStatus("error");
      setInviteMessage("专属链接暂时生成失败，请稍后再试。");
    }
  }

  async function handleCopyGeneratedReferralLink(): Promise<void> {
    if (!referral?.shareUrl) return;

    setInviteStatus("copying");
    setInviteMessage("");

    const copied = await copyTextToClipboard(referral.shareUrl);
    if (!copied) {
      setInviteStatus("manual");
      setInviteMessage("复制没有成功。你可以手动选择链接复制，复制成功后再点击按钮确认。");
      return;
    }

    await handleConfirmReferralCopied();
  }

  return (
    <GoalFitPageFrame>
      <section className="goal-fit-panel goal-fit-free-result-frame">
        <section className="goal-fit-free-diagnosis-card">
          <header className="goal-fit-free-diagnosis-header">
            <p className="goal-fit-free-page-title">第一份工作预演</p>
            <span>基础判断</span>
          </header>

          <div className="goal-fit-free-diagnosis-core goal-fit-free-diagnosis-core-v110">
            <div className="goal-fit-free-headline goal-fit-free-judgement-stack">
              <p className="goal-fit-free-current-label">你的当前判断：</p>
              <h1>{judgementSentence}</h1>
              <p>{judgement.summary}</p>
            </div>
            <div className="goal-fit-free-score goal-fit-free-score-secondary">
              <span>综合匹配度</span>
              <strong>{result.scores.overallScore}%</strong>
              <small>{getAdviceLabel(result.scores.overallScore)}</small>
            </div>
          </div>

          <p className="goal-fit-free-risk-line goal-fit-free-risk-sentence">
            <span>最大风险：</span>
            <strong>{riskSentence}</strong>
          </p>

          <p className="goal-fit-free-target">
            当前预演：{result.targetCompanyLabel} × {result.targetRoleLabel}
          </p>

          <div className="goal-fit-free-report-includes goal-fit-free-report-includes-compact">
            <small>应届生求职场景预演｜基于你的公司类型与岗位方向生成</small>
            <p>完整报告将继续拆解：</p>
            <ul>
              <li>公司环境</li>
              <li>岗位差距</li>
              <li>投递风险</li>
              <li>调整方向</li>
            </ul>
          </div>

          <div className="goal-fit-free-cta-stack goal-fit-free-inline-actions">
            <p className="goal-fit-free-price-line">{priceLineLabel}</p>
            <button
              className="primary-button goal-fit-free-primary-cta goal-fit-pay-primary"
              type="button"
              onClick={handleUnlock}
            >
              {primaryUnlockLabel}
            </button>
            <button className="secondary-button goal-fit-free-coupon-cta" type="button" onClick={handleOpenInvitePanel}>
              {inviteButtonLabel}
            </button>
          </div>
        </section>

        <section className="goal-fit-free-risk-card">
          <p className="goal-fit-eyebrow">主要风险</p>
          <ul className="goal-fit-free-risk-list">
            {riskPoints.map((risk) => (
              <li key={risk.title}>
                <strong>{risk.title}</strong>
                <span>{risk.description}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="goal-fit-free-advice-card">
          <h2>行动提醒</h2>
          <p>{actionReminder}</p>
        </section>

        <section className="goal-fit-free-lock-card">
          <div>
            <p className="goal-fit-eyebrow">完整报告会继续拆</p>
            <h2>完整报告会继续拆公司环境、岗位差距、投递风险和调整方向。</h2>
          </div>
          <div className="goal-fit-free-lock-grid">
            {[
              {
                title: "公司类型适配拆解",
                items: ["这类公司的用人风格", "你进入这类公司的准备情况", "你入职后的真实体感", "你需要提前补齐的部分"]
              },
              {
                title: "岗位类型适配拆解",
                items: ["这类岗位更看重什么", "你的当前胜任准备", "你做这类岗位后的体感", "你需要补的能力和表达"]
              },
              {
                title: "建议行动",
                items: ["最大风险点", "优先补齐方向", "材料调整方向", "面试表达提醒"]
              }
            ].map((card) => (
              <article className="goal-fit-free-locked-preview" key={card.title}>
                <span>待解锁</span>
                <h3>{card.title}</h3>
                <ul>
                  {card.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="goal-fit-free-unlock-card">
          <button className="secondary-button goal-fit-free-direct-unlock-link" type="button" onClick={handleUnlock}>
            直接 {standardPriceLabel} 查看完整报告
          </button>
          <p>查看公司差距、岗位差距和具体行动建议。</p>
          <small>免费页先给你总判断，完整报告会继续给你拆解和行动。</small>
        </section>
      </section>

      <nav className="goal-fit-free-sticky-actions" aria-label="完整报告操作">
        <button className="primary-button goal-fit-pay-primary" type="button" onClick={handleUnlock}>
          {primaryUnlockLabel}
        </button>
        <button className="secondary-button" type="button" onClick={handleOpenInvitePanel}>
          {inviteButtonLabel}
        </button>
      </nav>

      {isInvitePanelOpen ? (
        <section className="goal-fit-invite-overlay" role="dialog" aria-modal="true" aria-labelledby="goal-fit-invite-title">
          <div className="goal-fit-invite-panel">
            <p className="goal-fit-eyebrow">邀请优惠</p>
            <h2 id="goal-fit-invite-title">
              {invitePanelTitle}
            </h2>
            <p>
              {invitePanelDescription}
            </p>
            {inviteMessage ? <p className={`goal-fit-invite-message ${inviteStatus}`}>{inviteMessage}</p> : null}
            {referral?.shareUrl ? (
              <div className="goal-fit-invite-share-box">
                <p>你可以复制链接，也可以截图二维码发给同学。</p>
                {inviteQrCodeDataUrl ? (
                  <img className="goal-fit-invite-qrcode" src={inviteQrCodeDataUrl} alt="专属邀请链接二维码" />
                ) : inviteQrCodeError ? (
                  <p className="goal-fit-invite-qrcode-error">{inviteQrCodeError}</p>
                ) : (
                  <div className="goal-fit-invite-qrcode-placeholder">正在生成二维码...</div>
                )}
              </div>
            ) : null}
            {referral?.shareUrl && inviteStatus === "manual" ? (
              <textarea className="goal-fit-invite-manual-link" readOnly value={referral.shareUrl} />
            ) : null}
            <div className="goal-fit-invite-actions">
              {inviteStatus === "share_prompt" ? (
                <>
                  <button className="secondary-button" type="button" onClick={handleCopyGeneratedReferralLink}>
                    复制邀请链接
                  </button>
                  <button className="primary-button" type="button" onClick={handleUnlock}>
                    继续，查看我的优惠
                  </button>
                </>
              ) : inviteStatus === "manual" || inviteStatus === "confirm_failed" ? (
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleCopyGeneratedReferralLink}
                >
                  复制邀请链接
                </button>
              ) : (
                <button
                  className="primary-button"
                  type="button"
                  disabled={inviteStatus === "copying"}
                  onClick={handleCopyReferralLink}
                >
                  {inviteStatus === "copying" ? "正在复制..." : inviteButtonLabel}
                </button>
              )}
              <button className="secondary-button" type="button" onClick={() => setIsInvitePanelOpen(false)}>
                暂不领取
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </GoalFitPageFrame>
  );
}

export default GoalFitFreeResultPage;
