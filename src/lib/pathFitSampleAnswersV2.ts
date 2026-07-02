import type {
  CompanyTypeV2,
  DimensionKeyV2,
  PathFitAnswerMapV2,
  QuestionV2,
  RoleTypeV2
} from "../types/pathFitV2";

const { derivePathSelectionV2, getVisibleQuestionsV2 } = await import("./pathFitScoringV2" + ".ts");
const { questionsV2Config } = (await import("./questionsV2Data" + ".ts")) as typeof import("./questionsV2Data");

export const PATH_FIT_V2_SAMPLE_KEYS = [
  "high_fit",
  "low_admission",
  "motivation_conflict",
  "work_style_conflict",
  "company_environment_conflict",
  "role_scenario_conflict"
] as const;

export type PathFitSampleKeyV2 = (typeof PATH_FIT_V2_SAMPLE_KEYS)[number];

export const PATH_FIT_V2_SAMPLE_LABELS: Record<PathFitSampleKeyV2, string> = {
  high_fit: "高适配样本",
  low_admission: "准入压力样本",
  motivation_conflict: "动机预期冲突样本",
  work_style_conflict: "工作方式冲突样本",
  company_environment_conflict: "公司环境冲突样本",
  role_scenario_conflict: "岗位场景冲突样本"
};

type SampleDefinition = {
  companyType: CompanyTypeV2;
  roleType: RoleTypeV2;
  chooser: (question: QuestionV2, context: SampleContext) => string;
};

type SampleContext = {
  companyType: CompanyTypeV2;
  roleType: RoleTypeV2;
};

const questions = questionsV2Config.questions;

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
    throw new Error(`${questionId}: selectorValue ${selectorValue} not found`);
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

const SAMPLE_DEFINITIONS: Record<PathFitSampleKeyV2, SampleDefinition> = {
  high_fit: {
    companyType: "big_platform",
    roleType: "tech_data_product",
    chooser: (question, context) => chooseHighestRawSignal(question, context)
  },
  low_admission: {
    companyType: "big_platform",
    roleType: "tech_data_product",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "admissionFitScore")
  },
  motivation_conflict: {
    companyType: "startup",
    roleType: "sales",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "motivationFitScore")
  },
  work_style_conflict: {
    companyType: "startup",
    roleType: "operation_project",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "baseWorkStyleFitScore")
  },
  company_environment_conflict: {
    companyType: "soe",
    roleType: "function_support",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "companyScenarioFitScore")
  },
  role_scenario_conflict: {
    companyType: "mnc",
    roleType: "sales",
    chooser: (question, context) =>
      chooseLowestForDimension(question, context, "roleScenarioFitScore")
  }
};

export function normalizePathFitSampleKeyV2(sampleKey: string | null): PathFitSampleKeyV2 {
  if (PATH_FIT_V2_SAMPLE_KEYS.includes(sampleKey as PathFitSampleKeyV2)) {
    return sampleKey as PathFitSampleKeyV2;
  }

  return "high_fit";
}

export function getPathFitSampleAnswerMapV2(sampleKey: PathFitSampleKeyV2): PathFitAnswerMapV2 {
  const sample = SAMPLE_DEFINITIONS[sampleKey];
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
