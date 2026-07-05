import { useState } from "react";
import type { ReactNode } from "react";
import GoalFitHeader from "../components/GoalFitHeader";
import { navigateTo } from "../lib/router";
import { getGoalFitSession } from "../lib/goalFitSessionStore";
import type { GoalFitRiskInsightSeverity, GoalFitResult } from "../lib/goalFitTypes";

const severityLabels: Record<GoalFitRiskInsightSeverity, string> = {
  high: "需要重点确认",
  medium: "建议提前确认",
  low: "作为参考"
};

const screenLabels = ["总判断", "适配拆解", "风险行动"];

type ResultBand = "high" | "medium" | "low";

type DimensionCard = {
  title: string;
  value: number;
  explanation: string;
  reminder: string;
};

function getResultBand(score: number): ResultBand {
  if (score >= 80) return "high";
  if (score >= 65) return "medium";
  return "low";
}

function getOverallScoreText(score: number): string {
  if (score >= 80) {
    return "这个方向可以作为当前求职的优先方向，但仍需要提前处理关键风险点。";
  }

  if (score >= 65) {
    return "这个方向有机会，但不建议盲投。你需要先补齐门槛、表达或岗位理解上的短板。";
  }

  return "这个方向当前风险较高，不建议直接作为第一优先方向。更适合先做准备、换切入点，或选择更匹配的岗位组合。";
}

function getFirstScreenAdvice(score: number): string {
  if (score >= 80) {
    return "这个目标可以优先推进，但简历和面试里要提前解释你的关键优势，不要只靠兴趣和意愿表达。";
  }

  if (score >= 65) {
    return "先不要盲目扩大投递量，优先补齐最影响反馈的门槛项，并准备一套解释你为什么适合这个岗位的表达。";
  }

  return "先把这个目标作为观察方向，不要马上作为主投方向。可以通过实习、项目、课程、作品或更接近的岗位切入，降低第一份工作的试错成本。";
}

function getScoreExplanation(score: number): { summary: string; reminder: string } {
  if (score >= 80) {
    return {
      summary: "匹配度较高，说明这一维度对你是加分项。",
      reminder: "继续确认具体团队和岗位边界，别只看大方向。"
    };
  }

  if (score >= 65) {
    return {
      summary: "有一定匹配度，但还需要提前准备或验证。",
      reminder: "建议先补足这一项，再集中投入目标机会。"
    };
  }

  return {
    summary: "当前存在明显风险，需要先补齐或降低目标难度。",
    reminder: "不要急着盲投，先找到更稳的切入点。"
  };
}

function buildCompanyDimensions(result: GoalFitResult): DimensionCard[] {
  const { scores } = result;
  const companyAdaptationScore = Math.round(
    (scores.companyPersonalityScore + scores.companyBehaviorScore) / 2
  );

  return [
    {
      title: "你的性格和该类型公司的匹配度",
      value: scores.companyPersonalityScore,
      explanation:
        "这个分数看的是你的职场底色，是否容易适应这类公司的节奏、规则和人际环境。",
      reminder: getScoreExplanation(scores.companyPersonalityScore).reminder
    },
    {
      title: "你现在进入该类型公司的准备情况",
      value: scores.companyEntryScore,
      explanation:
        "这个分数看的是你的学历、经历、项目和基础门槛，是否足够支撑你进入这类公司。",
      reminder: getScoreExplanation(scores.companyEntryScore).reminder
    },
    {
      title: "你入职后的适应度",
      value: companyAdaptationScore,
      explanation:
        "这个分数看的是你进入之后能不能稳定跟上节奏，而不是只看能不能拿到面试。",
      reminder: getScoreExplanation(companyAdaptationScore).reminder
    },
    {
      title: "你的做事风格和该类型公司的匹配度",
      value: scores.companyBehaviorScore,
      explanation:
        "这个分数看的是你处理任务、反馈、协作和压力的方式，是否适合这类公司环境。",
      reminder: getScoreExplanation(scores.companyBehaviorScore).reminder
    }
  ];
}

