import questionsV2ConfigJson from "../src/config/questions_v2.json" with { type: "json" };
import type {
  CompanyTypeV2,
  DimensionKeyV2,
  PathFitAnswerMapV2,
  PathFitScoringResultV2,
  QuestionV2,
  QuestionsV2Config,
  RoleTypeV2
} from "../src/types/pathFitV2";

const { derivePathSelectionV2, getVisibleQuestionsV2, scorePathFitV2 } = await import(
  "../src/lib/pathFitScoringV2" + ".ts"
);

type SampleDefinition = {
  name: string;
  companyType: CompanyTypeV2;
  roleType: RoleTypeV2;
  chooser: (question: QuestionV2, context: SampleContext) => string;
  assertResult: (result: PathFitScoringResultV2) => void;
};

type SampleContext = {
  companyType: CompanyTypeV2;
  roleType: RoleTypeV2;
};

type ScanRow = {
  companyType: CompanyTypeV2;
  roleType: RoleTypeV2;
  finalPathFitScore: number;
  rawWeightedScore: number;
  dimensionScores: PathFitScoringResultV2["dimensionScores"];
  primaryObstacleType: PathFitScoringResultV2["obstacle"]["primaryObstacleType"];
  capTriggered: boolean;
};

const questionsV2Config = questionsV2ConfigJson as QuestionsV2Config;
const questions = questionsV2Config.questions;
const companyTypes: CompanyTypeV2[] = [
  "soe",
  "mnc",
  "big_platform",
  "startup",
  "sme_private"
];
const roleTypes: RoleTypeV2[] = [
  "sales",
  "operation_project",
  "content_marketing",
  "tech_data_product",
  "function_support"
];
const dimensionKeys: DimensionKeyV2[] = [
  "admissionFitScore",
  "motivationFitScore",
  "baseWorkStyleFitScore",
  "companyScenarioFitScore",
  "roleScenarioFitScore"
];

