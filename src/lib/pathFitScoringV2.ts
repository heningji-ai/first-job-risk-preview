import type {
  CapRuleResultV2,
  CompanyTypeV2,
  DerivedPathSelectionV2,
  DimensionKeyV2,
  DimensionScoresV2,
  ObstacleResultV2,
  ObstacleTypeV2,
  OptionV2,
  PathFitAnswerMapV2,
  PathFitScoringResultV2,
  QuestionV2,
  RoleTypeV2
} from "../types/pathFitV2";

type QuestionsV2DataModule = typeof import("./questionsV2Data");

const { questionsV2Config } = (await import("./questionsV2Data" + ".ts")) as QuestionsV2DataModule;

type VisibleQuestionsV2Result = {
  visibleQuestions: QuestionV2[];
  visibleQuestionIds: string[];
};

type ValidateAnswerMapV2Options = {
  strict?: boolean;
};

type ValidateAnswerMapV2Result = {
  missingQuestionIds: string[];
};

type ScorePathFitV2Options = {
  strict?: boolean;
  questions?: QuestionV2[];
};

const COMPANY_TYPES: CompanyTypeV2[] = [
  "soe",
  "mnc",
  "big_platform",
  "startup",
  "sme_private"
];

const ROLE_TYPES: RoleTypeV2[] = [
  "sales",
  "operation_project",
  "content_marketing",
  "tech_data_product",
  "function_support"
];

const DIMENSION_KEYS: DimensionKeyV2[] = [
  "admissionFitScore",
  "motivationFitScore",
  "baseWorkStyleFitScore",
  "companyScenarioFitScore",
  "roleScenarioFitScore"
];

const DIMENSION_WEIGHTS: Record<DimensionKeyV2, number> = {
  admissionFitScore: 0.3,
  motivationFitScore: 0.2,
  baseWorkStyleFitScore: 0.2,
  companyScenarioFitScore: 0.1,
  roleScenarioFitScore: 0.2
};

const OBSTACLE_TYPE_BY_DIMENSION: Record<DimensionKeyV2, ObstacleTypeV2> = {
  admissionFitScore: "admission_barrier",
  motivationFitScore: "motivation_expectation",
  baseWorkStyleFitScore: "work_style",
  companyScenarioFitScore: "company_environment",
  roleScenarioFitScore: "role_scenario"
};

const OBSTACLE_PRIORITY: DimensionKeyV2[] = [
  "admissionFitScore",
  "baseWorkStyleFitScore",
  "motivationFitScore",
  "roleScenarioFitScore",
  "companyScenarioFitScore"
];

const OBSTACLE_REASONS: Record<ObstacleTypeV2, string> = {
  admission_barrier:
    "当前路径的主要压力来自准入门槛，尤其是学历、专业、实习或项目证明与目标公司/岗位筛选要求之间的关系。",
  motivation_expectation:
    "当前路径的主要压力来自动机与预期，选择理由和真实工作体验之间可能存在落差。",
  work_style:
    "当前路径的主要压力来自通用工作方式，日常推进、反馈处理、节奏承受等方面可能和目标路径存在摩擦。",
  company_environment:
    "当前路径的主要压力来自公司环境，目标公司类型的流程、节奏、边界或不确定性可能会放大适应压力。",
  role_scenario:
    "当前路径的主要压力来自岗位场景，真实业务中的高频任务可能更容易形成卡点。"
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number): number {
  return Math.round(value);
}

function assertCompanyType(value: unknown, questionId: string): asserts value is CompanyTypeV2 {
  if (!COMPANY_TYPES.includes(value as CompanyTypeV2)) {
    throw new Error(`${questionId}: invalid selectorValue for company_type: ${String(value)}`);
  }
}

function assertRoleType(value: unknown, questionId: string): asserts value is RoleTypeV2 {
  if (!ROLE_TYPES.includes(value as RoleTypeV2)) {
    throw new Error(`${questionId}: invalid selectorValue for work_type: ${String(value)}`);
  }
}

function findQuestion(questions: QuestionV2[], questionId: string): QuestionV2 {
  const question = questions.find((item) => item.questionId === questionId);

  if (!question) {
    throw new Error(`${questionId}: question not found in questions_v2.json`);
  }

  return question;
}

