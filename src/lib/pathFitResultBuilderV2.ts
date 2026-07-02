import questionsV2ConfigJson from "../config/questions_v2.json" with { type: "json" };
import type {
  CompanyTypeV2,
  DimensionKeyV2,
  DisplayRiskLevelV2,
  ObstacleTypeV2,
  PathFitAnswerMapV2,
  PathFitDisplayDimensionV2,
  PathFitExplanationSignalV2,
  PathFitObstacleDisplayV2,
  PathFitPathContextV2,
  PathFitResultPresentationV2,
  PathFitScoringResultV2,
  QuestionV2,
  QuestionsV2Config,
  RoleTypeV2,
  SignalLevelV2
} from "../types/pathFitV2";

const { scorePathFitV2 } = await import("./pathFitScoringV2" + ".ts");

type TagScore = {
  tag: string;
  severity: "risk" | "severeRisk";
  sourceQuestionIds: Set<string>;
  weight: number;
};

const questionsV2Config = questionsV2ConfigJson as QuestionsV2Config;

const COMPANY_TYPE_LABELS: Record<CompanyTypeV2, string> = {
  soe: "国企 / 事业单位 / 央国企平台",
  mnc: "外企 / 跨国公司",
  big_platform: "大厂 / 大平台",
  startup: "创业公司",
  sme_private: "中小民企 / 传统民企"
};

const ROLE_TYPE_LABELS: Record<RoleTypeV2, string> = {
  sales: "销售 / 商务 / 客户拓展",
  operation_project: "运营 / 项目 / 用户增长",
  content_marketing: "内容 / 市场 / 品牌",
  tech_data_product: "技术 / 数据 / 产品",
  function_support: "职能支持"
};

const COMPANY_REQUIREMENT_SUMMARIES: Record<CompanyTypeV2, string> = {
  soe:
    "这类组织通常更看重规则适应、稳定执行、汇报意识和流程耐心。新人压力往往来自审批节奏、层级边界和成长速度感。",
  mnc:
    "这类组织通常更看重规则理解、专业表达、协作边界和自我驱动。新人压力往往来自没人手把手带、需要主动确认和书面表达。",
  big_platform:
    "这类组织通常更看重节奏承受、快速学习、跨团队协作和结果交付。新人压力往往来自强反馈、同龄竞争和变化节奏。",
  startup:
    "这类组织通常更看重主动探索、快速试错、自我推进和资源不足时的解决问题能力。新人压力往往来自没有标准答案、方向变化和一人多岗。",
  sme_private:
    "这类组织通常更看重执行落地、灵活配合、问题处理和结果意识。新人压力往往来自管理不够规范、职责边界不清和培训体系不足。"
};

const ROLE_REQUIREMENT_SUMMARIES: Record<RoleTypeV2, string> = {
  sales: "这个方向的高频场景是陌生客户触达、被拒绝后的恢复、目标压力和长期跟进。",
  operation_project: "这个方向的高频场景是多方协调、目标变化、细节跟进和数据复盘。",
  content_marketing: "这个方向的高频场景是方案被否定、持续产出、数据反馈不好和创意受限制。",
  tech_data_product: "这个方向的高频场景是需求不清、持续学习、专业反馈和排期质量冲突。",
  function_support: "这个方向的高频场景是流程与同事诉求冲突、重复细致工作、成果不容易被看见和跨部门服务边界。"
};

const OBSTACLE_TITLES: Record<ObstacleTypeV2, string> = {
  admission_barrier: "最大的压力可能在准入门槛",
  motivation_expectation: "最大的压力可能在动机与预期",
  work_style: "最大的压力可能在工作方式",
  company_environment: "最大的压力可能在公司环境",
  role_scenario: "最大的压力可能在岗位场景"
};

const OBSTACLE_DIMENSION_LABELS: Record<DimensionKeyV2, string> = {
  admissionFitScore: "准入适配",
  motivationFitScore: "动机预期",
  baseWorkStyleFitScore: "工作方式",
  companyScenarioFitScore: "工作方式",
  roleScenarioFitScore: "情景反应"
};

