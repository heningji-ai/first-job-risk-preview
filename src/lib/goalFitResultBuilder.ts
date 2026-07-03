import type {
  CompanyType,
  GoalFitAnswerMap,
  GoalFitOverallConclusion,
  GoalFitQuadrantConclusion,
  GoalFitQuestionBank,
  GoalFitRecommendation,
  GoalFitResult,
  GoalFitResultCard,
  GoalFitRiskInsight,
  GoalFitScoreResult,
  MotivationTag,
  RiskTag,
  RoleType
} from "./goalFitTypes";

const { calculateGoalFitScores } = (await import(
  "./goalFitScoringEngine" + ".ts"
)) as typeof import("./goalFitScoringEngine");
const { selectGoalFitQuestions } = (await import(
  "./goalFitQuestionSelector" + ".ts"
)) as typeof import("./goalFitQuestionSelector");

const RESULT_VERSION = "goal-fit-result-v1.3";

type BuildGoalFitResultInput = {
  questionBank: GoalFitQuestionBank;
  answers: GoalFitAnswerMap;
  targetCompany: CompanyType;
  targetRole: RoleType;
};

type RiskRule = {
  id: string;
  source: string;
  severity: GoalFitRiskInsight["severity"];
  matches: (scores: GoalFitScoreResult) => boolean;
  title: string;
  description: string;
};

const severityRank: Record<GoalFitRiskInsight["severity"], number> = {
  high: 3,
  medium: 2,
  low: 1
};

function hasMotivationTag(scores: GoalFitScoreResult, tag: MotivationTag): boolean {
  return scores.motivationTags.includes(tag);
}

function getRiskTagCount(scores: GoalFitScoreResult, tag: RiskTag): number {
  return scores.riskTagCounts.find((item) => item.tag === tag)?.count ?? 0;
}

function getOverallConclusion(overallScore: number): GoalFitOverallConclusion {
  if (overallScore >= 85) {
    return {
      level: "high_match",
      title: "高度匹配，可以优先尝试",
      summary:
        "你的目标公司和目标岗位整体匹配度较高。这个方向可以作为当前求职的优先选择，但仍然要看具体团队、领导风格和岗位边界。"
    };
  }

  if (overallScore >= 75) {
    return {
      level: "good_match",
      title: "可以继续尝试，但要看具体风险",
      summary:
        "这个目标整体可尝试，但不要只看公司名或岗位名。你需要进一步确认团队节奏、带教机制、岗位边界和实际考核方式。"
    };
  }

  if (overallScore >= 65) {
    return {
      level: "conditional_match",
      title: "有潜力，但不能盲投",
      summary:
        "这个方向不是不能尝试，但当前仍有明显变量。建议你先补足关键经历、项目案例或面试表达，再集中投递。"
    };
  }

  if (overallScore >= 55) {
    return {
      level: "high_risk",
      title: "当前目标风险较高，需要谨慎选择",
      summary:
        "你和这个目标之间存在比较明显的差距。更适合先判断差距来自背景、方法、动机还是环境，再决定继续冲还是调整目标组合。"
    };
  }

  return {
    level: "not_priority",
    title: "不建议作为第一优先方向",
    summary:
      "从当前结果看，这个目标不适合作为第一优先方向。你可以保留它作为探索选项，但求职主线建议重新评估。"
  };
}

