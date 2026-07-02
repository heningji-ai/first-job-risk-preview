import { navigateTo } from "../lib/router";
import { buildPathFitResultV2 } from "../lib/pathFitResultBuilderV2";
import {
  getPathFitSampleAnswerMapV2,
  normalizePathFitSampleKeyV2,
  PATH_FIT_V2_SAMPLE_KEYS,
  PATH_FIT_V2_SAMPLE_LABELS,
  type PathFitSampleKeyV2
} from "../lib/pathFitSampleAnswersV2";
import type { DisplayRiskLevelV2, PathFitResultPresentationV2 } from "../types/pathFitV2";

const RISK_LEVEL_LABELS: Record<DisplayRiskLevelV2, string> = {
  low: "压力较低",
  medium: "有一定摩擦",
  high: "压力偏高",
  severe: "压力较高"
};

function getCurrentSampleKey(): PathFitSampleKeyV2 {
  const params = new URLSearchParams(window.location.search);
  return normalizePathFitSampleKeyV2(params.get("sample"));
}

function buildSampleHref(sampleKey: PathFitSampleKeyV2): string {
  return `/result-v2-preview?sample=${sampleKey}`;
}

function renderSecondaryObstacle(result: PathFitResultPresentationV2) {
  if (!result.secondaryObstacle) return null;

  return (
    <article className="result-v2-note-card">
      <p className="result-v2-kicker">同时需要留意</p>
      <h3>{result.secondaryObstacle.title}</h3>
      <p>{result.secondaryObstacle.reason}</p>
    </article>
  );
}

function ResultPageV2Preview() {
  const sampleKey = getCurrentSampleKey();
  const answerMap = getPathFitSampleAnswerMapV2(sampleKey);
  const result = buildPathFitResultV2(answerMap);

  return (
    <main className="result-v2-shell">
      <section className="result-v2-hero">
        <div className="preview-v2-switcher" aria-label="样本切换">
          {PATH_FIT_V2_SAMPLE_KEYS.map((key) => (
            <button
              className={key === sampleKey ? "preview-v2-chip active" : "preview-v2-chip"}
              key={key}
              type="button"
              onClick={() => navigateTo(buildSampleHref(key))}
            >
              {PATH_FIT_V2_SAMPLE_LABELS[key]}
            </button>
          ))}
        </div>

        <p className="result-v2-eyebrow">{PATH_FIT_V2_SAMPLE_LABELS[sampleKey]}</p>
        <h1>{result.resultTitle}</h1>
        <p className="result-v2-summary">{result.resultSummary}</p>
        <div className="result-v2-score">
          <span>路径预演值</span>
          <strong>{result.finalPathFitScore}</strong>
        </div>
      </section>

      <section className="result-v2-section result-v2-path-card">
        <p className="result-v2-kicker">你选择的路径</p>
        <h2>
          {result.pathContext.companyTypeLabel}
          <span> × </span>
          {result.pathContext.roleTypeLabel}
        </h2>
      </section>

      <section className="result-v2-section">
        <div className="result-v2-section-heading">
          <p className="result-v2-kicker">四个维度拆解</p>
          <h2>这条路径会在哪些地方考验你</h2>
        </div>
        <div className="result-v2-dimension-grid">
          {result.displayDimensions.map((dimension) => (
            <article className="result-v2-dimension-card" key={dimension.key}>
              <div>
                <h3>{dimension.label}</h3>
                <span>{RISK_LEVEL_LABELS[dimension.riskLevel]}</span>
              </div>
              <strong>{dimension.score}</strong>
              <p>{dimension.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="result-v2-section result-v2-obstacle">
        <p className="result-v2-kicker">最大障碍</p>
        <h2>{result.primaryObstacle.title}</h2>
        <p>{result.primaryObstacle.reason}</p>
        {renderSecondaryObstacle(result)}
      </section>

      <section className="result-v2-section result-v2-requirements">
        <article>
          <p className="result-v2-kicker">这类公司通常期待什么</p>
          <p>{result.pathContext.companyRequirementSummary}</p>
        </article>
        <article>
          <p className="result-v2-kicker">这个岗位的高频场景是什么</p>
          <p>{result.pathContext.roleRequirementSummary}</p>
        </article>
      </section>

      {result.explanationSignals.length > 0 ? (
        <section className="result-v2-section">
          <div className="result-v2-section-heading">
            <p className="result-v2-kicker">同时需要留意</p>
            <h2>这些反应可能会放大路径摩擦</h2>
          </div>
          <div className="result-v2-signal-list">
            {result.explanationSignals.map((signal) => (
              <article className="result-v2-signal-card" key={signal.tag}>
                <h3>{signal.label}</h3>
                <p>{signal.summary}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="result-v2-section result-v2-boundary">
        <h2>这份结果怎么看</h2>
        <p>{result.boundaryCopy}</p>
        <div className="result-v2-cta">{result.officialAccountCta}</div>
      </section>
    </main>
  );
}

export default ResultPageV2Preview;
