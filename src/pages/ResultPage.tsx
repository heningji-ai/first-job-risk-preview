import { useEffect, useMemo, useState } from "react";
import questionsConfig from "../config/audiences/student/questions.json";
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

const RESULT_TEXT = {
  title: "第一份工作风险预演结果",
  intro: "这是基于你当前答题生成的风险预演，不是正式职业诊断。",
  basicChoice: "你的基础选择",
  riskFocus: "本次需要重点留意的风险",
  riskCardLabel: "风险预演卡",
  fallbackLabel: "兜底提醒",
  typicalScenes: "典型场景",
  notSaying: "这不是在说你什么",
  riskReductionActions: "降低风险的做法",
  nextStep: "下一步你要验证什么",
  whoToAsk: "可以找谁验证",
  jiGeCanHelpWith: "找猎头季哥可以帮你判断什么",
  shareLine: "适合分享的一句话",
  currentLimits: "当前结果怎么看",
  limitOne: "当前文案仍是 PRODUCT_DRAFT，需要产品方终审后才能升级为 APPROVED。",
  limitTwo: "风险规则仍是 draft，结果不能替代真实岗位访谈、面试判断和职业咨询。",
  limitThree: "本页只整理展示风险预演信息，没有新增分享、登录、支付或后端链路。"
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

function getAnswerDisplayValue(questionId: string, answerId: string | undefined): string {
  if (!answerId) return TEXT.noValue;

  const question = QUESTION_CONFIG.questions.find((item) => item.id === questionId);
  const option = question?.options?.find((item) => item.id === answerId);

  return option?.text ?? option?.label ?? answerId;
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

function RiskCopyCard({ item }: { item: ResolvedRiskCardCopy }) {
  const { copy, isFallback } = item;

  return (
    <article className="result-risk-card">
      <div className="result-card-header">
        <p className="eyebrow">{isFallback ? RESULT_TEXT.fallbackLabel : RESULT_TEXT.riskCardLabel}</p>
        <h3>{copy.displayName}</h3>
      </div>

      <p className="risk-prompt">{copy.oneLineRiskPrompt}</p>
      <p className="section-note">{copy.resultShortCopy}</p>

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

      <section className="result-card-block result-next-step" aria-label={RESULT_TEXT.nextStep}>
        <h4>{RESULT_TEXT.nextStep}</h4>
        <TextList items={copy.preChoiceValidationChecklist} className="validation-list" />
        <div className="verification-meta">
          <p>
            <strong>{RESULT_TEXT.whoToAsk}</strong>
            <span>{copy.whoToAsk}</span>
          </p>
          <p>
            <strong>{RESULT_TEXT.jiGeCanHelpWith}</strong>
            <span>{copy.jiGeCanHelpWith}</span>
          </p>
        </div>
      </section>

      <section className="result-card-block share-copy" aria-label={RESULT_TEXT.shareLine}>
        <h4>{RESULT_TEXT.shareLine}</h4>
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
          <div className="risk-card-list">
            {presentation.topRiskCardCopies.map((item) => (
              <RiskCopyCard item={item} key={item.cardId} />
            ))}
          </div>
        </section>

        <section className="result-section result-card-section" aria-labelledby="limit-title">
          <h2 id="limit-title">{RESULT_TEXT.currentLimits}</h2>
          <p>{RESULT_TEXT.limitOne}</p>
          <p>{RESULT_TEXT.limitTwo}</p>
          <p>{RESULT_TEXT.limitThree}</p>
          <p className="copy-status-note">当前 copy 状态：{presentation.copyStatusSummary}</p>
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
