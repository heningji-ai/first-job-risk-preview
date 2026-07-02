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
