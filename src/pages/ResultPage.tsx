import { useEffect, useMemo, useState } from "react";
import { navigateTo } from "../lib/router";
import { buildDebugKeySummary, buildRiskCopyStatusSummary, summarizeWarnings } from "../lib/resultPresentation";
import { buildResultPageData } from "../lib/resultPipeline";
import { resolveTopRiskCardCopies } from "../lib/riskCardCopyResolver";
import { getStoredSession } from "../lib/sessionStorage";
import type { ResolvedRiskCardCopy } from "../lib/riskCardCopyResolver";
import type { ResultPageData } from "../types/result";
import type { StoredTestSession } from "../types/session";

type ResultPageProps = {
  testSessionId: string;
};

const TEXT = {
  notFound: "未找到测试记录",
  unavailable: "这个结果暂时不可用",
  restart: "请返回首页重新开始一次测试。",
  home: "返回首页",
  complete: "测试完成",
  title: "第一份工作风险预演结果",
  intro: "这是基于当前答题结果生成的风险预演，不是正式职业诊断。",
  basicInfo: "基础信息",
  answeredCount: "已回答题目数量",
  audienceType: "测试人群",
  currentStatus: "当前状态",
  education: "学历背景",
  companyType: "关注公司类型",
  workType: "关注工作类型",
  choiceReason: "选择原因",
  mainConcern: "主要担心",
  examStatus: "考研/考公状态",
  riskPreview: "风险预演",
  nextStep: "下一步你要验证什么",
  shareLine: "适合分享的一句话",
  currentLimits: "当前限制说明",
  limitOne: "当前文案仍是 PRODUCT_DRAFT，需要产品方终审后才能升级为 APPROVED。",
  limitTwo: "风险卡规则仍是 draft，结果不能替代真实岗位访谈、面试判断和职业咨询。",
  limitThree: "本页展示文案来自 risk_card_copy.json，不参与风险触发判断。",
  noValue: "未填写",
  fallbackLabel: "兜底提醒",
  debugInfo: "开发调试信息",
  warnings: "工程 warnings",
  warningTypes: "关键 warning 类型"
};

const BASIC_FIELD_LABELS: Array<{ key: string; label: string }> = [
  { key: "current_status", label: TEXT.currentStatus },
  { key: "education", label: TEXT.education },
  { key: "company_type", label: TEXT.companyType },
  { key: "work_type", label: TEXT.workType },
  { key: "choice_reason", label: TEXT.choiceReason },
  { key: "main_concern", label: TEXT.mainConcern },
  { key: "postgraduate_exam", label: TEXT.examStatus }
];

function TextList({ items }: { items: string[] }) {
  if (items.length === 0) return <p>{TEXT.noValue}</p>;
  return (
    <ul className="warning-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function RiskCopyCard({ item }: { item: ResolvedRiskCardCopy }) {
  const { copy, isFallback } = item;

  return (
    <article className="risk-card-debug">
      <p className="eyebrow">{isFallback ? TEXT.fallbackLabel : copy.status}</p>
      <h3>{copy.displayName}</h3>
      <p>{copy.oneLineRiskPrompt}</p>
      <p>{copy.resultShortCopy}</p>

      <h4>典型场景</h4>
      <TextList items={copy.typicalScenes} />

      <h4>不是在说你什么</h4>
      <p>{copy.notSaying}</p>

      <h4>降低风险的做法</h4>
      <TextList items={copy.riskReductionActions} />

      <section aria-label={TEXT.nextStep}>
        <h4>{TEXT.nextStep}</h4>
        <TextList items={copy.preChoiceValidationChecklist} />
        <p>{copy.whoToAsk}</p>
        <p>{copy.jiGeCanHelpWith}</p>
      </section>

      <section aria-label={TEXT.shareLine}>
        <h4>{TEXT.shareLine}</h4>
        <p>{copy.shareShortCopy}</p>
      </section>
    </article>
  );
}

function ResultPage({ testSessionId }: ResultPageProps) {
  const [session, setSession] = useState<StoredTestSession | undefined>();
  const [resultData, setResultData] = useState<ResultPageData | undefined>();
  const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

  useEffect(() => {
    const storedSession = getStoredSession(testSessionId);
    setSession(storedSession);
    setResultData(storedSession ? buildResultPageData(storedSession) : undefined);
  }, [testSessionId]);

  const presentation = useMemo(() => {
    if (!resultData) return undefined;
    const topRiskCardCopies = resolveTopRiskCardCopies(resultData.riskCardResult.topRiskCards);
    return {
      topRiskCardCopies,
      copyStatusSummary: buildRiskCopyStatusSummary(topRiskCardCopies),
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
          <p className="inline-warning">{TEXT.intro}</p>
        </section>

        <section className="result-section" aria-labelledby="basic-info-title">
          <h2 id="basic-info-title">{TEXT.basicInfo}</h2>
          <dl className="result-list result-list-compact">
            <div>
              <dt>{TEXT.audienceType}</dt>
              <dd>{session.audienceType}</dd>
            </div>
            <div>
              <dt>{TEXT.answeredCount}</dt>
              <dd>{resultData.resultDraft.answeredCount}</dd>
            </div>
            {BASIC_FIELD_LABELS.map((field) => (
              <div key={field.key}>
                <dt>{field.label}</dt>
                <dd>{session.answers[field.key] ?? TEXT.noValue}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="result-section" aria-labelledby="risk-preview-title">
          <h2 id="risk-preview-title">{TEXT.riskPreview}</h2>
          <div className="risk-card-list">
            {presentation.topRiskCardCopies.map((item) => (
              <RiskCopyCard item={item} key={item.cardId} />
            ))}
          </div>
        </section>

        <section className="result-section" aria-labelledby="limit-title">
          <h2 id="limit-title">{TEXT.currentLimits}</h2>
          <p>{TEXT.limitOne}</p>
          <p>{TEXT.limitTwo}</p>
          <p>{TEXT.limitThree}</p>
          <dl className="result-list result-list-compact">
            <div>
              <dt>copy status</dt>
              <dd>{presentation.copyStatusSummary}</dd>
            </div>
          </dl>
        </section>

        {isDev ? (
          <details className="debug-details">
            <summary>{TEXT.debugInfo}</summary>
            <dl className="result-list result-list-compact">
              {presentation.debugKeys.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
              <div>
                <dt>{TEXT.warningTypes}</dt>
                <dd>{presentation.warningSummary.join(", ") || "(none)"}</dd>
              </div>
            </dl>
            <details className="debug-details">
              <summary>{TEXT.warnings}</summary>
              {resultData.warnings.length > 0 ? <TextList items={resultData.warnings} /> : <p>(none)</p>}
            </details>
          </details>
        ) : null}

        <button className="secondary-button" type="button" onClick={() => navigateTo("/")}>
          {TEXT.home}
        </button>
      </section>
    </main>
  );
}

export default ResultPage;