export function getCompanyQuadrantConclusion(
  companyPersonalityScore: number,
  companyBehaviorScore: number
): GoalFitQuadrantConclusion {
  if (companyPersonalityScore >= 75 && companyBehaviorScore >= 75) {
    return {
      type: "high_match",
      title: "你和目标公司的匹配度较高",
      summary: "你的性格底色和日常职场行为都比较支持这类公司环境。它可以作为你的优先选择。",
      advice: "继续确认具体团队、岗位边界和领导风格，避免只看公司类型做判断。"
    };
  }

  if (
    (companyPersonalityScore >= 65 && companyPersonalityScore < 75) ||
    (companyBehaviorScore >= 65 && companyBehaviorScore < 75)
  ) {
    return {
      type: "conditional",
      title: "有条件适配",
      summary: "你和这类公司有一定匹配基础，但结果取决于具体团队、领导风格、培训机制和岗位边界。",
      advice: "不要泛泛判断公司类型，要具体看团队和岗位。"
    };
  }

  if (companyPersonalityScore >= 75 && companyBehaviorScore < 65) {
    return {
      type: "personality_fit_behavior_weak",
      title: "底色适合，但做事方式还需要训练",
      summary: "你不是不适合这类公司，更像是还没有完全掌握这类组织里的做事方式。",
      advice: "重点训练汇报、流程意识、资源争取、跨部门协作和反馈处理。"
    };
  }

  if (companyPersonalityScore < 65 && companyBehaviorScore >= 75) {
    return {
      type: "behavior_fit_personality_drain",
      title: "短期能适应，但长期可能消耗较高",
      summary: "你知道在这类公司应该怎么做，也能短期适应。但它未必是你的低消耗环境。",
      advice: "要重点确认团队强度、领导风格和长期成长路径。"
    };
  }

  if (companyPersonalityScore < 65 && companyBehaviorScore < 65) {
    return {
      type: "low_match",
      title: "不建议作为第一优先公司类型",
      summary: "从性格底色和日常行为看，你和这类公司环境都存在明显摩擦。",
      advice: "可以保留观察，但不建议把它作为当前求职主线。"
    };
  }

  return {
    type: "conditional",
    title: "有条件适配",
    summary: "你和这类公司有一定匹配基础，但结果取决于具体团队、领导风格、培训机制和岗位边界。",
    advice: "不要泛泛判断公司类型，要具体看团队和岗位。"
  };
}

export function getRoleQuadrantConclusion(
  rolePersonalityScore: number,
  roleBehaviorScore: number
): GoalFitQuadrantConclusion {
  if (rolePersonalityScore >= 75 && roleBehaviorScore >= 75) {
    return {
      type: "high_match",
      title: "你和目标岗位的匹配度较高",
      summary: "你的性格底色和真实岗位场景反应都比较支持这个岗位方向。",
      advice: "可以作为优先投递方向，但仍需要准备案例、工具能力和面试表达。"
    };
  }

  if (
    (rolePersonalityScore >= 65 && rolePersonalityScore < 75) ||
    (roleBehaviorScore >= 65 && roleBehaviorScore < 75)
  ) {
    return {
      type: "conditional",
      title: "有条件适配",
      summary: "你和这个岗位有一定匹配基础，但需要看具体工作内容、团队支持和训练周期。",
      advice: "不要只看岗位名称，要看实际职责和考核方式。"
    };
  }

  if (rolePersonalityScore >= 75 && roleBehaviorScore < 65) {
    return {
      type: "personality_fit_behavior_weak",
      title: "底色适合，但方法和经验还不够",
      summary: "你不是不适合这个岗位，而是缺少方法、训练、项目经验或表达准备。",
      advice: "重点补项目案例、工具能力、岗位理解和面试表达。"
    };
  }

  if (rolePersonalityScore < 65 && roleBehaviorScore >= 75) {
    return {
      type: "behavior_fit_personality_drain",
      title: "能做，但未必是低消耗方向",
      summary: "你能应对这个岗位的真实任务，但它不一定是你的天然优势区。",
      advice: "短期可以尝试，长期要关注消耗、成长速度和替代方向。"
    };
  }

  if (rolePersonalityScore < 65 && roleBehaviorScore < 65) {
    return {
      type: "low_match",
      title: "不建议作为第一优先岗位",
      summary: "从性格底色和岗位场景反应看，你和这个岗位存在明显摩擦。",
      advice: "建议重新评估岗位选择，或先补足关键能力后再尝试。"
    };
  }

  return {
    type: "conditional",
    title: "有条件适配",
    summary: "你和这个岗位有一定匹配基础，但需要看具体工作内容、团队支持和训练周期。",
    advice: "不要只看岗位名称，要看实际职责和考核方式。"
  };
}

