import type { AccessMode, AmountCalculation, CouponCode } from "./types.js";

const ORIGINAL_AMOUNT_CENTS = 1990;
const SHARE_CARD_DISCOUNT_CENTS = 1000;

export function normalizeCouponCode(
  accessMode: AccessMode,
  couponCode: CouponCode | null
): CouponCode | null {
  if (accessMode === "share_coupon" && couponCode === "share_card") return "share_card";
  return null;
}

export function calculateOrderAmount(
  accessMode: AccessMode,
  couponCode: CouponCode | null
): AmountCalculation {
  const normalizedCoupon = normalizeCouponCode(accessMode, couponCode);
  const discountAmountCents = normalizedCoupon === "share_card" ? SHARE_CARD_DISCOUNT_CENTS : 0;

  return {
    originalAmountCents: ORIGINAL_AMOUNT_CENTS,
    discountAmountCents,
    payAmountCents: ORIGINAL_AMOUNT_CENTS - discountAmountCents,
    couponCode: normalizedCoupon
  };
}
