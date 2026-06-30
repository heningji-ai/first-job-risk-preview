import questionsConfig from "../config/audiences/student/questions.json";
import riskCardsConfig from "../config/audiences/student/risk_cards.json";
import scoringConfig from "../config/audiences/student/scoring.json";
import viralCopyConfig from "../config/audiences/student/viral_copy.json";
import type { Question, RiskCard, ScoringConfig, ViralCopyConfig } from "../types/config";
import type { ResultPageData } from "../types/result";
import type { StoredTestSession } from "../types/session";
import { buildResultDraft } from "./resultDraft";
import { evaluateRiskCards } from "./riskCardEngine";

type QuestionsConfigFile = {
  _todo?: string;
  questions: Question[];
};

type RiskCardsConfigFile = {
  _todo?: string;
  riskCards: RiskCard[];
};

type ScoringConfigFile = ScoringConfig & {
  _todo?: string;
};

function hasMbtiTypeQuestion(questions: Question[]): boolean {
  return questions.some((question) => question.id === "mbti_type" || question.sourceCode === "B1");
}

export function buildResultPageData(session: StoredTestSession): ResultPageData {
  const questionsFile = questionsConfig as QuestionsConfigFile;
  const scoringFile = scoringConfig as unknown as ScoringConfigFile;
  const riskCardsFile = riskCardsConfig as RiskCardsConfigFile;
  const viralCopyFile = viralCopyConfig as ViralCopyConfig & { _todo?: string };

  const resultDraft = buildResultDraft({
    testSessionId: session.id,
    audienceType: session.audienceType,
    answers: session.answers,
    questions: questionsFile.questions,
    scoringConfig: scoringFile,
    createdAt: session.completedAt
  });
  const riskCardResult = evaluateRiskCards(session.answers, resultDraft, riskCardsFile.riskCards);
  const warnings = [...resultDraft.warnings, ...riskCardResult.warnings];

  if (scoringFile._todo) warnings.push("SCORING_PLACEHOLDER");
  if (riskCardsFile._todo) warnings.push("ENGINEERING_SAMPLE_ONLY");
  if (viralCopyFile._todo) warnings.push("VIRAL_COPY_PLACEHOLDER");
  if (!hasMbtiTypeQuestion(questionsFile.questions)) warnings.push("B1_MBTI_TYPE_MISSING");

  return {
    session,
    resultDraft,
    riskCardResult,
    warnings
  };
}
