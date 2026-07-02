export type CompanyTypeV2 =
  | "soe"
  | "mnc"
  | "big_platform"
  | "startup"
  | "sme_private";

export type RoleTypeV2 =
  | "sales"
  | "operation_project"
  | "content_marketing"
  | "tech_data_product"
  | "function_support";

export type DimensionKeyV2 =
  | "admissionFitScore"
  | "motivationFitScore"
  | "baseWorkStyleFitScore"
  | "companyScenarioFitScore"
  | "roleScenarioFitScore";

export type SignalLevelV2 = "positive" | "neutral" | "risk" | "severeRisk";

export type AffinityScoreV2 = -2 | -1 | 0 | 1 | 2;

export type CompanyAffinityV2 = Record<CompanyTypeV2, AffinityScoreV2>;

export type RoleAffinityV2 = Record<RoleTypeV2, AffinityScoreV2>;

export type OptionSignalV2 = {
  signalLevel: SignalLevelV2;
  scoreDelta: AffinityScoreV2;
  dim: DimensionKeyV2[];
  company: CompanyAffinityV2;
  role: RoleAffinityV2;
  tags: string[];
  explain: boolean;
};

export type DisplayConditionV2 =
  | {
      field: "company_type";
      equals: CompanyTypeV2;
    }
  | {
      field: "work_type";
      equals: RoleTypeV2;
    };

export type OptionV2 = {
  optionId: string;
  label: string;
  optionSignal: OptionSignalV2;
  selectorValue?: CompanyTypeV2 | RoleTypeV2;
};

export type QuestionV2 = {
  questionId: string;
  module:
    | "admission"
    | "motivation"
    | "work_style"
    | "company_scenario"
    | "role_scenario";
  visibleToAll: boolean;
  displayCondition: DisplayConditionV2 | null;
  title: string;
  options: OptionV2[];
  scoringDimension: DimensionKeyV2[] | "path_selector";
  affectedCompanyTypes: CompanyTypeV2[] | "all";
  affectedRoleTypes: RoleTypeV2[] | "all";
  scoringIntent: string;
  explainable: boolean;
};

export type QuestionsV2Config = {
  version: "v1.2";
  audience: "student_first_job";
  totalQuestionBankSize: 58;
  actualAnswerCountPerUser: 30;
  modules: {
    admission: 8;
    motivation: 5;
    work_style: 10;
    company_scenario: 15;
    role_scenario: 20;
  };
  questions: QuestionV2[];
};

export type PathFitAnswerMapV2 = Record<string, string>;

export type DerivedPathSelectionV2 = {
  companyType: CompanyTypeV2;
  roleType: RoleTypeV2;
  companyQuestionId: "A7";
  roleQuestionId: "A8";
};

export type DimensionScoresV2 = Record<DimensionKeyV2, number>;

export type CapRuleResultV2 = {
  triggered: boolean;
  dimension: DimensionKeyV2;
  capValue: number;
  reason: string;
};

export type ObstacleTypeV2 =
  | "admission_barrier"
  | "motivation_expectation"
  | "work_style"
  | "company_environment"
  | "role_scenario";

export type ObstacleResultV2 = {
  primaryObstacleType: ObstacleTypeV2;
  primaryObstacleDimension: DimensionKeyV2;
  primaryObstacleReason: string;
  secondaryObstacleType?: ObstacleTypeV2;
  secondaryObstacleDimension?: DimensionKeyV2;
  capTriggered: boolean;
  capReason?: string;
};

export type DebugSignalV2 = {
  questionId: string;
  optionId: string;
  dim: DimensionKeyV2[];
  scoreDelta: number;
  companyAffinity: number;
  roleAffinity: number;
  rawSignal: number;
  optionFitScore: number;
  ignored?: boolean;
  reason?: string;
};

export type PathFitScoringResultV2 = {
  finalPathFitScore: number;
  finalPathFitLabel: string;
  rawWeightedScore: number;
  dimensionScores: DimensionScoresV2;
  caps: CapRuleResultV2[];
  obstacle: ObstacleResultV2;
  pathSelection: DerivedPathSelectionV2;
  answeredQuestionCount: number;
  expectedVisibleQuestionCount: number;
  visibleQuestionIds: string[];
  missingQuestionIds: string[];
  debugSignals: DebugSignalV2[];
};
