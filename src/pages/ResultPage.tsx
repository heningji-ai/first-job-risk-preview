import { useEffect, useMemo, useState } from "react";
import questionsConfig from "../config/audiences/student/questions.json";
import { navigateTo } from "../lib/router";
import { buildDebugKeySummary, buildRiskCopyStatusSummary, summarizeWarnings } from "../lib/resultPresentation";
import { buildResultPageData } from "../lib/resultPipeline";
import { resolveRiskCardCopy, resolveTopRiskCardCopies } from "../lib/riskCardCopyResolver";
import { getStoredSession } from "../lib/sessionStorage";
import type { ResolvedRiskCardCopy } from "../lib/riskCardCopyResolver";
import type { ResultPageData } from "../types/result";
import type { StoredTestSession } from "../types/session";

type ResultPageProps = {
  testSessionId: string;
};

type QuestionOption = {
  id: string;
  text?: string;
  label?: string;
};

type QuestionConfigItem = {
  id: string;
  text?: string;
  title?: string;
  options?: QuestionOption[];
};

type QuestionsConfigFile = {
  questions: QuestionConfigItem[];
};

const QUESTION_CONFIG = questionsConfig as QuestionsConfigFile;
const FALLBACK_RISK_CARD_ID = "H0_GENERAL_REMINDER";
const MAX_VISIBLE_VALIDATION_ITEMS = 3;

const RESULT_TEXT = {
  title: "第一份工作风险预演结果",
  intro: "这是基于你当前答题生成的风险预演，不是正式职业诊断。",
  basicChoice: "你的基础选择",
  riskFocus: "这次最需要先验证的一件事",
  riskCardLabel: "风险预演卡",
  fallbackLabel: "兜底提醒",
  validationTitle: "下一步先验证这 3 件事",
  moreDetails: "展开看更多解释",
  typicalScenes: "典型场景",
  notSaying: "这不是在说你什么",
  riskReductionActions: "降低风险的做法",
  whoToAsk: "可以找谁验证",
  jiGeCanHelpWith: "找猎头季哥可以帮你看什么",
  shareLine: "适合分享的一句话",
  currentLimits: "当前结果怎么看",
  limitSummary: "当前结果仍是产品草稿，只适合作为求职前的风险预演，不能替代真实岗位访谈、面试判断和职业咨询。",
  ctaTitle: "找工作还有其他卡点，可以继续看",
  ctaIntro:
    "如果你还在纠结方向、简历、面试、Offer 或试用期问题，可以继续关注「猎头季哥人才重估实验室」，也可以添加猎头季哥企业微信进一步说明情况。",
  publicAccountLabel: "公众号",
  publicAccountName: "猎头季哥人才重估实验室",
  wecomLabel: "企业微信",
  wecomName: "猎头季哥",
  wecomPlaceholder: "【上线前补充】",
  ctaBoundary: "关注公众号或添加企业微信，不等于进入一对一服务，是否进一步沟通以后续实际问题为准。"
};

