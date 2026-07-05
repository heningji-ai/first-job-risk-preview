import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import GoalFitHeader from "../components/GoalFitHeader";
import { buildGoalFitResult } from "../lib/goalFitResultBuilder";
import { goalFitQuestionBank } from "../lib/goalFitQuestionBank";
import { markGoalFitOrderPaid, markGoalFitOrderPaidWithCoupon } from "../lib/goalFitOrderStore";
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
};

const unlockItems = [
  {
    title: "公司差距",
    body: "这类公司怎么用人，你进去后会是什么体感。"
  },
  {
    title: "岗位差距",
    body: "这类岗位真正考验什么，你当前离它还有多远。"
  },
  {
    title: "建议行动",
    body: "你接下来该验证什么、补什么、怎么调整求职材料和面试表达。"
  }
];

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

  if (sample === "high_fit") {
    return {
      result: createSampleResult(),
      sessionId: "sample_high_fit",
      isSample: true,
      isUnlocked: false,
      hasShareCardCoupon
    };
  }

  if (!sessionId) {
    return { result: null, sessionId: null, isSample: false, isUnlocked: false, hasShareCardCoupon };
  }

  return {
    result: getGoalFitSession(sessionId)?.result ?? null,
    sessionId,
    isSample: false,
    isUnlocked: isGoalFitReportUnlocked(sessionId),
    hasShareCardCoupon
  };
}

function buildFreeResultPath(context: UnlockContext): string {
  if (context.isSample) return "/result-goal-fit-free-preview?sample=high_fit";
  return `/result-goal-fit-free-preview?session=${encodeURIComponent(context.sessionId ?? "")}`;
}

function buildFullResultPath(context: UnlockContext): string {
  if (context.isSample) return "/result-goal-fit-preview?sample=high_fit&section=breakdown";
  return `/result-goal-fit-preview?session=${encodeURIComponent(context.sessionId ?? "")}&section=breakdown`;
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

  if (!context.result || !context.sessionId) return <MissingUnlockPage />;

  const fullResultPath = buildFullResultPath(context);
  const freeResultPath = buildFreeResultPath(context);

  function handleConfirmUnlock(): void {
    if (!context.sessionId) return;

    if (context.hasShareCardCoupon) {
      markGoalFitOrderPaidWithCoupon(context.sessionId, "share_card");
    } else {
      markGoalFitOrderPaid(context.sessionId);
    }
    if (!context.isSample) {
      markGoalFitReportUnlocked(context.sessionId);
    }
    setIsUnlocked(true);
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
              : "你现在可以查看完整报告，继续看公司差距、岗位差距和建议行动。"}
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
          <h1>解锁完整目标适配报告</h1>
          <p>免费判断已经帮你看到了总方向。完整报告会继续拆解：公司差距、岗位差距和建议行动。</p>
        </header>

        <div className="goal-fit-unlock-layout">
          <section className="goal-fit-unlock-main-card">
            <div className="goal-fit-unlock-product">
              <span>产品名称</span>
              <strong>完整目标适配报告</strong>
            </div>
            <div className="goal-fit-unlock-price">
              <span>{context.hasShareCardCoupon ? "应付" : "价格"}</span>
              <strong>{context.hasShareCardCoupon ? "¥9.9" : "¥19.9"}</strong>
            </div>
            {context.hasShareCardCoupon ? (
              <div className="goal-fit-unlock-price-detail">
                <span>标准价：¥19.9</span>
                <span>求职方向卡优惠：-¥10</span>
                <strong>应付：¥9.9</strong>
              </div>
            ) : null}
            <div className="goal-fit-unlock-item-list">
              {unlockItems.map((item) => (
                <article className="goal-fit-unlock-item" key={item.title}>
                  <h2>{item.title}</h2>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <aside className="goal-fit-unlock-summary-card">
            <p className="goal-fit-eyebrow">当前预演</p>
            <div className="goal-fit-result-path">
              <span>公司类型：{context.result.targetCompanyLabel}</span>
              <span>岗位方向：{context.result.targetRoleLabel}</span>
            </div>
            <button className="primary-button" type="button" onClick={handleConfirmUnlock}>
              {context.hasShareCardCoupon ? "¥9.9 解锁完整报告" : "确认解锁完整报告"}
            </button>
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
