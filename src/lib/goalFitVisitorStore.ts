const VISITOR_STORAGE_KEY = "first_job_goal_fit_visitor_id_v1";

function getStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;

  return (globalThis as { localStorage?: Storage }).localStorage;
}

function createVisitorId(): string {
  const cryptoLike = globalThis.crypto;
  if (cryptoLike?.randomUUID) return `visitor_${cryptoLike.randomUUID()}`;

  return `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getGoalFitVisitorId(): string {
  const storage = getStorage();
  if (!storage) return createVisitorId();

  const existing = storage.getItem(VISITOR_STORAGE_KEY);
  if (existing) return existing;

  const visitorId = createVisitorId();
  storage.setItem(VISITOR_STORAGE_KEY, visitorId);
  return visitorId;
}
