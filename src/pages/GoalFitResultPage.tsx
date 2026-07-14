import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import GoalFitHeader from "../components/GoalFitHeader";
import { IS_PRODUCTION } from "../config/api";
import { buildGoalFitResult } from "../lib/goalFitResultBuilder";
import { goalFitQuestionBank } from "../lib/goalFitQuestionBank";
import { selectGoalFitQuestions } from "../lib/goalFitQuestionSelector";
import { navigateTo } from "../lib/router";
import { getGoalFitSession } from "../lib/goalFitSessionStore";
import { getGoalFitUnlockStatusFromApi } from "../lib/goalFitOrderStore";
import { isGoalFitReportUnlocked } from "../lib/goalFitUnlockStore";
import type {
  CompanyType,
  GoalFitAnswerMap,
  GoalFitResult,
  GoalFitRiskInsightSeverity,
  RoleType
} from "../lib/goalFitTypes";

const severityLabels: Record<GoalFitRiskInsightSeverity, string> = {
  high: "需要重点确认",
  medium: "建议提前确认",
  low: "作为参考"
};

const screenLabels = ["你的整体情况", "工作适配拆解", "建议求职行动"];

type ResultBand = "high" | "medium" | "low";

type DimensionCard = {
  title: string;
  value: number;
  explanation: string;
  reminder: string;
};

type NarrativeBlock = {
  title: string;
  body: string;
};

type ActionRiskType = "entry_gap" | "style_adaptation" | "role_evidence" | "target_validation";

type ActionAdvice = {
  priorityProblem: string;
  nextStep: string;
  styleGuidance: string;
};

type ReportContext = {
  result: GoalFitResult | null;
  sessionId: string | null;
  isSample: boolean;
  isUnlocked: boolean;
};

function getResultBand(score: number): ResultBand {
  if (score >= 80) return "high";
  if (score >= 65) return "medium";
  return "low";
}

function getOverallScoreText(score: number): string {
  if (score >= 80) {
    return "匹配度较高，这个方向可以作为当前求职的优先方向。";
  }

  if (score >= 65) {
    return "中等偏上，这个方向可以尝试，但不建议盲目当成唯一第一选择。";
  }

  if (score >= 50) {
    return "这个方向有机会，但当前风险偏高，不建议直接作为主投方向。";
  }

  return "当前不建议把这个方向作为第一优先选择。";
}

