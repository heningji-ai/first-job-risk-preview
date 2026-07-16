import { buildApiUrl } from "../config/api";
import { getGoalFitVisitorId } from "./goalFitVisitorStore";

const ATTRIBUTION_STORAGE_KEY = "first_job_goal_fit_attribution_v1";

type GoalFitAttribution = {
  source: string;
  channel: string;
  campaign: string;
  referralCode: string | null;
};

export type GoalFitAnalyticsEvent = {
  eventName: string;
  sessionId?: string | null;
  orderId?: string | null;
  eventValue?: number | null;
  pagePath?: string | null;
  metadata?: Record<string, unknown>;
};

function getStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  return undefined;
}

function createEventId(eventName: string): string {
  const cryptoLike = globalThis.crypto;
  if (cryptoLike?.randomUUID) return `evt_${eventName}_${cryptoLike.randomUUID()}`;
  return `evt_${eventName}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readStoredAttribution(): GoalFitAttribution | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(ATTRIBUTION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GoalFitAttribution) : null;
  } catch {
    return null;
  }
}

function writeStoredAttribution(attribution: GoalFitAttribution): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
}

export function getGoalFitAttribution(): GoalFitAttribution {
  const params = new URLSearchParams(window.location.search);
  const stored = readStoredAttribution();
  const source = params.get("source")?.trim();
  const channel = params.get("channel")?.trim();
  const campaign = params.get("campaign")?.trim();
  const referralCode = params.get("ref")?.trim();
  const hasExplicitAttribution = Boolean(source || channel || campaign || referralCode);

  if (stored && !hasExplicitAttribution) return stored;

  const attribution: GoalFitAttribution = {
    source: source || stored?.source || "direct",
    channel: channel || stored?.channel || "organic",
    campaign: campaign || stored?.campaign || "none",
    referralCode: stored?.referralCode || referralCode || null
  };

  if (!stored || hasExplicitAttribution) {
    writeStoredAttribution(attribution);
  }

  return attribution;
}

async function postAnalytics(path: string, body: Record<string, unknown>): Promise<void> {
  try {
    await fetch(buildApiUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } catch {
    // Analytics must never block the product flow.
  }
}

export function trackGoalFitVisit(sessionId?: string | null): void {
  const attribution = getGoalFitAttribution();

  void postAnalytics("/api/analytics/visit", {
    visitorId: getGoalFitVisitorId(),
    sessionId: sessionId ?? null,
    ...attribution,
    referralCode: attribution.referralCode,
    landingPath: window.location.pathname,
    landingUrl: window.location.href,
    referrer: document.referrer || null
  });
}

export function trackGoalFitEvent(event: GoalFitAnalyticsEvent): void {
  const attribution = getGoalFitAttribution();

  void postAnalytics("/api/analytics/events", {
    events: [
      {
        eventId: createEventId(event.eventName),
        visitorId: getGoalFitVisitorId(),
        sessionId: event.sessionId ?? null,
        orderId: event.orderId ?? null,
        eventName: event.eventName,
        eventValue: event.eventValue ?? null,
        pagePath: event.pagePath ?? window.location.pathname,
        metadata: event.metadata ?? null,
        ...attribution,
        referralCode: attribution.referralCode
      }
    ]
  });
}