const riskRules: RiskRule[] = [
  {
    id: "stable_startup_conflict",
    source: "motivation_company",
    severity: "high",
    matches: (scores) => hasMotivationTag(scores, "stable") && scores.targetCompany === "V",
    title: "稳定需求和创业环境之间可能有冲突",
    description:
      "你对稳定和安全感有较高需求，但创业公司通常意味着变化、职责模糊、资源不足和带教不稳定。选择前要重点确认业务是否稳定、现金流是否健康、试用期目标是否清楚。"
  },
  {
    id: "platform_halo_pressure",
    source: "motivation_risk_tag",
    severity: "medium",
    matches: (scores) =>
      (hasMotivationTag(scores, "status") || hasMotivationTag(scores, "money")) &&
      scores.targetCompany === "D" &&
      (getRiskTagCount(scores, "HIGH_PRESSURE") > 0 || getRiskTagCount(scores, "REJECTION_SENSITIVE") > 0),
    title: "不要只看大厂光环",
    description:
      "你容易被平台、薪资或履历光环吸引，但如果压力耐受和反馈恢复速度不足，大厂环境可能带来较高消耗。要具体看团队强度、KPI 和领导风格。"
  },
  {
    id: "external_communication_drain",
    source: "role_risk_tag",
    severity: "medium",
    matches: (scores) =>
      (scores.targetRole === "SLS" || scores.targetRole === "MKT") &&
      getRiskTagCount(scores, "SOCIAL_DRAIN") > 0,
    title: "高频外部沟通可能带来消耗",
    description:
      "你可以通过方法短期适应外部沟通，但高频陌生沟通未必是你的低消耗工作方式。建议优先判断岗位是陌拜型、顾问式、客户成功、内容策略还是品牌策划。"
  },
  {
    id: "training_expectation_gap",
    source: "company_risk_tag",
    severity: "high",
    matches: (scores) =>
      (scores.targetCompany === "V" || scores.targetCompany === "M") &&
      getRiskTagCount(scores, "NEEDS_TRAINING") > 0,
    title: "带教期待和组织现实可能不一致",
    description:
      "你对带教、反馈和明确标准有期待，但创业公司和部分中小民企往往缺乏系统培训。入职前要确认谁带你、试用期目标是什么、反馈频率如何。"
  },
  {
    id: "create_basic_work_gap",
    source: "motivation_company_risk_tag",
    severity: "medium",
    matches: (scores) =>
      hasMotivationTag(scores, "create") &&
      (scores.targetCompany === "G" || scores.targetCompany === "F") &&
      getRiskTagCount(scores, "GROWTH_GAP") > 0,
    title: "创造感和基础工作之间可能有落差",
    description:
      "你希望参与完整项目、看到成果，但目标环境可能需要你先做局部、基础、重复的工作。要确认成长路径，而不是只看平台稳定性。"
  },
  {
    id: "boundary_organization_conflict",
    source: "company_risk_tag",
    severity: "medium",
    matches: (scores) =>
      (scores.targetCompany === "M" || scores.targetCompany === "G") &&
      getRiskTagCount(scores, "BOUNDARY_CONFLICT") > 0,
    title: "边界感和组织风格可能冲突",
    description:
      "你更适合边界清晰、规则透明的职业化组织。如果进入强人情、强领导意图或非正式规则较多的团队，可能会有明显消耗。"
  },
  {
    id: "entry_ticket_gap",
    source: "entry_behavior_score",
    severity: "medium",
    matches: (scores) =>
      (scores.companyEntryScore < 60 || scores.roleEntryScore < 60) &&
      (scores.companyBehaviorScore >= 75 || scores.roleBehaviorScore >= 75),
    title: "能做，但入场券还不够强",
    description:
      "你的行为方式接近目标方向，但当前背景竞争力不足。不代表不能做，而是需要补实习、项目、作品、工具能力或表达包装。"
  },
  {
    id: "screening_pass_adaptation_risk",
    source: "entry_behavior_score",
    severity: "medium",
    matches: (scores) =>
      (scores.companyEntryScore >= 75 || scores.roleEntryScore >= 75) &&
      (scores.companyBehaviorScore < 65 || scores.roleBehaviorScore < 65),
    title: "背景能过筛，但入职适应风险要看清",
    description:
      "你的学历、学校、实习或项目可能能帮助你进入筛选，但入职后的真实适应风险较高。你需要补工作方法，而不是只依赖背景优势。"
  }
];