const TAG_COPY: Record<string, { label: string; summary: string }> = {
  need_guidance: {
    label: "对带教和反馈节点的依赖较高",
    summary: "当目标、标准或下一步不够清楚时，你可能更需要外部节点帮助校准。"
  },
  pressure_sensitive: {
    label: "压力和强反馈会影响投入节奏",
    summary: "在节奏持续较快或反馈直接的场景里，投入感可能更容易受到影响。"
  },
  uncertainty_tolerance: {
    label: "对不确定和变化的消化成本较高",
    summary: "当方向、职责或目标频繁变化时，你可能需要更多时间重新建立稳定感。"
  },
  communication_energy: {
    label: "高频沟通会带来额外消耗",
    summary: "需要持续对齐、触达或协调时，沟通成本可能成为额外压力。"
  },
  feedback_processing: {
    label: "需要更清晰的反馈消化方式",
    summary: "面对否定、数据不佳或专业反馈时，你可能需要更明确的复盘路径。"
  },
  execution_continuity: {
    label: "长周期推进需要更明确的节奏",
    summary: "连续推进、细节跟踪或长期跟进时，节奏设计会影响稳定发挥。"
  },
  autonomy: {
    label: "自主推进需要更清晰的目标边界",
    summary: "当没人明确安排下一步时，目标边界会影响你启动和推进的效率。"
  },
  stability_preference: {
    label: "对稳定性和确定性的期待较强",
    summary: "如果目标路径变化较多，稳定预期和真实体验之间可能出现落差。"
  },
  growth_expectation: {
    label: "对成长速度和回报节奏比较敏感",
    summary: "如果成长反馈来得较慢，可能会影响你对这条路的持续投入。"
  },
  admission_barrier: {
    label: "当前证明材料和筛选门槛之间有压力",
    summary: "目标路径可能对学历、专业、实习或项目证明有更高识别要求。"
  },
  environment_preference: {
    label: "对组织氛围和环境边界比较敏感",
    summary: "公司环境里的流程、节奏、边界或自由度可能放大适应压力。"
  },
  role_pressure: {
    label: "岗位高频场景可能形成压力点",
    summary: "目标岗位里的真实业务场景可能比想象中更考验稳定推进。"
  }
};

const BOUNDARY_COPY =
  "这不是对你的最终定性。它只是根据你当前选择的公司类型、岗位方向和答题反应，提前预演这条路径可能出现的阻力。真正的职业选择，还需要结合你的简历、项目、实习、表达能力和真实机会一起判断。";

const OFFICIAL_ACCOUNT_CTA = "关注公众号：猎头季哥人才重估实验室";

function getRiskLevel(score: number): DisplayRiskLevelV2 {
  if (score >= 85) return "low";
  if (score >= 70) return "medium";
  if (score >= 55) return "high";
  return "severe";
}

function getDisplayDimensionSummary(score: number): string {
  if (score >= 85) return "这一项目前比较顺，暂时不是主要压力来源。";
  if (score >= 70) return "这一项基本可支撑当前路径，但仍有提前确认的空间。";
  if (score >= 55) return "这一项存在明显摩擦，后续需要重点看清真实要求。";
  return "这一项压力较高，可能会成为当前路径里的关键阻力。";
}

function getResultCopy(finalPathFitScore: number): { resultTitle: string; resultSummary: string } {
  if (finalPathFitScore >= 85) {
    return {
      resultTitle: "这条路径目前对你比较友好",
      resultSummary:
        "从当前回答看，你选择的公司类型、岗位方向和你的准备基础之间比较顺。真正需要做的是把已有优势表达清楚，而不是频繁换方向。"
    };
  }

  if (finalPathFitScore >= 70) {
    return {
      resultTitle: "这条路径可以走，但需要提前补关键短板",
      resultSummary:
        "这不是一条完全不匹配的路，但里面有一些地方会影响你进入筛选、适应节奏或长期投入。越早看清这些摩擦，越容易把风险变成准备动作。"
    };
  }

  if (finalPathFitScore >= 55) {
    return {
      resultTitle: "这条路径存在明显摩擦",
      resultSummary:
        "你不是不能走这条路，但当前阶段会遇到比较具体的阻力。问题可能不在努力本身，而在准入门槛、预期落差、工作方式或真实岗位场景之间的冲突。"
    };
  }

  return {
    resultTitle: "这条路径对你当前阶段压力较高",
    resultSummary:
      "这条路不是一句放弃就能概括，但如果直接冲进去，可能会在筛选、适应或长期投入上遇到连续阻力。更稳的做法是先看清最大障碍，再决定是补证据、换切口，还是调整目标公司和岗位。"
  };
}

function buildDisplayDimensions(result: PathFitScoringResultV2): PathFitDisplayDimensionV2[] {
  const { dimensionScores } = result;
  const workStyleDisplayScore = Math.round(
    (dimensionScores.baseWorkStyleFitScore * 20 +
      dimensionScores.companyScenarioFitScore * 10) /
      30
  );
  const dimensions = [
    {
      key: "admission" as const,
      label: "准入适配",
      score: dimensionScores.admissionFitScore
    },
    {
      key: "motivation" as const,
      label: "动机预期",
      score: dimensionScores.motivationFitScore
    },
    {
      key: "work_style" as const,
      label: "工作方式",
      score: workStyleDisplayScore
    },
    {
      key: "scenario_reaction" as const,
      label: "情景反应",
      score: dimensionScores.roleScenarioFitScore
    }
  ];

  return dimensions.map((dimension) => ({
    ...dimension,
    summary: getDisplayDimensionSummary(dimension.score),
    riskLevel: getRiskLevel(dimension.score)
  }));
}