function fail(message: string): never {
  throw new Error(`[test-scoring-v2] ${message}`);
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

function chooseLowestRawSignal(question: QuestionV2, context: SampleContext): string {
  return [...question.options].sort(
    (a, b) =>
      rawSignalForOption(a, context.companyType, context.roleType) -
      rawSignalForOption(b, context.companyType, context.roleType)
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

function buildAnswerMap(
  companyType: CompanyTypeV2,
  roleType: RoleTypeV2,
  chooser: (question: QuestionV2, context: SampleContext) => string
): PathFitAnswerMapV2 {
  const answerMap: PathFitAnswerMapV2 = {
    A7: selectPathOptionId("A7", companyType),
    A8: selectPathOptionId("A8", roleType)
  };
  const pathSelection = derivePathSelectionV2(answerMap, questions);
  const { visibleQuestions } = getVisibleQuestionsV2(
    questions,
    pathSelection.companyType,
    pathSelection.roleType
  );

  for (const question of visibleQuestions) {
    if (question.questionId === "A7" || question.questionId === "A8") continue;

    answerMap[question.questionId] = chooser(question, {
      companyType,
      roleType
    });
  }

  return answerMap;
}

function scoreSample(
  companyType: CompanyTypeV2,
  roleType: RoleTypeV2,
  chooser: (question: QuestionV2, context: SampleContext) => string
): PathFitScoringResultV2 {
  return scorePathFitV2(buildAnswerMap(companyType, roleType, chooser), {
    questions,
    strict: true
  });
}

function assertResultBasics(sampleName: string, result: PathFitScoringResultV2): void {
  assert(result.visibleQuestionIds.length === 30, `${sampleName}: visibleQuestionIds must be 30`);
  assert(result.answeredQuestionCount === 30, `${sampleName}: answeredQuestionCount must be 30`);
  assert(
    result.expectedVisibleQuestionCount === 30,
    `${sampleName}: expectedVisibleQuestionCount must be 30`
  );

  for (const dimension of dimensionKeys) {
    const score = result.dimensionScores[dimension];
    assert(score >= 0 && score <= 100, `${sampleName}: ${dimension} out of range`);
  }

  assert(
    result.rawWeightedScore >= 0 && result.rawWeightedScore <= 100,
    `${sampleName}: rawWeightedScore out of range`
  );
  assert(
    result.finalPathFitScore >= 0 && result.finalPathFitScore <= 100,
    `${sampleName}: finalPathFitScore out of range`
  );

  if (result.caps.length > 0) {
    assert(
      result.finalPathFitScore <= result.rawWeightedScore,
      `${sampleName}: capped finalPathFitScore must not exceed rawWeightedScore`
    );
  }
}

function assertPrimaryObstacleOrLowerCap(
  sampleName: string,
  result: PathFitScoringResultV2,
  expected: PathFitScoringResultV2["obstacle"]["primaryObstacleType"]
): void {
  if (result.obstacle.primaryObstacleType === expected) return;

  assert(
    result.caps.length > 0,
    `${sampleName}: expected primaryObstacleType ${expected}, got ${result.obstacle.primaryObstacleType}`
  );

  console.log(
    `[test-scoring-v2] INFO: ${sampleName} primary obstacle is ${result.obstacle.primaryObstacleType} because a lower cap won.`
  );
}

function summarize(sample: SampleDefinition, result: PathFitScoringResultV2): void {
  console.log(`[test-scoring-v2] PASS: ${sample.name}`);
  console.log(`  companyType: ${result.pathSelection.companyType}`);
  console.log(`  roleType: ${result.pathSelection.roleType}`);
  console.log(`  finalPathFitScore: ${result.finalPathFitScore}`);
  console.log(`  finalPathFitLabel: ${result.finalPathFitLabel}`);
  console.log(`  rawWeightedScore: ${result.rawWeightedScore}`);
  console.log(`  dimensionScores: ${JSON.stringify(result.dimensionScores)}`);
  console.log(`  primaryObstacleType: ${result.obstacle.primaryObstacleType}`);
  console.log(`  secondaryObstacleType: ${result.obstacle.secondaryObstacleType ?? "none"}`);
  console.log(`  capTriggered: ${result.obstacle.capTriggered}`);
}

function toScanRow(
  companyType: CompanyTypeV2,
  roleType: RoleTypeV2,
  result: PathFitScoringResultV2
): ScanRow {
  return {
    companyType,
    roleType,
    finalPathFitScore: result.finalPathFitScore,
    rawWeightedScore: result.rawWeightedScore,
    dimensionScores: result.dimensionScores,
    primaryObstacleType: result.obstacle.primaryObstacleType,
    capTriggered: result.obstacle.capTriggered
  };
}

function scanAllCombinations(
  chooser: (question: QuestionV2, context: SampleContext) => string
): ScanRow[] {
  const rows: ScanRow[] = [];

  for (const companyType of companyTypes) {
    for (const roleType of roleTypes) {
      rows.push(toScanRow(companyType, roleType, scoreSample(companyType, roleType, chooser)));
    }
  }

  return rows;
}

function scoreRange(rows: ScanRow[]): { min: number; max: number } {
  return {
    min: Math.min(...rows.map((row) => row.finalPathFitScore)),
    max: Math.max(...rows.map((row) => row.finalPathFitScore))
  };
}

function findDimensionMinimum(dimension: DimensionKeyV2): ScanRow & {
  targetDimension: DimensionKeyV2;
  dimensionScore: number;
} {
  let minimum:
    | (ScanRow & {
        targetDimension: DimensionKeyV2;
        dimensionScore: number;
      })
    | undefined;

  for (const companyType of companyTypes) {
    for (const roleType of roleTypes) {
      const result = scoreSample(companyType, roleType, (question, context) =>
        chooseLowestForDimension(question, context, dimension)
      );
      const row = {
        ...toScanRow(companyType, roleType, result),
        targetDimension: dimension,
        dimensionScore: result.dimensionScores[dimension]
      };

      if (
        !minimum ||
        row.dimensionScore < minimum.dimensionScore ||
        (row.dimensionScore === minimum.dimensionScore &&
          row.finalPathFitScore < minimum.finalPathFitScore)
      ) {
        minimum = row;
      }
    }
  }

  if (!minimum) fail(`${dimension}: no minimum found`);
  return minimum;
}

const samples: SampleDefinition[] = [
  {
    name: "high_fit_sample",
    companyType: "big_platform",
    roleType: "tech_data_product",
    chooser: (question, context) => chooseHighestRawSignal(question, context),
    assertResult: (result) => {
      assert(result.finalPathFitScore >= 80, "high_fit_sample: finalPathFitScore must be >= 80");
      assert(!result.obstacle.capTriggered, "high_fit_sample: must not trigger cap");
    }
  },
  {
    name: "low_admission_sample",
    companyType: "big_platform",
    roleType: "tech_data_product",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "admissionFitScore"),
    assertResult: (result) => {
      assert(
        result.dimensionScores.admissionFitScore <= 45,
        "low_admission_sample: admissionFitScore must be <= 45"
      );
      assert(result.obstacle.capTriggered, "low_admission_sample: must trigger cap");
      assert(
        result.finalPathFitScore <= 62,
        "low_admission_sample: finalPathFitScore must be <= 62"
      );
      assert(
        result.obstacle.primaryObstacleType === "admission_barrier",
        "low_admission_sample: primaryObstacleType must be admission_barrier"
      );
    }
  },
  {
    name: "motivation_conflict_sample",
    companyType: "startup",
    roleType: "sales",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "motivationFitScore"),
    assertResult: (result) => {
      assert(
        result.dimensionScores.motivationFitScore <= 55,
        "motivation_conflict_sample: motivationFitScore must be <= 55"
      );
      assertPrimaryObstacleOrLowerCap(
        "motivation_conflict_sample",
        result,
        "motivation_expectation"
      );
    }
  },
  {
    name: "severe_motivation_cap_sample",
    companyType: "startup",
    roleType: "sales",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "motivationFitScore"),
    assertResult: (result) => {
      assert(
        result.dimensionScores.motivationFitScore <= 45,
        "severe_motivation_cap_sample: motivationFitScore must be <= 45"
      );
      assert(result.obstacle.capTriggered, "severe_motivation_cap_sample: must trigger cap");
    }
  },
  {
    name: "work_style_conflict_sample",
    companyType: "startup",
    roleType: "operation_project",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "baseWorkStyleFitScore"),
    assertResult: (result) => {
      assert(
        result.dimensionScores.baseWorkStyleFitScore <= 55,
        "work_style_conflict_sample: baseWorkStyleFitScore must be <= 55"
      );
      assertPrimaryObstacleOrLowerCap("work_style_conflict_sample", result, "work_style");
    }
  },
  {
    name: "severe_work_style_cap_sample",
    companyType: "startup",
    roleType: "operation_project",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "baseWorkStyleFitScore"),
    assertResult: (result) => {
      assert(
        result.dimensionScores.baseWorkStyleFitScore <= 45,
        "severe_work_style_cap_sample: baseWorkStyleFitScore must be <= 45"
      );
      assert(result.obstacle.capTriggered, "severe_work_style_cap_sample: must trigger cap");
    }
  },
  {
    name: "company_environment_conflict_sample",
    companyType: "soe",
    roleType: "function_support",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "companyScenarioFitScore"),
    assertResult: (result) => {
      assert(
        result.dimensionScores.companyScenarioFitScore <= 45,
        "company_environment_conflict_sample: companyScenarioFitScore must be <= 45"
      );
      assert(result.obstacle.capTriggered, "company_environment_conflict_sample: must trigger cap");
      assertPrimaryObstacleOrLowerCap(
        "company_environment_conflict_sample",
        result,
        "company_environment"
      );
    }
  },
  {
    name: "role_scenario_conflict_sample",
    companyType: "mnc",
    roleType: "sales",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "roleScenarioFitScore"),
    assertResult: (result) => {
      assert(
        result.dimensionScores.roleScenarioFitScore <= 45,
        "role_scenario_conflict_sample: roleScenarioFitScore must be <= 45"
      );
      assert(result.obstacle.capTriggered, "role_scenario_conflict_sample: must trigger cap");
      assertPrimaryObstacleOrLowerCap("role_scenario_conflict_sample", result, "role_scenario");
    }
  }
];

