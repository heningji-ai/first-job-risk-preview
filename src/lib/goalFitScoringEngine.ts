import type {
  CompanyType,
  GoalFitAnswerMap,
  GoalFitQuestion,
  GoalFitQuestionBank,
  GoalFitScoreResult,
  MotivationTag,
  MotivationTagCount,
  QuestionModule,
  QuestionOption,
  RiskTag,
  RiskTagCount,
  RoleType
} from "./goalFitTypes";

const {
  companyEntryWeights,
  companyMotivationFit,
  companyRolePairScore,
  DEFAULT_COMPANY_SCORE,
  DEFAULT_PAIR_SCORE,
  DEFAULT_ROLE_SCORE,
  motivationTagPriority,
  roleEntryWeights,
  roleMotivationFit,
  SCORE_VERSION
} = (await import("./goalFitScoringConfig" + ".ts")) as typeof import("./goalFitScoringConfig");
const { selectGoalFitQuestions } = (await import(
  "./goalFitQuestionSelector" + ".ts"
)) as typeof import("./goalFitQuestionSelector");

type CalculateGoalFitScoresInput = {
  questionBank: GoalFitQuestionBank;
  answers: GoalFitAnswerMap;
  targetCompany: CompanyType;
  targetRole: RoleType;
};

const riskTagPriority: RiskTag[] = [
  "HIGH_PRESSURE",
  "SOCIAL_DRAIN",
  "AMBIGUITY",
  "NEEDS_TRAINING",
  "PROCESS_MISMATCH",
  "BOUNDARY_CONFLICT",
  "LOW_RESOURCE_INITIATIVE",
  "REJECTION_SENSITIVE",
  "GROWTH_GAP",
  "MOTIVATION_MISMATCH",
  "LOW_CLARITY"
];

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function getSelectedOption(question: GoalFitQuestion, answers: GoalFitAnswerMap): QuestionOption {
  const answer = answers[question.id];

  if (!answer) {
    throw new Error(`Goal Fit answer missing for question: ${question.id}`);
  }

  const option = question.options.find((item) => item.id === answer);

  if (!option) {
    throw new Error(`Goal Fit invalid optionId ${answer} for question: ${question.id}`);
  }

  return option;
}

function getQuestionsByModule(questions: GoalFitQuestion[], module: QuestionModule): GoalFitQuestion[] {
  return questions.filter((question) => question.module === module);
}

function calculateWeightedEntryScore(
  questions: GoalFitQuestion[],
  answers: GoalFitAnswerMap,
  weights: Partial<Record<string, number>>,
  label: string
): number {
  let weightedTotal = 0;
  let weightTotal = 0;

  for (const question of questions) {
    const weight = weights[question.id] ?? 0;

    if (weight <= 0) continue;

    const option = getSelectedOption(question, answers);
    weightedTotal += (option.mainScore / 5) * weight;
    weightTotal += weight;
  }

  if (weightTotal <= 0) {
    throw new Error(`Goal Fit ${label} weight total must be greater than 0`);
  }

  return clampScore((weightedTotal / weightTotal) * 100);
}

function calculateAverageCompanyScore(
  questions: GoalFitQuestion[],
  answers: GoalFitAnswerMap,
  targetCompany: CompanyType
): number {
  if (questions.length === 0) {
    throw new Error("Goal Fit company score source questions must not be empty");
  }

  const total = questions.reduce((sum, question) => {
    const option = getSelectedOption(question, answers);
    return sum + (option.companyScores?.[targetCompany] ?? DEFAULT_COMPANY_SCORE);
  }, 0);

  return clampScore((total / questions.length / 5) * 100);
}

function calculateAverageRoleScore(
  questions: GoalFitQuestion[],
  answers: GoalFitAnswerMap,
  targetRole: RoleType
): number {
  if (questions.length === 0) {
    throw new Error("Goal Fit role score source questions must not be empty");
  }

  const total = questions.reduce((sum, question) => {
    const option = getSelectedOption(question, answers);
    return sum + (option.roleScores?.[targetRole] ?? DEFAULT_ROLE_SCORE);
  }, 0);

  return clampScore((total / questions.length / 5) * 100);
}

function calculateMainScoreAverage(
  questions: GoalFitQuestion[],
  answers: GoalFitAnswerMap,
  expectedCount: number,
  label: string
): number {
  if (questions.length !== expectedCount) {
    throw new Error(`Goal Fit ${label} must contain ${expectedCount} questions, got ${questions.length}`);
  }

  const total = questions.reduce((sum, question) => {
    const option = getSelectedOption(question, answers);
    return sum + option.mainScore;
  }, 0);

  return clampScore((total / (expectedCount * 5)) * 100);
}

