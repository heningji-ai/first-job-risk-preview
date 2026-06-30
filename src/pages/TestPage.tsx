import { useEffect, useMemo, useState } from "react";
import QuestionCard from "../components/QuestionCard";
import ProgressBar from "../components/ProgressBar";
import {
  filterAnswersByVisibleQuestions,
  getVisibleQuestions,
  type Answers
} from "../lib/questionFlow";
import { navigateTo } from "../lib/router";
import { createStoredSession } from "../lib/sessionStorage";
import type { Question } from "../types/config";
import questionsConfig from "../config/audiences/student/questions.json";

const allQuestions = (questionsConfig.questions as Question[]).sort(
  (left, right) => left.order - right.order
);

function getMbtiKnownNotice(question: Question, selectedAnswer?: string): string | null {
  if (question.id !== "mbti_known" || selectedAnswer !== "known") return null;
  return "MBTI 细分题暂未开放，本次先使用快速倾向题继续";
}

function TestPage() {
  const [answers, setAnswers] = useState<Answers>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const visibleQuestions = useMemo(() => getVisibleQuestions(allQuestions, answers), [answers]);
  const safeIndex = Math.min(currentIndex, Math.max(visibleQuestions.length - 1, 0));
  const currentQuestion = visibleQuestions[safeIndex];
  const selectedAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const notice = currentQuestion ? getMbtiKnownNotice(currentQuestion, selectedAnswer) : null;
  const isLastQuestion = safeIndex >= visibleQuestions.length - 1;

  useEffect(() => {
    if (currentIndex !== safeIndex) {
      setCurrentIndex(safeIndex);
    }
  }, [currentIndex, safeIndex]);

  function handleSelect(optionId: string) {
    if (!currentQuestion) return;
    setAnswers((previousAnswers) => ({
      ...previousAnswers,
      [currentQuestion.id]: optionId
    }));
  }

  function handleBack() {
    setCurrentIndex((previousIndex) => Math.max(previousIndex - 1, 0));
  }

  function handleNext() {
    if (!currentQuestion || !selectedAnswer) return;

    if (isLastQuestion) {
      const visibleAnswers = filterAnswersByVisibleQuestions(answers, visibleQuestions);
      const session = createStoredSession("student", visibleAnswers);
      navigateTo(`/result/${encodeURIComponent(session.id)}`);
      return;
    }

    setCurrentIndex((previousIndex) => Math.min(previousIndex + 1, visibleQuestions.length - 1));
  }

  if (!currentQuestion) {
    return (
      <main className="app-shell">
        <section className="state-panel">
          <h1>暂无可展示题目</h1>
          <p>请先检查 student questions 配置。</p>
          <button className="secondary-button" type="button" onClick={() => navigateTo("/")}>
            返回首页
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="test-shell">
      <div className="test-layout">
        <ProgressBar current={safeIndex + 1} total={visibleQuestions.length} />
        <QuestionCard
          question={currentQuestion}
          selectedAnswer={selectedAnswer}
          notice={notice}
          onSelect={handleSelect}
        />
        <div className="test-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={handleBack}
            disabled={safeIndex === 0}
          >
            上一题
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={handleNext}
            disabled={!selectedAnswer}
          >
            {isLastQuestion ? "完成测试" : "下一题"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default TestPage;
