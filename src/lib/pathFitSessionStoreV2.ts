import type {
  CompanyTypeV2,
  PathFitAnswerMapV2,
  QuestionV2,
  RoleTypeV2
} from "../types/pathFitV2";

type PathFitScoringV2Module = typeof import("./pathFitScoringV2");

const { derivePathSelectionV2, getVisibleQuestionsV2, validateAnswerMapV2 } = (await import(
  "./pathFitScoringV2" + ".ts"
)) as PathFitScoringV2Module;
const { questionsV2Config } = (await import("./questionsV2Data" + ".ts")) as typeof import("./questionsV2Data");

const SESSION_STORAGE_KEY = "first_job_risk_preview_v2_preview_sessions";

export type PathFitPreviewSessionV2 = {
  sessionId: string;
  version: "v1.2";
  createdAt: string;
  updatedAt: string;
  answerMap: PathFitAnswerMapV2;
  companyType: CompanyTypeV2;
  roleType: RoleTypeV2;
  answeredQuestionCount: number;
  visibleQuestionIds: string[];
};

function getStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;

  const maybeStorage = (globalThis as { localStorage?: Storage }).localStorage;
  return maybeStorage;
}

function readSessions(): PathFitPreviewSessionV2[] {
  const storage = getStorage();

  if (!storage) return [];

  const raw = storage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PathFitPreviewSessionV2[]) : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions: PathFitPreviewSessionV2[]): void {
  const storage = getStorage();

  if (!storage) return;

  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

function createSessionId(): string {
  return `v2_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function prunePathFitAnswerMapToVisibleV2(
  answerMap: PathFitAnswerMapV2,
  visibleQuestions: QuestionV2[]
): PathFitAnswerMapV2 {
  const visibleQuestionIds = new Set(visibleQuestions.map((question) => question.questionId));

  return Object.fromEntries(
    Object.entries(answerMap).filter(([questionId]) => visibleQuestionIds.has(questionId))
  );
}

export function createPathFitPreviewSessionV2(
  answerMap: PathFitAnswerMapV2
): PathFitPreviewSessionV2 {
  const pathSelection = derivePathSelectionV2(answerMap, questionsV2Config.questions);
  const { visibleQuestions, visibleQuestionIds } = getVisibleQuestionsV2(
    questionsV2Config.questions,
    pathSelection.companyType,
    pathSelection.roleType
  );
  const cleanAnswerMap = prunePathFitAnswerMapToVisibleV2(answerMap, visibleQuestions);

  validateAnswerMapV2(cleanAnswerMap, visibleQuestions, { strict: true });

  const answeredQuestionCount = visibleQuestions.filter((question) =>
    Boolean(cleanAnswerMap[question.questionId])
  ).length;

  if (visibleQuestionIds.length !== 30) {
    throw new Error(`V2 preview session visible question count must be 30, got ${visibleQuestionIds.length}`);
  }

  if (answeredQuestionCount !== 30) {
    throw new Error(`V2 preview session answered question count must be 30, got ${answeredQuestionCount}`);
  }

  const now = new Date().toISOString();
  const session: PathFitPreviewSessionV2 = {
    sessionId: createSessionId(),
    version: "v1.2",
    createdAt: now,
    updatedAt: now,
    answerMap: cleanAnswerMap,
    companyType: pathSelection.companyType,
    roleType: pathSelection.roleType,
    answeredQuestionCount,
    visibleQuestionIds
  };
  const sessions = listPathFitPreviewSessionsV2().filter(
    (item) => item.sessionId !== session.sessionId
  );

  writeSessions([session, ...sessions]);

  return session;
}

export function getPathFitPreviewSessionV2(
  sessionId: string
): PathFitPreviewSessionV2 | null {
  return listPathFitPreviewSessionsV2().find((session) => session.sessionId === sessionId) ?? null;
}

export function listPathFitPreviewSessionsV2(): PathFitPreviewSessionV2[] {
  return readSessions();
}

export function clearPathFitPreviewSessionsV2(): void {
  const storage = getStorage();
  storage?.removeItem(SESSION_STORAGE_KEY);
}
