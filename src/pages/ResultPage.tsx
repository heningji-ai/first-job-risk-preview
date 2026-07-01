import { useEffect, useMemo, useState } from "react";
import questionsConfig from "../config/audiences/student/questions.json";
import { buildResultExperiencePresentation } from "../lib/resultExperiencePresentation";
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
const FALLBACK_COMPANY_LABEL = "暂未明确的公司类型";
const FALLBACK_WORK_LABEL = "暂未明确的岗位类型";

const RESULT_TEXT = {
  heroTitle: "第一份工作路径适配风险预演",
  heroIntro: "这是基于你当前选择生成的路径适配风险预演，不是正式职业诊断。",
  audioLabel: "氛围音乐：未来接入",
  audioHint: "未来会根据你的结果匹配不同氛围音乐",
  selectedPath: "你这次选择的是：",
  metricPathFit: "路径适应度参考值",
  metricSixMonth: "6 个月离职风险预演值",
  metricAge30: "30 岁后职场焦虑风险预演值",
  metricNote: "这些数值不是对个人能力的评价，也不是真实结果预测，只用于表达这条路径对你当前阶段的适应压力。",
  verdictQuestion: "这条路径，对你现在是否友好？",
  expectationTitle: "这类公司和岗位，通常更希望新人具备什么？",
  companyExpectation: "这类公司通常更希望新人具备：",
  workExpectation: "这类岗位通常更希望新人具备：",
  sensitivePoint: "你当前最敏感的压力点",
  possibleOutcome: "如果调整不了，可能发生什么？",
  moreDetails: "展开看更多解释",
  typicalScenes: "典型场景",
  notSaying: "这不是在说你什么",
  shareLine: "适合分享的一句话",
  currentLimits: "当前结果怎么看",
  limitSummary:
    "这是一份求职前的路径适配风险预演。\n\n它帮你提前看见这类公司和岗位可能带来的适应压力，但不能替代真实岗位信息、面试反馈和一对一职业判断。",
  ctaTitle: "找工作还有其他卡点，可以继续看",
  ctaIntro:
    "如果你还在纠结方向、简历、面试、Offer 或试用期问题，可以关注「猎头季哥人才重估实验室」。这里会持续分享找工作中的判断方法、服务说明，以及优质岗位信息。",
  publicAccountLabel: "公众号",
  publicAccountName: "猎头季哥人才重估实验室",
  wecomLabel: "企业微信",
  wecomName: "关注公众号后，回复【重估】获取添加方式",
  ctaBoundary: "关注公众号或添加企业微信，不等于进入一对一服务，是否进一步沟通以后续实际问题为准。"
};

const TEXT = {
  notFound: "未找到测试记录",
  unavailable: "这个结果暂时不可用",
  restart: "请返回首页重新开始一次测试。",
  home: "返回首页",
  noValue: "未填写",
  debugInfo: "开发调试信息",
  warnings: "工程 warnings",
  warningTypes: "关键 warning 类型"
};

const COMPANY_TYPE_FIELD = "company_type";
const WORK_TYPE_FIELD = "work_type";

function getAnswerOption(questionId: string, answerId: string | undefined): QuestionOption | undefined {
  if (!answerId) return undefined;

  const question = QUESTION_CONFIG.questions.find((item) => item.id === questionId);
  return question?.options?.find((item) => item.id === answerId);
}

