import { navigateTo } from "../lib/router";

function HomePage() {
  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="home-title">
        <p className="eyebrow">秋招前，先做一次选择预演</p>
        <h1 id="home-title">第一份工作风险预演</h1>
        <p className="lead">
          通过一组配置化问题，先看看你想选的公司和岗位路径可能在哪些地方考验你。
        </p>
        <button className="primary-button" type="button" onClick={() => navigateTo("/test")}>
          开始测试
        </button>
      </section>
    </main>
  );
}

export default HomePage;
