import { useEffect } from "react";
import GoalFitHeader from "../components/GoalFitHeader";
import { recordGoalFitReferralVisitFromUrl } from "../lib/goalFitReferralStore";
import { navigateTo } from "../lib/router";

const previewItems = [
  "这个方向值不值得先投",
  "你和目标岗位差在哪里",
  "哪些问题会影响投递反馈",
  "完整报告继续拆公司、岗位和调整方向"
];

function scrollToPreview() {
  document.getElementById("goal-fit-what-you-see")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function GoalFitLandingPage() {
  useEffect(() => {
    void recordGoalFitReferralVisitFromUrl();
  }, []);

  return (
    <main className="goal-fit-shell goal-fit-landing-shell">
      <GoalFitHeader />

      <section className="goal-fit-landing-hero" aria-labelledby="goal-fit-landing-title">
        <div className="goal-fit-landing-hero-copy">
          <p className="goal-fit-landing-trust">猎头季哥｜21年招聘经验｜招聘端判断</p>
          <h1 id="goal-fit-landing-title">第一份工作风险预演</h1>
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
              onClick={() => navigateTo("/test-goal-fit-preview")}
            >
              开始风险预演
            </button>
            <button className="goal-fit-landing-text-link" type="button" onClick={scrollToPreview}>
              先看测完能得到什么 ↓
            </button>
          </div>
        </div>

        <figure className="goal-fit-landing-hero-card" aria-hidden="true">
          <img src="/images/goal-fit-start-hero.png" alt="" />
        </figure>
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
          <button className="primary-button" type="button" onClick={() => navigateTo("/test-goal-fit-preview")}>
            开始风险预演
          </button>
          <small>基于21年招聘经验，帮应届生提前看清第一份工作的适应风险。</small>
        </div>
      </section>
    </main>
  );
}

export default GoalFitLandingPage;
