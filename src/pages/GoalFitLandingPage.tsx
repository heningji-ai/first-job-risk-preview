import { useEffect } from "react";
import GoalFitHeader from "../components/GoalFitHeader";
import { trackGoalFitEvent, trackGoalFitVisit } from "../lib/goalFitAnalytics";
import { recordGoalFitReferralVisitFromUrl } from "../lib/goalFitReferralStore";
import { navigateTo } from "../lib/router";

const previewItems = [
  "这个方向值不值得先投",
  "你和目标岗位差在哪里",
  "哪些问题会影响投递反馈",
  "完整报告继续拆公司、岗位和调整方向"
];

const miniReportItems = [
  {
    index: "01",
    title: "公司环境风险",
    description: "看这类公司怎么筛人、怎么用人"
  },
  {
    index: "02",
    title: "岗位适配差距",
    description: "看目标岗位真正考验什么"
  },
  {
    index: "03",
    title: "投递反馈风险",
    description: "看哪些问题会影响简历和面试反馈"
  },
  {
    index: "04",
    title: "下一步调整方向",
    description: "看你现在最该先补哪一块"
  }
];

function scrollToPreview() {
  document.getElementById("goal-fit-what-you-see")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function GoalFitLandingPage() {
  useEffect(() => {
    trackGoalFitVisit();
    trackGoalFitEvent({ eventName: "landing_view" });
    void recordGoalFitReferralVisitFromUrl();
  }, []);

  function handleStartPreview(): void {
    trackGoalFitEvent({ eventName: "test_start" });
    navigateTo("/test-goal-fit-preview");
  }

  return (
    <main className="goal-fit-shell goal-fit-landing-shell">
      <GoalFitHeader />

      <section className="goal-fit-landing-hero" aria-labelledby="goal-fit-landing-title">
        <div className="goal-fit-landing-hero-copy">
          <p className="goal-fit-landing-trust">猎头季哥｜21年招聘经验｜招聘端判断</p>
          <h1 id="goal-fit-landing-title">第一份工作预演</h1>
          <p className="goal-fit-landing-category">应届生求职场景预演</p>
          <p className="goal-fit-landing-subtitle">
            别只看岗位名，
            <br />
            先看看你进去后会不会适应。
          </p>
          <p className="goal-fit-landing-caption">3–5分钟｜34题｜先看基础判断</p>

          <div className="goal-fit-landing-actions">
            <button
              className="primary-button goal-fit-landing-primary"
              type="button"
              onClick={handleStartPreview}
            >
              开始预演
            </button>
            <button className="goal-fit-landing-text-link" type="button" onClick={scrollToPreview}>
              先看测完能得到什么 ↓
            </button>
          </div>
        </div>

        <aside className="goal-fit-landing-mini-report" aria-label="求职风险预演报告预览">
          <div className="goal-fit-mini-report-head">
            <span>报告预览</span>
            <strong>测完你会得到一份求职风险预演</strong>
          </div>
          <div className="goal-fit-mini-report-grid">
            {miniReportItems.map((item) => (
              <article className="goal-fit-mini-report-item" key={item.index}>
                <span>{item.index}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="goal-fit-mini-report-note">不评价你适不适合某种人生，只预演这条求职目标的现实摩擦。</p>
        </aside>
      </section>

      <section
        className="goal-fit-landing-section goal-fit-landing-second-screen"
        id="goal-fit-what-you-see"
        aria-labelledby="goal-fit-preview-title"
      >
        <div className="goal-fit-landing-section-heading">
          <p className="goal-fit-eyebrow">基础判断</p>
          <h2 id="goal-fit-preview-title">测完先给你 4 个求职判断</h2>
        </div>

        <ol className="goal-fit-landing-preview-list goal-fit-landing-judgement-list">
          {previewItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>

        <div className="goal-fit-landing-bottom-cta goal-fit-landing-compact-cta">
          <button className="primary-button" type="button" onClick={handleStartPreview}>
            开始预演
          </button>
          <small>基于21年招聘经验，帮应届生提前看清第一份工作的适应风险。</small>
        </div>
      </section>
    </main>
  );
}

export default GoalFitLandingPage;