export function detectGoalFitRiskInsights(scores: GoalFitScoreResult): GoalFitRiskInsight[] {
  const insights = riskRules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => rule.matches(scores))
    .map(({ rule, index }) => ({
      id: rule.id,
      title: rule.title,
      description: rule.description,
      severity: rule.severity,
      source: rule.source,
      order: index
    }))
    .sort((a, b) => {
      const severityDiff = severityRank[b.severity] - severityRank[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.order - b.order;
    })
    .slice(0, 3)
    .map(({ order: _order, ...insight }) => insight);

  if (insights.length > 0) return insights;

  return [
    {
      id: "team_specific_difference",
      title: "具体团队差异风险",
      description:
        "同一个公司类型和岗位名称，在不同团队里的差异可能很大。你需要重点确认领导风格、带教机制、岗位边界和考核方式。",
      severity: "low",
      source: "fallback"
    }
  ];
}

export function generateHeadhunterSummary(result: Pick<GoalFitResult, "scores">): string {
  const score = result.scores.overallScore;

  if (score >= 85) {
    return "这个目标可以作为主线推进，但不要只看方向匹配，面试里还要把项目、实习和岗位理解讲清楚。";
  }

  if (score >= 75) {
    return "这个目标值得继续尝试，关键不是换方向，而是看具体团队和岗位边界。";
  }

  if (score >= 65) {
    return "你不是不能试这个方向，但现在不能盲投，先补足案例、工具和岗位理解会更稳。";
  }

  if (score >= 55) {
    return "这个目标现在有明显摩擦，建议先判断差距来自背景、方法还是环境，再决定是否继续冲。";
  }

  return "这个方向不建议作为第一优先，可以保留观察，但求职主线需要重新评估。";
}

function getRecommendations(scores: GoalFitScoreResult): GoalFitRecommendation[] {
  const recommendations: GoalFitRecommendation[] = [];
  const addRecommendation = (recommendation: GoalFitRecommendation) => {
    if (recommendations.length < 3) recommendations.push(recommendation);
  };

  if (scores.companyEntryScore < 60 || scores.roleEntryScore < 60) {
    addRecommendation({
      title: "先补入场证明",
      description: "优先补相关实习、项目、作品、工具能力或可讲清楚的案例，让简历先过筛。"
    });
  }

  if (scores.roleBehaviorScore < 65) {
    addRecommendation({
      title: "补岗位方法和案例",
      description: "围绕目标岗位准备 1-2 个能讲清楚目标、过程、结果和复盘的案例。"
    });
  }

  if (scores.companyBehaviorScore < 65) {
    addRecommendation({
      title: "训练职场做事方式",
      description: "重点准备汇报、反馈处理、资源争取、跨部门协作和优先级判断。"
    });
  }

  if (scores.motivationFitScore < 65) {
    addRecommendation({
      title: "重新确认求职动机",
      description: "不要只看公司名和岗位名，先确认你最想要的是稳定、成长、收入、平台还是参与感。"
    });
  }

  if (getRiskTagCount(scores, "NEEDS_TRAINING") > 0) {
    addRecommendation({
      title: "面试时确认带教机制",
      description: "重点问清谁带你、试用期目标是什么、反馈频率如何、入职前 30 天要完成什么。"
    });
  }

  if (getRiskTagCount(scores, "HIGH_PRESSURE") > 0) {
    addRecommendation({
      title: "确认真实工作强度",
      description: "不要只听岗位介绍，要具体问 KPI、加班频率、反馈节奏和团队当前压力来源。"
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: "具体看团队，不要只看标签",
      description: "同一类公司和岗位差异很大，下一步重点看团队、领导风格、岗位边界和考核方式。"
    });
  }

  return recommendations.slice(0, 3);
}

