const UNLOCK_STORAGE_PREFIX = "goalFitReportUnlocked:";

function getStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;

  return (globalThis as { localStorage?: Storage }).localStorage;
}

export function markGoalFitReportUnlocked(sessionId: string): void {
  const storage = getStorage();
  if (!storage || !sessionId) return;

  storage.setItem(`${UNLOCK_STORAGE_PREFIX}${sessionId}`, "1");
}

export function isGoalFitReportUnlocked(sessionId: string): boolean {
  const storage = getStorage();
  if (!storage || !sessionId) return false;

  return storage.getItem(`${UNLOCK_STORAGE_PREFIX}${sessionId}`) === "1";
}
