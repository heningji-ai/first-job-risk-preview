import type { AudienceType } from "../types/config";
import type { StoredTestSession } from "../types/session";

export const ANONYMOUS_USER_ID_KEY = "first_job_risk_preview_anonymous_user_id";
export const SESSIONS_KEY = "first_job_risk_preview_sessions";

function randomString(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function getOrCreateAnonymousUserId(): string {
  const existingId = localStorage.getItem(ANONYMOUS_USER_ID_KEY);
  if (existingId) return existingId;

  const nextId = `anon_${Date.now()}_${randomString()}`;
  localStorage.setItem(ANONYMOUS_USER_ID_KEY, nextId);
  return nextId;
}

export function getStoredSessions(): StoredTestSession[] {
  const raw = localStorage.getItem(SESSIONS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getStoredSession(testSessionId: string): StoredTestSession | undefined {
  return getStoredSessions().find((session) => session.id === testSessionId);
}

export function createStoredSession(
  audienceType: AudienceType,
  answers: Record<string, string>
): StoredTestSession {
  const now = new Date().toISOString();
  const session: StoredTestSession = {
    id: `session_${Date.now()}_${randomString()}`,
    anonymousUserId: getOrCreateAnonymousUserId(),
    audienceType,
    answers,
    createdAt: now,
    completedAt: now
  };

  const sessions = getStoredSessions();
  localStorage.setItem(SESSIONS_KEY, JSON.stringify([...sessions, session]));
  return session;
}
