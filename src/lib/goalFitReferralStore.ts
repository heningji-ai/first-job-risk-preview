import { buildApiUrl } from "../config/api";
import { getGoalFitVisitorId } from "./goalFitVisitorStore";

const REFERRAL_CONTEXT_KEY = "first_job_goal_fit_referral_context_v1";

export type GoalFitReferralContext = {
  referralCode: string;
  visitorId: string;
  landingPath: string;
  recordedAt: string;
};

export type GoalFitReferralResponse = {
  referralCode: string;
  shareUrl: string;
  copied: boolean;
  discountGranted: boolean;
  discountAmountCents: number;
  payAmountCents: number;
};

export type GoalFitDiscountStatus = {
  discountGranted: boolean;
  discountUsed: boolean;
  discountAmountCents: number;
  payAmountCents: number;
  referralCode: string | null;
};

function getStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;

  return (globalThis as { localStorage?: Storage }).localStorage;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getGoalFitReferralContext(): GoalFitReferralContext | null {
  const storage = getStorage();
  if (!storage) return null;

  const raw = storage.getItem(REFERRAL_CONTEXT_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as GoalFitReferralContext;
  } catch {
    return null;
  }
}

function saveGoalFitReferralContext(context: GoalFitReferralContext): void {
  getStorage()?.setItem(REFERRAL_CONTEXT_KEY, JSON.stringify(context));
}

function removeReferralParamFromUrl(params: URLSearchParams): void {
  params.delete("ref");
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", nextUrl);
}

export async function recordGoalFitReferralVisitFromUrl(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const referralCode = params.get("ref")?.trim();
  if (!referralCode) return;

  if (getGoalFitReferralContext()) {
    removeReferralParamFromUrl(params);
    return;
  }

  const visitorId = getGoalFitVisitorId();
  const landingPath = `${window.location.pathname}${window.location.search}`;

  try {
    const result = await requestJson<{ ok: boolean; recorded: boolean }>("/api/referrals/visit", {
      method: "POST",
      body: JSON.stringify({
        referralCode,
        visitorId,
        landingPath
      })
    });

    if (result.recorded) {
      saveGoalFitReferralContext({
        referralCode,
        visitorId,
        landingPath,
        recordedAt: new Date().toISOString()
      });
    }
  } catch {
    // Invalid referrals should not block the page.
  } finally {
    removeReferralParamFromUrl(params);
  }
}

export async function markGoalFitReferralStarted(): Promise<void> {
  const context = getGoalFitReferralContext();
  if (!context) return;

  try {
    await requestJson("/api/referrals/start", {
      method: "POST",
      body: JSON.stringify({
        referralCode: context.referralCode,
        visitorId: context.visitorId
      })
    });
  } catch {
    // Referral tracking must not block the test flow.
  }
}

export async function markGoalFitReferralCompleted(resultSessionId: string): Promise<void> {
  const context = getGoalFitReferralContext();
  if (!context) return;

  try {
    await requestJson("/api/referrals/complete", {
      method: "POST",
      body: JSON.stringify({
        referralCode: context.referralCode,
        visitorId: context.visitorId,
        resultSessionId
      })
    });
  } catch {
    // Referral tracking must not block result generation.
  }
}

export async function createGoalFitReferralLink(sessionId: string): Promise<GoalFitReferralResponse> {
  return requestJson<GoalFitReferralResponse>("/api/referrals/create", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      visitorId: getGoalFitVisitorId()
    })
  });
}

export async function confirmGoalFitReferralCopied(sessionId: string): Promise<GoalFitReferralResponse> {
  return requestJson<GoalFitReferralResponse>("/api/referrals/create-or-copy", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      visitorId: getGoalFitVisitorId()
    })
  });
}

export async function getGoalFitDiscountStatus(sessionId: string): Promise<GoalFitDiscountStatus> {
  return requestJson<GoalFitDiscountStatus>(
    `/api/referrals/discount-status?sessionId=${encodeURIComponent(sessionId)}`
  );
}
