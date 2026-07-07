import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { buildGoalFitResult } from "../lib/goalFitResultBuilder";
import { goalFitQuestionBank } from "../lib/goalFitQuestionBank";
import { selectGoalFitQuestions } from "../lib/goalFitQuestionSelector";
import { navigateTo } from "../lib/router";
import {
  clearGoalFitDraft,
  createGoalFitSession,
  getGoalFitDraft,
  saveGoalFitDraft,
  saveGoalFitSession
} from "../lib/goalFitSessionStore";
import type {
  CompanyType,
  GoalFitAnswerMap,
  GoalFitQuestion,
  QuestionModule,
  RoleType,
  TargetQuestion
} from "../lib/goalFitTypes";

type PageStep = "target" | "targetRole" | "confirm" | "questions" | "complete";

const moduleShortLabels: Record<QuestionModule, string> = {
  A_BACKGROUND: "基础背景",
  B_PERSONALITY: "职场底色",
  C_MOTIVATION: "求职动机",
  D_WORKPLACE_SCENARIO: "职场场景",
  E_ROLE_SCENARIO: "岗位预演"
};

const companyOptionDescriptions: Record<CompanyType, string> = {
  G: "稳定感强，但节奏慢、流程多。",
  F: "规则清楚，但沟通和协作标准更高。",
  D: "成长快，但节奏硬、竞争强。",
  V: "机会多，但变化快、不确定性高。",
  M: "上手机会多，但老板和团队很关键。"
};

const companySelectionFeedback: Record<CompanyType, string> = {
  G: "你选了更稳定的环境，后面会重点看你能不能适应流程、边界和长期节奏。",
  F: "你选了更职业化的环境，后面会重点看你的表达、协作和边界感。",
  D: "你选了高成长、高竞争的环境，后面会重点看你的抗压、协作和成长节奏。",
  V: "你选了变化更快的环境，后面会重点看你能不能适应模糊目标和不确定性。",
  M: "你选了更看团队和老板的环境，后面会重点看你的执行落地和现实适应。"
};

const roleOptionDescriptions: Record<RoleType, string> = {
  SLS: "愿意主动开口，也扛得住被拒绝。",
  PM: "喜欢拆问题，也愿意推进事情落地。",
  OPS: "愿意反复跟数据和细节打交道。",
  TECH: "能沉下心解决问题，也愿意持续学习。",
  DATA: "喜欢从信息里找规律，也能讲清结论。",
  FUNC: "做事细，能跟流程，愿意稳定成长。",
  MKT: "喜欢表达和观察用户，也接受反复修改。",
  SUP: "愿意盯流程和交付，也能处理扯皮。"
};

const roleSelectionFeedback: Record<RoleType, string> = {
  SLS: "你选择了一个更看目标感和沟通恢复力的方向。后面会重点判断你是否适合高频反馈和外部压力。",
  PM: "你选择了一个更看推进能力的方向。后面会重点判断你能不能理解需求、协调资源并交付结果。",
  OPS: "你选择了一个更看执行节奏的方向。后面会重点判断你是否能持续优化，而不是只靠一时兴趣。",
  TECH: "你选择了一个更看专业耐心的方向。后面会重点判断你是否能持续学习和拆解问题。",
  DATA: "你选择了一个更看逻辑和业务理解的方向。后面会重点判断你能不能把数据变成判断。",
  FUNC: "你选择了一个更看细致和协作的方向。后面会重点判断你是否适合规则、流程和组织支持。",
  MKT: "你选择了一个更看表达和用户洞察的方向。后面会重点判断你能不能接受反复修改和结果检验。",
  SUP: "你选择了一个更看落地和抗压的方向。后面会重点判断你是否能处理流程、协同和突发问题。"
};

const questionNotes: Partial<Record<string, string>> = {
  A01: "这会影响初筛门槛，不代表你的真实能力。",
  A03: "这会影响你进入目标岗位时，需要补多少解释成本。",
  A04: "这会影响你讲案例时，能不能让招聘方快速相信你做过类似事情。"
};

