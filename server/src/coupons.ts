import type { AccessMode, AmountCalculation, CouponCode } from "./types.js";
import { calculateGoalFitOrderAmount, normalizeGoalFitCouponCode } from "./pricing.js";

export function normalizeCouponCode(
  accessMode: AccessMode,
  couponCode: CouponCode | null
): CouponCode | null {
  return normalizeGoalFitCouponCode(accessMode, couponCode);
}

export function calculateOrderAmount(
  accessMode: AccessMode,
  couponCode: CouponCode | null
): AmountCalculation {
  return calculateGoalFitOrderAmount(accessMode, couponCode);
}
