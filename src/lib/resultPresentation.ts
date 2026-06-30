import type { ResultPageData, ScoreMap } from "../types/result";
import type { RiskCardEvaluation, TopRiskCard } from "../types/riskCard";

export type RiskCardViewModel = {
  cardId: string;
  title: string;
  score: string;
  matchedSignals: string;
  triggered?: boolean;
  skippedReason?: string;
  isFallback?: boolean;
};

const KEY_WARNING_TYPES = [
  "SCORING_PLACEHOLDER",
  "DIMENSION_RULES_PLACEHOLDER",
  "ENGINEERING_SAMPLE_ONLY",
  "VIRAL_COPY_PLACEHOLDER",
  "B1_MBTI_TYPE_MISSING"
];

export function formatScoreKeys(scores: ScoreMap | Record<string, unknown>): string {
  const keys = Object.keys(scores);
  return keys.length > 0 ? keys.join(", ") : "(none)";
}

export function summarizeWarnings(warnings: string[]): string[] {
  return KEY_WARNING_TYPES.filter((type) => warnings.some((warning) => warning.includes(type)));
}

function formatMatchedSignals(signals: RiskCardEvaluation["matchedSignals"]): string {
  if (signals.length === 0) return "(none)";
  return signals.map((signal) => `${signal.type}:${signal.field}:${signal.score}`).join(", ");
}

export function buildRiskCardViewModels(
  topRiskCards: TopRiskCard[],
  evaluatedCards: RiskCardEvaluation[]
): RiskCardViewModel[] {
  return topRiskCards.map((topCard) => {
    const evaluatedCard = evaluatedCards.find((card) => card.cardId === topCard.cardId);
    return {
      cardId: topCard.cardId,
      title: evaluatedCard?.title ?? topCard.title,
      score: topCard.score === null ? "(fallback)" : String(topCard.score),
      matchedSignals: evaluatedCard ? formatMatchedSignals(evaluatedCard.matchedSignals) : "(none)",
      triggered: evaluatedCard?.triggered,
      skippedReason: evaluatedCard?.skippedReason,
      isFallback: topCard.isFallback
    };
  });
}

export function buildTriggeredRiskCardViewModels(cards: RiskCardEvaluation[]): RiskCardViewModel[] {
  return cards.map((card) => ({
    cardId: card.cardId,
    title: card.title,
    score: String(card.score),
    matchedSignals: formatMatchedSignals(card.matchedSignals),
    triggered: card.triggered,
    skippedReason: card.skippedReason
  }));
}

export function buildDebugKeySummary(data: ResultPageData): Array<{ label: string; value: string }> {
  return [
    {
      label: "directRiskScores keys",
      value: formatScoreKeys(data.resultDraft.directRiskScores)
    },
    {
      label: "dimensionScores keys",
      value: formatScoreKeys(data.resultDraft.dimensionScores)
    },
    {
      label: "finalRiskScores keys",
      value: formatScoreKeys(data.resultDraft.finalRiskScores)
    },
    {
      label: "triggeredRiskCards ids",
      value: data.riskCardResult.triggeredRiskCards.map((card) => card.cardId).join(", ") || "(none)"
    },
    {
      label: "topRiskCards ids",
      value: data.riskCardResult.topRiskCards.map((card) => card.cardId).join(", ") || "(none)"
    },
    {
      label: "protected / skipped ids",
      value: data.riskCardResult.skippedCards.map((card) => card.cardId).join(", ") || "(none)"
    }
  ];
}
