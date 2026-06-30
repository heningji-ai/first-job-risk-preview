import riskCardCopyConfig from "../config/audiences/student/risk_card_copy.json";
import type { TopRiskCard } from "../types/riskCard";
import type { RiskCardCopy, RiskCardCopyConfig } from "../types/riskCardCopy";

const FALLBACK_COPY_ID = "H0_GENERAL_REMINDER";

type RiskCardCopyConfigFile = RiskCardCopyConfig & {
  _todo?: string;
};

export type ResolvedRiskCardCopy = {
  cardId: string;
  isFallback: boolean;
  copy: RiskCardCopy;
};

const copyConfig = riskCardCopyConfig as RiskCardCopyConfigFile;

function getFallbackCopy(): RiskCardCopy {
  return copyConfig.riskCardCopies[FALLBACK_COPY_ID];
}

export function resolveRiskCardCopy(cardId: string): RiskCardCopy {
  return copyConfig.riskCardCopies[cardId] ?? getFallbackCopy();
}

export function resolveTopRiskCardCopies(topRiskCards: TopRiskCard[]): ResolvedRiskCardCopy[] {
  return topRiskCards.map((card) => ({
    cardId: card.cardId,
    isFallback: card.isFallback || card.cardId === FALLBACK_COPY_ID,
    copy: resolveRiskCardCopy(card.cardId)
  }));
}