function getAnswerDisplayValue(questionId: string, answerId: string | undefined, fallback: string): string {
  const option = getAnswerOption(questionId, answerId);
  return option?.text ?? option?.label ?? fallback;
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

function ResultPage({ testSessionId }: ResultPageProps) {
  const [session, setSession] = useState<StoredTestSession | undefined>();
  const [resultData, setResultData] = useState<ResultPageData | undefined>();
  const [showMusicHint, setShowMusicHint] = useState(false);
  const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

  useEffect(() => {
    const storedSession = getStoredSession(testSessionId);
    setSession(storedSession);
    setResultData(storedSession ? buildResultPageData(storedSession) : undefined);
  }, [testSessionId]);

  const presentation = useMemo(() => {
    if (!resultData || !session) return undefined;

    const topRiskCardCopies = resolveTopRiskCardCopies(resultData.riskCardResult.topRiskCards);
    const primaryRiskCardCopy = resolvePrimaryRiskCardCopy(topRiskCardCopies);
    const companyTypeId = session.answers[COMPANY_TYPE_FIELD];
    const workTypeId = session.answers[WORK_TYPE_FIELD];
    const companyTypeLabel = getAnswerDisplayValue(COMPANY_TYPE_FIELD, companyTypeId, FALLBACK_COMPANY_LABEL);
    const workTypeLabel = getAnswerDisplayValue(WORK_TYPE_FIELD, workTypeId, FALLBACK_WORK_LABEL);
    const experience = buildResultExperiencePresentation({
      riskCardId: primaryRiskCardCopy.cardId,
      isFallback: primaryRiskCardCopy.isFallback,
      companyTypeId,
      workTypeId,
      companyTypeLabel,
      workTypeLabel,
      primaryRiskName: primaryRiskCardCopy.copy.displayName,
      primaryRiskPrompt: primaryRiskCardCopy.copy.oneLineRiskPrompt,
      primaryRiskSummary: primaryRiskCardCopy.copy.resultShortCopy
    });

    return {
      topRiskCardCopies,
      primaryRiskCardCopy,
      experience,
      copyStatusForDebug: buildRiskCopyStatusSummary([primaryRiskCardCopy]),
      warningSummary: summarizeWarnings(resultData.warnings),
      debugKeys: buildDebugKeySummary(resultData)
    };
  }, [resultData, session]);

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

  const primaryCopy = presentation.primaryRiskCardCopy.copy;
  const experience = presentation.experience;

  return (
    <main className={`result-shell result-experience-shell scene-${experience.sceneMood} band-${experience.pathFitBand.toLowerCase()}`}>
      <section className="result-page result-experience-page" aria-labelledby="result-title">
        <section className="scene-hero" aria-labelledby="result-title">
          <button
            className="audio-toggle"
            type="button"
            aria-describedby="music-hint"
            onClick={() => setShowMusicHint((current) => !current)}
          >
            <span>{RESULT_TEXT.audioLabel}</span>
            <small>{experience.musicMoodLabel}</small>
          </button>

          <div className="scene-visual" aria-hidden="true">
            <span className="scene-sun" />
            <span className="scene-road" />
            <span className="scene-wave" />
            <span className="scene-building scene-building-left" />
            <span className="scene-building scene-building-right" />
          </div>

          <div className="scene-hero-content">
            <p className="eyebrow">{RESULT_TEXT.heroIntro}</p>
            <h1 id="result-title">{RESULT_TEXT.heroTitle}</h1>
            <p className="scene-title">{experience.sceneTitle}</p>
            <p className="scene-subtitle">{experience.sceneSubtitle}</p>
            <div className="path-chips" aria-label={RESULT_TEXT.selectedPath}>
              <span>{experience.companyTypeLabel}</span>
              <span>{experience.workTypeLabel}</span>
            </div>
            <p className="scene-verdict-line">{experience.verdictTitle}</p>
            {showMusicHint ? (
              <p className="music-future-note" id="music-hint">
                {RESULT_TEXT.audioHint}
              </p>
            ) : null}
          </div>
        </section>

        <section className="result-section result-card-section path-card" aria-labelledby="path-title">
          <p className="eyebrow">{RESULT_TEXT.selectedPath}</p>
          <h2 id="path-title">
            {experience.companyTypeLabel}里的{experience.workTypeLabel}
          </h2>
        </section>

        <section className="result-section metric-grid" aria-label="路径适配风险预演指标">
          <article className="metric-card">
            <p className="eyebrow">{RESULT_TEXT.metricPathFit}</p>
            <strong>{experience.pathFitPercent}%</strong>
            <span>{experience.pathFitLabel}</span>
          </article>
          <article className="metric-card">
            <p className="eyebrow">{RESULT_TEXT.metricSixMonth}</p>
            <strong>{experience.sixMonthExitRiskLevel}</strong>
            <span>风险指数：{experience.sixMonthExitRiskIndex}/100</span>
          </article>
          <article className="metric-card">
            <p className="eyebrow">{RESULT_TEXT.metricAge30}</p>
            <strong>{experience.age30AnxietyRiskLevel}</strong>
            <span>风险指数：{experience.age30AnxietyRiskIndex}/100</span>
          </article>
        </section>

        <p className="metric-note">{RESULT_TEXT.metricNote}</p>

        <section className="result-section result-card-section verdict-card" aria-labelledby="verdict-title">
          <p className="eyebrow">{RESULT_TEXT.verdictQuestion}</p>
          <h2 id="verdict-title">{experience.verdictTitle}</h2>
          <p>{experience.verdictBody}</p>
        </section>

        <section className="result-section result-card-section" aria-labelledby="expectation-title">
          <h2 id="expectation-title">{RESULT_TEXT.expectationTitle}</h2>
          <div className="expectation-grid">
            <section className="expectation-panel" aria-label={RESULT_TEXT.companyExpectation}>
              <p className="eyebrow">{experience.companyTypeLabel}</p>
              <h3>{RESULT_TEXT.companyExpectation}</h3>
              <TextList items={experience.companyExpectation} />
            </section>
            <section className="expectation-panel" aria-label={RESULT_TEXT.workExpectation}>
              <p className="eyebrow">{experience.workTypeLabel}</p>
              <h3>{RESULT_TEXT.workExpectation}</h3>
              <TextList items={experience.workExpectation} />
            </section>
          </div>
        </section>

        <section className="result-section result-card-section friction-card" aria-labelledby="friction-title">
          <h2 id="friction-title">{RESULT_TEXT.sensitivePoint}</h2>
          <p className="risk-prompt">{primaryCopy.displayName}</p>
          <p>{primaryCopy.oneLineRiskPrompt}</p>
          <p>{primaryCopy.resultShortCopy}</p>
        </section>

        <section className="result-section result-card-section outcome-card" aria-labelledby="outcome-title">
          <h2 id="outcome-title">{RESULT_TEXT.possibleOutcome}</h2>
          <p>{experience.sixMonthExitRiskCopy}</p>
          <p>{experience.age30AnxietyRiskCopy}</p>
          <p>{experience.adaptationCostCopy}</p>
        </section>

        <details className="result-section result-card-section result-more-details">
          <summary>{RESULT_TEXT.moreDetails}</summary>
          <div className="result-more-content">
            <section className="result-card-block" aria-label={RESULT_TEXT.typicalScenes}>
              <h3>{RESULT_TEXT.typicalScenes}</h3>
              <TextList items={primaryCopy.typicalScenes} />
            </section>

            <section className="result-card-block" aria-label={RESULT_TEXT.notSaying}>
              <h3>{RESULT_TEXT.notSaying}</h3>
              <p>{primaryCopy.notSaying}</p>
            </section>

            <section className="result-card-block share-copy" aria-label={RESULT_TEXT.shareLine}>
              <h3>{RESULT_TEXT.shareLine}</h3>
              <p>{primaryCopy.shareShortCopy}</p>
            </section>
          </div>
        </details>

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
                <dd>{presentation.copyStatusForDebug}</dd>
              </div>
              <div>
                <dt>animation / music mood</dt>
                <dd>
                  {experience.animationPreset} / {experience.musicMoodKey}
                </dd>
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
