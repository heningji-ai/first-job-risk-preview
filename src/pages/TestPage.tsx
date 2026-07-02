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

const hiddenQuestionIds = new Set(["mbti_known"]);
const autoAnswers: Answers = {
  mbti_known: "unknown"
};

type SectionIntro = {
  key: string;
  title: string;
  body: string[];
};

const sectionIntros = {
  currentStatus: {
    key: "current_status",
    title: "先从你现在的位置开始",
    body: [
      "找工作是以你为主，不是以岗位名为主。",
      "因为真正每天去面对工作的人，是你。",
      "你的性格特质，只有放在适合的环境里，才更容易稳定、快乐，也更容易长出能力。",
      "所以，我们先从你现在的状态开始。"
    ]
  },
  companyType: {
    key: "company_type",
    title: "先看看你更想进入哪类公司",
    body: [
      "公司类型不同，那么每天的日常节奏、管理方式、给新人的空间也会不同。",
      "你先选一个最想尝试的方向，我们会看看它和你现在的性格、预期、承压方式是否容易适配。"
    ]
  },
  workType: {
    key: "work_type",
    title: "再看看你对哪类岗位更有兴趣",
    body: [
      "你想好了你具体想从事哪类岗位的工作了吗？",
      "其实职场上的岗位大致是分这些类别的。你可以先选择一些大的岗位方向。",
      "后面的测试，我会根据你的性格、这些岗位对人的要求，分析这条路和你的适配程度。",
      "在这里选错可以重选。职场上每次选错的代价会大很多。"
    ]
  },
  personalityBaseline: {
    key: "personality_baseline",
    title: "我们先建立一下你自己的性格基准线",
    body: [
      "这样才能更好地看出，哪些公司环境、哪些岗位要求，和你现在的状态更容易适配。",
      "下面几题不是考你对错，而是看你在压力、反馈、不确定和沟通里，通常会怎么反应。"
    ]
  },
  situationalSimulation: {
    key: "situational_simulation",
    title: "好的，我们基本了解了",
    body: [
      "下一步，我们做一些情景模拟，看看你会怎么选择。",
      "这些场景会更接近第一份工作里真实会遇到的情况：没人一步步告诉你怎么做，标准不清楚，反馈不及时，或者需要你自己判断下一步。"
    ]
  }
} satisfies Record<string, SectionIntro>;

function getQuestionStageLabel(question: Question): string {
  if (question.sourceCode?.startsWith("A")) return "先从你开始";
  if (question.sourceCode?.startsWith("C")) return "看看你的压力反应";
  if (question.sourceCode?.startsWith("D")) return "看看你的工作节奏";
  if (question.sourceCode?.startsWith("E")) return "看看你刚入职时的反应";
  if (question.sourceCode?.startsWith("F")) return "看看你和公司环境的适配";
  if (question.sourceCode?.startsWith("G")) return "看看你和岗位日常的适配";

  return "继续了解你的选择";
}

function isFirstVisibleSourceGroup(
  question: Question,
  visibleQuestions: Question[],
  currentIndex: number,
  sourcePrefix: string
): boolean {
  if (!question.sourceCode?.startsWith(sourcePrefix)) return false;

  return !visibleQuestions
    .slice(0, currentIndex)
    .some((visibleQuestion) => visibleQuestion.sourceCode?.startsWith(sourcePrefix));
}

function getSectionIntroForQuestion(
  question: Question,
  visibleQuestions: Question[],
  currentIndex: number
): SectionIntro | null {
  if (question.id === "current_status") return sectionIntros.currentStatus;
  if (question.id === "company_type") return sectionIntros.companyType;
  if (question.id === "work_type") return sectionIntros.workType;

  if (isFirstVisibleSourceGroup(question, visibleQuestions, currentIndex, "C")) {
    return sectionIntros.personalityBaseline;
  }

  if (isFirstVisibleSourceGroup(question, visibleQuestions, currentIndex, "E")) {
    return sectionIntros.situationalSimulation;
  }

  return null;
}

function TestPage() {
  const [answers, setAnswers] = useState<Answers>(() => ({ ...autoAnswers }));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);
  const [seenSectionIntros, setSeenSectionIntros] = useState<string[]>([]);

  const visibleQuestions = useMemo(
    () =>
      getVisibleQuestions(allQuestions, answers).filter(
        (question) => !hiddenQuestionIds.has(question.id)
      ),
    [answers]
  );
  const safeIndex = Math.min(currentIndex, Math.max(visibleQuestions.length - 1, 0));
  const currentQuestion = visibleQuestions[safeIndex];
  const selectedAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const displayQuestion = currentQuestion
    ? {
        ...currentQuestion,
        sourceCode: undefined,
        group: getQuestionStageLabel(currentQuestion)
      }
    : null;
  const sectionIntro = currentQuestion
    ? getSectionIntroForQuestion(currentQuestion, visibleQuestions, safeIndex)
    : null;
  const shouldShowSectionIntro = Boolean(
    sectionIntro && !seenSectionIntros.includes(sectionIntro.key)
  );
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
      const session = createStoredSession("student", {
        ...visibleAnswers,
        ...autoAnswers
      });
      setCompletedSessionId(session.id);
      return;
    }

    setCurrentIndex((previousIndex) => Math.min(previousIndex + 1, visibleQuestions.length - 1));
  }

  function handleContinueSectionIntro() {
    if (!sectionIntro) return;
    setSeenSectionIntros((previousKeys) =>
      previousKeys.includes(sectionIntro.key) ? previousKeys : [...previousKeys, sectionIntro.key]
    );
  }

  if (completedSessionId) {
    return (
      <main className="test-shell">
        <section className="state-panel completion-panel" aria-labelledby="completion-title">
          <p className="eyebrow">答题已完成</p>
          <h1 id="completion-title">你的路径预演已经生成</h1>
          <p>我们把你刚才的选择、性格反应、公司类型和岗位方向放在一起看了。</p>
          <p>下一页不会替你决定人生，而是帮你看看：这条路对你当前阶段是否友好。</p>
          <button
            className="primary-button completion-button"
            type="button"
            onClick={() => navigateTo(`/result/${encodeURIComponent(completedSessionId)}`)}
          >
            查看我的预演结果
          </button>
        </section>
      </main>
    );
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

  if (sectionIntro && shouldShowSectionIntro) {
    return (
      <main className="test-shell">
        <section className="state-panel section-intro-panel" aria-labelledby="section-intro-title">
          <p className="eyebrow">先停一下</p>
          <h1 id="section-intro-title">{sectionIntro.title}</h1>
          <div className="section-intro-copy">
            {sectionIntro.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="section-intro-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={handleBack}
              disabled={safeIndex === 0}
            >
              返回上一题
            </button>
            <button className="primary-button" type="button" onClick={handleContinueSectionIntro}>
              继续
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="test-shell">
      <div className="test-layout">
        <ProgressBar current={safeIndex + 1} total={visibleQuestions.length} />
        {displayQuestion ? (
          <QuestionCard
            question={displayQuestion}
            selectedAnswer={selectedAnswer}
            onSelect={handleSelect}
          />
        ) : null}
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
