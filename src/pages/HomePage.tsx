import { navigateTo } from "../lib/router";

function HomePage() {
  return (
    <main className="app-shell">
      <section className="hero-panel home-panel" aria-labelledby="home-title">
        <div className="home-content">
          <p className="eyebrow">第一份工作之前，先看清这条路</p>
          <h1 id="home-title">第一次找工作，迷茫不是你的问题</h1>
          <p className="lead">
            真正难的是，没人告诉你：公司和岗位背后的真实工作方式，到底适不适合你每天去面对。
          </p>
          <div className="home-copy">
            <p>我是猎头季哥，做了 21 年招聘和猎头。</p>
            <p>
              这些年，我一边看企业怎么筛人、怎么用人，也一边看很多年轻人为什么在第一份工作里迷茫、痛苦、怀疑自己，甚至入职几个月就想离开。
            </p>
            <p>很多时候，不是人不行，而是第一份工作选到了不适合自己的环境。</p>
            <p>
              这个测试不是替你决定人生，而是把我在招聘一线看到的用人标准、岗位日常和新人适应风险，整理成一组问题。
            </p>
            <p>
              它帮你在投简历前，先看清楚：你想去的公司、你感兴趣的岗位，会不会放大你现在最容易焦虑、消耗或逃避的地方。
            </p>
            <p>
              第一份工作不要只看公司名、岗位名、稳定感和热门程度，也要看自己能不能适应那种真实的工作方式。
            </p>
          </div>
          <div className="home-action">
            <button className="primary-button home-button" type="button" onClick={() => navigateTo("/test")}>
              先看看哪条路更适合我
            </button>
          </div>
        </div>

        <div className="home-visual" aria-hidden="true">
          <div className="home-glow" />
          <div className="home-person">
            <span className="home-person-head" />
            <span className="home-person-body" />
          </div>
          <div className="home-path home-path-left" />
          <div className="home-path home-path-center" />
          <div className="home-path home-path-right" />
          <div className="home-floating-card home-floating-card-company">公司</div>
          <div className="home-floating-card home-floating-card-role">岗位</div>
          <div className="home-floating-card home-floating-card-first">第一份工作</div>
        </div>
      </section>
    </main>
  );
}

export default HomePage;
