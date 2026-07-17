import { nanoid } from "nanoid";
import { db, runImmediateTransaction } from "./db.js";
import { calculateGoalFitOrderAmount } from "./pricing.js";

export type ReferralRecord = {
  id: string;
  referralCode: string;
  sourceSessionId: string;
  sourceVisitorId: string | null;
  createdAt: string;
  firstCopiedAt: string | null;
  copyCount: number;
  discountGrantedAt: string | null;
  discountUsedOrderId: string | null;
  status: "active" | "disabled";
};

export type ReferralVisitRecord = {
  id: string;
  referralId: string;
  visitorId: string;
  landingPath: string;
  firstVisitedAt: string;
  startedTestAt: string | null;
  completedTestAt: string | null;
  resultSessionId: string | null;
  orderId: string | null;
  paidAt: string | null;
};

function toReferral(row: unknown): ReferralRecord | null {
  if (!row || typeof row !== "object") return null;
  return row as ReferralRecord;
}

function toReferralVisit(row: unknown): ReferralVisitRecord | null {
  if (!row || typeof row !== "object") return null;
  return row as ReferralVisitRecord;
}

function createReferralCode(): string {
  return nanoid(18);
}

function nowIso(): string {
  return new Date().toISOString();
}

export function getReferralBySessionId(sessionId: string): ReferralRecord | null {
  return toReferral(
    db.prepare("SELECT * FROM goal_fit_referrals WHERE sourceSessionId = ?").get(sessionId)
  );
}

export function getReferralByCode(referralCode: string): ReferralRecord | null {
  return toReferral(
    db.prepare("SELECT * FROM goal_fit_referrals WHERE referralCode = ? AND status = 'active'").get(referralCode)
  );
}

function createReferralRecord(params: {
  sessionId: string;
  visitorId?: string | null;
}): ReferralRecord {
  return {
    id: nanoid(),
    referralCode: createReferralCode(),
    sourceSessionId: params.sessionId,
    sourceVisitorId: params.visitorId?.trim() || null,
    createdAt: nowIso(),
    firstCopiedAt: null,
    copyCount: 0,
    discountGrantedAt: null,
    discountUsedOrderId: null,
    status: "active"
  };
}

function insertReferral(referral: ReferralRecord): void {
  db.prepare(
    `
      INSERT INTO goal_fit_referrals (
        id,
        referralCode,
        sourceSessionId,
        sourceVisitorId,
        createdAt,
        firstCopiedAt,
        copyCount,
        discountGrantedAt,
        discountUsedOrderId,
        status
      ) VALUES (
        @id,
        @referralCode,
        @sourceSessionId,
        @sourceVisitorId,
        @createdAt,
        @firstCopiedAt,
        @copyCount,
        @discountGrantedAt,
        @discountUsedOrderId,
        @status
      )
    `
  ).run(referral);
}

export function createOrGetReferral(params: {
  sessionId: string;
  visitorId?: string | null;
}): ReferralRecord {
  return runImmediateTransaction(() => {
    const existing = getReferralBySessionId(params.sessionId);
    if (existing) return existing;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const referral = createReferralRecord(params);

      try {
        insertReferral(referral);
        return referral;
      } catch (error) {
        const racedReferral = getReferralBySessionId(params.sessionId);
        if (racedReferral) return racedReferral;

        if (attempt === 2) throw error;
      }
    }

    throw new Error("Failed to create referral.");
  });
}

export function confirmReferralCopied(params: {
  sessionId: string;
  visitorId?: string | null;
}): ReferralRecord {
  return runImmediateTransaction(() => {
    const referral = getReferralBySessionId(params.sessionId) ?? createReferralRecord(params);
    if (!getReferralBySessionId(params.sessionId)) {
      insertReferral(referral);
    }

    const copiedAt = nowIso();

    db.prepare(
      `
        UPDATE goal_fit_referrals
        SET firstCopiedAt = COALESCE(firstCopiedAt, @copiedAt),
            copyCount = copyCount + 1,
            discountGrantedAt = COALESCE(discountGrantedAt, @copiedAt)
        WHERE id = @id
      `
    ).run({
      id: referral.id,
      copiedAt
    });

    return getReferralBySessionId(params.sessionId) ?? referral;
  });
}

export function getReferralDiscountStatus(sessionId: string): {
  discountGranted: boolean;
  discountUsed: boolean;
  discountAmountCents: number;
  payAmountCents: number;
  referralCode: string | null;
} {
  const referral = getReferralBySessionId(sessionId);
  const discountGranted = Boolean(referral?.discountGrantedAt);
  const discountUsed = Boolean(referral?.discountUsedOrderId);
  const activeDiscount = discountGranted && !discountUsed;
  const amount = calculateGoalFitOrderAmount(activeDiscount ? "share_coupon" : "direct", activeDiscount ? "share_card" : null);

  return {
    discountGranted: activeDiscount,
    discountUsed,
    discountAmountCents: activeDiscount ? amount.discountAmountCents : 0,
    payAmountCents: amount.payAmountCents,
    referralCode: referral?.referralCode ?? null
  };
}

