import { db, runImmediateTransaction } from "./db.js";
import type { AccessMode, AmountCalculation, CouponCode, PricingMode } from "./types.js";

export const GOAL_FIT_PRODUCT_KEY = "goal_fit_report";

export type ProductPricingRule = {
  id: number;
  productKey: string;
  basePriceCents: number;
  salePriceCents: number;
  inviteDiscountCents: number;
  freeTrialEnabled: boolean;
  freeTrialStartAt: string | null;
  freeTrialEndAt: string | null;
  allowInviteDiscountStack: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminPricingUpdateInput = {
  basePriceCents?: number;
  salePriceCents?: number;
  inviteDiscountCents?: number;
  freeTrialEnabled?: boolean;
  freeTrialStartAt?: string | null;
  freeTrialEndAt?: string | null;
  allowInviteDiscountStack?: boolean;
  enabled?: boolean;
};

function nowIso(): string {
  return new Date().toISOString();
}

function toInt(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.round(numeric));
}

function toIsoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function normalizeGoalFitCouponCode(
  accessMode: AccessMode,
  couponCode: CouponCode | null
): CouponCode | null {
  if (accessMode === "share_coupon" && couponCode === "share_card") return "share_card";
  return null;
}

function mapPricingRule(row: any): ProductPricingRule {
  return {
    id: Number(row.id),
    productKey: String(row.product_key),
    basePriceCents: Number(row.base_price_cents),
    salePriceCents: Number(row.sale_price_cents),
    inviteDiscountCents: Number(row.invite_discount_cents),
    freeTrialEnabled: Number(row.free_trial_enabled) === 1,
    freeTrialStartAt: row.free_trial_start_at ?? null,
    freeTrialEndAt: row.free_trial_end_at ?? null,
    allowInviteDiscountStack: Number(row.allow_invite_discount_stack) === 1,
    enabled: Number(row.enabled) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function getGoalFitPricingRule(): ProductPricingRule {
  const row = db
    .prepare(
      `
        SELECT *
        FROM product_pricing_rules
        WHERE product_key = ? AND enabled = 1
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `
    )
    .get(GOAL_FIT_PRODUCT_KEY);

  if (row) return mapPricingRule(row);

  const fallback = db
    .prepare("SELECT * FROM product_pricing_rules WHERE product_key = ? ORDER BY id DESC LIMIT 1")
    .get(GOAL_FIT_PRODUCT_KEY);
  if (fallback) return mapPricingRule(fallback);

  throw new Error("Goal Fit pricing rule is not configured.");
}

export function isFreeTrialActive(rule: ProductPricingRule, at = new Date()): boolean {
  if (!rule.enabled || !rule.freeTrialEnabled) return false;

  const now = at.getTime();
  if (rule.freeTrialStartAt && now < new Date(rule.freeTrialStartAt).getTime()) return false;
  if (rule.freeTrialEndAt && now > new Date(rule.freeTrialEndAt).getTime()) return false;
  return true;
}

export function calculateGoalFitOrderAmount(
  accessMode: AccessMode,
  couponCode: CouponCode | null,
  at = new Date()
): AmountCalculation {
  const rule = getGoalFitPricingRule();
  const normalizedCoupon = normalizeGoalFitCouponCode(accessMode, couponCode);
  const freeTrialActive = isFreeTrialActive(rule, at);
  const pricingMode: PricingMode = freeTrialActive
    ? "free_trial"
    : rule.salePriceCents < rule.basePriceCents
      ? "sale"
      : "normal";
  const inviteDiscountAppliedCents =
    !freeTrialActive && normalizedCoupon && rule.allowInviteDiscountStack ? rule.inviteDiscountCents : 0;
  const preDiscountAmountCents = freeTrialActive ? 0 : rule.salePriceCents;
  const payAmountCents = Math.max(0, preDiscountAmountCents - inviteDiscountAppliedCents);
  const discountAmountCents = Math.max(0, rule.basePriceCents - payAmountCents);
  const snapshot = {
    pricingRuleId: rule.id,
    productKey: rule.productKey,
    basePriceCents: rule.basePriceCents,
    salePriceCents: rule.salePriceCents,
    inviteDiscountCents: rule.inviteDiscountCents,
    inviteDiscountAppliedCents,
    freeTrialActive,
    allowInviteDiscountStack: rule.allowInviteDiscountStack,
    calculatedAt: at.toISOString()
  };

  return {
    originalAmountCents: rule.basePriceCents,
    discountAmountCents,
    payAmountCents,
    couponCode: inviteDiscountAppliedCents > 0 ? normalizedCoupon : null,
    basePriceCents: rule.basePriceCents,
    salePriceCents: rule.salePriceCents,
    discountCents: discountAmountCents,
    finalAmountCents: payAmountCents,
    pricingRuleId: rule.id,
    pricingSnapshotJson: JSON.stringify(snapshot),
    pricingMode
  };
}

export function getGoalFitPricingDisplay() {
  const rule = getGoalFitPricingRule();
  const freeTrialActive = isFreeTrialActive(rule);
  const finalStandardPriceCents = freeTrialActive ? 0 : rule.salePriceCents;
  const priceLabel = freeTrialActive ? "限时免费试用" : `¥${(finalStandardPriceCents / 100).toFixed(1)}`;

  return {
    basePriceCents: rule.basePriceCents,
    salePriceCents: rule.salePriceCents,
    inviteDiscountCents: rule.inviteDiscountCents,
    finalStandardPriceCents,
    freeTrialEnabled: rule.freeTrialEnabled,
    freeTrialActive,
    freeTrialStartAt: rule.freeTrialStartAt,
    freeTrialEndAt: rule.freeTrialEndAt,
    allowInviteDiscountStack: rule.allowInviteDiscountStack,
    enabled: rule.enabled,
    pricingRuleId: rule.id,
    priceLabel
  };
}

export function updateGoalFitPricingRule(input: AdminPricingUpdateInput): ProductPricingRule {
  return runImmediateTransaction(() => {
    const current = getGoalFitPricingRule();
    const next = {
      basePriceCents: toInt(input.basePriceCents, current.basePriceCents),
      salePriceCents: toInt(input.salePriceCents, current.salePriceCents),
      inviteDiscountCents: toInt(input.inviteDiscountCents, current.inviteDiscountCents),
      freeTrialEnabled:
        typeof input.freeTrialEnabled === "boolean" ? input.freeTrialEnabled : current.freeTrialEnabled,
      freeTrialStartAt:
        "freeTrialStartAt" in input ? toIsoOrNull(input.freeTrialStartAt) : current.freeTrialStartAt,
      freeTrialEndAt: "freeTrialEndAt" in input ? toIsoOrNull(input.freeTrialEndAt) : current.freeTrialEndAt,
      allowInviteDiscountStack:
        typeof input.allowInviteDiscountStack === "boolean"
          ? input.allowInviteDiscountStack
          : current.allowInviteDiscountStack,
      enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
      updatedAt: nowIso()
    };

    db.prepare(
      `
        UPDATE product_pricing_rules
        SET base_price_cents = @basePriceCents,
            sale_price_cents = @salePriceCents,
            invite_discount_cents = @inviteDiscountCents,
            free_trial_enabled = @freeTrialEnabled,
            free_trial_start_at = @freeTrialStartAt,
            free_trial_end_at = @freeTrialEndAt,
            allow_invite_discount_stack = @allowInviteDiscountStack,
            enabled = @enabled,
            updated_at = @updatedAt
        WHERE id = @id
      `
    ).run({
      id: current.id,
      basePriceCents: next.basePriceCents,
      salePriceCents: next.salePriceCents,
      inviteDiscountCents: next.inviteDiscountCents,
      freeTrialEnabled: next.freeTrialEnabled ? 1 : 0,
      freeTrialStartAt: next.freeTrialStartAt,
      freeTrialEndAt: next.freeTrialEndAt,
      allowInviteDiscountStack: next.allowInviteDiscountStack ? 1 : 0,
      enabled: next.enabled ? 1 : 0,
      updatedAt: next.updatedAt
    });

    return getGoalFitPricingRule();
  });
}
