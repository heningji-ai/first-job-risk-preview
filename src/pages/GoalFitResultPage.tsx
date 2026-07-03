import { navigateTo } from "../lib/router";
import { getGoalFitSession } from "../lib/goalFitSessionStore";
import type { GoalFitRiskInsightSeverity, GoalFitResult } from "../lib/goalFitTypes";

const severityLabels: Record<GoalFitRiskInsightSeverity, string> = {
  high: "需要重点确认",
  medium: "建议提前确认",
  low: "作为参考"
};

function getReportFromUrl(): GoalFitResult | null {
  const params = new URLSearchParams(window.location.search);
  const reportId = params.get("session");

  if (!reportId) return null;

  return getGoalFitSession(reportId)?.result ?? null;
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="goal-fit-result-score-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MissingReportPage() {
  return (
    <main className="goal-fit-shell goal-fit-result-shell">
      <section className="goal-fit-panel goal-fit-result-empty">
        <p className="goal-fit-eyebrow">报告未找到</p>
        <h1>没有找到本次报告</h1>
        <p>
          可能是浏览器记录被清理，或者你打开的报告链接已经失效。你可以重新完成一次目标适配测试。
        </p>
        <button
          className="primary-button"
          type="button"
          onClick={() => navigateTo("/test-goal-fit-preview")}
        >
          重新开始测试
        </button>
      </section>
    </main>
  );
}

function GoalFitResultPage() {
  const result = getReportFromUrl();

  if (!result) return <MissingReportPage />;

  const { scores } = result;
  const riskInsights = result.riskInsights.slice(0, 3);
  const recommendations = result.recommendations.slice(0, 3);

  return (
    <main className="goal-fit-shell goal-fit-result-shell">
      <section className="goal-fit-panel goal-fit-result-hero">
        <p className="goal-fit-eyebrow">目标适配报告</p>
        <h1>你的目标适配结果</h1>
        <p>
          围绕你选择的目标公司和目标岗位，我们做了一次第一份工作预演。
        </p>
        <div className="goal-fit-result-path">
          <span>{result.targetCompanyLabel}</span>
          <i aria-hidden="true">×</i>
          <span>{result.targetRoleLabel}</span>
        </div>
        <div className="goal-fit-result-overview">
          <div className="goal-fit-result-main-score">
            <span>综合适配</span>
            <strong>{scores.overallScore}</strong>
          </div>
          <div>
            <h2>{result.overallConclusion.title}</h2>
            <p>{result.overallConclusion.summary}</p>
          </div>
        </div>
      </section>

      <section className="goal-fit-panel goal-fit-result-section">
        <h2>你和目标公司的匹配度</h2>
        <div className="goal-fit-result-score-grid">
          <ScorePill label="公司适配" value={scores.companyFitScore} />
          <ScorePill label="入场准备" value={scores.companyEntryScore} />
          <ScorePill label="性格底色" value={scores.companyPersonalityScore} />
          <ScorePill label="日常行为" value={scores.companyBehaviorScore} />
        </div>
        <article className="goal-fit-result-note-card">
          <h3>{result.companyQuadrant.title}</h3>
          <p>{result.companyQuadrant.summary}</p>
          <p>{result.companyQuadrant.advice}</p>
        </article>
      </section>

      <section className="goal-fit-panel goal-fit-result-section">
        <h2>你和目标岗位的匹配度</h2>
        <div className="goal-fit-result-score-grid">
          <ScorePill label="岗位适配" value={scores.roleFitScore} />
          <ScorePill label="入场准备" value={scores.roleEntryScore} />
          <ScorePill label="性格底色" value={scores.rolePersonalityScore} />
          <ScorePill label="岗位反应" value={scores.roleBehaviorScore} />
        </div>
        <article className="goal-fit-result-note-card">
          <h3>{result.roleQuadrant.title}</h3>
          <p>{result.roleQuadrant.summary}</p>
          <p>{result.roleQuadrant.advice}</p>
        </article>
      </section>

      <section className="goal-fit-panel goal-fit-result-section">
        <h2>你需要提前看清的风险</h2>
        <div className="goal-fit-result-list">
          {riskInsights.map((risk) => (
            <article className="goal-fit-result-risk" key={risk.id}>
              <span>{severityLabels[risk.severity]}</span>
              <h3>{risk.title}</h3>
              <p>{risk.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="goal-fit-panel goal-fit-result-section">
        <h2>猎头季哥怎么看</h2>
        <p className="goal-fit-result-summary">{result.headhunterSummary}</p>
      </section>

      <section className="goal-fit-panel goal-fit-result-section">
        <h2>接下来更适合怎么做</h2>
        <div className="goal-fit-result-list">
          {recommendations.map((item) => (
            <article className="goal-fit-result-action" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="goal-fit-panel goal-fit-result-section goal-fit-result-cta">
        <h2>如果你还想继续获得求职方向的帮助</h2>
        <p>可以关注公众号：猎头季哥人才重估实验室</p>
      </section>

      <section className="goal-fit-result-actions">
        <button
          className="primary-button"
          type="button"
          onClick={() => navigateTo("/test-goal-fit-preview")}
        >
          重新测试
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          回到顶部
        </button>
      </section>
    </main>
  );
}

export default GoalFitResultPage;
