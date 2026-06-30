import { useEffect, useState } from "react";
import { navigateTo } from "../lib/router";
import { buildResultPageData } from "../lib/resultPipeline";
import { getStoredSession } from "../lib/sessionStorage";
import type { ResultPageData } from "../types/result";
import type { StoredTestSession } from "../types/session";

type ResultPageProps = {
  testSessionId: string;
};

const TEXT = {
  notFound: "\u672a\u627e\u5230\u6d4b\u8bd5\u8bb0\u5f55",
  unavailable: "\u8fd9\u4e2a\u7ed3\u679c\u6682\u65f6\u4e0d\u53ef\u7528",
  restart: "\u8bf7\u8fd4\u56de\u9996\u9875\u91cd\u65b0\u5f00\u59cb\u4e00\u6b21\u6d4b\u8bd5\u3002",
  home: "\u8fd4\u56de\u9996\u9875",
  complete: "\u6d4b\u8bd5\u5b8c\u6210",
  title: "\u7ed3\u679c\u9875\u6570\u636e\u63a5\u5165\u5360\u4f4d\u7248",
  sampleNotice:
    "\u5f53\u524d\u98ce\u9669\u5361\u4e3a\u5de5\u7a0b\u793a\u4f8b\uff0c\u4e0d\u4ee3\u8868\u6b63\u5f0f\u804c\u4e1a\u5224\u65ad\u3002",
  engineeringOnly:
    "\u5f53\u524d\u7ed3\u679c\u4ec5\u7528\u4e8e\u5de5\u7a0b\u94fe\u8def\u9a8c\u8bc1\uff0c\u4e0d\u53ef\u4f5c\u4e3a\u6b63\u5f0f\u4ea7\u54c1\u5224\u65ad\u3002",
  answeredCount: "\u5df2\u56de\u7b54\u9898\u76ee\u6570\u91cf",
  h0Fallback:
    "H0_GENERAL_REMINDER \u662f\u65e0\u89e6\u53d1\u98ce\u9669\u5361\u65f6\u7684\u515c\u5e95\u5c55\u793a\u5361\uff0c\u4e0d\u5c5e\u4e8e\u6b63\u5f0f triggeredRiskCards\u3002",
  riskCardOutput: "\u98ce\u9669\u5361\u5de5\u7a0b\u8f93\u51fa"
};

function joinKeys(record: Record<string, unknown>): string {
  const keys = Object.keys(record);
  return keys.length > 0 ? keys.join(", ") : "(none)";
}

function warningNeedsEngineeringNotice(warnings: string[]): boolean {
  return warnings.some(
    (warning) =>
      warning.includes("SCORING_PLACEHOLDER") ||
      warning.includes("DIMENSION_RULES_PLACEHOLDER") ||
      warning.includes("ENGINEERING_SAMPLE_ONLY") ||
      warning.includes("B1") ||
      warning.includes("mbti_type")
  );
}

function ResultPage({ testSessionId }: ResultPageProps) {
  const [session, setSession] = useState<StoredTestSession | undefined>();
  const [resultData, setResultData] = useState<ResultPageData | undefined>();

  useEffect(() => {
    const storedSession = getStoredSession(testSessionId);
    setSession(storedSession);
    setResultData(storedSession ? buildResultPageData(storedSession) : undefined);
  }, [testSessionId]);

  if (!session || !resultData) {
    return (
      <main className="app-shell">
        <section className="state-panel">
          <p className="eyebrow">{TEXT.notFound}</p>
          <h1>{TEXT.unavailable}</h1>
          <p>{TEXT.restart}</p>
          <button className="primary-button" type="button" onClick={() => navigateTo("/")}>
            {TEXT.home}
          </button>
        </section>
      </main>
    );
  }

  const { resultDraft, riskCardResult, warnings } = resultData;
  const showEngineeringNotice = warningNeedsEngineeringNotice(warnings);

  return (
    <main className="result-shell">
      <section className="result-panel result-panel-wide" aria-labelledby="result-title">
        <p className="eyebrow">{TEXT.complete}</p>
        <h1 id="result-title">{TEXT.title}</h1>

        <p className="inline-notice">{TEXT.sampleNotice}</p>

        {showEngineeringNotice ? <p className="inline-warning">{TEXT.engineeringOnly}</p> : null}

        <dl className="result-list">
          <div>
            <dt>testSessionId</dt>
            <dd>{session.id}</dd>
          </div>
          <div>
            <dt>audienceType</dt>
            <dd>{session.audienceType}</dd>
          </div>
          <div>
            <dt>{TEXT.answeredCount}</dt>
            <dd>{resultDraft.answeredCount}</dd>
          </div>
          <div>
            <dt>directRiskScores keys</dt>
            <dd>{joinKeys(resultDraft.directRiskScores)}</dd>
          </div>
          <div>
            <dt>dimensionScores keys</dt>
            <dd>{joinKeys(resultDraft.dimensionScores)}</dd>
          </div>
          <div>
            <dt>finalRiskScores keys</dt>
            <dd>{joinKeys(resultDraft.finalRiskScores)}</dd>
          </div>
          <div>
            <dt>triggeredRiskCards ids</dt>
            <dd>{riskCardResult.triggeredRiskCards.map((card) => card.cardId).join(", ") || "(none)"}</dd>
          </div>
          <div>
            <dt>topRiskCards ids</dt>
            <dd>{riskCardResult.topRiskCards.map((card) => card.cardId).join(", ") || "(none)"}</dd>
          </div>
        </dl>

        {riskCardResult.topRiskCards.some((card) => card.isFallback) ? (
          <p className="inline-notice">{TEXT.h0Fallback}</p>
        ) : null}

        <section className="result-section" aria-labelledby="risk-card-title">
          <h2 id="risk-card-title">{TEXT.riskCardOutput}</h2>
          <div className="risk-card-list">
            {riskCardResult.evaluatedCards.map((card) => (
              <article className="risk-card-debug" key={card.cardId}>
                <h3>{card.cardId}</h3>
                <p>{card.title}</p>
                <dl>
                  <div>
                    <dt>triggered</dt>
                    <dd>{String(card.triggered)}</dd>
                  </div>
                  <div>
                    <dt>score</dt>
                    <dd>{card.score}</dd>
                  </div>
                  <div>
                    <dt>matchedSignals</dt>
                    <dd>
                      {card.matchedSignals.length > 0
                        ? card.matchedSignals
                            .map((signal) => `${signal.type}:${signal.field}:${signal.score}`)
                            .join(", ")
                        : "(none)"}
                    </dd>
                  </div>
                  <div>
                    <dt>skippedReason</dt>
                    <dd>{card.skippedReason ?? "(none)"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="result-section" aria-labelledby="warning-title">
          <h2 id="warning-title">warnings</h2>
          {warnings.length > 0 ? (
            <ul className="warning-list">
              {warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p>(none)</p>
          )}
        </section>

        <button className="secondary-button" type="button" onClick={() => navigateTo("/")}>
          {TEXT.home}
        </button>
      </section>
    </main>
  );
}

export default ResultPage;