function buildRoleDimensions(result: GoalFitResult): DimensionCard[] {
  const { scores } = result;
  const roleStyleScore = Math.round((scores.roleFitScore + scores.roleBehaviorScore) / 2);

  return [
    {
      title: "你的性格和该类型岗位的匹配度",
      value: scores.rolePersonalityScore,
      explanation:
        "这个分数看的是你的性格底色，是否适合这个岗位长期面对的人、事和压力。",
      reminder: getScoreExplanation(scores.rolePersonalityScore).reminder
    },
    {
      title: "你现在对该岗位的胜任准备度",
      value: scores.roleEntryScore,
      explanation:
        "这个分数看的是你目前的经历、能力证据和基础准备，是否支撑你进入这个岗位。",
      reminder: getScoreExplanation(scores.roleEntryScore).reminder
    },
    {
      title: "你面对该岗位典型场景的适应度",
      value: scores.roleBehaviorScore,
      explanation:
        "这个分数看的是你遇到真实工作场景时，能不能做出接近岗位要求的反应。",
      reminder: getScoreExplanation(scores.roleBehaviorScore).reminder
    },
    {
      title: "你的做事风格和岗位要求的匹配度",
      value: roleStyleScore,
      explanation:
        "这个分数看的是你的推进方式、沟通方式和解决问题方式，是否符合这个岗位的真实要求。",
      reminder: getScoreExplanation(roleStyleScore).reminder
    }
  ];
}

function getFitGapAdvice(result: GoalFitResult): string {
  const { companyFitScore, roleFitScore } = result.scores;
  const gap = companyFitScore - roleFitScore;

  if (gap <= -8) {
    return "你对这个岗位方向不一定差，但当前公司类型可能不是最容易放大你的环境。建议先看更适合你节奏和资源条件的公司类型。";
  }

  if (gap >= 8) {
    return "你选择的公司类型可能有机会，但岗位方向需要重新验证。建议先补岗位理解、项目经历或表达方式。";
  }

  if (companyFitScore >= 75 && roleFitScore >= 75) {
    return "公司和岗位组合整体较顺，可以作为当前优先方向，但仍要准备好解释你的关键优势和风险点。";
  }

  if (companyFitScore < 65 && roleFitScore < 65) {
    return "当前组合不建议盲投。建议先调整目标组合，或者通过实习、项目、作品和更低门槛岗位切入。";
  }

  return "公司和岗位之间没有明显单边短板，下一步更适合具体看团队、岗位职责和你能拿出的证明材料。";
}

function getReportFromUrl(): GoalFitResult | null {
  const params = new URLSearchParams(window.location.search);
  const reportId = params.get("session");

  if (!reportId) return null;

  return getGoalFitSession(reportId)?.result ?? null;
}

function GoalFitPageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="goal-fit-shell goal-fit-result-shell">
      <GoalFitHeader />
      {children}
    </main>
  );
}

function DimensionFitCard({ card }: { card: DimensionCard }) {
  const copy = getScoreExplanation(card.value);

  return (
    <article className={`goal-fit-result-dimension-card ${getResultBand(card.value)}`}>
      <div className="goal-fit-result-dimension-top">
        <h3>{card.title}</h3>
        <strong>{card.value}%</strong>
      </div>
      <p className="goal-fit-result-dimension-summary">{copy.summary}</p>
      <p>{card.explanation}</p>
      <p className="goal-fit-result-dimension-reminder">{card.reminder}</p>
    </article>
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
    <ol className="goal-fit-result-progress" aria-label="结果阅读进度">
      {screenLabels.map((label, index) => (
        <li key={label}>
          <button
            className={index === currentScreen ? "active" : ""}
            type="button"
            onClick={() => onChange(index)}
          >
            <span>{index + 1}</span>
            {label}
          </button>
        </li>
      ))}
    </ol>
  );
}

function MissingReportPage() {
  return (
    <GoalFitPageFrame>
      <section className="goal-fit-panel goal-fit-result-empty">
        <p className="goal-fit-eyebrow">报告未找到</p>
        <h1>没有找到本次报告</h1>
        <div className="goal-fit-empty-visual" aria-hidden="true">
          <span />
          <i />
        </div>
        <p>
          可能是浏览器记录被清理，或者你打开的报告链接已经失效。你可以重新完成一次目标适配判断。
        </p>
        <button
          className="primary-button"
          type="button"
          onClick={() => navigateTo("/test-goal-fit-preview")}
        >
          重新开始路径预演
        </button>
      </section>
    </GoalFitPageFrame>
  );
}

