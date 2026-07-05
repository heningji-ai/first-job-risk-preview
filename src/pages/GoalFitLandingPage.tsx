import GoalFitHeader from "../components/GoalFitHeader";
import { navigateTo } from "../lib/router";

const worryCards = [
  {
    title: "我到底适合什么样的公司？",
    body: "大厂、国企、外企、创业公司，到底哪一种环境更适合我？"
  },
  {
    title: "我到底能做哪些岗位？",
    body: "我是适合运营、产品、市场、技术、数据，还是只是觉得这些岗位听起来不错？"
  },
  {
    title: "找工作要听父母的，还是自己拿主意？",
    body: "稳定重要，发展也重要，但最后真正去上班的人是你。"
  },
  {
    title: "什么公司我去了会开心，什么公司我去了会煎熬？",
    body: "有些环境能放大你，有些环境会持续消耗你。"
  }
];

const previewItems = [
  "这个目标当前值不值得优先尝试",
  "你的综合匹配度意味着什么",
  "最容易影响你求职反馈的问题",
  "完整报告里会继续拆解哪些差距"
];

function scrollToPreview() {
  document.getElementById("goal-fit-what-you-see")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function GoalFitLandingPage() {
  return (
    <main className="goal-fit-shell goal-fit-landing-shell">
      <GoalFitHeader />

      <section className="goal-fit-landing-hero" aria-labelledby="goal-fit-landing-title">
        <div className="goal-fit-landing-hero-copy">
          <h1 id="goal-fit-landing-title">专为应届生量身定做的职场适应度测试</h1>
          <div className="goal-fit-landing-questions" aria-label="常见求职困惑">
            <p>我到底适合什么样的公司？</p>
            <p>我现在能做哪些岗位？</p>
            <p>找工作要听父母的，还是自己拿主意？</p>
            <p>什么公司会让我成长，什么公司会让我煎熬？</p>
          </div>
          <div className="goal-fit-landing-intro">
            <p>
              选择公司类型和岗位方向，完成 34 题判断。让 21
              年招聘经验，用真实招聘逻辑帮你先把第一份工作的方向理清楚。
            </p>
          </div>
          <div className="goal-fit-landing-actions">
            <button
              className="primary-button goal-fit-landing-primary"
              type="button"
              onClick={() => navigateTo("/test-goal-fit-preview")}
            >
              开始 3–5 分钟风险预演
            </button>
            <button
              className="secondary-button goal-fit-landing-secondary"
              type="button"
              onClick={scrollToPreview}
            >
              先看看我会得到什么
            </button>
          </div>
          <p className="goal-fit-landing-caption">约 3–5 分钟｜34 题｜先看免费判断</p>
        </div>

        <figure className="goal-fit-landing-hero-card">
          <img src="/images/goal-fit-start-hero.png" alt="第一份工作路径选择插图" />
        </figure>
      </section>

      <section
        className="goal-fit-landing-section goal-fit-landing-second-screen"
        id="goal-fit-what-you-see"
        aria-labelledby="goal-fit-worries-title"
      >
        <div className="goal-fit-landing-second-grid">
          <div className="goal-fit-landing-worry-column">
            <div className="goal-fit-landing-section-heading">
              <p className="goal-fit-eyebrow">投递前的真实问题</p>
              <h2 id="goal-fit-worries-title">你是不是也在想这些问题？</h2>
            </div>
            <div className="goal-fit-landing-card-grid">
              {worryCards.map((card) => (
                <article className="goal-fit-landing-card" key={card.title}>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="goal-fit-landing-preview-column" aria-labelledby="goal-fit-preview-title">
            <div className="goal-fit-landing-section-heading">
              <p className="goal-fit-eyebrow">完成后先看方向</p>
              <h2 id="goal-fit-preview-title">测完后，你会先看到</h2>
            </div>
            <ol className="goal-fit-landing-preview-list">
              {previewItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            <p className="goal-fit-landing-muted">
              免费判断先帮你看方向，完整报告再继续拆解：这类公司怎么用人、这类岗位真实要求什么，以及你接下来该怎么调整。
            </p>
            <p className="goal-fit-landing-boundary">
              这不是性格娱乐，也不是替你决定人生。它只判断一件具体的事：你选择的公司类型和岗位方向，和现在的你到底匹不匹配。
            </p>
          </div>
        </div>

        <div className="goal-fit-landing-bottom-cta goal-fit-landing-compact-cta">
          <h2>先预演一次，再决定要不要投。</h2>
          <button className="primary-button" type="button" onClick={() => navigateTo("/test-goal-fit-preview")}>
            开始第一次工作风险预演
          </button>
          <small>约 3–5 分钟｜34 题｜先看免费判断</small>
        </div>
      </section>
    </main>
  );
}

export default GoalFitLandingPage;