function findSelectedOption(
  question: QuestionV2,
  answerMap: PathFitAnswerMapV2
): OptionV2 {
  const selectedOptionId = answerMap[question.questionId];

  if (!selectedOptionId) {
    throw new Error(`${question.questionId}: missing answer`);
  }

  const option = question.options.find((item) => item.optionId === selectedOptionId);

  if (!option) {
    throw new Error(
      `${question.questionId}: optionId ${selectedOptionId} does not belong to this question`
    );
  }

  return option;
}

export function derivePathSelectionV2(
  answerMap: PathFitAnswerMapV2,
  questions: QuestionV2[] = questionsV2Config.questions
): DerivedPathSelectionV2 {
  const companyQuestion = findQuestion(questions, "A7");
  const roleQuestion = findQuestion(questions, "A8");
  const companyOption = findSelectedOption(companyQuestion, answerMap);
  const roleOption = findSelectedOption(roleQuestion, answerMap);

  assertCompanyType(companyOption.selectorValue, "A7");
  assertRoleType(roleOption.selectorValue, "A8");

  return {
    companyType: companyOption.selectorValue,
    roleType: roleOption.selectorValue,
    companyQuestionId: "A7",
    roleQuestionId: "A8"
  };
}

export function getVisibleQuestionsV2(
  questions: QuestionV2[],
  companyType: CompanyTypeV2,
  roleType: RoleTypeV2
): VisibleQuestionsV2Result {
  const visibleQuestions = questions.filter((question) => {
    if (question.visibleToAll) return true;

    if (question.displayCondition?.field === "company_type") {
      return question.displayCondition.equals === companyType;
    }

    if (question.displayCondition?.field === "work_type") {
      return question.displayCondition.equals === roleType;
    }

    return false;
  });
  const visibleQuestionIds = visibleQuestions.map((question) => question.questionId);

  if (visibleQuestions.length !== 30) {
    throw new Error(
      `visible question count must be 30 for ${companyType} + ${roleType}, got ${visibleQuestions.length}`
    );
  }

  return {
    visibleQuestions,
    visibleQuestionIds
  };
}

export function validateAnswerMapV2(
  answerMap: PathFitAnswerMapV2,
  visibleQuestions: QuestionV2[],
  options: ValidateAnswerMapV2Options = {}
): ValidateAnswerMapV2Result {
  const strict = options.strict ?? true;
  const missingQuestionIds: string[] = [];

  for (const question of visibleQuestions) {
    const selectedOptionId = answerMap[question.questionId];

    if (!selectedOptionId) {
      missingQuestionIds.push(question.questionId);
      continue;
    }

    const optionExists = question.options.some((option) => option.optionId === selectedOptionId);

    if (!optionExists) {
      throw new Error(
        `${question.questionId}: optionId ${selectedOptionId} does not belong to this question`
      );
    }
  }

  if (strict && missingQuestionIds.length > 0) {
    throw new Error(`missing answers for visible questions: ${missingQuestionIds.join(", ")}`);
  }

  return { missingQuestionIds };
}

function calculateOptionFitScore(
  option: OptionV2,
  companyType: CompanyTypeV2,
  roleType: RoleTypeV2
): {
  companyAffinity: number;
  roleAffinity: number;
  rawSignal: number;
  optionFitScore: number;
} {
  const companyAffinity = option.optionSignal.company[companyType];
  const roleAffinity = option.optionSignal.role[roleType];
  const rawSignal = clamp(
    option.optionSignal.scoreDelta + 0.5 * companyAffinity + 0.5 * roleAffinity,
    -4,
    4
  );
  const optionFitScore = clamp(70 + rawSignal * 7.5, 0, 100);

  return {
    companyAffinity,
    roleAffinity,
    rawSignal,
    optionFitScore
  };
}

