import { useEffect, useMemo, useState } from "react";
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

type PageStep = "target" | "confirm" | "questions" | "complete";

const moduleLabels: Record<QuestionModule, string> = {
  A_BACKGROUND: "认识你现在的基础",
  B_PERSONALITY: "看看你的职场底色",
  C_MOTIVATION: "理解你的求职动机",
  D_WORKPLACE_SCENARIO: "进入真实职场场景",
  E_ROLE_SCENARIO: "进入目标岗位预演"
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
      step
    });
  }, [answers, currentIndex, step, targetCompany, targetRole]);

  function handleConfirmTarget(): void {
    if (!targetCompany || !targetRole) {
      setErrorMessage("先选定一个目标公司和目标岗位，再开始预演。");
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
      navigateTo(`/result-goal-fit-preview?session=${encodeURIComponent(session.id)}`);
    } catch {
      setErrorMessage("还有题目没有完成，请补完后再生成报告。");
    }
  }

  if (step === "target") {
    return (
      <main className="goal-fit-shell">
        <section className="goal-fit-panel goal-fit-target-panel">
          <div className="goal-fit-header">
            <p className="goal-fit-eyebrow">第一份工作目标适配</p>
            <h1>你想去的公司，想做的岗位，真的适合你吗？</h1>
            <p>
              先选定一个你现在最想判断的求职目标，我们会围绕这个目标做适配预演。
            </p>
          </div>

          <div className="goal-fit-target-grid">
            <article className="goal-fit-target-block">
              <h2>{companyQuestion.text}</h2>
              <div className="goal-fit-option-list">
                {companyQuestion.options.map((option) => (
                  <button
                    className={
                      option.id === targetCompany
                        ? "goal-fit-option-button active"
                        : "goal-fit-option-button"
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
                    {option.text}
                  </button>
                ))}
              </div>
            </article>

            <article className="goal-fit-target-block">
              <h2>{roleQuestion.text}</h2>
              <div className="goal-fit-option-list">
                {roleQuestion.options.map((option) => (
                  <button
                    className={
                      option.id === targetRole
                        ? "goal-fit-option-button active"
                        : "goal-fit-option-button"
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
                    {option.text}
                  </button>
                ))}
              </div>
            </article>
          </div>

          {errorMessage ? <p className="goal-fit-error">{errorMessage}</p> : null}

          <button
            className="primary-button goal-fit-primary-action"
            type="button"
            onClick={handleConfirmTarget}
            disabled={!targetCompany || !targetRole}
          >
            确认目标，开始预演
          </button>
        </section>
      </main>
    );
  }

  if (step === "confirm") {
    return (
      <main className="goal-fit-shell">
        <section className="goal-fit-panel goal-fit-confirm-panel">
          <p className="goal-fit-eyebrow">目标确认</p>
          <h1>你的目标已经选好了</h1>
          <div className="goal-fit-path-card">
            <strong>{targetCompanyLabel}</strong>
            <span>×</span>
            <strong>{targetRoleLabel}</strong>
          </div>
          <p>
            接下来，我们会从基础背景、性格底色、求职动机、职场场景和岗位场景，判断这个目标和现在的你是否匹配。
          </p>
          <div className="goal-fit-actions">
            <button className="secondary-button" type="button" onClick={() => setStep("target")}>
              重新选择
            </button>
            <button className="primary-button" type="button" onClick={handleStartQuestions}>
              继续
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (step === "complete") {
    return (
      <main className="goal-fit-shell">
        <section className="goal-fit-panel goal-fit-complete-panel">
          <p className="goal-fit-eyebrow">报告已生成</p>
          <h1>你的目标适配报告已经生成</h1>
          <p>
            我们已经根据你的目标公司、目标岗位和 34 道选择，生成了本次适配结果。
          </p>
          <p className="goal-fit-note">
            下一步可以查看目标公司适配、目标岗位适配、主要风险和行动建议。
          </p>
          <span className="goal-fit-complete-mark" aria-hidden="true" />
        </section>
      </main>
    );
  }

  if (!currentQuestion) {
    return (
      <main className="goal-fit-shell">
        <section className="goal-fit-panel">
          <h1>暂时没有可回答的问题</h1>
          <button className="primary-button" type="button" onClick={() => setStep("target")}>
            重新选择目标
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="goal-fit-shell">
      <section className="goal-fit-panel goal-fit-question-panel">
        <div className="goal-fit-question-top">
          <p className="goal-fit-eyebrow">{moduleLabels[currentQuestion.module]}</p>
          <div className="goal-fit-progress" aria-label="答题进度">
            <div className="goal-fit-progress-meta">
              <span>
                第 {currentIndex + 1} 题 / 共 {selectedQuestions.length} 题
              </span>
              <span>{answeredCount} 已完成</span>
            </div>
            <div className="goal-fit-progress-track">
              <i style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>

        <article className="goal-fit-question">
          <h1>{currentQuestion.text}</h1>
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

        {errorMessage ? <p className="goal-fit-error">{errorMessage}</p> : null}

        <div className="goal-fit-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={handlePreviousQuestion}
            disabled={currentIndex === 0}
          >
            上一题
          </button>
          <button className="primary-button" type="button" onClick={handleNextQuestion}>
            {isLastQuestion ? "生成报告" : "下一题"}
          </button>
        </div>
      </section>
    </main>
  );
}

export default GoalFitTestPage;
