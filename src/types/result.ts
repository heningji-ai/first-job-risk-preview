import type { AudienceType } from "./config";
import type { RiskCardEngineResult } from "./riskCard";
import type { RiskLevel } from "./session";
import type { StoredTestSession } from "./session";

export type ScoreDetail = {
  actualScore: number;
  maxScore: number;
  normalizedScore: number;
};

export type ScoreMap = Record<string, ScoreDetail>;

export type FinalRiskSource = {
  type: "directR" | "dimension";
  key: string;
  rawWeight: number;
  normalizedWeight: number;
  score: number;
};

export type FinalRiskScore = {
  score: number | null;
  riskLevel: RiskLevel | null;
  sources: FinalRiskSource[];
};

export type ResultDraft = {
  testSessionId: string;
  audienceType: AudienceType;
  answeredCount: number;
  flags?: Record<string, boolean | string>;
  directRiskScores: ScoreMap;
  dimensionScores: ScoreMap;
  finalRiskScores: Record<string, FinalRiskScore>;
  warnings: string[];
  createdAt: string;
};

export type ResultPageData = {
  session: StoredTestSession;
  resultDraft: ResultDraft;
  riskCardResult: RiskCardEngineResult;
  warnings: string[];
};