function buildPathContext(
  companyType: CompanyTypeV2,
  roleType: RoleTypeV2
): PathFitPathContextV2 {
  return {
    companyType,
    roleType,
    companyTypeLabel: COMPANY_TYPE_LABELS[companyType],
    roleTypeLabel: ROLE_TYPE_LABELS[roleType],
    companyRequirementSummary: COMPANY_REQUIREMENT_SUMMARIES[companyType],
    roleRequirementSummary: ROLE_REQUIREMENT_SUMMARIES[roleType]
  };
}

function buildObstacleDisplay(
  type: ObstacleTypeV2,
  dimension: DimensionKeyV2,
  reason: string
): PathFitObstacleDisplayV2 {
  return {
    type,
    title: OBSTACLE_TITLES[type],
    reason,
    dimensionLabel: OBSTACLE_DIMENSION_LABELS[dimension]
  };
}

function getSeverityWeight(signalLevel: SignalLevelV2): number {
  if (signalLevel === "severeRisk") return 3;
  if (signalLevel === "risk") return 2;
  return 0;
}

function collectExplanationSignals(
  result: PathFitScoringResultV2,
  answerMap: PathFitAnswerMapV2,
  questions: QuestionV2[]
): { signals: PathFitExplanationSignalV2[]; unmappedTags: string[] } {
  const visibleQuestionIdSet = new Set(result.visibleQuestionIds);
  const tagScores = new Map<string, TagScore>();
  const unmappedTags = new Set<string>();

  for (const question of questions) {
    if (!visibleQuestionIdSet.has(question.questionId)) continue;

    const optionId = answerMap[question.questionId];
    const option = question.options.find((item) => item.optionId === optionId);

    if (!option?.optionSignal.explain) continue;
    if (option.optionSignal.signalLevel !== "risk" && option.optionSignal.signalLevel !== "severeRisk") {
      continue;
    }

    for (const tag of option.optionSignal.tags) {
      const copy = TAG_COPY[tag];

      if (!copy) {
        unmappedTags.add(tag);
        continue;
      }

      const existing = tagScores.get(tag);
      const severityWeight = getSeverityWeight(option.optionSignal.signalLevel);

      if (existing) {
        existing.weight += severityWeight;
        existing.sourceQuestionIds.add(question.questionId);
        if (option.optionSignal.signalLevel === "severeRisk") {
          existing.severity = "severeRisk";
        }
      } else {
        tagScores.set(tag, {
          tag,
          severity: option.optionSignal.signalLevel,
          sourceQuestionIds: new Set([question.questionId]),
          weight: severityWeight
        });
      }
    }
  }

  const signals = [...tagScores.values()]
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      if (b.sourceQuestionIds.size !== a.sourceQuestionIds.size) {
        return b.sourceQuestionIds.size - a.sourceQuestionIds.size;
      }
      return a.tag.localeCompare(b.tag);
    })
    .slice(0, 3)
    .map((item) => ({
      tag: item.tag,
      label: TAG_COPY[item.tag].label,
      summary: TAG_COPY[item.tag].summary,
      sourceQuestionIds: [...item.sourceQuestionIds].sort(),
      severity: item.severity
    }));

  return {
    signals,
    unmappedTags: [...unmappedTags].sort()
  };
}

export function buildPathFitResultV2(
  answerMap: PathFitAnswerMapV2
): PathFitResultPresentationV2 {
  const scoringResult = scorePathFitV2(answerMap, {
    questions: questionsV2Config.questions,
    strict: true
  });
  const { resultTitle, resultSummary } = getResultCopy(scoringResult.finalPathFitScore);
  const { companyType, roleType } = scoringResult.pathSelection;
  const explanation = collectExplanationSignals(
    scoringResult,
    answerMap,
    questionsV2Config.questions
  );
  const obstacle = scoringResult.obstacle;

  return {
    version: "v1.2",
    finalPathFitScore: scoringResult.finalPathFitScore,
    finalPathFitLabel: scoringResult.finalPathFitLabel,
    resultTitle,
    resultSummary,
    pathContext: buildPathContext(companyType, roleType),
    displayDimensions: buildDisplayDimensions(scoringResult),
    primaryObstacle: buildObstacleDisplay(
      obstacle.primaryObstacleType,
      obstacle.primaryObstacleDimension,
      obstacle.primaryObstacleReason
    ),
    secondaryObstacle:
      obstacle.secondaryObstacleType && obstacle.secondaryObstacleDimension
        ? buildObstacleDisplay(
            obstacle.secondaryObstacleType,
            obstacle.secondaryObstacleDimension,
            obstacle.primaryObstacleReason
          )
        : undefined,
    capTriggered: obstacle.capTriggered,
    capReason: obstacle.capReason,
    explanationSignals: explanation.signals,
    boundaryCopy: BOUNDARY_COPY,
    officialAccountCta: OFFICIAL_ACCOUNT_CTA,
    debug: {
      scoringResult,
      rawDimensionScores: scoringResult.dimensionScores,
      unmappedTags: explanation.unmappedTags
    }
  };
}
