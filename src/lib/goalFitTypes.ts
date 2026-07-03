export type CompanyType = "G" | "F" | "D" | "V" | "M";

export type RoleType =
  | "SLS"
  | "PM"
  | "OPS"
  | "TECH"
  | "DATA"
  | "FUNC"
  | "MKT"
  | "SUP";

export type QuestionModule =
  | "A_BACKGROUND"
  | "B_PERSONALITY"
  | "C_MOTIVATION"
  | "D_WORKPLACE_SCENARIO"
  | "E_ROLE_SCENARIO";

export type MotivationTag =
  | "money"
  | "stable"
  | "status"
  | "growth"
  | "create"
  | "first_job"
  | "anxiety"
  | "balanced";

export type RiskTag =
  | "HIGH_PRESSURE"
  | "SOCIAL_DRAIN"
  | "AMBIGUITY"
  | "NEEDS_TRAINING"
  | "PROCESS_MISMATCH"
  | "BOUNDARY_CONFLICT"
  | "LOW_RESOURCE_INITIATIVE"
  | "REJECTION_SENSITIVE"
  | "GROWTH_GAP"
  | "MOTIVATION_MISMATCH"
  | "LOW_CLARITY";

export type CompanyScoreMap = Partial<Record<CompanyType, number>>;

export type RoleScoreMap = Partial<Record<RoleType, number>>;

export type QuestionOption = {
  id: string;
  text: string;
  mainScore: number;
  companyScores?: CompanyScoreMap;
  roleScores?: RoleScoreMap;
  motivationTags?: MotivationTag[];
  riskTags?: RiskTag[];
};

export type GoalFitQuestion = {
  id: string;
  module: QuestionModule;
  text: string;
  options: QuestionOption[];
  roleBranch?: RoleType;
  requiredInMVP?: boolean;
};

export type TargetQuestion = {
  id: "T01" | "T02" | string;
  type: "targetCompany" | "targetRole" | string;
  text: string;
  options: Array<{
    id: string;
    text: string;
  }>;
};

export type GoalFitDrawRules = {
  A_BACKGROUND: string[];
  B_PERSONALITY: string[];
  C_MOTIVATION: string[];
  D_WORKPLACE_SCENARIO: string[];
  E_ROLE_SCENARIO: string;
};

export type GoalFitQuestionBank = {
  version: string;
  description: string;
  companyTypes: Record<CompanyType, string>;
  roleTypes: Record<RoleType, string>;
  defaultCompanyScore: number;
  defaultRoleScore: number;
  targetQuestions: TargetQuestion[];
  drawRules: GoalFitDrawRules;
  questions: GoalFitQuestion[];
};
