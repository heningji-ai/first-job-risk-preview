import type { RiskCard, TriggerCondition } from "./config";

export type RiskCardSkippedReason =
  | "PROTECTED"
  | "STRONG_MATCH_NOT_MET"
  | "NO_PRIMARY_RISK_SIGNAL"
  | "SCORE_BELOW_THRESHOLD";

export type MatchedRiskSignal = {
  type: TriggerCondition["type"];
  field: string;
  score: number;
};

export type RiskCardEvaluation = {
  cardId: string;
  title: string;
  triggered: boolean;
  score: number;
  priority: RiskCard["priority"];
  order: number;
  matchedSignals: MatchedRiskSignal[];
  skippedReason?: RiskCardSkippedReason;
  warnings: string[];
};

export type TopRiskCard = {
  cardId: string;
  title: string;
  score: number | null;
  isFallback: boolean;
};

export type RiskCardEngineResult = {
  evaluatedCards: RiskCardEvaluation[];
  triggeredRiskCards: RiskCardEvaluation[];
  protectedCards: RiskCardEvaluation[];
  skippedCards: RiskCardEvaluation[];
  topRiskCards: TopRiskCard[];
  warnings: string[];
};