function GoalFitResultPage() {
  const [currentResultScreen, setCurrentResultScreen] = useState(0);
  const result = getReportFromUrl();

  if (!result) return <MissingReportPage />;

  const { scores } = result;
  const riskInsights = result.riskInsights.slice(0, 3);
  const recommendations = result.recommendations.slice(0, 3);
  const companyDimensions = buildCompanyDimensions(result);
  const roleDimensions = buildRoleDimensions(result);

  return (
    <GoalFitPageFrame>
      <section className="goal-fit-panel goal-fit-result-frame">
        <header className="goal-fit-result-header">
          <h1>目标适配报告</h1>
          <p>
            根据你的测试结果，你选择的公司类型、岗位类型与你当前状态的适配程度如下。
          </p>
          <ScreenDots currentScreen={currentResultScreen} onChange={setCurrentResultScreen} />
        </header>

        {currentResultScreen === 0 ? (
          <section className="goal-fit-result-screen">
            <p className="goal-fit-eyebrow">先看总判断</p>
            <div className="goal-fit-result-split">
              <div className="goal-fit-result-primary">
                <div className="goal-fit-result-overview goal-fit-result-judgement">
                  <div className="goal-fit-result-main-score">
                    <span>当前匹配度</span>
                    <strong>{scores.overallScore}%</strong>
                  </div>
                  <div>
                    <h2>
                      你选择的「{result.targetCompanyLabel}」类型公司 ×「{result.targetRoleLabel}」
                      岗位，当前匹配度是 {scores.overallScore}%
                    </h2>
                    <p>
                      这里不是评价你优秀不优秀，而是判断这个目标能不能作为你当前求职的第一优先方向。
                    </p>
                    <p>{getOverallScoreText(scores.overallScore)}</p>
                  </div>
                </div>
                <article className="goal-fit-result-human-card">
                  <h3>针对你的情况，我们建议：</h3>
                  <p>{getFirstScreenAdvice(scores.overallScore)}</p>
                </article>
              </div>
              <aside className="goal-fit-result-side-card">
                <p className="goal-fit-eyebrow">当前预演</p>
                <div className="goal-fit-result-path">
                  <span>公司类型：{result.targetCompanyLabel}</span>
                  <span>岗位类型：{result.targetRoleLabel}</span>
                </div>
                <p className="goal-fit-result-score-explain">
                  当前报告只看你选择的目标组合和当前准备状态之间的匹配度，不是能力评价。
                </p>
              </aside>
            </div>
            <div className="goal-fit-result-actions">
              <p className="goal-fit-result-action-copy">
                接下来，我们看具体公司类型和岗位类型与你之间的差距。
              </p>
              <button
                className="primary-button"
                type="button"
                onClick={() => setCurrentResultScreen(1)}
              >
                看具体差距
              </button>
            </div>
          </section>
        ) : null}

        {currentResultScreen === 1 ? (
          <section className="goal-fit-result-screen">
            <p className="goal-fit-eyebrow">适配拆解</p>
            <div className="goal-fit-result-fit-grid goal-fit-result-dimension-groups">
              <section className="goal-fit-result-fit-card">
                <div className="goal-fit-result-group-heading">
                  <h2>你和目标公司类型的匹配度</h2>
                  <p>
                    这里看的是：你选择的公司环境，是否适合你当前的背景、性格、做事方式和适应节奏。
                  </p>
                </div>
                <div className="goal-fit-result-dimension-grid">
                  {companyDimensions.map((card) => (
                    <DimensionFitCard card={card} key={card.title} />
                  ))}
                </div>
              </section>

              <section className="goal-fit-result-fit-card">
                <div className="goal-fit-result-group-heading">
                  <h2>你和目标岗位类型的匹配度</h2>
                  <p>
                    这里看的是：你选择的岗位方向，是否适合你的性格底色、当前准备、典型工作场景和做事方式。
                  </p>
                </div>
                <div className="goal-fit-result-dimension-grid">
                  {roleDimensions.map((card) => (
                    <DimensionFitCard card={card} key={card.title} />
                  ))}
                </div>
              </section>

              <article className="goal-fit-result-note-card goal-fit-result-gap-advice">
                <h3>针对你的情况，我们建议：</h3>
                <p>{getFitGapAdvice(result)}</p>
              </article>
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
                看风险行动
              </button>
            </div>
          </section>
        ) : null}

        {currentResultScreen === 2 ? (
          <section className="goal-fit-result-screen">
            <p className="goal-fit-eyebrow">最后看风险行动</p>
            <div className="goal-fit-result-split">
              <div className="goal-fit-result-primary">
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
              </div>
              <aside className="goal-fit-result-section goal-fit-result-cta goal-fit-result-side-card">
                <h2>如果你还想继续看清求职方向</h2>
                <p>可以关注公众号：</p>
                <strong>猎头季哥人才重估实验室</strong>
                <div className="goal-fit-result-cta-note">
                  <p>我会继续讲：</p>
                  <ul>
                    <li>第一份工作怎么选</li>
                    <li>简历怎么改</li>
                    <li>面试怎么说</li>
                    <li>哪些岗位不能盲投</li>
                  </ul>
                </div>
              </aside>
            </div>

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
    </GoalFitPageFrame>
  );
}

export default GoalFitResultPage;