function buildCards(result: Omit<GoalFitResult, "cards">): GoalFitResultCard[] {
  const firstRisk = result.riskInsights[0];

  return [
    {
      id: "summary",
      title: "你的目标适配结果",
      summary: `${result.targetCompanyLabel} × ${result.targetRoleLabel}，综合适配度 ${result.scores.overallScore}。${result.overallConclusion.title}`
    },
    {
      id: "company",
      title: "你和目标公司的匹配度",
      summary: `公司适配 ${result.scores.companyFitScore}，入场准备 ${result.scores.companyEntryScore}，性格底色 ${result.scores.companyPersonalityScore}，日常行为 ${result.scores.companyBehaviorScore}。${result.companyQuadrant.title}`
    },
    {
      id: "role",
      title: "你和目标岗位的匹配度",
      summary: `岗位适配 ${result.scores.roleFitScore}，入场准备 ${result.scores.roleEntryScore}，性格底色 ${result.scores.rolePersonalityScore}，岗位反应 ${result.scores.roleBehaviorScore}。${result.roleQuadrant.title}`
    },
    {
      id: "risk",
      title: "你最大的目标风险",
      summary: `${firstRisk.title}。${firstRisk.description}`
    },
    {
      id: "headhunter",
      title: "猎头季哥怎么看",
      summary: result.headhunterSummary
    },
    {
      id: "action",
      title: "接下来你更适合怎么做",
      summary: result.recommendations.map((item) => `${item.title}：${item.description}`).join(" ")
    },
    {
      id: "cta",
      title: "如果你还想继续获得求职帮助",
      summary: "关注公众号：猎头季哥人才重估实验室。"
    }
  ];
}

export function buildGoalFitResult({
  questionBank,
  answers,
  targetCompany,
  targetRole
}: BuildGoalFitResultInput): GoalFitResult {
  const selectedQuestions = selectGoalFitQuestions(questionBank, targetRole);
  const scores = calculateGoalFitScores({
    questionBank,
    answers,
    targetCompany,
    targetRole
  });

  if (selectedQuestions.length !== scores.answeredQuestionCount) {
    throw new Error("Goal Fit result selected question count mismatch");
  }

  const partialResult = {
    targetCompany,
    targetRole,
    targetCompanyLabel: questionBank.companyTypes[targetCompany],
    targetRoleLabel: questionBank.roleTypes[targetRole],
    scores,
    overallConclusion: getOverallConclusion(scores.overallScore),
    companyQuadrant: getCompanyQuadrantConclusion(
      scores.companyPersonalityScore,
      scores.companyBehaviorScore
    ),
    roleQuadrant: getRoleQuadrantConclusion(scores.rolePersonalityScore, scores.roleBehaviorScore),
    riskInsights: detectGoalFitRiskInsights(scores),
    headhunterSummary: "",
    recommendations: getRecommendations(scores),
    resultVersion: RESULT_VERSION
  };
  const resultWithoutCards = {
    ...partialResult,
    headhunterSummary: generateHeadhunterSummary(partialResult)
  };

  return {
    ...resultWithoutCards,
    cards: buildCards(resultWithoutCards)
  };
}