function countMotivationTags(
  questions: GoalFitQuestion[],
  answers: GoalFitAnswerMap
): MotivationTagCount[] {
  const counts = new Map<MotivationTag, number>();

  for (const question of questions) {
    const option = getSelectedOption(question, answers);

    for (const tag of option.motivationTags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return motivationTagPriority.indexOf(a.tag) - motivationTagPriority.indexOf(b.tag);
    });
}

function deriveMotivationTags(motivationTagCounts: MotivationTagCount[]): MotivationTag[] {
  if (motivationTagCounts.length === 0) return ["balanced"];

  return motivationTagCounts.slice(0, 2).map((item) => item.tag);
}

function calculateMotivationFitScore(
  tags: MotivationTag[],
  targetCompany: CompanyType,
  targetRole: RoleType
): number {
  const scores = tags.map(
    (tag) => ((companyMotivationFit[tag][targetCompany] + roleMotivationFit[tag][targetRole]) / 10) * 100
  );
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  return clampScore(average);
}

function calculatePairScore(targetCompany: CompanyType, targetRole: RoleType): number {
  return clampScore(companyRolePairScore[`${targetCompany}_${targetRole}`] ?? DEFAULT_PAIR_SCORE);
}

function countRiskTags(questions: GoalFitQuestion[], answers: GoalFitAnswerMap): RiskTagCount[] {
  const counts = new Map<RiskTag, number>();

  for (const question of questions) {
    const option = getSelectedOption(question, answers);

    for (const tag of option.riskTags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return riskTagPriority.indexOf(a.tag) - riskTagPriority.indexOf(b.tag);
    });
}

export function calculateGoalFitScores({
  questionBank,
  answers,
  targetCompany,
  targetRole
}: CalculateGoalFitScoresInput): GoalFitScoreResult {
  const selectedQuestions = selectGoalFitQuestions(questionBank, targetRole);
  const selectedQuestionIds = selectedQuestions.map((question) => question.id);

  for (const question of selectedQuestions) {
    getSelectedOption(question, answers);
  }

  const backgroundQuestions = getQuestionsByModule(selectedQuestions, "A_BACKGROUND");
  const personalityQuestions = getQuestionsByModule(selectedQuestions, "B_PERSONALITY");
  const motivationQuestions = getQuestionsByModule(selectedQuestions, "C_MOTIVATION");
  const workplaceScenarioQuestions = getQuestionsByModule(selectedQuestions, "D_WORKPLACE_SCENARIO");
  const roleScenarioQuestions = getQuestionsByModule(selectedQuestions, "E_ROLE_SCENARIO");

  const companyEntryScore = calculateWeightedEntryScore(
    backgroundQuestions,
    answers,
    companyEntryWeights[targetCompany],
    "companyEntryScore"
  );
  const roleEntryScore = calculateWeightedEntryScore(
    backgroundQuestions,
    answers,
    roleEntryWeights[targetRole],
    "roleEntryScore"
  );
  const companyPersonalityScore = calculateAverageCompanyScore(
    personalityQuestions,
    answers,
    targetCompany
  );
  const companyBehaviorScore = calculateAverageCompanyScore(
    workplaceScenarioQuestions,
    answers,
    targetCompany
  );
  const rolePersonalityScore = calculateAverageRoleScore(personalityQuestions, answers, targetRole);
  const roleBehaviorScore = calculateMainScoreAverage(
    roleScenarioQuestions,
    answers,
    8,
    "roleBehaviorScore"
  );
  const motivationTagCounts = countMotivationTags(motivationQuestions, answers);
  const motivationTags = deriveMotivationTags(motivationTagCounts);
  const motivationFitScore = calculateMotivationFitScore(motivationTags, targetCompany, targetRole);
  const pairScore = calculatePairScore(targetCompany, targetRole);
  const companyFitScore = clampScore(
    companyEntryScore * 0.25 +
      companyPersonalityScore * 0.3 +
      companyBehaviorScore * 0.3 +
      motivationFitScore * 0.15
  );
  const roleFitScore = clampScore(
    roleEntryScore * 0.25 +
      rolePersonalityScore * 0.25 +
      roleBehaviorScore * 0.35 +
      motivationFitScore * 0.15
  );
  const overallScore = clampScore(companyFitScore * 0.45 + roleFitScore * 0.45 + pairScore * 0.1);

  return {
    targetCompany,
    targetRole,
    companyEntryScore,
    roleEntryScore,
    companyPersonalityScore,
    companyBehaviorScore,
    companyFitScore,
    rolePersonalityScore,
    roleBehaviorScore,
    roleFitScore,
    motivationFitScore,
    pairScore,
    overallScore,
    motivationTags,
    motivationTagCounts,
    riskTagCounts: countRiskTags(selectedQuestions, answers),
    answeredQuestionCount: selectedQuestions.length,
    selectedQuestionIds,
    scoreVersion: SCORE_VERSION
  };
}
