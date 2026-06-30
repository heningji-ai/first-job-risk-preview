import type { AudienceType, Question, QuestionOption, ScoringConfig } from "../types/config";
import type { ResultDraft, ScoreDetail, ScoreMap, FinalRiskScore, FinalRiskSource } from "../types/result";
import type { RiskLevel } from "../types/session";

type Answers = Record<string, string>;

type ScoreNamespace = "directR" | "dimensions";

type ScoreCalculationResult = {
  scores: ScoreMap;
  warnings: string[];
};

type BuildResultDraftInput = {
  testSessionId: string;
  audienceType: AudienceType;
  answers: Answers;
  questions: Question[];
  scoringConfig: ScoringConfig & { _todo?: string };
  createdAt?: string;
};

function addScore(target: Record<string, number>, key: string, value: number): void {
  target[key] = (target[key] ?? 0) + value;
}

function hasScores(option: QuestionOption): boolean {
  return (
    Object.keys(option.scores?.directR ?? {}).length > 0 ||
    Object.keys(option.scores?.dimensions ?? {}).length > 0
  );
}

function getSelectedOption(question: Question, answer: string): QuestionOption | undefined {
  return question.options.find((option) => option.id === answer);
}

function calculateOptionScores(
  answers: Answers,
  questions: Question[],
  namespace: ScoreNamespace,
  warningPrefix: string
): ScoreCalculationResult {
  const actualScores: Record<string, number> = {};
  const maxScores: Record<string, number> = {};
  const warnings: string[] = [];
  const questionsById = new Map(questions.map((question) => [question.id, question]));

  for (const [questionId, answer] of Object.entries(answers)) {
    const question = questionsById.get(questionId);
    if (!question) {
      warnings.push(`${warningPrefix}_UNKNOWN_QUESTION:${questionId}`);
      continue;
    }

    const selectedOption = getSelectedOption(question, answer);
    if (!selectedOption) {
      warnings.push(`${warningPrefix}_UNKNOWN_OPTION:${questionId}:${answer}`);
      continue;
    }

    if (!hasScores(selectedOption)) {
      warnings.push(`${warningPrefix}_NO_SCORING_FIELDS:${questionId}:${answer}`);
      continue;
    }

    const questionMaxScores: Record<string, number> = {};
    for (const option of question.options) {
      for (const [key, value] of Object.entries(option.scores?.[namespace] ?? {})) {
        const scoreValue = Number(value);
        if (!Number.isFinite(scoreValue)) {
          warnings.push(`${warningPrefix}_NON_NUMERIC_SCORE:${questionId}:${option.id}:${key}`);
          continue;
        }
        questionMaxScores[key] = Math.max(questionMaxScores[key] ?? 0, scoreValue);
      }
    }

    for (const [key, value] of Object.entries(questionMaxScores)) {
      addScore(maxScores, key, value);
    }

    for (const [key, value] of Object.entries(selectedOption.scores?.[namespace] ?? {})) {
      const scoreValue = Number(value);
      if (!Number.isFinite(scoreValue)) {
        warnings.push(`${warningPrefix}_NON_NUMERIC_SELECTED_SCORE:${questionId}:${answer}:${key}`);
        continue;
      }
      addScore(actualScores, key, scoreValue);
    }
  }

  const scores: ScoreMap = {};
  for (const key of new Set([...Object.keys(actualScores), ...Object.keys(maxScores)])) {
    const maxScore = maxScores[key] ?? 0;
    const actualScore = actualScores[key] ?? 0;
    if (maxScore <= 0) {
      warnings.push(`${warningPrefix}_MISSING_MAX_SCORE:${key}`);
      continue;
    }
    scores[key] = {
      actualScore,
      maxScore,
      normalizedScore: (actualScore / maxScore) * 100
    };
  }

  return { scores, warnings };
}

export function calculateDirectRiskScores(answers: Answers, questions: Question[]): ScoreCalculationResult {
  return calculateOptionScores(answers, questions, "directR", "DIRECT_RISK");
}