function calculateDimensionScores(
  answerMap: PathFitAnswerMapV2,
  visibleQuestions: QuestionV2[],
  pathSelection: DerivedPathSelectionV2,
  allQuestions: QuestionV2[]
): {
  dimensionScores: DimensionScoresV2;
  debugSignals: PathFitScoringResultV2["debugSignals"];
} {
  const dimensionBuckets = Object.fromEntries(
    DIMENSION_KEYS.map((dimension) => [dimension, [] as number[]])
  ) as Record<DimensionKeyV2, number[]>;
  const debugSignals: PathFitScoringResultV2["debugSignals"] = [];
  const visibleQuestionIdSet = new Set(visibleQuestions.map((question) => question.questionId));

  for (const [questionId, optionId] of Object.entries(answerMap)) {
    if (visibleQuestionIdSet.has(questionId)) continue;

    const question = allQuestions.find((item) => item.questionId === questionId);
    const option = question?.options.find((item) => item.optionId === optionId);

    debugSignals.push({
      questionId,
      optionId,
      dim: option?.optionSignal.dim ?? [],
      scoreDelta: option?.optionSignal.scoreDelta ?? 0,
      companyAffinity: 0,
      roleAffinity: 0,
      rawSignal: 0,
      optionFitScore: 0,
      ignored: true,
      reason: "answer is not visible for current company_type + work_type"
    });
  }

  for (const question of visibleQuestions) {
    const option = findSelectedOption(question, answerMap);
    const { companyAffinity, roleAffinity, rawSignal, optionFitScore } =
      calculateOptionFitScore(option, pathSelection.companyType, pathSelection.roleType);

    debugSignals.push({
      questionId: question.questionId,
      optionId: option.optionId,
      dim: option.optionSignal.dim,
      scoreDelta: option.optionSignal.scoreDelta,
      companyAffinity,
      roleAffinity,
      rawSignal,
      optionFitScore
    });

    for (const dimension of option.optionSignal.dim) {
      dimensionBuckets[dimension].push(optionFitScore);
    }
  }

  const dimensionScores = Object.fromEntries(
    DIMENSION_KEYS.map((dimension) => {
      const scores = dimensionBuckets[dimension];

      if (scores.length === 0) {
        debugSignals.push({
          questionId: "__dimension_default__",
          optionId: dimension,
          dim: [dimension],
          scoreDelta: 0,
          companyAffinity: 0,
          roleAffinity: 0,
          rawSignal: 0,
          optionFitScore: 70,
          reason: "dimension has no scoring items; defaulted to 70"
        });

        return [dimension, 70];
      }

      const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      return [dimension, roundScore(average)];
    })
  ) as DimensionScoresV2;

  return {
    dimensionScores,
    debugSignals
  };
}

function calculateRawWeightedScore(dimensionScores: DimensionScoresV2): number {
  return roundScore(
    DIMENSION_KEYS.reduce(
      (sum, dimension) => sum + dimensionScores[dimension] * DIMENSION_WEIGHTS[dimension],
      0
    )
  );
}

function buildCap(
  dimension: DimensionKeyV2,
  capValue: number,
  reason: string
): CapRuleResultV2 {
  return {
    triggered: true,
    dimension,
    capValue,
    reason
  };
}

function evaluateCaps(dimensionScores: DimensionScoresV2): CapRuleResultV2[] {
  const caps: CapRuleResultV2[] = [];

  if (dimensionScores.admissionFitScore < 35) {
    caps.push(
      buildCap(
        "admissionFitScore",
        55,
        "admissionFitScore < 35 limits finalPathFitScore to 55"
      )
    );
  }

  if (dimensionScores.admissionFitScore < 45) {
    caps.push(
      buildCap(
        "admissionFitScore",
        62,
        "admissionFitScore < 45 limits finalPathFitScore to 62"
      )
    );
  }

  if (dimensionScores.motivationFitScore < 45) {
    caps.push(
      buildCap(
        "motivationFitScore",
        70,
        "motivationFitScore < 45 limits finalPathFitScore to 70"
      )
    );
  }

  if (dimensionScores.baseWorkStyleFitScore < 45) {
    caps.push(
      buildCap(
        "baseWorkStyleFitScore",
        65,
        "baseWorkStyleFitScore < 45 limits finalPathFitScore to 65"
      )
    );
  }

  if (dimensionScores.companyScenarioFitScore < 45) {
    caps.push(
      buildCap(
        "companyScenarioFitScore",
        68,
        "companyScenarioFitScore < 45 limits finalPathFitScore to 68"
      )
    );
  }

  if (dimensionScores.roleScenarioFitScore < 45) {
    caps.push(
      buildCap(
        "roleScenarioFitScore",
        68,
        "roleScenarioFitScore < 45 limits finalPathFitScore to 68"
      )
    );
  }

  return caps;
}