function getTargetQuestion(type: "targetCompany" | "targetRole"): TargetQuestion {
  const question = goalFitQuestionBank.targetQuestions.find((item) => item.type === type);

  if (!question) {
    throw new Error(`Goal Fit target question missing: ${type}`);
  }

  return question;
}

function isCompanyType(value: string): value is CompanyType {
  return Object.prototype.hasOwnProperty.call(goalFitQuestionBank.companyTypes, value);
}

function isRoleType(value: string): value is RoleType {
  return Object.prototype.hasOwnProperty.call(goalFitQuestionBank.roleTypes, value);
}

function getSelectedQuestions(targetRole?: RoleType): GoalFitQuestion[] {
  if (!targetRole) return [];
  return selectGoalFitQuestions(goalFitQuestionBank, targetRole);
}

function GoalFitPageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="goal-fit-shell">
      {children}
    </main>
  );
}

function GoalFitCoordinateVisual() {
  return (
    <figure className="goal-fit-roadmap-figure" aria-label="第一份工作路径预演示意图">
      <img src="/goal-fit-roadmap.png" alt="" aria-hidden="true" />
    </figure>
  );
}

function GoalFitTestPage() {
  const [step, setStep] = useState<PageStep>("target");
  const [targetCompany, setTargetCompany] = useState<CompanyType | undefined>();
  const [targetRole, setTargetRole] = useState<RoleType | undefined>();
  const [answers, setAnswers] = useState<GoalFitAnswerMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const companyQuestion = getTargetQuestion("targetCompany");
  const roleQuestion = getTargetQuestion("targetRole");
  const selectedQuestions = useMemo(() => getSelectedQuestions(targetRole), [targetRole]);
  const currentQuestion = selectedQuestions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const answeredCount = selectedQuestions.filter((question) => Boolean(answers[question.id])).length;
  const isLastQuestion = currentIndex >= selectedQuestions.length - 1;
  const progressPercent =
    selectedQuestions.length > 0 ? Math.round((answeredCount / selectedQuestions.length) * 100) : 0;
  const targetCompanyLabel = targetCompany ? goalFitQuestionBank.companyTypes[targetCompany] : "";
  const targetRoleLabel = targetRole ? goalFitQuestionBank.roleTypes[targetRole] : "";
  const currentQuestionNote = currentQuestion ? questionNotes[currentQuestion.id] : undefined;

  useEffect(() => {
    const draft = getGoalFitDraft();
    if (!draft) return;

    if (draft.targetCompany && isCompanyType(draft.targetCompany)) {
      setTargetCompany(draft.targetCompany);
    }
    if (draft.targetRole && isRoleType(draft.targetRole)) {
      setTargetRole(draft.targetRole);
    }
    setAnswers(draft.answers ?? {});
    setCurrentIndex(Math.max(0, draft.currentIndex ?? 0));
    setStep(draft.step === "complete" ? "questions" : draft.step);
  }, []);

  useEffect(() => {
    saveGoalFitDraft({
      targetCompany,
      targetRole,
      answers,
      currentIndex,
      step: step === "targetRole" ? "target" : step
    });
  }, [answers, currentIndex, step, targetCompany, targetRole]);

  function handleConfirmCompany(): void {
    if (!targetCompany) {
      setErrorMessage("先选一个你最近最想判断的公司类型，再继续。");
      return;
    }

    setErrorMessage("");
    setStep("targetRole");
  }

  function handleConfirmTarget(): void {
    if (!targetCompany || !targetRole) {
      setErrorMessage("先选定目标公司和岗位方向，再开始预演。");
      return;
    }

    setErrorMessage("");
    setStep("confirm");
  }

  function handleStartQuestions(): void {
    setErrorMessage("");
    setCurrentIndex(0);
    setStep("questions");
  }

  function handleSelectOption(optionId: string): void {
    if (!currentQuestion) return;

    setErrorMessage("");
    setAnswers((previousAnswers) => ({
      ...previousAnswers,
      [currentQuestion.id]: optionId
    }));
  }

  function handlePreviousQuestion(): void {
    setErrorMessage("");
    setCurrentIndex((previousIndex) => Math.max(previousIndex - 1, 0));
  }

  function handleNextQuestion(): void {
    if (!targetCompany || !targetRole || !currentQuestion) return;

    if (!currentAnswer) {
      setErrorMessage("先选一个最接近你真实情况的答案，再继续。");
      return;
    }

    if (!isLastQuestion) {
      setErrorMessage("");
      setCurrentIndex((previousIndex) => previousIndex + 1);
      return;
    }

    try {
      const cleanAnswers = Object.fromEntries(
        selectedQuestions.map((question) => [question.id, answers[question.id]])
      ) as GoalFitAnswerMap;

      buildGoalFitResult({
        questionBank: goalFitQuestionBank,
        answers: cleanAnswers,
        targetCompany,
        targetRole
      });
      const session = createGoalFitSession({
        questionBank: goalFitQuestionBank,
        answers: cleanAnswers,
        targetCompany,
        targetRole
      });

      saveGoalFitSession(session);
      clearGoalFitDraft();
      setErrorMessage("");
      navigateTo(`/result-goal-fit-free-preview?session=${encodeURIComponent(session.id)}`);
    } catch {
      setErrorMessage("还有题目没有完成，请补完后再生成报告。");
    }
  }

  if (step === "target") {
    return (
      <GoalFitPageFrame>
        <section className="goal-fit-layout-split goal-fit-target-layout">
          <aside className="goal-fit-intro-panel goal-fit-layout-side">
            <p className="goal-fit-step-pill">第 1 步 / 2 步：先定环境</p>
            <div className="goal-fit-page-heading">
              <p className="goal-fit-eyebrow">先建立你的风险预演坐标</p>
              <h1>你第一份工作，想先进入哪种环境？</h1>
              <p>先选一个你最想尝试的环境，后面再看它会放大你，还是消耗你。</p>
            </div>

            <GoalFitCoordinateVisual />

            <div className="goal-fit-lite-hint">
              <span>第一份工作更怕环境错配。</span>
              <details>
                <summary>为什么先看环境？</summary>
                <p>因为同一个人，放在不同公司环境里，优势和消耗会完全不同。</p>
              </details>
            </div>
          </aside>

          <section className="goal-fit-panel goal-fit-target-panel goal-fit-choice-panel goal-fit-layout-main">
            <article className="goal-fit-target-block">
              <h2>你会优先投哪类公司？</h2>
              <div className="goal-fit-option-list goal-fit-choice-list">
                {companyQuestion.options.map((option) => {
                  const isSelected = option.id === targetCompany;
                  const description = isCompanyType(option.id)
                    ? companyOptionDescriptions[option.id]
                    : "";

                  return (
                    <button
                      className={
                        isSelected
                          ? "goal-fit-option-button goal-fit-option-card active"
                          : "goal-fit-option-button goal-fit-option-card"
                      }
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (isCompanyType(option.id)) {
                          setTargetCompany(option.id);
                          setErrorMessage("");
                        }
                      }}
                    >
                      <span className="goal-fit-option-main">{option.text}</span>
                      <span className="goal-fit-option-desc">{description}</span>
                      {isSelected ? <span className="goal-fit-option-check">✓</span> : null}
                    </button>
                  );
                })}
              </div>
            </article>

            {targetCompany ? (
              <p className="goal-fit-selection-feedback">
                <span>已记录</span>
                {companySelectionFeedback[targetCompany]}
              </p>
            ) : null}

            {errorMessage ? <p className="goal-fit-error">{errorMessage}</p> : null}

            <button
              className="primary-button goal-fit-primary-action"
              type="button"
              onClick={handleConfirmCompany}
              disabled={!targetCompany}
            >
              继续，看看你更适合什么岗位
            </button>
          </section>
        </section>
      </GoalFitPageFrame>
    );
  }

  if (step === "targetRole") {
    return (
      <GoalFitPageFrame>
        <section className="goal-fit-layout-split goal-fit-target-layout">
          <aside className="goal-fit-intro-panel goal-fit-layout-side">
            <p className="goal-fit-step-pill">第 2 步 / 2 步：再定岗位</p>
            <div className="goal-fit-page-heading">
              <p className="goal-fit-eyebrow">再确定你最想试的工作方向</p>
              <h1>你第一份工作，更想先判断哪个岗位方向？</h1>
              <p>先选一个你最想试、最常投，或者最纠结的岗位方向。</p>
            </div>

            <div className="goal-fit-coordinate-strip">
              <span>当前预演</span>
              <strong>{targetCompanyLabel}</strong>
              <strong>{targetRoleLabel || "待选择岗位方向"}</strong>
            </div>
            <p className="goal-fit-side-copy">
              这一步是在把你的求职目标从“想去哪里”，变成“去那里做什么”。
            </p>
          </aside>

          <section className="goal-fit-panel goal-fit-target-panel goal-fit-choice-panel goal-fit-layout-main">
            <article className="goal-fit-target-block">
              <h2>在这个环境里，你更想做哪类工作？</h2>
              <div className="goal-fit-option-list goal-fit-choice-list">
                {roleQuestion.options.map((option) => {
                  const isSelected = option.id === targetRole;
                  const description = isRoleType(option.id)
                    ? roleOptionDescriptions[option.id]
                    : "";

                  return (
                    <button
                      className={
                        isSelected
                          ? "goal-fit-option-button goal-fit-option-card active"
                          : "goal-fit-option-button goal-fit-option-card"
                      }
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (isRoleType(option.id)) {
                          setTargetRole(option.id);
                          setErrorMessage("");
                        }
                      }}
                    >
                      <span className="goal-fit-option-main">{option.text}</span>
                      <span className="goal-fit-option-desc">{description}</span>
                      {isSelected ? <span className="goal-fit-option-check">✓</span> : null}
                    </button>
                  );
                })}
              </div>
            </article>

            {targetRole ? (
              <p className="goal-fit-selection-feedback">
                {roleSelectionFeedback[targetRole]}
              </p>
            ) : null}

            {errorMessage ? <p className="goal-fit-error">{errorMessage}</p> : null}

            <div className="goal-fit-actions">
              <button className="goal-fit-text-button" type="button" onClick={() => setStep("target")}>
                返回上一步
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={handleConfirmTarget}
                disabled={!targetRole}
              >
                继续，开始风险预演
              </button>
            </div>
          </section>
        </section>
      </GoalFitPageFrame>
    );
  }

  if (step === "confirm") {
    return (
      <GoalFitPageFrame>
        <section className="goal-fit-panel goal-fit-confirm-panel">
          <p className="goal-fit-step-pill">准备开始：正式进入风险预演</p>
          <h1>你的求职风险预演即将开始</h1>
          <p>我们已经拿到第一个判断坐标：你想进入什么环境，做什么岗位。</p>
          <div className="goal-fit-path-card goal-fit-target-object-card">
            <small>本次预演目标</small>
            <div>
              <span>公司环境</span>
              <strong>{targetCompanyLabel}</strong>
            </div>
            <i aria-hidden="true">×</i>
            <div>
              <span>岗位方向</span>
              <strong>{targetRoleLabel}</strong>
            </div>
            <p>我们会判断：这个方向是你的机会，还是容易消耗你的选择。</p>
          </div>
          <div className="goal-fit-preview-card">
            <h2>测完后，你会先看到</h2>
            <ol>
              <li>这个目标当前值不值得优先尝试</li>
              <li>你的综合匹配度意味着什么</li>
              <li>最容易影响你求职反馈的问题</li>
              <li>后续会继续拆公司、岗位和调整方向</li>
            </ol>
            <p className="goal-fit-preview-note">
              基础判断先帮你看方向，后续再继续拆解：这类公司怎么用人、这类岗位真实要求什么，以及你接下来该怎么调整。
            </p>
          </div>
          <div className="goal-fit-actions">
            <button className="secondary-button" type="button" onClick={() => setStep("target")}>
              重新选择目标
            </button>
            <button className="primary-button" type="button" onClick={handleStartQuestions}>
              开始 34 题判断
            </button>
          </div>
          <p className="goal-fit-action-caption">约 3–5 分钟，完成后生成方向判断</p>
          <p className="goal-fit-method-line">
            基于真实招聘逻辑，看公司环境、岗位要求、个人基础、动机和职场场景是否匹配。
          </p>
        </section>
      </GoalFitPageFrame>
    );
  }

  if (step === "complete") {
    return (
      <GoalFitPageFrame>
        <section className="goal-fit-panel goal-fit-complete-panel">
          <p className="goal-fit-eyebrow">报告已生成</p>
          <h1>你的目标适配报告已经生成</h1>
          <p>我们已经根据你的目标公司、目标岗位和 34 道选择，生成了本次适配结果。</p>
          <span className="goal-fit-complete-mark" aria-hidden="true" />
        </section>
      </GoalFitPageFrame>
    );
  }

  if (!currentQuestion) {
    return (
      <GoalFitPageFrame>
        <section className="goal-fit-panel">
          <h1>暂时没有可回答的问题</h1>
          <button className="primary-button" type="button" onClick={() => setStep("target")}>
            重新选择目标
          </button>
        </section>
      </GoalFitPageFrame>
    );
  }

  return (
    <GoalFitPageFrame>
      <section className="goal-fit-question-task">
        <header className="goal-fit-task-header">
          <div className="goal-fit-task-title-row">
            <h1>第一份工作风险预演</h1>
            <span>招聘端判断</span>
          </div>
          <p className="goal-fit-task-progress-copy">
            第 {currentIndex + 1} / {selectedQuestions.length} 题｜已完成 {progressPercent}%
          </p>
          <div className="goal-fit-progress" aria-label="答题进度">
            <div className="goal-fit-progress-track">
              <i style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <p className="goal-fit-task-target">
            当前目标：{targetCompanyLabel} × {targetRoleLabel}
          </p>
        </header>

        <section className="goal-fit-panel goal-fit-question-panel">
          <div className="goal-fit-question-top">
            <p className="goal-fit-module-title">{moduleShortLabels[currentQuestion.module]}</p>
            <h1>{currentQuestion.text}</h1>
          </div>

          <article className="goal-fit-question">
            <div className="goal-fit-option-list">
              {currentQuestion.options.map((option) => (
                <button
                  className={
                    option.id === currentAnswer
                      ? "goal-fit-option-button active"
                      : "goal-fit-option-button"
                  }
                  key={option.id}
                  type="button"
                  onClick={() => handleSelectOption(option.id)}
                >
                  {option.text}
                </button>
              ))}
            </div>
          </article>

          {currentQuestionNote ? (
            <details className="goal-fit-question-reason">
              <summary>为什么问这个？</summary>
              <p>{currentQuestionNote}</p>
            </details>
          ) : null}

          {errorMessage ? <p className="goal-fit-error">{errorMessage}</p> : null}

          <div
            className={
              currentIndex > 0
                ? "goal-fit-actions goal-fit-question-actions"
                : "goal-fit-actions goal-fit-question-actions goal-fit-question-actions-single"
            }
          >
            {currentIndex > 0 ? (
              <button className="goal-fit-text-button" type="button" onClick={handlePreviousQuestion}>
                上一题
              </button>
            ) : null}
            <button
              className="primary-button"
              type="button"
              onClick={handleNextQuestion}
              disabled={!currentAnswer}
            >
              {isLastQuestion ? "查看基础判断" : "下一题"}
            </button>
          </div>
        </section>
      </section>
    </GoalFitPageFrame>
  );
}

export default GoalFitTestPage;