export function calculateDimensionScores(
  answers: Answers,
  questions: Question[],
  scoringConfig: ScoringConfig & { _todo?: string }
): ScoreCalculationResult {
  const result = calculateOptionScores(answers, questions, "dimensions", "DIMENSION");
  if (scoringConfig._todo || Object.keys(scoringConfig.riskFormulas ?? {}).every((riskKey) => {
    const formula = scoringConfig.riskFormulas[riskKey];
    return Object.keys(formula.dimensionWeights ?? {}).length === 0;
  })) {
    result.warnings.push("DIMENSION_RULES_PLACEHOLDER");
  }
  return result;
}

function getRiskLevel(score: number, scoringConfig: ScoringConfig): RiskLevel {
  const thresholds = scoringConfig.thresholds;
  if (score >= thresholds.high[0] && score <= thresholds.high[1]) return "high";
  if (score >= thresholds.medium[0] && score <= thresholds.medium[1]) return "medium";
  return "low";
}

export function calculateFinalRiskScores(
  directRiskScores: ScoreMap,
  dimensionScores: ScoreMap,
  scoringConfig: ScoringConfig
): { scores: Record<string, FinalRiskScore>; warnings: string[] } {
  const warnings: string[] = [];
  const scores: Record<string, FinalRiskScore> = {};

  for (const riskKey of scoringConfig.finalRisks) {
    const formula = scoringConfig.riskFormulas[riskKey];
    if (!formula) {
      warnings.push(`FINAL_RISK_MISSING_FORMULA:${riskKey}`);
      scores[riskKey] = { score: null, riskLevel: null, sources: [] };
      continue;
    }

    const availableSources: Array<Omit<FinalRiskSource, "normalizedWeight">> = [];
    const directRisk = directRiskScores[riskKey];
    if (directRisk && directRisk.maxScore > 0 && formula.directRWeight > 0) {
      availableSources.push({
        type: "directR",
        key: riskKey,
        rawWeight: formula.directRWeight,
        score: directRisk.normalizedScore
      });
    }

    for (const [dimensionKey, rawWeight] of Object.entries(formula.dimensionWeights ?? {})) {
      const dimensionScore = dimensionScores[dimensionKey];
      if (dimensionScore && dimensionScore.maxScore > 0 && rawWeight > 0) {
        availableSources.push({
          type: "dimension",
          key: dimensionKey,
          rawWeight,
          score: dimensionScore.normalizedScore
        });
      }
    }

    const totalWeight = availableSources.reduce((sum, source) => sum + source.rawWeight, 0);
    if (totalWeight <= 0) {
      warnings.push(`FINAL_RISK_NO_AVAILABLE_SOURCE:${riskKey}`);
      scores[riskKey] = { score: null, riskLevel: null, sources: [] };
      continue;
    }

    const sources = availableSources.map((source) => ({
      ...source,
      normalizedWeight: source.rawWeight / totalWeight
    }));
    const score = sources.reduce((sum, source) => sum + source.score * source.normalizedWeight, 0);
    scores[riskKey] = {
      score,
      riskLevel: getRiskLevel(score, scoringConfig),
      sources
    };
  }

  return { scores, warnings };
}

export function buildResultDraft(input: BuildResultDraftInput): ResultDraft {
  const directRiskResult = calculateDirectRiskScores(input.answers, input.questions);
  const dimensionResult = calculateDimensionScores(input.answers, input.questions, input.scoringConfig);
  const finalRiskResult = calculateFinalRiskScores(
    directRiskResult.scores,
    dimensionResult.scores,
    input.scoringConfig
  );

  return {
    testSessionId: input.testSessionId,
    audienceType: input.audienceType,
    answeredCount: Object.keys(input.answers).length,
    directRiskScores: directRiskResult.scores,
    dimensionScores: dimensionResult.scores,
    finalRiskScores: finalRiskResult.scores,
    warnings: [...directRiskResult.warnings, ...dimensionResult.warnings, ...finalRiskResult.warnings],
    createdAt: input.createdAt ?? new Date().toISOString()
  };
}
