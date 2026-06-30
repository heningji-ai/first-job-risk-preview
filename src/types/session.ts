import type { AudienceType } from "./config";

export type RiskLevel = "low" | "medium" | "high";

export type ScoreBucket = {
  dimensions: Record<string, number>;
  directR: Record<string, number>;
};

export type EventLog = {
  id: string;
  eventName:
    | "start_test"
    | "answer_question"
    | "complete_test"
    | "view_result"
    | "generate_path_share_card"
    | "copy_viral_text"
    | "copy_test_link"
    | "export_csv";
  payload?: Record<string, unknown>;
  createdAt: string;
};

export type TestSession = {
  id: string;
  anonymousUserId: string;
  openid?: string;
  audienceType: AudienceType;
  answers: Record<string, string>;
  flags: Record<string, boolean | string>;
  actualScores: ScoreBucket;
  maxScores: ScoreBucket;
  normalizedScores: ScoreBucket;
  finalRisks: Record<string, number>;
  riskLevels: Record<string, RiskLevel>;
  triggeredRiskCards: string[];
  topRiskCards: string[];
  pathShareCard?: {
    title: string;
    pathLabel: string;
    warningText: string;
  };
  viralCopy?: {
    targetText: string;
    copyText: string;
  };
  events: EventLog[];
  createdAt: string;
  completedAt?: string;
};

export type StoredTestSession = {
  id: string;
  anonymousUserId: string;
  audienceType: AudienceType;
  answers: Record<string, string>;
  createdAt: string;
  completedAt: string;
};
