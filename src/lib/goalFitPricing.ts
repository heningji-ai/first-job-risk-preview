import { buildApiUrl } from "../config/api";

export type GoalFitPricingDisplay = {
  basePriceCents: number;
  salePriceCents: number;
  inviteDiscountCents: number;
  finalStandardPriceCents: number;
  freeTrialEnabled: boolean;
  freeTrialActive: boolean;
  freeTrialStartAt: string | null;
  freeTrialEndAt: string | null;
  allowInviteDiscountStack: boolean;
  enabled: boolean;
  pricingRuleId: number;
  priceLabel: string;
};

export function formatGoalFitYuan(cents: number): string {
  return `¥${(Math.max(0, cents) / 100).toFixed(1)}`;
}

export async function getGoalFitPricingDisplay(): Promise<GoalFitPricingDisplay> {
  const response = await fetch(buildApiUrl("/api/pricing/goal-fit-report"));
  if (!response.ok) throw new Error(`pricing request failed: ${response.status}`);
  return (await response.json()) as GoalFitPricingDisplay;
}
