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
const MAX_VISIBLE_VALIDATION_ITEMS = 3;
const FALLBACK_COMPANY_LABEL = "暂未明确的公司类型";
const FALLBACK_WORK_LABEL = "暂未明确的岗位类型";

const RESULT_TEXT = {
  heroTitle: "第一份工作选择预演",
  heroIntro: "这是基于你当前选择生成的路径预演，不是正式职业诊断。",
  audioOn: "氛围音乐入口：已开启",
  audioOff: "氛围音乐入口：未开启",
  audioNote: "暂不播放真实音频",
  selectedPath: "你这次选择的是：",
  verdictQuestion: "你选的这条路，适不适合你？",
  scenePrompt: "你可以把这条路想象成：",
  expectationTitle: "这类公司和岗位，通常更希望新人具备什么？",
  companyExpectation: "这类公司通常更希望新人具备：",
  workExpectation: "这类岗位通常更希望新人具备：",
  possibleFriction: "如果强行选择，可能会卡在哪里？",
  thinkingTitle: "如果继续走这条路，先想清楚 3 件事",
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
    "如果你还在纠结方向、简历、面试、Offer 或试用期问题，可以关注「猎头季哥人才重估实验室」。这里会持续分享找工作中的判断方法、服务说明，以及优质岗位信息。",
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
  const [isAudioEntryOn, setIsAudioEntryOn] = useState(false);
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
      visibleValidationItems: primaryRiskCardCopy.copy.preChoiceValidationChecklist.slice(0, MAX_VISIBLE_VALIDATION_ITEMS),
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
    <main className={`result-shell result-experience-shell scene-${experience.sceneMood}`}>
      <section className="result-page result-experience-page" aria-labelledby="result-title">
        <section className="scene-hero" aria-labelledby="result-title">
          <button
            className="audio-toggle"
            type="button"
            aria-pressed={isAudioEntryOn}
            onClick={() => setIsAudioEntryOn((current) => !current)}
          >
            <span>{isAudioEntryOn ? RESULT_TEXT.audioOn : RESULT_TEXT.audioOff}</span>
            <small>{RESULT_TEXT.audioNote}</small>
          </button>

          <div className="scene-visual" aria-hidden="true">
            <span className="scene-sun" />
            <span className="scene-road" />
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
          </div>
        </section>

        <section className="result-section result-card-section path-card" aria-labelledby="path-title">
          <p className="eyebrow">{RESULT_TEXT.selectedPath}</p>
          <h2 id="path-title">
            {experience.companyTypeLabel}里的{experience.workTypeLabel}
          </h2>
        </section>

        <section className="result-section result-card-section verdict-card" aria-labelledby="verdict-title">
          <p className="eyebrow">{primaryCopy.displayName}</p>
          <h2 id="verdict-title">{RESULT_TEXT.verdictQuestion}</h2>
          <p className="verdict-title">{experience.verdictTitle}</p>
          <p>{experience.verdictBody}</p>
        </section>

        <section className="result-section result-card-section scene-narrative-card" aria-labelledby="scene-title">
          <p className="eyebrow">{RESULT_TEXT.scenePrompt}</p>
          <h2 id="scene-title">{experience.sceneTitle}</h2>
          <p>{experience.sceneNarrative}</p>
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
          <h2 id="friction-title">{RESULT_TEXT.possibleFriction}</h2>
          <p className="risk-prompt">{primaryCopy.oneLineRiskPrompt}</p>
          <p>{primaryCopy.resultShortCopy}</p>
          <TextList items={experience.longTermImpactCopy} />
        </section>

        <section className="result-section result-card-section thinking-card" aria-labelledby="thinking-title">
          <h2 id="thinking-title">{RESULT_TEXT.thinkingTitle}</h2>
          <TextList items={presentation.visibleValidationItems} className="validation-list" />
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

            <section className="result-card-block" aria-label={RESULT_TEXT.riskReductionActions}>
              <h3>{RESULT_TEXT.riskReductionActions}</h3>
              <TextList items={primaryCopy.riskReductionActions} />
            </section>

            <section className="result-card-block" aria-label={RESULT_TEXT.whoToAsk}>
              <h3>{RESULT_TEXT.whoToAsk}</h3>
              <p>{primaryCopy.whoToAsk}</p>
            </section>

            <section className="result-card-block" aria-label={RESULT_TEXT.jiGeCanHelpWith}>
              <h3>{RESULT_TEXT.jiGeCanHelpWith}</h3>
              <p>{primaryCopy.jiGeCanHelpWith}</p>
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
                <dd>{presentation.copyStatusForDebug}</dd>
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