export function recordReferralVisit(params: {
  referralCode: string;
  visitorId: string;
  landingPath: string;
}): ReferralVisitRecord | null {
  return runImmediateTransaction(() => {
    const referral = getReferralByCode(params.referralCode);
    if (!referral) return null;
    if (referral.sourceVisitorId && referral.sourceVisitorId === params.visitorId) return null;

    const existing = getReferralVisit(params.referralCode, params.visitorId);
    if (existing) return existing;

    const visit: ReferralVisitRecord = {
      id: nanoid(),
      referralId: referral.id,
      visitorId: params.visitorId,
      landingPath: params.landingPath,
      firstVisitedAt: nowIso(),
      startedTestAt: null,
      completedTestAt: null,
      resultSessionId: null,
      orderId: null,
      paidAt: null
    };

    db.prepare(
      `
        INSERT OR IGNORE INTO goal_fit_referral_visits (
          id,
          referralId,
          visitorId,
          landingPath,
          firstVisitedAt,
          startedTestAt,
          completedTestAt,
          resultSessionId,
          orderId,
          paidAt
        ) VALUES (
          @id,
          @referralId,
          @visitorId,
          @landingPath,
          @firstVisitedAt,
          @startedTestAt,
          @completedTestAt,
          @resultSessionId,
          @orderId,
          @paidAt
        )
      `
    ).run(visit);

    return getReferralVisit(params.referralCode, params.visitorId) ?? visit;
  });
}

export function getReferralVisit(referralCode: string, visitorId: string): ReferralVisitRecord | null {
  return toReferralVisit(
    db
      .prepare(
        `
          SELECT visit.*
          FROM goal_fit_referral_visits visit
          JOIN goal_fit_referrals referral ON referral.id = visit.referralId
          WHERE referral.referralCode = ? AND visit.visitorId = ?
        `
      )
      .get(referralCode, visitorId)
  );
}

export function markReferralVisitStarted(params: {
  referralCode: string;
  visitorId: string;
}): ReferralVisitRecord | null {
  const visit = getReferralVisit(params.referralCode, params.visitorId);
  if (!visit) return null;

  db.prepare(
    `
      UPDATE goal_fit_referral_visits
      SET startedTestAt = COALESCE(startedTestAt, @startedTestAt)
      WHERE id = @id
    `
  ).run({
    id: visit.id,
    startedTestAt: nowIso()
  });

  return getReferralVisit(params.referralCode, params.visitorId);
}

export function markReferralVisitCompleted(params: {
  referralCode: string;
  visitorId: string;
  resultSessionId: string;
}): ReferralVisitRecord | null {
  const visit = getReferralVisit(params.referralCode, params.visitorId);
  if (!visit) return null;

  db.prepare(
    `
      UPDATE goal_fit_referral_visits
      SET completedTestAt = COALESCE(completedTestAt, @completedTestAt),
          resultSessionId = COALESCE(resultSessionId, @resultSessionId)
      WHERE id = @id
    `
  ).run({
    id: visit.id,
    completedTestAt: nowIso(),
    resultSessionId: params.resultSessionId
  });

  return getReferralVisit(params.referralCode, params.visitorId);
}

export function attachReferralVisitToOrder(params: {
  referralCode?: string | null;
  visitorId?: string | null;
  orderId: string;
}): ReferralVisitRecord | null {
  if (!params.referralCode || !params.visitorId) return null;
  const visit = getReferralVisit(params.referralCode, params.visitorId);
  if (!visit) return null;

  db.prepare(
    `
      UPDATE goal_fit_referral_visits
      SET orderId = COALESCE(orderId, @orderId)
      WHERE id = @id
    `
  ).run({
    id: visit.id,
    orderId: params.orderId
  });

  return getReferralVisit(params.referralCode, params.visitorId);
}

export function markReferralPaidForOrder(orderId: string): void {
  const paidAt = nowIso();

  db.prepare(
    `
      UPDATE goal_fit_referral_visits
      SET paidAt = COALESCE(paidAt, @paidAt)
      WHERE orderId = @orderId
    `
  ).run({
    orderId,
    paidAt
  });

  db.prepare(
    `
      UPDATE goal_fit_referrals
      SET discountUsedOrderId = COALESCE(discountUsedOrderId, @orderId)
      WHERE discountUsedOrderId IS NULL
        AND sourceSessionId = (
          SELECT sessionId
          FROM orders
          WHERE id = @orderId
            AND accessMode = 'share_coupon'
            AND discountAmountCents > 0
        )
        AND discountGrantedAt IS NOT NULL
    `
  ).run({
    orderId
  });
}

export function buildReferralResponse(referral: ReferralRecord, origin: string): {
  referralCode: string;
  shareUrl: string;
  copied: boolean;
  discountGranted: boolean;
  discountAmountCents: number;
  payAmountCents: number;
} {
  const shareUrl = `${origin.replace(/\/$/, "")}/goal-fit-preview?ref=${encodeURIComponent(referral.referralCode)}`;
  const discountGranted = Boolean(referral.discountGrantedAt && !referral.discountUsedOrderId);
  const amount = calculateGoalFitOrderAmount(discountGranted ? "share_coupon" : "direct", discountGranted ? "share_card" : null);

  return {
    referralCode: referral.referralCode,
    shareUrl,
    copied: Boolean(referral.firstCopiedAt),
    discountGranted,
    discountAmountCents: discountGranted ? amount.discountAmountCents : 0,
    payAmountCents: amount.payAmountCents
  };
}
