import type {
  CompanyType,
  GoalFitAnswerMap,
  GoalFitQuestionBank,
  GoalFitResult,
  GoalFitSession,
  RoleType
} from "./goalFitTypes";

const { buildGoalFitResult } = (await import(
  "./goalFitResultBuilder" + ".ts"
)) as typeof import("./goalFitResultBuilder");
const { selectGoalFitQuestions } = (await import(
  "./goalFitQuestionSelector" + ".ts"
)) as typeof import("./goalFitQuestionSelector");

const SESSION_STORAGE_KEY = "first_job_goal_fit_sessions_v1";
const DRAFT_STORAGE_KEY = "first_job_goal_fit_draft_v1";

export type GoalFitDraft = {
  targetCompany?: CompanyType;
  targetRole?: RoleType;
  answers: GoalFitAnswerMap;
  currentIndex: number;
  step: "target" | "confirm" | "questions" | "complete";
};

function getStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;

  return (globalThis as { localStorage?: Storage }).localStorage;
}

function readSessions(): GoalFitSession[] {
  const storage = getStorage();
  if (!storage) return [];

  const raw = storage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GoalFitSession[]) : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions: GoalFitSession[]): void {
  const storage = getStorage();
  if (!storage) return;

  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

export function createGoalFitSessionId(): string {
  return `goal_fit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function saveGoalFitSession(session: GoalFitSession): void {
  const sessions = readSessions().filter((item) => item.id !== session.id);
  writeSessions([session, ...sessions]);
}

export function getGoalFitSession(sessionId: string): GoalFitSession | null {
  return readSessions().find((session) => session.id === sessionId) ?? null;
}

export function listGoalFitSessions(): GoalFitSession[] {
  return readSessions();
}

export function clearGoalFitSessions(): void {
  const storage = getStorage();
  storage?.removeItem(SESSION_STORAGE_KEY);
}

export function createGoalFitSession({
  questionBank,
  answers,
  targetCompany,
  targetRole
}: {
  questionBank: GoalFitQuestionBank;
  answers: GoalFitAnswerMap;
  targetCompany: CompanyType;
  targetRole: RoleType;
}): GoalFitSession {
  const selectedQuestions = selectGoalFitQuestions(questionBank, targetRole);
  const selectedQuestionIds = selectedQuestions.map((question) => question.id);
  const result: GoalFitResult = buildGoalFitResult({
    questionBank,
    answers,
    targetCompany,
    targetRole
  });
  const now = new Date().toISOString();

  return {
    id: createGoalFitSessionId(),
    createdAt: now,
    updatedAt: now,
    targetCompany,
    targetRole,
    answers: { ...answers },
    selectedQuestionIds,
    result
  };
}

export function saveGoalFitDraft(draft: GoalFitDraft): void {
  const storage = getStorage();
  if (!storage) return;

  storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function getGoalFitDraft(): GoalFitDraft | null {
  const storage = getStorage();
  if (!storage) return null;

  const raw = storage.getItem(DRAFT_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<GoalFitDraft>;
    if (!parsed || typeof parsed !== "object" || !parsed.answers) return null;

    return {
      targetCompany: parsed.targetCompany,
      targetRole: parsed.targetRole,
      answers: parsed.answers,
      currentIndex: Number.isInteger(parsed.currentIndex) ? parsed.currentIndex ?? 0 : 0,
      step: parsed.step ?? "target"
    };
  } catch {
    return null;
  }
}

export function clearGoalFitDraft(): void {
  const storage = getStorage();
  storage?.removeItem(DRAFT_STORAGE_KEY);
}
