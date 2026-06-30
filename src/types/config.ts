export const BASE_FIELDS = [
  "current_status",
  "education",
  "gender",
  "postgraduate_exam",
  "company_type",
  "work_type",
  "choice_reason",
  "main_concern",
  "mbti_known",
  "mbti_type",
  "audience_type"
] as const;

export type BaseField = (typeof BASE_FIELDS)[number];

export type AudienceType =
  | "student"
  | "career"
  | "career_under_35"
  | "career_over_35"
  | "career_change"
  | "manager";

export type RuleOperator = "eq" | "neq" | "in" | "not_in" | "gte" | "lte" | "gt" | "lt";
export type ShowWhenOperator = "eq" | "neq" | "in" | "not_in" | "equals" | "notEquals" | "notIn";

export type ShowWhenRule = {
  field: string;
  operator: ShowWhenOperator;
  value: string | string[];
};

export type QuestionOption = {
  id: string;
  text: string;
  label?: string;
  description?: string;
  scores?: {
    dimensions?: Record<string, number>;
    directR?: Record<string, number>;
  };
  flags?: Record<string, boolean | string>;
};

export type Question = {
  id: string;
  sourceCode?: string;
  group: string;
  order: number;
  text: string;
  type: "single_choice";
  required: boolean;
  showWhen?: ShowWhenRule[];
  options: QuestionOption[];
};

export type RiskFormula = {
  directRWeight: number;
  dimensionWeights: Record<string, number>;
};

export type ScoringConfig = {
  dimensions: string[];
  finalRisks: string[];
  riskFormulas: Record<string, RiskFormula>;
  thresholds: {
    low: [number, number];
    medium: [number, number];
    high: [number, number];
  };
};

export type TriggerCondition = {
  type: "answer" | "dimension" | "finalRisk" | "flag" | "field";
  field: string;
  operator: RuleOperator;
  value: string | string[] | number | boolean;
  score: number;
};

export type ProtectRule = Omit<TriggerCondition, "score"> & {
  score?: number;
};

export type RiskCard = {
  id: string;
  title: string;
  mainText: string;
  subText: string;
  stingText: string;
  priority: "high" | "medium" | "low";
  baseTriggerScore: number;
  relatedRisks: string[];
  strongMatch?: {
    companyType?: string[];
    workType?: string[];
  };
  conditions: TriggerCondition[];
  protectRules?: ProtectRule[];
  animationType: string;
  musicType: string;
};

export type ResultCopyConfig = {
  loadingScreen: {
    title: string;
    steps: string[];
    completeText: string;
  };
  pathScreen: {
    title: string;
    subText: string;
    closingText: string;
  };
  riskIndexScreen: {
    title: string;
    subText: string;
  };
  riskLevelTexts: Record<
    string,
    {
      low: string;
      medium: string;
      high: string;
    }
  >;
};

export type ViralCopyConfig = {
  pathShareCard: {
    title: string;
    companyWarnings: Record<string, string>;
    workWarnings: Record<string, string>;
    footer: string;
  };
  defaultViralCopy: {
    targetText: string;
    copyText: string;
  };
  viralCopies: Record<
    string,
    {
      targetText: string;
      copyText: string;
    }
  >;
};

export type AnimationMapConfig = {
  screenAnimations: Record<string, string>;
  riskCardAnimations: Record<string, string>;
  fallbackRiskCardAnimation: string;
  musicMap: Record<string, string>;
};

export type ServiceCardsConfig = {
  intro: {
    title: string;
    text: string;
  };
  cards: Array<{
    id: string;
    title: string;
    serviceName: string;
    items: string[];
    boundary: string;
  }>;
};

export type LabelsConfig = {
  companyTypeLabels: Record<string, string>;
  workTypeLabels: Record<string, string>;
  riskLabels: Record<string, string>;
  riskLevelLabels: {
    low: string;
    medium: string;
    high: string;
  };
};

export type TestCase = {
  id: string;
  name: string;
  answers: Record<string, string>;
  expected: {
    mustTrigger?: string[];
    mayTrigger?: string[];
    riskLevels?: Record<string, Array<"low" | "medium" | "high">>;
    viralCopy?: {
      targetText?: string;
      copyText?: string;
    };
  };
};