const TEXT = {
  notFound: "未找到测试记录",
  unavailable: "这个结果暂时不可用",
  restart: "请返回首页重新开始一次测试。",
  home: "返回首页",
  complete: "测试完成",
  answeredCount: "已回答题目数量",
  audienceType: "测试人群",
  currentStatus: "当前状态",
  education: "学历背景",
  companyType: "关注公司类型",
  workType: "关注工作类型",
  choiceReason: "选择原因",
  mainConcern: "主要担心",
  examStatus: "考研/考公状态",
  noValue: "未填写",
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

function getAnswerDisplayValue(questionId: string, answerId: string | undefined): string {
  if (!answerId) return TEXT.noValue;

  const question = QUESTION_CONFIG.questions.find((item) => item.id === questionId);
  const option = question?.options?.find((item) => item.id === answerId);

  return option?.text ?? option?.label ?? answerId;
}

function getFallbackRiskCardCopy(): ResolvedRiskCardCopy {
  return {
    cardId: FALLBACK_RISK_CARD_ID,
    isFallback: true,
    copy: resolveRiskCardCopy(FALLBACK_RISK_CARD_ID)
  };
}

function resolvePrimaryRiskCardCopy(topRiskCardCopies: ResolvedRiskCardCopy[]): ResolvedRiskCardCopy {
  const primary = topRiskCardCopies[0];

  if (!primary) return getFallbackRiskCardCopy();
  if (primary.copy.cardId !== primary.cardId) return getFallbackRiskCardCopy();

  return primary;
}

function TextList({ items, className }: { items: string[]; className?: string }) {
  if (items.length === 0) return <p>{TEXT.noValue}</p>;
  return (
    <ul className={className ?? "result-text-list"}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function PrimaryRiskSummary({ item }: { item: ResolvedRiskCardCopy }) {
  const { copy, isFallback } = item;
  const visibleValidationItems = copy.preChoiceValidationChecklist.slice(0, MAX_VISIBLE_VALIDATION_ITEMS);

  return (
    <article className="result-risk-card result-risk-card-compact">
      <div className="result-card-header">
        <p className="eyebrow">{isFallback ? RESULT_TEXT.fallbackLabel : RESULT_TEXT.riskCardLabel}</p>
        <h3>{copy.displayName}</h3>
      </div>

      <p className="risk-prompt">{copy.oneLineRiskPrompt}</p>
      <p className="section-note">{copy.resultShortCopy}</p>

      <section className="result-card-block result-next-step" aria-label={RESULT_TEXT.validationTitle}>
        <h4>{RESULT_TEXT.validationTitle}</h4>
        <TextList items={visibleValidationItems} className="validation-list" />
      </section>

      <details className="result-more-details">
        <summary>{RESULT_TEXT.moreDetails}</summary>
        <div className="result-more-content">
          <section className="result-card-block" aria-label={RESULT_TEXT.typicalScenes}>
            <h4>{RESULT_TEXT.typicalScenes}</h4>
            <TextList items={copy.typicalScenes} />
          </section>

          <section className="result-card-block" aria-label={RESULT_TEXT.notSaying}>
            <h4>{RESULT_TEXT.notSaying}</h4>
            <p>{copy.notSaying}</p>
          </section>

          <section className="result-card-block" aria-label={RESULT_TEXT.riskReductionActions}>
            <h4>{RESULT_TEXT.riskReductionActions}</h4>
            <TextList items={copy.riskReductionActions} />
          </section>

          <section className="result-card-block" aria-label={RESULT_TEXT.whoToAsk}>
            <h4>{RESULT_TEXT.whoToAsk}</h4>
            <p>{copy.whoToAsk}</p>
          </section>

          <section className="result-card-block" aria-label={RESULT_TEXT.jiGeCanHelpWith}>
            <h4>{RESULT_TEXT.jiGeCanHelpWith}</h4>
            <p>{copy.jiGeCanHelpWith}</p>
          </section>

          <section className="result-card-block share-copy" aria-label={RESULT_TEXT.shareLine}>
            <h4>{RESULT_TEXT.shareLine}</h4>
            <p>{copy.shareShortCopy}</p>
          </section>
        </div>
      </details>
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
    const primaryRiskCardCopy = resolvePrimaryRiskCardCopy(topRiskCardCopies);
    return {
      topRiskCardCopies,
      primaryRiskCardCopy,
      copyStatusSummary: buildRiskCopyStatusSummary([primaryRiskCardCopy]),
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
    <main className="result-shell result-mobile-shell">
      <section className="result-page" aria-labelledby="result-title">
        <section className="result-hero result-hero-mobile" aria-labelledby="result-title">
          <p className="eyebrow">{TEXT.complete}</p>
          <h1 id="result-title">{RESULT_TEXT.title}</h1>
          <p>{RESULT_TEXT.intro}</p>
        </section>

        <section className="result-section result-card-section" aria-labelledby="basic-info-title">
          <h2 id="basic-info-title">{RESULT_TEXT.basicChoice}</h2>
          <dl className="choice-summary">
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
                <dd>{getAnswerDisplayValue(field.key, session.answers[field.key])}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="result-section" aria-labelledby="risk-preview-title">
          <h2 id="risk-preview-title">{RESULT_TEXT.riskFocus}</h2>
          <PrimaryRiskSummary item={presentation.primaryRiskCardCopy} />
        </section>

        <section className="result-section result-card-section result-limit-card" aria-labelledby="limit-title">
          <h2 id="limit-title">{RESULT_TEXT.currentLimits}</h2>
          <p>{RESULT_TEXT.limitSummary}</p>
        </section>

        <section className="result-section result-card-section cta-card cta-card-compact" aria-labelledby="cta-title">
          <p className="eyebrow">继续看求职判断</p>
          <h2 id="cta-title">{RESULT_TEXT.ctaTitle}</h2>
          <p>{RESULT_TEXT.ctaIntro}</p>

          <div className="cta-entry-list cta-entry-list-compact">
            <section className="cta-entry cta-entry-compact" aria-label={RESULT_TEXT.publicAccountLabel}>
              <p className="cta-entry-label">{RESULT_TEXT.publicAccountLabel}</p>
              <h3>{RESULT_TEXT.publicAccountName}</h3>
            </section>

            <section className="cta-entry cta-entry-compact" aria-label={RESULT_TEXT.wecomLabel}>
              <p className="cta-entry-label">{RESULT_TEXT.wecomLabel}</p>
              <h3>{RESULT_TEXT.wecomName}</h3>
              <p className="cta-placeholder-text">{RESULT_TEXT.wecomPlaceholder}</p>
            </section>
          </div>

          <p className="section-note">{RESULT_TEXT.ctaBoundary}</p>
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
              <div>
                <dt>risk card copy status</dt>
                <dd>{presentation.copyStatusSummary}</dd>
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