for (const sample of samples) {
  const answerMap = buildAnswerMap(sample.companyType, sample.roleType, sample.chooser);
  const result = scorePathFitV2(answerMap, { questions, strict: true });
  const repeatedResult = scorePathFitV2(answerMap, { questions, strict: true });

  assertResultBasics(sample.name, result);
  assert(
    JSON.stringify(result) === JSON.stringify(repeatedResult),
    `${sample.name}: repeated scoring must be deterministic`
  );
  sample.assertResult(result);
  summarize(sample, result);
}

const highestRows = scanAllCombinations((question, context) =>
  chooseHighestRawSignal(question, context)
);
const lowestRows = scanAllCombinations((question, context) =>
  chooseLowestRawSignal(question, context)
);
const highestRange = scoreRange(highestRows);
const lowestRange = scoreRange(lowestRows);
const lowestCapCount = lowestRows.filter((row) => row.capTriggered).length;
const dimensionMinimums = dimensionKeys.map((dimension) => findDimensionMinimum(dimension));

console.log(
  `[test-scoring-v2] scan highest finalPathFitScore range: ${highestRange.min}-${highestRange.max}`
);
console.log(
  `[test-scoring-v2] scan lowest finalPathFitScore range: ${lowestRange.min}-${lowestRange.max}`
);
console.log(`[test-scoring-v2] scan lowest capTriggered count: ${lowestCapCount}`);
for (const row of dimensionMinimums) {
  console.log(
    `[test-scoring-v2] min ${row.targetDimension}: ${row.dimensionScore} (${row.companyType} + ${row.roleType}), final=${row.finalPathFitScore}, cap=${row.capTriggered}`
  );
}

assert(
  highestRange.min >= 80 && highestRange.max <= 95,
  `highest theoretical finalPathFitScore range should be roughly 80-95, got ${highestRange.min}-${highestRange.max}`
);
assert(
  lowestRange.min <= 55,
  `lowest theoretical finalPathFitScore minimum must be <= 55, got ${lowestRange.min}`
);
assert(lowestCapCount > 0, "at least one lowest theoretical combination must trigger cap");
assert(
  !lowestRows.every((row) => row.finalPathFitScore >= 60 && !row.capTriggered),
  "lowest theoretical combinations must not all remain 60+ with no cap"
);

for (const row of dimensionMinimums) {
  assert(
    row.dimensionScore <= 45,
    `${row.targetDimension}: minimum reachable score must be <= 45, got ${row.dimensionScore}`
  );
}

console.log(`[test-scoring-v2] PASS: ${samples.length} samples`);
console.log("[test-scoring-v2] PASS: extreme scan checks");
