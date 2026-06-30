import type { RiskCard, ProtectRule, TriggerCondition } from "../types/config";
import type { ResultDraft } from "../types/result";
import type {
  MatchedRiskSignal,
  RiskCardEngineResult,
  RiskCardEvaluation,
  RiskCardSkippedReason,
  TopRiskCard
} from "../types/riskCard";

type Answers = Record<string, string>;
type ConditionLike = TriggerCondition | ProtectRule;

const PRIMARY_RISK_SIGNAL_TYPES = new Set(["answer", "dimension", "finalRisk"]);
const DEFAULT_TRIGGER_THRESHOLD = 60;
const FALLBACK_RISK_CARD_ID = "H0_GENERAL_REMINDER";
const priorityRank: Record<RiskCard["priority"], number> = {
  high: 3,
  medium: 2,
  low: 1
};

function compareValues(operator: string, actual: unknown, expected: unknown): boolean {
  if (operator === "eq" || operator === "equals") return actual === expected;
  if (operator === "neq" || operator === "notEquals") return actual !== expected;
  if (operator === "in") return Array.isArray(expected) && expected.includes(actual);
  if (operator === "notIn" || operator === "not_in") return Array.isArray(expected) && !expected.includes(actual);
  if (operator === "gte") return Number(actual) >= Number(expected);
  if (operator === "lte") return Number(actual) <= Number(expected);
  if (operator === "gt") return Number(actual) > Number(expected);
  if (operator === "lt") return Number(actual) < Number(expected);
  return false;
}

function getConditionValue(
  condition: ConditionLike,
  answers: Answers,
  resultDraft: ResultDraft,
  warnings: string[]
): unknown {
  if (condition.type === "answer" || condition.type === "field") {
    return answers[condition.field];
  }

  if (condition.type === "dimension") {
    return resultDraft.dimensionScores[condition.field]?.normalizedScore;
  }

  if (condition.type === "finalRisk") {
    return resultDraft.finalRiskScores[condition.field]?.score;
  }

  if (condition.type === "flag") {
    if (!resultDraft.flags) {
      warnings.push(`FLAG_SOURCE_MISSING:${condition.field}`);
      return undefined;
    }
    return resultDraft.flags[condition.field];
  }

  return undefined;
}

function matchesCondition(
  condition: ConditionLike,
  answers: Answers,
  resultDraft: ResultDraft,
  warnings: string[]
): boolean {
  const actual = getConditionValue(condition, answers, resultDraft, warnings);
  if (actual === undefined || actual === null) {
    return false;
  }
  return compareValues(condition.operator, actual, condition.value);
}

function matchesStrongMatch(card: RiskCard, answers: Answers): boolean {
  const companyTypes = card.strongMatch?.companyType;
  const workTypes = card.strongMatch?.workType;

  if (Array.isArray(companyTypes) && !companyTypes.includes(answers.company_type)) return false;
  if (Array.isArray(workTypes) && !workTypes.includes(answers.work_type)) return false;

  return true;
}

function buildEvaluation(
  card: RiskCard,
  order: number,
  triggered: boolean,
  score: number,
  matchedSignals: MatchedRiskSignal[],
  warnings: string[],
  skippedReason?: RiskCardSkippedReason
): RiskCardEvaluation {
  return {
    cardId: card.id,
    title: card.title,
    triggered,
    score,
    priority: card.priority,
    order,
    matchedSignals,
    skippedReason,
    warnings
  };
}

export function evaluateRiskCard(
  card: RiskCard,
  answers: Answers,
  resultDraft: ResultDraft,
  order = 0
): RiskCardEvaluation {
  const warnings: string[] = [];

  if ((card.protectRules ?? []).some((rule) => matchesCondition(rule, answers, resultDraft, warnings))) {
    return buildEvaluation(card, order, false, 0, [], warnings, "PROTECTED");
  }

  if (!matchesStrongMatch(card, answers)) {
    return buildEvaluation(card, order, false, 0, [], warnings, "STRONG_MATCH_NOT_MET");
  }

  const matchedSignals: MatchedRiskSignal[] = [];
  for (const condition of card.conditions) {
    if (!matchesCondition(condition, answers, resultDraft, warnings)) continue;
    matchedSignals.push({
      type: condition.type,
      field: condition.field,
      score: condition.score
    });
  }

  const score =
    Number(card.baseTriggerScore ?? 0) +
    matchedSignals.reduce((sum, signal) => sum + Number(signal.score ?? 0), 0);
  const hasPrimaryRiskSignal = matchedSignals.some((signal) => PRIMARY_RISK_SIGNAL_TYPES.has(signal.type));

  if (!hasPrimaryRiskSignal) {
    if (matchedSignals.some((signal) => signal.type === "flag")) {
      warnings.push(`FLAG_ONLY_TRIGGER_BLOCKED:${card.id}`);
    }
    return buildEvaluation(card, order, false, score, matchedSignals, warnings, "NO_PRIMARY_RISK_SIGNAL");
  }

  if (score < DEFAULT_TRIGGER_THRESHOLD) {
    return buildEvaluation(card, order, false, score, matchedSignals, warnings, "SCORE_BELOW_THRESHOLD");
  }

  return buildEvaluation(card, order, true, score, matchedSignals, warnings);
}

export function selectTopRiskCards(triggeredRiskCards: RiskCardEvaluation[], limit = 3): TopRiskCard[] {
  if (triggeredRiskCards.length === 0) {
    return [
      {
        cardId: FALLBACK_RISK_CARD_ID,
        title: "GENERAL_REMINDER_FALLBACK",
        score: null,
        isFallback: true
      }
    ];
  }

  return [...triggeredRiskCards]
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const priorityDiff = priorityRank[right.priority] - priorityRank[left.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return left.order - right.order;
    })
    .slice(0, limit)
    .map((card) => ({
      cardId: card.cardId,
      title: card.title,
      score: card.score,
      isFallback: false
    }));
}

export function evaluateRiskCards(
  answers: Answers,
  resultDraft: ResultDraft,
  riskCards: RiskCard[],
  topLimit = 3
): RiskCardEngineResult {
  const evaluatedCards = riskCards.map((card, index) => evaluateRiskCard(card, answers, resultDraft, index));
  const triggeredRiskCards = evaluatedCards.filter((card) => card.triggered);
  const protectedCards = evaluatedCards.filter((card) => card.skippedReason === "PROTECTED");
  const skippedCards = evaluatedCards.filter((card) => !card.triggered);
  const topRiskCards = selectTopRiskCards(triggeredRiskCards, topLimit);
  const warnings = evaluatedCards.flatMap((card) => card.warnings.map((warning) => `${card.cardId}:${warning}`));

  return {
    evaluatedCards,
    triggeredRiskCards,
    protectedCards,
    skippedCards,
    topRiskCards,
    warnings
  };
}
