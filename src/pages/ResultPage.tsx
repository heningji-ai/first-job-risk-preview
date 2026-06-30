import { useEffect, useMemo, useState } from "react";
import { navigateTo } from "../lib/router";
import {
  buildDebugKeySummary,
  buildRiskCardViewModels,
  buildTriggeredRiskCardViewModels,
  summarizeWarnings
} from "../lib/resultPresentation";
import { buildResultPageData } from "../lib/resultPipeline";
import { getStoredSession } from "../lib/sessionStorage";
import type { ResultPageData } from "../types/result";
import type { RiskCardViewModel } from "../lib/resultPresentation";
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
  title: "\u7ed3\u679c\u9875\u4fe1\u606f\u7ed3\u6784\u5360\u4f4d\u7248",
  sampleNotice:
    "\u5f53\u524d\u98ce\u9669\u5361\u4e3a\u5de5\u7a0b\u793a\u4f8b\uff0c\u4e0d\u4ee3\u8868\u6b63\u5f0f\u804c\u4e1a\u5224\u65ad\u3002",
  engineeringOnly:
    "\u5f53\u524d\u7ed3\u679c\u4ec5\u7528\u4e8e\u5de5\u7a0b\u94fe\u8def\u9a8c\u8bc1\uff0c\u4e0d\u53ef\u4f5c\u4e3a\u6b63\u5f0f\u4ea7\u54c1\u5224\u65ad\u3002",
  answeredCount: "\u5df2\u56de\u7b54\u9898\u76ee\u6570\u91cf",
  basicInfo: "\u57fa\u7840\u4fe1\u606f",
  riskPreview: "\u98ce\u9669\u9884\u89c8",
  riskPreviewNotice:
    "\u4ee5\u4e0b\u98ce\u9669\u5361\u4e3a\u5de5\u7a0b\u793a\u4f8b\uff0c\u4ec5\u7528\u4e8e\u9a8c\u8bc1\u89e6\u53d1\u94fe\u8def\u3002",
  triggerExplain: "\u5de5\u7a0b\u89e6\u53d1\u89e3\u91ca",
  currentLimits: "\u5f53\u524d\u9650\u5236",
  warningCount: "\u5de5\u7a0b warnings \u6570\u91cf",
  keyWarnings: "\u5173\u952e warning \u7c7b\u578b",
  allWarnings: "\u67e5\u770b\u5168\u90e8\u5de5\u7a0b warnings",
  debugInfo: "\u5f00\u53d1\u8c03\u8bd5\u4fe1\u606f",
  fallbackYes: "\u662f",
  fallbackNo: "\u5426"
};

function RiskCardBlock({ card, showTriggered }: { card: RiskCardViewModel; showTriggered?: boolean }) {
  return (
    <article className="risk-card-debug">
      <h3>{card.cardId}</h3>
      <p>{card.title}</p>
      <dl>
        {showTriggered ? (
          <div>
            <dt>triggered</dt>
            <dd>{String(card.triggered)}</dd>
          </div>
        ) : null}
        <div>
          <dt>score</dt>
          <dd>{card.score}</dd>
        </div>
        <div>
          <dt>matchedSignals</dt>
          <dd>{card.matchedSignals}</dd>
        </div>
        <div>
          <dt>H0 fallback</dt>
          <dd>{card.isFallback ? TEXT.fallbackYes : TEXT.fallbackNo}</dd>
        </div>
        {card.skippedReason ? (
          <div>
            <dt>skippedReason</dt>
            <dd>{card.skippedReason}</dd>
          </div>
        ) : null}
      </dl>
    </article>
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

  const presentation = useMemo(() => {
    if (!resultData) return undefined;
    return {
      topRiskCards: buildRiskCardViewModels(
        resultData.riskCardResult.topRiskCards,
        resultData.riskCardResult.evaluatedCards
      ),
      triggeredRiskCards: buildTriggeredRiskCardViewModels(resultData.riskCardResult.triggeredRiskCards),
      warningSummary: summarizeWarnings(resultData.warnings),
      debugKeys: buildDebugKeySummary(resultData)
    };
  }, [resultData]);

  if (!session || !resultData || !presentation) {
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

  return (
    <main className="result-shell">
      <section className="result-panel result-panel-wide" aria-labelledby="result-title">
        <section className="result-hero" aria-labelledby="result-title">
          <p className="eyebrow">{TEXT.complete}</p>
          <h1 id="result-title">{TEXT.title}</h1>
          <p className="inline-warning">{TEXT.engineeringOnly}</p>
          <p className="inline-notice">{TEXT.sampleNotice}</p>
        </section>

        <section className="result-section" aria-labelledby="basic-info-title">
          <h2 id="basic-info-title">{TEXT.basicInfo}</h2>
          <dl className="result-list result-list-compact">
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
              <dd>{resultData.resultDraft.answeredCount}</dd>
            </div>
          </dl>
        </section>

        <section className="result-section" aria-labelledby="risk-preview-title">
          <h2 id="risk-preview-title">{TEXT.riskPreview}</h2>
          <p className="section-note">{TEXT.riskPreviewNotice}</p>
          <div className="risk-card-list">
            {presentation.topRiskCards.map((card) => (
              <RiskCardBlock card={card} key={card.cardId} />
            ))}
          </div>
        </section>

        <section className="result-section" aria-labelledby="trigger-explain-title">
          <h2 id="trigger-explain-title">{TEXT.triggerExplain}</h2>
          <div className="risk-card-list">
            {presentation.triggeredRiskCards.length > 0 ? (
              presentation.triggeredRiskCards.map((card) => (
                <RiskCardBlock card={card} key={card.cardId} showTriggered />
              ))
            ) : (
              <p>(none)</p>
            )}
          </div>
        </section>

        <section className="result-section" aria-labelledby="limit-title">
          <h2 id="limit-title">{TEXT.currentLimits}</h2>
          <dl className="result-list result-list-compact">
            <div>
              <dt>{TEXT.warningCount}</dt>
              <dd>{resultData.warnings.length}</dd>
            </div>
            <div>
              <dt>{TEXT.keyWarnings}</dt>
              <dd>{presentation.warningSummary.join(", ") || "(none)"}</dd>
            </div>
          </dl>
          <details className="debug-details">
            <summary>{TEXT.allWarnings}</summary>
            {resultData.warnings.length > 0 ? (
              <ul className="warning-list">
                {resultData.warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>(none)</p>
            )}
          </details>
        </section>

        <details className="debug-details">
          <summary>{TEXT.debugInfo}</summary>
          <dl className="result-list result-list-compact">
            {presentation.debugKeys.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </details>

        <button className="secondary-button" type="button" onClick={() => navigateTo("/")}>
          {TEXT.home}
        </button>
      </section>
    </main>
  );
}

export default ResultPage;