function getFirstScreenAdvice(score: number): string {
  if (score >= 80) {
    return "你和这类公司、这类岗位之间有比较明显的适配基础。接下来更重要的不是换方向，而是把你的优势在简历和面试里讲清楚。";
  }

  if (score >= 65) {
    return "你和这类公司、岗位有一定匹配基础，但仍有几个关键差距，会影响后续的筛选通过率和入职适应度。";
  }

  if (score >= 50) {
    return "你和这个目标之间存在一些明显磨合点。如果直接投，可能会遇到反馈少、面试解释不清，或者入职后不适应的问题。";
  }

  return "这不代表你以后不能做，而是以你现在的准备状态，直接冲这个方向试错成本较高。更稳的做法是先换切入点，或者补齐关键准备。";
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

function createSampleResult(): GoalFitResult {
  const targetCompany: CompanyType = "D";
  const targetRole: RoleType = "TECH";
  const selectedQuestions = selectGoalFitQuestions(goalFitQuestionBank, targetRole);
  const answers = Object.fromEntries(
    selectedQuestions.map((question) => [question.id, question.options[0]?.id ?? ""])
  ) as GoalFitAnswerMap;

  return buildGoalFitResult({
    questionBank: goalFitQuestionBank,
    answers,
    targetCompany,
    targetRole
  });
}

function getReportContextFromUrl(): ReportContext {
  const params = new URLSearchParams(window.location.search);
  const sample = params.get("sample");
  const reportId = params.get("session");

  if (sample === "high_fit") {
    return {
      result: createSampleResult(),
      sessionId: null,
      isSample: true,
      isUnlocked: true
    };
  }

  if (!reportId) {
    return { result: null, sessionId: null, isSample: false, isUnlocked: false };
  }

  return {
    result: getGoalFitSession(reportId)?.result ?? null,
    sessionId: reportId,
    isSample: false,
    isUnlocked: isGoalFitReportUnlocked(reportId)
  };
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

function NarrativeCard({ card }: { card: NarrativeBlock }) {
  return (
    <article className="goal-fit-result-narrative-card">
      <div className="goal-fit-result-narrative-top">
        <h3>{card.title}</h3>
      </div>
      <p>{card.body}</p>
    </article>
  );
}

function getCompanyNarrativeCopy(targetCompanyLabel: string) {
  if (/国企|事业|央国企/.test(targetCompanyLabel)) {
    return {
      hiringStyle:
        "这类组织通常更重视稳定性、规则意识、材料完整度和长期投入。招聘端会先看你是不是能进入基本筛选池，再看你的表达是否稳、经历是否能支撑岗位要求。",
      currentState:
        "你现在需要确认的不是喜不喜欢稳定，而是能不能把自己的经历讲成一套可靠、可交付、能融入组织节奏的故事。",
      workFeeling:
        "进入之后，你可能会面对更清晰的层级、更慢的反馈和更重的流程感。适应得好的人，往往能在规则里持续推进；不适应的人，容易觉得节奏慢、边界不清或反馈不够直接。",
      entryBarrier:
        "入门门槛通常来自学历、专业相关度、实习经历、项目证明和表达稳定性。你现在要做的是把已有经历整理成招聘端能快速看懂的证据。"
    };
  }

  if (/大厂|平台/.test(targetCompanyLabel)) {
    return {
      hiringStyle:
        "这类公司通常更看重学习速度、结构化表达、项目经历和抗压能力。招聘端不只看你想不想进大平台，更会看你是否能跟上高密度协作和高标准交付。",
      currentState:
        "你目前更需要确认的是：你的经历里有没有能被快速识别的亮点，以及你能不能把问题拆清楚、把结果讲清楚。",
      workFeeling:
        "进入之后，你可能会遇到更快节奏、更高频反馈和更细的目标拆解。它能放大成长速度，也可能放大焦虑和自我怀疑。",
      entryBarrier:
        "入门门槛通常来自项目质量、实习含金量、表达逻辑和岗位理解。只说想进大厂不够，需要让招聘端看到你已经为这类环境做过准备。"
    };
  }

  if (/外企/.test(targetCompanyLabel)) {
    return {
      hiringStyle:
        "这类公司通常更看重沟通边界、协作方式、英文或跨文化表达，以及你对岗位职责的稳定理解。",
      currentState:
        "你现在要确认的是，自己是否能在相对清晰的规则里主动推进，而不是等别人把每一步都拆好。",
      workFeeling:
        "进入之后，你可能会感到流程更规范、沟通更讲边界，但也需要更主动地同步信息、管理预期和证明价值。",
      entryBarrier:
        "入门门槛通常来自语言表达、岗位相关经历、沟通成熟度和简历可信度。准备不足时，不是没机会，而是容易在筛选阶段被看不清。"
    };
  }

  if (/创业|初创/.test(targetCompanyLabel)) {
    return {
      hiringStyle:
        "这类公司通常更看重主动性、变化承受力、快速补位和把事情推到结果的能力。招聘端会在意你是否能接受边界不清和资源不足。",
      currentState:
        "你现在需要确认的是，自己是被新鲜感吸引，还是确实能在不确定环境里持续推进事情。",
      workFeeling:
        "进入之后，你可能会获得更大的参与感，也可能面对目标变化、反馈不稳定和一人多岗。适应得好会成长很快，适应不好会消耗明显。",
      entryBarrier:
        "入门门槛不一定只在学历上，更在于你能否拿出可迁移的项目、执行证据和解决问题的主动性。"
    };
  }

  if (/民企|中小|传统/.test(targetCompanyLabel)) {
    return {
      hiringStyle:
        "这类公司通常更看重能不能尽快上手、是否务实、是否能理解业务现场。招聘端会更关注你能带来什么具体帮助。",
      currentState:
        "你现在需要确认的是，自己能不能接受更直接的业务目标和更少的系统培训，而不是只看岗位名称是否体面。",
      workFeeling:
        "进入之后，你可能会更快接触真实业务，也可能遇到流程不够标准、带教不够系统和边界变化较多的情况。",
      entryBarrier:
        "入门门槛通常来自岗位理解、执行证据和沟通成熟度。你需要让对方相信，你不是只来学习，而是能尽快接住具体工作。"
    };
  }

  return {
    hiringStyle:
      "这类公司会用自己的节奏筛人、用人和培养新人。招聘端看的不是标签，而是你能否进入筛选池、能否稳定表达、能否适应真实工作环境。",
    currentState:
      "你现在需要确认的是，这个环境会放大你的优势，还是会让你的准备不足更明显。",
    workFeeling:
      "进入之后的体感，通常取决于反馈是否清楚、节奏是否能跟上、协作成本是否可承受。",
    entryBarrier:
      "入门门槛来自学历、经历、项目、表达证据和岗位理解。你需要把已有准备整理成招聘端能判断的材料。"
  };
}

function buildCompanyNarrativeBlocks(result: GoalFitResult): NarrativeBlock[] {
  const copy = getCompanyNarrativeCopy(result.targetCompanyLabel);

  return [
    {
      title: "这类公司的用人风格",
      body: copy.hiringStyle
    },
    {
      title: "你目前更像哪种状态",
      body: copy.currentState
    },
    {
      title: "如果你进入这类公司，可能会是什么体感",
      body: copy.workFeeling
    },
    {
      title: "这类公司的入门门槛，和你现在的准备",
      body: copy.entryBarrier
    }
  ];
}

function getRoleNarrativeCopy(targetRoleLabel: string) {
  if (/销售|商务/.test(targetRoleLabel)) {
    return {
      style:
        "这类岗位更希望你能主动接触人、持续跟进线索、接受被拒绝，并且能把客户需求转成下一步动作。",
      ability:
        "真正考验的是沟通推进、目标拆解、情绪恢复和持续复盘，而不是单纯外向或会聊天。",
      gap:
        "如果你缺少真实沟通、跟进、转化或项目推进证据，招聘端会很难判断你是否能扛住业务压力。",
      feeling:
        "真的做起来，你可能会在成交和反馈中获得成就感，也可能在高频拒绝、目标压力和不确定回报里感到消耗。"
    };
  }

  if (/运营|项目/.test(targetRoleLabel)) {
    return {
      style:
        "这类岗位更希望你能拆任务、盯进度、协调多人，并且在信息不完整时先把事情推起来。",
      ability:
        "真正考验的是执行节奏、跨人协作、问题拆解和持续复盘，而不是只会写计划。",
      gap:
        "如果你的经历里缺少活动、项目、流程推进或结果复盘，招聘端会难以判断你是否能接住真实项目。",
      feeling:
        "真的做起来，你可能会喜欢推进事情的掌控感，也可能被临时变化、多方沟通和反复修改消耗。"
    };
  }

  if (/内容|市场|品牌/.test(targetRoleLabel)) {
    return {
      style:
        "这类岗位更希望你能观察用户、理解传播场景、持续产出内容，并且愿意接受反馈和修改。",
      ability:
        "真正考验的是选题判断、表达能力、用户理解和数据反馈后的调整，而不是只看创意兴趣。",
      gap:
        "如果你缺少作品、账号、活动、传播案例或复盘材料，招聘端会很难判断你的能力是否能落到业务结果。",
      feeling:
        "真的做起来，你可能会享受表达和创作，也可能在频繁改稿、数据压力和热点节奏里感到不稳定。"
    };
  }

  if (/技术|数据|产品/.test(targetRoleLabel)) {
    return {
      style:
        "这类岗位更希望你能把复杂问题拆清楚，持续学习工具和方法，并且用项目或作品证明能力。",
      ability:
        "真正考验的是问题拆解、逻辑表达、工具使用、方案验证和长期学习，而不是只看是否感兴趣。",
      gap:
        "如果你缺少项目、作品、代码、分析报告或产品文档，招聘端会很难判断你是否能进入岗位筛选池。",
      feeling:
        "真的做起来，你可能会喜欢解决问题的成就感，也可能在长周期学习、反复调试和高标准交付里感到压力。"
    };
  }

  if (/职能|人力|财务|行政/.test(targetRoleLabel)) {
    return {
      style:
        "这类岗位更希望你稳、细、能守规则，也能在琐碎事务里保持耐心和准确度。",
      ability:
        "真正考验的是流程意识、细节稳定、沟通边界和责任心，而不是只看是否喜欢稳定。",
      gap:
        "如果你缺少事务处理、数据整理、流程协作或实习证明，招聘端会难以判断你能否稳定接住基础工作。",
      feeling:
        "真的做起来，你可能会喜欢秩序感，也可能在重复任务、细节要求和服务他人的场景里感到消耗。"
    };
  }

  return {
    style:
      "这类岗位更希望你能长期面对它的真实任务、交付要求和反馈方式，而不是只被岗位名称吸引。",
    ability:
      "真正考验的是理解问题、推进任务、处理反馈和持续学习的能力。",
    gap:
      "你目前需要确认自己是否已经有足够清楚的岗位证据，包括项目、作品、实习、工具能力和表达方式。",
    feeling:
      "真的做起来，你可能会在某些任务里获得成就感，也可能在高频反馈、重复推进或边界不清时感到消耗。"
  };
}

function buildRoleNarrativeBlocks(result: GoalFitResult): NarrativeBlock[] {
  const copy = getRoleNarrativeCopy(result.targetRoleLabel);

  return [
    {
      title: "这类岗位更希望的做事风格",
      body: copy.style
    },
    {
      title: "这个岗位真正考验什么能力",
      body: copy.ability
    },
    {
      title: "你目前和岗位要求之间的差距",
      body: copy.gap
    },
    {
      title: "如果你真的做这个岗位，可能会有什么感受",
      body: copy.feeling
    }
  ];
}

function getActionRiskType(result: GoalFitResult): ActionRiskType {
  const { scores } = result;
  const entryScore = Math.min(scores.companyEntryScore, scores.roleEntryScore);
  const styleScore = Math.min(
    scores.companyPersonalityScore,
    scores.companyBehaviorScore,
    scores.rolePersonalityScore,
    scores.roleBehaviorScore
  );
  const roleEvidenceScore = scores.roleEntryScore;
  const lowest = Math.min(entryScore, styleScore, roleEvidenceScore, scores.motivationFitScore);

  if (roleEvidenceScore === lowest && roleEvidenceScore <= 68) return "role_evidence";
  if (entryScore === lowest && entryScore <= 68) return "entry_gap";
  if (styleScore === lowest && styleScore <= 72) return "style_adaptation";
  if (scores.motivationFitScore === lowest && scores.motivationFitScore <= 72) {
    return "target_validation";
  }

  if (roleEvidenceScore <= entryScore && roleEvidenceScore <= styleScore) return "role_evidence";
  if (entryScore <= styleScore) return "entry_gap";
  if (styleScore <= 72) return "style_adaptation";
  return "target_validation";
}

function getRiskTypeSentence(riskType: ActionRiskType): string {
  if (riskType === "entry_gap") {
    return "你现在的问题更偏向“材料和证据还不够集中”。招聘端不一定会否定你这个人，但可能看不出你为什么已经有资格进入这个方向的筛选池。";
  }

  if (riskType === "role_evidence") {
    return "你现在的问题更偏向“岗位证据还不够清晰”。你可能对这个岗位有兴趣，但还需要证明自己做过接近的事情，理解它的真实工作，而不是只表达愿意尝试。";
  }

  if (riskType === "style_adaptation") {
    return "你现在的问题更偏向“风格适应”。这意味着你和目标之间不是能力单点差距，而是工作节奏、反馈方式、协作方式可能会持续消耗你。";
  }

  return "你现在的问题更偏向“目标验证不足”。在继续扩大投递前，需要先确认这个目标到底值不值得作为当前主线。";
}

function buildPriorityProblem(result: GoalFitResult, riskType: ActionRiskType): string {
  const targetText = result.targetCompanyLabel + " × " + result.targetRoleLabel;
  const riskSentence = getRiskTypeSentence(riskType);

  if (result.scores.overallScore >= 80) {
    return (
      "你现在最需要优先处理的，不是继续怀疑这个方向对不对，而是尽快把目标推进起来。\n\n" +
      "从结果看，「" +
      targetText +
      "」和你当前状态之间有比较好的适配基础。它不代表你一定不会遇到困难，但说明这条路值得作为当前求职的优先方向。\n\n" +
      "很多人在这个阶段会卡在“我是不是还要再准备得更完美一点”。但求职不是等你完全准备好了才开始，而是在投递、沟通、面试和反馈里不断校准。你现在更需要做的是：把简历调整到这个方向，把最能证明你的经历放到前面，然后尽快开始真实投递和真实沟通。\n\n" +
      riskSentence +
      "\n\n不要因为追求完美，错过了本来可以拿到反馈的机会。"
    );
  }

  if (result.scores.overallScore >= 65) {
    return (
      "你现在最需要优先处理的，是把这个目标从“我想试试”变成“我知道自己为什么能试”。\n\n" +
      "从结果看，「" +
      targetText +
      "」不是明显错配。你和这个方向之间有一定连接点，所以它可以尝试。但它还不是闭眼冲的方向。你需要先弄清楚：这类公司到底怎么筛人，这类岗位每天到底在处理什么问题，以及你现有经历能不能支撑这个目标。\n\n" +
      "如果你现在直接扩大投递，可能会出现一个问题：投了很多，但反馈不稳定；面试聊了几轮，却发现自己说不清为什么适合。你真正要优先处理的，不是多投几个岗位，而是先把目标验证清楚，把材料讲清楚。\n\n" +
      riskSentence
    );
  }

  return (
    "你现在最需要优先处理的，不是马上继续投递，而是认真想清楚：这个方向到底是你内心真正想走的路，还是你暂时被平台、岗位名称或外界期待吸引了。\n\n" +
    "从结果看，「" +
    targetText +
    "」和你当前状态之间存在比较明显的距离。这不代表你不能做，也不代表你不够好。它更像是在提醒你：如果你继续选择这个目标，就需要付出一段改变自己的成本；如果你更想保护自己的状态，也许需要重新选择一个更匹配的切入点。\n\n" +
    "第一份工作不是给人生下最终结论，但它会影响你接下来一两年的节奏、信心和成长体验。你可以遵从自己的内心，选择更舒服、更匹配的道路；也可以选择训练自己，去适应一个更现实、更有压力的目标。真正重要的是，你不要在没有看清代价的情况下盲目硬冲。\n\n" +
    riskSentence +
    "\n\n现在先停下来想清楚，再行动，比继续焦虑地海投更重要。"
  );
}

function buildNextStepAdvice(riskType: ActionRiskType): string {
  const sharedStart =
    "你现在要补的第一件事，不是马上扩大投递，而是先把目标验证清楚。\n\n" +
    "先找真实岗位描述、学长学姐经历、招聘 JD、面试问题，确认这个方向每天到底在处理什么人、什么任务、什么反馈。不要只根据岗位名称判断自己适不适合。很多岗位看起来相似，但真实工作场景、压力来源和评价标准完全不同。\n\n" +
    "如果你选择的是一个自己很向往、但当前匹配度不高的方向，就更要先做验证。你可以去看这个岗位的日常任务，找已经在这个方向工作的学长学姐聊一聊，整理 3-5 个真实面试问题，再回头判断：自己是真的想做，还是只是喜欢这个岗位听起来的样子。";

  const entryCopy =
    "如果你的问题来自入场准备不足，你需要补的是能被招聘方看见的材料：实习、项目、作品、课程案例、证书、比赛经历，或者一段能说明你解决过具体问题的经历。";
  const roleCopy =
    "如果你的问题来自岗位证据不足，你需要补的是“我为什么能做这个岗位”的证据。不要只说你喜欢、愿意学，而要能说清楚：你做过什么接近的事情，解决过什么问题，结果是什么，和目标岗位有什么关系。";
  const styleCopy =
    "如果你的问题来自风格适应风险，你需要补的是职场化能力：更清楚地理解目标，更稳定地完成任务，更成熟地接收反馈，更主动地和别人协作。";
  const materialCopy =
    "这些内容后面都可以转化到求职材料和面试表达里。材料里要让别人看到证据，面试里要让别人听懂你的判断。不要把求职材料写成经历清单，而是把它整理成“我为什么适合这个方向”的证明。";

  if (riskType === "entry_gap") {
    return [sharedStart, entryCopy, roleCopy, styleCopy, materialCopy].join("\n\n");
  }

  if (riskType === "role_evidence") {
    return [sharedStart, roleCopy, entryCopy, styleCopy, materialCopy].join("\n\n");
  }

  if (riskType === "style_adaptation") {
    return [sharedStart, styleCopy, entryCopy, roleCopy, materialCopy].join("\n\n");
  }

  return [sharedStart, entryCopy, roleCopy, styleCopy, materialCopy].join("\n\n");
}

function buildActionAdvice(result: GoalFitResult): ActionAdvice {
  const riskType = getActionRiskType(result);

  if (riskType === "entry_gap") {
    return {
      priorityProblem: buildPriorityProblem(result, riskType),
      nextStep: buildNextStepAdvice(riskType),
      styleGuidance:
        "性格和做事风格差距，不等于你不适合工作。它更像一个提醒：你需要避开最容易消耗自己的团队和岗位形态。\n\n有些人适合目标明确、反馈稳定、边界清楚的环境；有些人适合变化更快、空间更大、要求更主动的环境。你现在要做的，不是简单否定自己，而是看清楚：什么样的节奏会让你发挥，什么样的协作方式会持续消耗你。\n\n从校园进入职场，本来就需要一次适应。过去你可以更多根据兴趣、舒适感和个人节奏做事，但工作会要求你面对目标、规则、反馈、协作和压力。这个过程不会一直舒服，但它是很多人真正开始成熟的地方。\n\n你可以选择更匹配自己的道路，也可以选择训练自己，去适应更现实的社会环境。关键是不要盲目硬冲，也不要因为一个结果就否定自己。你需要做的是：看清差距，选对团队，给自己一段有方向的调整期。"
    };
  }

  if (riskType === "style_adaptation") {
    return {
      priorityProblem: buildPriorityProblem(result, riskType),
      nextStep: buildNextStepAdvice(riskType),
      styleGuidance:
        "性格和做事风格差距，不等于你不适合工作。它更像一个提醒：你需要避开最容易消耗自己的团队和岗位形态。\n\n有些人适合目标明确、反馈稳定、边界清楚的环境；有些人适合变化更快、空间更大、要求更主动的环境。你现在要做的，不是简单否定自己，而是看清楚：什么样的节奏会让你发挥，什么样的协作方式会持续消耗你。\n\n从校园进入职场，本来就需要一次适应。过去你可以更多根据兴趣、舒适感和个人节奏做事，但工作会要求你面对目标、规则、反馈、协作和压力。这个过程不会一直舒服，但它是很多人真正开始成熟的地方。\n\n你可以选择更匹配自己的道路，也可以选择训练自己，去适应更现实的社会环境。关键是不要盲目硬冲，也不要因为一个结果就否定自己。你需要做的是：看清差距，选对团队，给自己一段有方向的调整期。"
    };
  }

  if (riskType === "role_evidence") {
    return {
      priorityProblem: buildPriorityProblem(result, riskType),
      nextStep: buildNextStepAdvice(riskType),
      styleGuidance:
        "性格和做事风格差距，不等于你不适合工作。它更像一个提醒：你需要避开最容易消耗自己的团队和岗位形态。\n\n有些人适合目标明确、反馈稳定、边界清楚的环境；有些人适合变化更快、空间更大、要求更主动的环境。你现在要做的，不是简单否定自己，而是看清楚：什么样的节奏会让你发挥，什么样的协作方式会持续消耗你。\n\n从校园进入职场，本来就需要一次适应。过去你可以更多根据兴趣、舒适感和个人节奏做事，但工作会要求你面对目标、规则、反馈、协作和压力。这个过程不会一直舒服，但它是很多人真正开始成熟的地方。\n\n如果你担心自己的风格不完全贴合岗位，可以先用小项目验证。真实体验会比想象更准确，也能帮你判断哪些任务让你有能量、哪些任务会消耗你。"
    };
  }

  return {
    priorityProblem: buildPriorityProblem(result, riskType),
    nextStep: buildNextStepAdvice(riskType),
    styleGuidance:
      "性格和做事风格差距，不等于你不适合工作。它更像一个提醒：你需要避开最容易消耗自己的团队和岗位形态。\n\n有些人适合目标明确、反馈稳定、边界清楚的环境；有些人适合变化更快、空间更大、要求更主动的环境。你现在要做的，不是简单否定自己，而是看清楚：什么样的节奏会让你发挥，什么样的协作方式会持续消耗你。\n\n从校园进入职场，本来就需要一次适应。过去你可以更多根据兴趣、舒适感和个人节奏做事，但工作会要求你面对目标、规则、反馈、协作和压力。这个过程不会一直舒服，但它是很多人真正开始成熟的地方。\n\n关键是不要盲目硬冲，也不要因为一个结果就否定自己。"
  };
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

function LockedReportPage({ sessionId }: { sessionId: string }) {
  return (
    <GoalFitPageFrame>
      <section className="goal-fit-panel goal-fit-result-empty goal-fit-result-locked">
        <p className="goal-fit-eyebrow">完整报告已生成</p>
        <h1>请先解锁完整目标适配报告</h1>
        <p>你的总判断、最大风险点和完整报告预览已经生成。解锁后可以继续查看公司差距、岗位差距和具体行动建议。</p>
        <div className="goal-fit-result-actions goal-fit-locked-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => navigateTo(`/goal-fit-unlock-preview?session=${encodeURIComponent(sessionId)}`)}
          >
            解锁完整目标适配报告
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              navigateTo(`/result-goal-fit-free-preview?session=${encodeURIComponent(sessionId)}`)
            }
          >
            返回查看免费判断
          </button>
        </div>
      </section>
    </GoalFitPageFrame>
  );
}

function GoalFitResultPage() {
  const reportContext = getReportContextFromUrl();
  const [apiUnlocked, setApiUnlocked] = useState<boolean | null>(reportContext.isSample ? true : null);
  const [unlockCheckComplete, setUnlockCheckComplete] = useState(
    reportContext.isSample || (!IS_PRODUCTION && reportContext.isUnlocked)
  );
  const result = reportContext.result;

  useEffect(() => {
    if (reportContext.isSample || !reportContext.sessionId) return;

    let ignore = false;

    async function checkUnlockStatus(): Promise<void> {
      if (!reportContext.sessionId) return;

      try {
        const status = await getGoalFitUnlockStatusFromApi(reportContext.sessionId);
        if (!ignore) setApiUnlocked(status.unlocked);
      } catch {
        if (!ignore) setApiUnlocked(null);
      } finally {
        if (!ignore) setUnlockCheckComplete(true);
      }
    }

    void checkUnlockStatus();

    return () => {
      ignore = true;
    };
  }, [reportContext.isSample, reportContext.sessionId]);

  if (!result) return <MissingReportPage />;
  if (!reportContext.isSample && reportContext.sessionId && !unlockCheckComplete) {
    return (
      <GoalFitPageFrame>
        <section className="goal-fit-panel goal-fit-result-empty goal-fit-result-locked">
          <p className="goal-fit-eyebrow">正在确认解锁状态</p>
          <h1>正在打开完整报告</h1>
          <p>我们正在确认这份报告的解锁状态，请稍等片刻。</p>
        </section>
      </GoalFitPageFrame>
    );
  }

  const hasUnlockedAccess =
    reportContext.isSample || apiUnlocked === true || (!IS_PRODUCTION && reportContext.isUnlocked);

  if (!reportContext.isSample && reportContext.sessionId && !hasUnlockedAccess) {
    return <LockedReportPage sessionId={reportContext.sessionId} />;
  }

  const { scores } = result;
  const companyNarratives = buildCompanyNarrativeBlocks(result);
  const roleNarratives = buildRoleNarrativeBlocks(result);
  const actionAdvice = buildActionAdvice(result);

  return (
    <GoalFitPageFrame>
      <section className="goal-fit-panel goal-fit-result-frame">
        <header className="goal-fit-result-header goal-fit-report-cover">
          <p className="goal-fit-eyebrow">招聘端判断视角</p>
          <h1>第一份工作风险预演报告</h1>
          <p>基于你的34题回答生成。本报告判断的是目标风险，不评价能力高低。</p>
          <div className="goal-fit-result-path">
            <span>公司类型：{result.targetCompanyLabel}</span>
            <span>岗位方向：{result.targetRoleLabel}</span>
          </div>
        </header>

        <section className="goal-fit-result-screen goal-fit-report-section">
          <p className="goal-fit-eyebrow">一、你的整体情况</p>
          <div className="goal-fit-result-overview goal-fit-result-judgement">
            <div className="goal-fit-result-main-score">
              <span>当前匹配度</span>
              <strong>{scores.overallScore}%</strong>
            </div>
            <div>
              <h2>{getOverallScoreText(scores.overallScore)}</h2>
              <p>{getFirstScreenAdvice(scores.overallScore)}</p>
            </div>
          </div>
        </section>

        <section className="goal-fit-result-screen goal-fit-report-section">
          <div className="goal-fit-result-group-heading">
            <p className="goal-fit-eyebrow">二、目标公司环境风险</p>
            <h2>这类公司怎么筛人、怎么用人，以及你进去后可能是什么体感。</h2>
          </div>
          <div className="goal-fit-result-narrative-grid">
            {companyNarratives.map((card) => (
              <NarrativeCard card={card} key={card.title} />
            ))}
          </div>
        </section>

        <section className="goal-fit-result-screen goal-fit-report-section">
          <div className="goal-fit-result-group-heading">
            <p className="goal-fit-eyebrow">三、目标岗位工作方式风险</p>
            <h2>这类岗位真实需要什么，你做起来会遇到哪些工作方式考验。</h2>
          </div>
          <div className="goal-fit-result-narrative-grid">
            {roleNarratives.map((card) => (
              <NarrativeCard card={card} key={card.title} />
            ))}
          </div>
        </section>

        <section className="goal-fit-result-screen goal-fit-report-section">
          <p className="goal-fit-eyebrow">四、最可能发生的不适应场景</p>
          <article className="goal-fit-result-note-card goal-fit-result-gap-advice">
            <h3>针对你的情况，我们建议：</h3>
            <p>{getFitGapAdvice(result)}</p>
          </article>
          <article className="goal-fit-result-action-card featured">
            <h2>你最需要优先处理的问题</h2>
            <p>{actionAdvice.priorityProblem}</p>
          </article>
        </section>

        <section className="goal-fit-result-screen goal-fit-report-section">
          <p className="goal-fit-eyebrow">五、建议求职行动</p>
          <div className="goal-fit-result-advice-report">
            <article className="goal-fit-result-action-card style">
              <h2>如果差距来自性格或做事风格</h2>
              {actionAdvice.styleGuidance.split("\n\n").map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>

            <article className="goal-fit-result-action-card emphasis">
              <h2>你接下来要补什么</h2>
              {actionAdvice.nextStep.split("\n\n").map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>

            <article className="goal-fit-result-action-card goal-fit-result-cta wide">
              <h2>继续获得求职方向帮助</h2>
              <p>
                如果你在求职中还有其他问题，可以关注公众号：
                <strong>猎头季哥人才重估实验室</strong>
              </p>
              <p>
                继续陪你看清方向、优化简历、准备面试，为顺利进入职场保驾护航。
              </p>
              <p>
                自动报告基于测试答案生成；599元人工人才重估服务会结合你的简历、经历和求职目标进行一对一判断。
              </p>
            </article>
          </div>

          <div className="goal-fit-result-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => navigateTo("/test-goal-fit-preview")}
            >
              重新测试
            </button>
          </div>
        </section>
      </section>
    </GoalFitPageFrame>
  );
}

export default GoalFitResultPage;
