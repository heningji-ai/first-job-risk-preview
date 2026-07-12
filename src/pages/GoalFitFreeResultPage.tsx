import type { ReactNode } from "react";
import GoalFitHeader from "../components/GoalFitHeader";
import { buildGoalFitResult } from "../lib/goalFitResultBuilder";
import { goalFitQuestionBank } from "../lib/goalFitQuestionBank";
import { selectGoalFitQuestions } from "../lib/goalFitQuestionSelector";
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

  if (!result) return <MissingFreeResultPage />;

  const judgement = result.overallConclusion;
  const primaryRisk = getPrimaryRisk(result);
  const riskPoints = getRiskPoints(result, primaryRisk);
  const actionReminder = getActionReminder(result, primaryRisk.title);

  function handleUnlock(): void {
    if (isSample) {
      navigateTo("/goal-fit-unlock-preview?sample=high_fit");
      return;
    }

    if (!sessionId) return;

    navigateTo(`/goal-fit-unlock-preview?session=${encodeURIComponent(sessionId)}`);
  }

  function handleShareCoupon(): void {
    if (isSample) {
      navigateTo("/goal-fit-share-preview?sample=high_fit&mode=coupon");
      return;
    }

    if (!sessionId) return;

    navigateTo(`/goal-fit-share-preview?session=${encodeURIComponent(sessionId)}&mode=coupon`);
  }

  return (
    <GoalFitPageFrame>
      <section className="goal-fit-panel goal-fit-free-result-frame">
        <section className="goal-fit-free-diagnosis-card">
          <header className="goal-fit-free-diagnosis-header">
            <p className="goal-fit-free-page-title">第一份工作风险预演</p>
            <span>基础判断</span>
          </header>

          <div className="goal-fit-free-diagnosis-core">
            <div className="goal-fit-free-score">
              <span>综合匹配度</span>
              <strong>{result.scores.overallScore}%</strong>
            </div>
            <div className="goal-fit-free-headline">
              <p>这个方向可以先投吗？</p>
              <h1>{judgement.title}</h1>
              <p>{judgement.summary}</p>
            </div>
          </div>

          <p className="goal-fit-free-risk-line">
            <span>最大风险：</span>
            <strong>{primaryRisk.title}</strong>
          </p>

          <p className="goal-fit-free-target">
            当前预演：{result.targetCompanyLabel} × {result.targetRoleLabel}
          </p>

          <button className="primary-button goal-fit-free-primary-cta" type="button" onClick={handleShareCoupon}>
            保存图片并分享，¥9.9 解锁
          </button>
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

        <section className="goal-fit-free-share-discount-card goal-fit-free-share-discount-card-primary">
          <div className="goal-fit-free-share-discount-copy">
            <p className="goal-fit-eyebrow">完整报告解锁</p>
            <h2>完整报告解锁价 ¥19.9</h2>
            <p>保存并分享本次测试海报，可以享受 ¥10 优惠，优惠后 ¥9.9 解锁完整报告。</p>
            <strong>保存求职方向卡，也可以发给同学一起测。</strong>
            <button className="primary-button" type="button" onClick={handleShareCoupon}>
              保存图片并分享，¥9.9 解锁
            </button>
          </div>
          <img src="/images/goal-fit-share-poster.png" alt="第一份工作风险预演分享海报预览" />
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
            不分享，直接 ¥19.9 解锁
          </button>
          <p>查看公司差距、岗位差距和具体行动建议。</p>
          <small>免费页先给你总判断，完整报告会继续给你拆解和行动。</small>
        </section>
      </section>
    </GoalFitPageFrame>
  );
}

export default GoalFitFreeResultPage;
