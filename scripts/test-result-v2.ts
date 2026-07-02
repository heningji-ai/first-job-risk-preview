import type {
  CompanyTypeV2,
  DimensionKeyV2,
  PathFitAnswerMapV2,
  PathFitResultPresentationV2,
  QuestionV2,
  RoleTypeV2
} from "../src/types/pathFitV2";

const { questionsV2Config } = (await import("../src/lib/questionsV2Data" + ".ts")) as typeof import("../src/lib/questionsV2Data");
const { derivePathSelectionV2, getVisibleQuestionsV2, scorePathFitV2 } = await import(
  "../src/lib/pathFitScoringV2" + ".ts"
);
const { buildPathFitResultV2 } = await import("../src/lib/pathFitResultBuilderV2" + ".ts");
const {
  getPathFitSampleAnswerMapV2,
  PATH_FIT_V2_SAMPLE_KEYS,
  PATH_FIT_V2_SAMPLE_LABELS
} = await import("../src/lib/pathFitSampleAnswersV2" + ".ts");

type SampleContext = {
  companyType: CompanyTypeV2;
  roleType: RoleTypeV2;
};

type SampleDefinition = {
  name: string;
  companyType: CompanyTypeV2;
  roleType: RoleTypeV2;
  chooser: (question: QuestionV2, context: SampleContext) => string;
};

const questions = questionsV2Config.questions;