function getFinalPathFitLabel(finalPathFitScore: number): string {
  if (finalPathFitScore >= 85) return "路径适应度较高";
  if (finalPathFitScore >= 70) return "基本可走";
  if (finalPathFitScore >= 55) return "存在摩擦";
  if (finalPathFitScore >= 40) return "压力较大";
  return "路径压力很高";
}

function compareDimensionPriority(a: DimensionKeyV2, b: DimensionKeyV2): number {
  return OBSTACLE_PRIORITY.indexOf(a) - OBSTACLE_PRIORITY.indexOf(b);
}

export function determineObstacleV2(
  dimensionScores: DimensionScoresV2,
  caps: CapRuleResultV2[]
): ObstacleResultV2 {
  const sortedDimensions = [...DIMENSION_KEYS].sort((a, b) => {
    const scoreDiff = dimensionScores[a] - dimensionScores[b];
    if (scoreDiff !== 0) return scoreDiff;
    return compareDimensionPriority(a, b);
  });

  let primaryObstacleDimension = sortedDimensions[0];
  let capReason: string | undefined;

  if (caps.length > 0) {
    const sortedCaps = [...caps].sort((a, b) => {
      const capDiff = a.capValue - b.capValue;
      if (capDiff !== 0) return capDiff;

      const scoreDiff = dimensionScores[a.dimension] - dimensionScores[b.dimension];
      if (scoreDiff !== 0) return scoreDiff;

      return compareDimensionPriority(a.dimension, b.dimension);
    });
    primaryObstacleDimension = sortedCaps[0].dimension;
    capReason = sortedCaps[0].reason;
  }

  const primaryObstacleType = OBSTACLE_TYPE_BY_DIMENSION[primaryObstacleDimension];
  const secondaryCandidate = sortedDimensions.find(
    (dimension) =>
      dimension !== primaryObstacleDimension &&
      dimensionScores[dimension] - dimensionScores[sortedDimensions[0]] < 5
  );

  return {
    primaryObstacleType,
    primaryObstacleDimension,
    primaryObstacleReason: OBSTACLE_REASONS[primaryObstacleType],
    secondaryObstacleType: secondaryCandidate
      ? OBSTACLE_TYPE_BY_DIMENSION[secondaryCandidate]
      : undefined,
    secondaryObstacleDimension: secondaryCandidate,
    capTriggered: caps.length > 0,
    capReason
  };
}

export function scorePathFitV2(
  answerMap: PathFitAnswerMapV2,
  options: ScorePathFitV2Options = {}
): PathFitScoringResultV2 {
  const questions = options.questions ?? questionsV2Config.questions;
  const strict = options.strict ?? true;
  const pathSelection = derivePathSelectionV2(answerMap, questions);
  const { visibleQuestions, visibleQuestionIds } = getVisibleQuestionsV2(
    questions,
    pathSelection.companyType,
    pathSelection.roleType
  );
  const { missingQuestionIds } = validateAnswerMapV2(answerMap, visibleQuestions, { strict });
  const { dimensionScores, debugSignals } = calculateDimensionScores(
    answerMap,
    visibleQuestions,
    pathSelection,
    questions
  );
  const rawWeightedScore = calculateRawWeightedScore(dimensionScores);
  const caps = evaluateCaps(dimensionScores);
  const capValue = caps.length > 0 ? Math.min(...caps.map((cap) => cap.capValue)) : 100;
  const finalPathFitScore = Math.min(rawWeightedScore, capValue);
  const obstacle = determineObstacleV2(dimensionScores, caps);

  // V1.2 scoring is independent from risk cards. Risk cards may be connected
  // later as an explanation layer only. They must not decide finalPathFitScore
  // or primaryObstacleType.
  return {
    finalPathFitScore,
    finalPathFitLabel: getFinalPathFitLabel(finalPathFitScore),
    rawWeightedScore,
    dimensionScores,
    caps,
    obstacle,
    pathSelection,
    answeredQuestionCount: visibleQuestions.filter(
      (question) => Boolean(answerMap[question.questionId])
    ).length,
    expectedVisibleQuestionCount: visibleQuestions.length,
    visibleQuestionIds,
    missingQuestionIds,
    debugSignals
  };
}
