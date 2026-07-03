import { useState } from "react";
import { navigateTo } from "../lib/router";
import { getGoalFitSession } from "../lib/goalFitSessionStore";
import type { GoalFitRiskInsightSeverity, GoalFitResult } from "../lib/goalFitTypes";

const severityLabels: Record<GoalFitRiskInsightSeverity, string> = {
  high: "需要重点确认",
  medium: "建议提前确认",
  low: "作为参考"
};

const screenLabels = ["总判断", "适配拆解", "风险行动"];

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

function ScreenDots({
  currentScreen,
  onChange
}: {
  currentScreen: number;
  onChange: (screen: number) => void;
}) {
  return (
    <div className="goal-fit-result-tabs" aria-label="结果阅读进度">
      {screenLabels.map((label, index) => (
        <button
          className={index === currentScreen ? "active" : ""}
          key={label}
          type="button"
          onClick={() => onChange(index)}
        >
          <span>{index + 1}</span>
          {label}
        </button>
      ))}
    </div>
  );
}

function FitCard({
  title,
  scores,
  conclusion
}: {
  title: string;
  scores: Array<{ label: string; value: number }>;
  conclusion: { title: string; summary: string; advice: string };
}) {
  return (
    <article className="goal-fit-result-fit-card">
      <h3>{title}</h3>
      <div className="goal-fit-result-score-grid">
        {scores.map((item) => (
          <ScorePill key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
      <div className="goal-fit-result-note-card">
        <h4>{conclusion.title}</h4>
        <p>{conclusion.summary}</p>
        <p>{conclusion.advice}</p>
      </div>
    </article>
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
  const [currentResultScreen, setCurrentResultScreen] = useState(0);
  const result = getReportFromUrl();

  if (!result) return <MissingReportPage />;

  const { scores } = result;
  const riskInsights = result.riskInsights.slice(0, 3);
  const recommendations = result.recommendations.slice(0, 3);

  return (
    <main className="goal-fit-shell goal-fit-result-shell">
      <section className="goal-fit-panel goal-fit-result-frame">
        <header className="goal-fit-result-header">
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
          <ScreenDots currentScreen={currentResultScreen} onChange={setCurrentResultScreen} />
        </header>

        {currentResultScreen === 0 ? (
          <section className="goal-fit-result-screen">
            <p className="goal-fit-eyebrow">先看总判断</p>
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
            <article className="goal-fit-result-human-card">
              <h3>猎头季哥怎么看</h3>
              <p>{result.headhunterSummary}</p>
            </article>
            <div className="goal-fit-result-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => setCurrentResultScreen(1)}
              >
                看公司和岗位适配
              </button>
            </div>
          </section>
        ) : null}

        {currentResultScreen === 1 ? (
          <section className="goal-fit-result-screen">
            <p className="goal-fit-eyebrow">拆开看：公司和岗位</p>
            <div className="goal-fit-result-fit-grid">
              <FitCard
                title="你和目标公司的匹配度"
                scores={[
                  { label: "公司适配", value: scores.companyFitScore },
                  { label: "入场准备", value: scores.companyEntryScore },
                  { label: "性格底色", value: scores.companyPersonalityScore },
                  { label: "日常行为", value: scores.companyBehaviorScore }
                ]}
                conclusion={result.companyQuadrant}
              />
              <FitCard
                title="你和目标岗位的匹配度"
                scores={[
                  { label: "岗位适配", value: scores.roleFitScore },
                  { label: "入场准备", value: scores.roleEntryScore },
                  { label: "性格底色", value: scores.rolePersonalityScore },
                  { label: "岗位反应", value: scores.roleBehaviorScore }
                ]}
                conclusion={result.roleQuadrant}
              />
            </div>
            <div className="goal-fit-result-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setCurrentResultScreen(0)}
              >
                返回总判断
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => setCurrentResultScreen(2)}
              >
                看风险和下一步
              </button>
            </div>
          </section>
        ) : null}

        {currentResultScreen === 2 ? (
          <section className="goal-fit-result-screen">
            <p className="goal-fit-eyebrow">最后看风险和行动</p>
            <section className="goal-fit-result-section">
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

            <section className="goal-fit-result-section">
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

            <section className="goal-fit-result-section goal-fit-result-cta">
              <h2>如果你还想继续获得求职方向的帮助</h2>
              <p>可以关注公众号：猎头季哥人才重估实验室</p>
              <p className="goal-fit-result-cta-note">
                我会继续讲：第一份工作怎么选、简历怎么改、面试怎么说、哪些岗位不能盲投。
              </p>
            </section>

            <div className="goal-fit-result-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setCurrentResultScreen(1)}
              >
                返回上一屏
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => navigateTo("/test-goal-fit-preview")}
              >
                重新测试
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default GoalFitResultPage;