function fail(message: string): never {
  throw new Error(`[test-result-v2] ${message}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) fail(message);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rawSignalForOption(
  option: QuestionV2["options"][number],
  companyType: CompanyTypeV2,
  roleType: RoleTypeV2
): number {
  return clamp(
    option.optionSignal.scoreDelta +
      0.5 * option.optionSignal.company[companyType] +
      0.5 * option.optionSignal.role[roleType],
    -4,
    4
  );
}

function selectPathOptionId(questionId: "A7" | "A8", selectorValue: string): string {
  const question = questions.find((item) => item.questionId === questionId);
  const option = question?.options.find((item) => item.selectorValue === selectorValue);

  if (!option) {
    fail(`${questionId}: selectorValue ${selectorValue} not found`);
  }

  return option.optionId;
}

function chooseHighestRawSignal(question: QuestionV2, context: SampleContext): string {
  return [...question.options].sort(
    (a, b) =>
      rawSignalForOption(b, context.companyType, context.roleType) -
      rawSignalForOption(a, context.companyType, context.roleType)
  )[0].optionId;
}

function chooseLowestForDimension(
  question: QuestionV2,
  context: SampleContext,
  dimension: DimensionKeyV2
): string {
  const targetOptions = question.options.filter((option) =>
    option.optionSignal.dim.includes(dimension)
  );

  if (targetOptions.length === 0) {
    return chooseHighestRawSignal(question, context);
  }

  return [...targetOptions].sort(
    (a, b) =>
      rawSignalForOption(a, context.companyType, context.roleType) -
      rawSignalForOption(b, context.companyType, context.roleType)
  )[0].optionId;
}

function buildAnswerMap(sample: SampleDefinition): PathFitAnswerMapV2 {
  const answerMap: PathFitAnswerMapV2 = {
    A7: selectPathOptionId("A7", sample.companyType),
    A8: selectPathOptionId("A8", sample.roleType)
  };
  const pathSelection = derivePathSelectionV2(answerMap, questions);
  const { visibleQuestions } = getVisibleQuestionsV2(
    questions,
    pathSelection.companyType,
    pathSelection.roleType
  );

  for (const question of visibleQuestions) {
    if (question.questionId === "A7" || question.questionId === "A8") continue;

    answerMap[question.questionId] = sample.chooser(question, {
      companyType: sample.companyType,
      roleType: sample.roleType
    });
  }

  return answerMap;
}

function collectPublicText(value: unknown): string[] {
  if (value === undefined || value === null) return [];

  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectPublicText(item));

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
      if (key === "debug") return [];
      return collectPublicText(item);
    });
  }

  return [];
}

function assertNoForbiddenPublicWording(sampleName: string, result: PathFitResultPresentationV2): void {
  const forbidden = [
    "A 档",
    "B 档",
    "C 档",
    "D 档",
    "档位",
    "评级",
    "等级",
    "score",
    "cardId",
    "pathFitBand",
    "诊断分数",
    "能力分数",
    "职业匹配分",
    "性格匹配度",
    "你不适合",
    "你就是",
    "必须放弃",
    "免费咨询",
    "立即咨询",
    "购买服务",
    "保证入职",
    "企业微信",
    "回复【重估】"
  ];
  const text = collectPublicText(result).join("\n");
  const matched = forbidden.find((item) => text.includes(item));

  assert(!matched, `${sampleName}: public presentation contains forbidden wording: ${matched}`);
}

function assertResultShape(sample: SampleDefinition, result: PathFitResultPresentationV2): void {
  assert(result.version === "v1.2", `${sample.name}: version must be v1.2`);
  assert(result.pathContext.companyType === sample.companyType, `${sample.name}: companyType mismatch`);
  assert(result.pathContext.roleType === sample.roleType, `${sample.name}: roleType mismatch`);
  assert(Boolean(result.pathContext.companyTypeLabel), `${sample.name}: companyTypeLabel missing`);
  assert(Boolean(result.pathContext.roleTypeLabel), `${sample.name}: roleTypeLabel missing`);
  assert(result.displayDimensions.length === 4, `${sample.name}: displayDimensions length must be 4`);
  assert(
    ["admission", "motivation", "work_style", "scenario_reaction"].every((key) =>
      result.displayDimensions.some((dimension) => dimension.key === key)
    ),
    `${sample.name}: displayDimensions missing required keys`
  );
  assert(result.explanationSignals.length <= 3, `${sample.name}: explanationSignals must be <= 3`);
  assertNoForbiddenPublicWording(sample.name, result);
}

function assertScoringConsistency(
  sample: SampleDefinition,
  answerMap: PathFitAnswerMapV2,
  result: PathFitResultPresentationV2
): void {
  const scoringResult = scorePathFitV2(answerMap, { questions, strict: true });
  const repeatedResult = buildPathFitResultV2(answerMap);
  const workStyleExpected = Math.round(
    (scoringResult.dimensionScores.baseWorkStyleFitScore * 20 +
      scoringResult.dimensionScores.companyScenarioFitScore * 10) /
      30
  );
  const workStyleDisplay = result.displayDimensions.find(
    (dimension) => dimension.key === "work_style"
  );

  assert(
    result.finalPathFitScore === scoringResult.finalPathFitScore,
    `${sample.name}: finalPathFitScore must match scorePathFitV2`
  );
  assert(
    result.finalPathFitLabel === scoringResult.finalPathFitLabel,
    `${sample.name}: finalPathFitLabel must match scorePathFitV2`
  );
  assert(
    result.primaryObstacle.type === scoringResult.obstacle.primaryObstacleType,
    `${sample.name}: primaryObstacle must match scorePathFitV2`
  );
  assert(
    result.capTriggered === scoringResult.obstacle.capTriggered,
    `${sample.name}: capTriggered must match scorePathFitV2`
  );
  assert(
    workStyleDisplay?.score === workStyleExpected,
    `${sample.name}: work_style display score must merge baseWorkStyle and companyScenario`
  );
  assert(
    JSON.stringify(result) === JSON.stringify(repeatedResult),
    `${sample.name}: repeated buildPathFitResultV2 output must be deterministic`
  );
}

function summarize(sample: SampleDefinition, result: PathFitResultPresentationV2): void {
  console.log(`[test-result-v2] PASS: ${sample.name}`);
  console.log(`  finalPathFitScore: ${result.finalPathFitScore}`);
  console.log(`  resultTitle: ${result.resultTitle}`);
  console.log(`  primaryObstacle.title: ${result.primaryObstacle.title}`);
  console.log(
    `  displayDimensions: ${result.displayDimensions
      .map((dimension) => `${dimension.key}:${dimension.score}:${dimension.riskLevel}`)
      .join(", ")}`
  );
  console.log(
    `  explanationSignals: ${result.explanationSignals
      .map((signal) => `${signal.tag}:${signal.severity}`)
      .join(", ")}`
  );
}

const samples: SampleDefinition[] = [
  {
    name: "high_fit_sample",
    companyType: "big_platform",
    roleType: "tech_data_product",
    chooser: (question, context) => chooseHighestRawSignal(question, context)
  },
  {
    name: "low_admission_sample",
    companyType: "big_platform",
    roleType: "tech_data_product",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "admissionFitScore")
  },
  {
    name: "motivation_conflict_sample",
    companyType: "startup",
    roleType: "sales",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "motivationFitScore")
  },
  {
    name: "work_style_conflict_sample",
    companyType: "startup",
    roleType: "operation_project",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "baseWorkStyleFitScore")
  },
  {
    name: "company_environment_conflict_sample",
    companyType: "soe",
    roleType: "function_support",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "companyScenarioFitScore")
  },
  {
    name: "role_scenario_conflict_sample",
    companyType: "mnc",
    roleType: "sales",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "roleScenarioFitScore")
  }
];

for (const sample of samples) {
  const answerMap = buildAnswerMap(sample);
  const result = buildPathFitResultV2(answerMap);

  assertResultShape(sample, result);
  assertScoringConsistency(sample, answerMap, result);
  summarize(sample, result);
}

for (const sampleKey of PATH_FIT_V2_SAMPLE_KEYS) {
  const answerMap = getPathFitSampleAnswerMapV2(sampleKey);
  const scoringResult = scorePathFitV2(answerMap, { questions, strict: true });
  const result = buildPathFitResultV2(answerMap);

  assert(
    scoringResult.visibleQuestionIds.length === 30,
    `${sampleKey}: visibleQuestionIds must be 30`
  );
  assert(
    scoringResult.answeredQuestionCount === 30,
    `${sampleKey}: answeredQuestionCount must be 30`
  );
  assertResultShape(
    {
      name: sampleKey,
      companyType: scoringResult.pathSelection.companyType,
      roleType: scoringResult.pathSelection.roleType,
      chooser: (question) => question.options[0].optionId
    },
    result
  );
  assertScoringConsistency(
    {
      name: sampleKey,
      companyType: scoringResult.pathSelection.companyType,
      roleType: scoringResult.pathSelection.roleType,
      chooser: (question) => question.options[0].optionId
    },
    answerMap,
    result
  );
  console.log(`[test-result-v2] PASS: ${sampleKey} ${PATH_FIT_V2_SAMPLE_LABELS[sampleKey]}`);
}

console.log(`[test-result-v2] PASS: ${samples.length} samples`);
console.log(`[test-result-v2] PASS: ${PATH_FIT_V2_SAMPLE_KEYS.length} preview sample answer maps`);
