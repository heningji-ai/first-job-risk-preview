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

function getFreeResultJudgement(score: number): { title: string; description: string } {
  if (score >= 80) {
    return {
      title: "匹配度较高，这个方向可以作为当前求职的优先方向。",
      description:
        "你和这类公司、这类岗位之间有比较明显的适配基础。接下来更重要的不是换方向，而是把你的优势在简历和面试里讲清楚。"
    };
  }

  if (score >= 65) {
    return {
      title: "中等偏上，这个方向可以尝试，但不建议盲目当成唯一第一选择。",
      description:
        "你和这类公司、岗位有一定匹配基础，但仍有几个关键差距，会影响后续的筛选通过率和入职适应度。"
    };
  }

  if (score >= 50) {
    return {
      title: "这个方向有机会，但当前风险偏高，不建议直接作为主投方向。",
      description:
        "你和这个目标之间存在一些明显磨合点。如果直接投，可能会遇到反馈少、面试解释不清，或者入职后不适应的问题。"
    };
  }

  return {
    title: "当前不建议把这个方向作为第一优先选择。",
    description:
      "这不代表你以后不能做，而是以你现在的准备状态，直接冲这个方向试错成本较高。更稳的做法是先换切入点，或者补齐关键准备。"
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

function getFirstAdvice(riskTitle: string): string {
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

  const judgement = getFreeResultJudgement(result.scores.overallScore);
  const primaryRisk = getPrimaryRisk(result);

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
        <header className="goal-fit-free-hero">
          <div>
            <p className="goal-fit-eyebrow">总判断</p>
            <h1>你的第一份工作目标判断已生成</h1>
            <p>
              我们先给你一个总判断。完整报告会继续拆解：你选择的公司类型、岗位类型，和你当前状态之间到底差在哪里。
            </p>
          </div>
          <ol className="goal-fit-result-progress" aria-label="结果阅读进度">
            {["总判断", "适配拆解", "建议行动"].map((label, index) => (
              <li key={label}>
                <span className={index === 0 ? "active" : ""}>
                  <i>{index + 1}</i>
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </header>

        <div className="goal-fit-free-grid">
          <section className="goal-fit-free-main-card">
            <p className="goal-fit-eyebrow">先看总体判断</p>
            <p className="goal-fit-free-target">
              你选择的是：<strong>「{result.targetCompanyLabel}」×「{result.targetRoleLabel}」</strong>
            </p>
            <div className="goal-fit-free-score">
              <span>综合匹配度</span>
              <strong>{result.scores.overallScore}%</strong>
            </div>
            <h2>{judgement.title}</h2>
            <p>{judgement.description}</p>
          </section>

          <aside className="goal-fit-result-side-card">
            <p className="goal-fit-eyebrow">当前预演</p>
            <div className="goal-fit-result-path">
              <span>公司类型：{result.targetCompanyLabel}</span>
              <span>岗位方向：{result.targetRoleLabel}</span>
            </div>
          </aside>
        </div>

        <section className="goal-fit-free-risk-card">
          <p className="goal-fit-eyebrow">你当前最需要优先确认的是：</p>
          <h2>{primaryRisk.title}</h2>
          <p>{primaryRisk.description}</p>
        </section>

        <section className="goal-fit-free-advice-card">
          <h2>针对你的情况，我们建议：</h2>
          <ul>
            <li>{getFirstAdvice(primaryRisk.title)}</li>
            <li>再判断自己是否能长期适应这类公司的节奏和这个岗位的要求。</li>
          </ul>
        </section>

        <section className="goal-fit-free-lock-card">
          <div>
            <p className="goal-fit-eyebrow">完整报告已生成</p>
            <h2>下面这些内容已经根据你的测试结果生成，解锁后可以继续查看。</h2>
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
          <button className="primary-button" type="button" onClick={handleUnlock}>
            解锁完整目标适配报告 ¥19.9
          </button>
          <div className="goal-fit-free-coupon-card">
            <p>
              保存 / 分享求职方向卡，可领取 ¥10 优惠券，优惠后 ¥9.9 解锁完整报告。
            </p>
            <button className="secondary-button" type="button" onClick={handleShareCoupon}>
              生成求职方向卡，领取优惠
            </button>
          </div>
          <p>查看公司差距、岗位差距和具体行动建议。</p>
          <small>免费页先给你总判断，完整报告会继续给你拆解和行动。</small>
        </section>
      </section>
    </GoalFitPageFrame>
  );
}

export default GoalFitFreeResultPage;
