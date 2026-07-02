import { useEffect, useMemo, useState } from "react";
import questionsV2ConfigJson from "../config/questions_v2.json" with { type: "json" };
import {
  derivePathSelectionV2,
  getVisibleQuestionsV2,
  validateAnswerMapV2
} from "../lib/pathFitScoringV2";
import {
  createPathFitPreviewSessionV2,
  prunePathFitAnswerMapToVisibleV2
} from "../lib/pathFitSessionStoreV2";
import { navigateTo } from "../lib/router";
import type { PathFitAnswerMapV2, QuestionV2, QuestionsV2Config } from "../types/pathFitV2";

const questionsV2Config = questionsV2ConfigJson as QuestionsV2Config;
const questions = questionsV2Config.questions;
const TARGET_ANSWER_COUNT = questionsV2Config.actualAnswerCountPerUser;

function getCurrentVisibleQuestions(answerMap: PathFitAnswerMapV2): QuestionV2[] {
  if (!answerMap.A7 || !answerMap.A8) {
    return questions.filter((question) => question.visibleToAll);
  }

  const pathSelection = derivePathSelectionV2(answerMap, questions);
  return getVisibleQuestionsV2(
    questions,
    pathSelection.companyType,
    pathSelection.roleType
  ).visibleQuestions;
}

function TestPageV2Preview() {
  const [answerMap, setAnswerMap] = useState<PathFitAnswerMapV2>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const visibleQuestions = useMemo(() => getCurrentVisibleQuestions(answerMap), [answerMap]);
  const visibleQuestionKey = visibleQuestions.map((question) => question.questionId).join("|");
  const currentQuestion = visibleQuestions[currentIndex] ?? visibleQuestions[0];
  const answeredVisibleCount = visibleQuestions.filter((question) =>
    Boolean(answerMap[question.questionId])
  ).length;
  const isLastQuestion = currentIndex >= visibleQuestions.length - 1;
  const currentAnswer = currentQuestion ? answerMap[currentQuestion.questionId] : undefined;

  useEffect(() => {
    setAnswerMap((previousAnswerMap) => {
      const prunedAnswerMap = prunePathFitAnswerMapToVisibleV2(
        previousAnswerMap,
        visibleQuestions
      );
      return Object.keys(prunedAnswerMap).length === Object.keys(previousAnswerMap).length
        ? previousAnswerMap
        : prunedAnswerMap;
    });
    setCurrentIndex((previousIndex) =>
      Math.min(previousIndex, Math.max(visibleQuestions.length - 1, 0))
    );
  }, [visibleQuestionKey, visibleQuestions]);

  function handleSelect(optionId: string): void {
    if (!currentQuestion) return;

    setErrorMessage("");
    setAnswerMap((previousAnswerMap) => ({
      ...previousAnswerMap,
      [currentQuestion.questionId]: optionId
    }));
  }

  function handlePrevious(): void {
    setErrorMessage("");
    setCurrentIndex((previousIndex) => Math.max(previousIndex - 1, 0));
  }

  function handleNext(): void {
    if (!currentQuestion) return;

    if (!currentAnswer) {
      setErrorMessage("先选一个最接近你真实想法的答案，再继续。");
      return;
    }

    if (!isLastQuestion) {
      setErrorMessage("");
      setCurrentIndex((previousIndex) => previousIndex + 1);
      return;
    }

    try {
      const completeVisibleQuestions = getCurrentVisibleQuestions(answerMap);
      const cleanAnswerMap = prunePathFitAnswerMapToVisibleV2(answerMap, completeVisibleQuestions);

      if (completeVisibleQuestions.length !== TARGET_ANSWER_COUNT) {
        throw new Error("请先完成公司类型和岗位方向选择，再查看结果。");
      }

      validateAnswerMapV2(cleanAnswerMap, completeVisibleQuestions, { strict: true });
      const session = createPathFitPreviewSessionV2(cleanAnswerMap);
      navigateTo(`/result-v2-preview?session=${encodeURIComponent(session.sessionId)}`);
    } catch {
      setErrorMessage("还有题目没有完成，请补完后再查看结果。");
    }
  }

  if (!currentQuestion) {
    return (
      <main className="test-v2-shell">
        <section className="test-v2-card">
          <h1>暂时没有可回答的问题</h1>
          <button className="primary-button" type="button" onClick={() => navigateTo("/")}>
            返回首页
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="test-v2-shell">
      <section className="test-v2-card">
        <div className="test-v2-header">
          <p className="test-v2-eyebrow">V1.2 路径适配预览</p>
          <h1>先按真实想法走完这一版题目</h1>
          <p>
            这里使用新的路径适配题库，结果只进入 V2 预览页，不会影响当前线上答题流程。
          </p>
        </div>

        <div className="test-v2-progress" aria-label="答题进度">
          <span>
            已回答 {answeredVisibleCount} / {TARGET_ANSWER_COUNT}
          </span>
          <div>
            <i style={{ width: `${Math.min(100, (answeredVisibleCount / TARGET_ANSWER_COUNT) * 100)}%` }} />
          </div>
        </div>

        <article className="test-v2-question">
          <p className="test-v2-step">
            第 {Math.min(currentIndex + 1, TARGET_ANSWER_COUNT)} 题
          </p>
          <h2>{currentQuestion.title}</h2>
          <div className="test-v2-option-list">
            {currentQuestion.options.map((option) => (
              <button
                className={
                  option.optionId === currentAnswer
                    ? "test-v2-option active"
                    : "test-v2-option"
                }
                key={option.optionId}
                type="button"
                onClick={() => handleSelect(option.optionId)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </article>

        {errorMessage ? <p className="test-v2-error">{errorMessage}</p> : null}

        <div className="test-v2-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            上一题
          </button>
          <button className="primary-button" type="button" onClick={handleNext}>
            {isLastQuestion ? "查看路径预演结果" : "下一题"}
          </button>
        </div>
      </section>
    </main>
  );
}

export default TestPageV2Preview;
