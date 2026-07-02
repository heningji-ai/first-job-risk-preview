import questionsV2ConfigJson from "../src/config/questions_v2.json" with { type: "json" };
import type {
  PathFitAnswerMapV2,
  PathFitResultPresentationV2,
  QuestionsV2Config
} from "../src/types/pathFitV2";

const { buildPathFitResultV2 } = await import("../src/lib/pathFitResultBuilderV2" + ".ts");
const {
  getPathFitSampleAnswerMapV2,
  PATH_FIT_V2_SAMPLE_KEYS,
  PATH_FIT_V2_SAMPLE_LABELS
} = await import("../src/lib/pathFitSampleAnswersV2" + ".ts");
const { derivePathSelectionV2, getVisibleQuestionsV2, validateAnswerMapV2 } = await import(
  "../src/lib/pathFitScoringV2" + ".ts"
);
const {
  clearPathFitPreviewSessionsV2,
  createPathFitPreviewSessionV2,
  getPathFitPreviewSessionV2,
  listPathFitPreviewSessionsV2,
  prunePathFitAnswerMapToVisibleV2
} = await import("../src/lib/pathFitSessionStoreV2" + ".ts");

const questionsV2Config = questionsV2ConfigJson as QuestionsV2Config;
const questions = questionsV2Config.questions;
const V2_SESSION_STORAGE_KEY = "first_job_risk_preview_v2_preview_sessions";
const OLD_SESSION_STORAGE_KEY = "first_job_risk_preview_sessions";

class MemoryStorage {
  private items = new Map<string, string>();

  get length(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

function fail(message: string): never {
  throw new Error(`[test-flow-v2-preview] ${message}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) fail(message);
}

function collectPublicText(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectPublicText(item));

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
      if (key === "debug") return [];
      return collectPublicText(item);
    });
  }

  return [];
}

function assertNoForbiddenPublicWording(
  label: string,
  result: PathFitResultPresentationV2
): void {
  const forbidden = [
    "A 档",
    "B 档",
    "C 档",
    "D 档",
    "档位",
    "评级",
    "等级",
    "pathFitBand",
    "产品草稿",
    "工程占位",
    "placeholder",
    "debug",
    "test",
    "职业诊断",
    "你不适合",
    "离职率",
    "离职概率",
    "真实离职率",
    "诊断分数",
    "能力分数",
    "职业匹配分",
    "性格匹配度",
    "免费咨询",
    "免费分析",
    "免费帮你判断",
    "立即咨询",
    "购买服务",
    "领取方案",
    "保证入职",
    "保证上岸",
    "包过面试"
  ];
  const publicText = collectPublicText(result).join("\n");
  const matched = forbidden.find((item) => publicText.includes(item));

  assert(!matched, `${label}: public result contains forbidden wording: ${matched}`);
}

function assertAnswerMapIsVisibleOnly(
  label: string,
  answerMap: PathFitAnswerMapV2
): void {
  const pathSelection = derivePathSelectionV2(answerMap, questions);
  const { visibleQuestions, visibleQuestionIds } = getVisibleQuestionsV2(
    questions,
    pathSelection.companyType,
    pathSelection.roleType
  );
  const answerQuestionIds = Object.keys(answerMap);

  assert(visibleQuestions.length === 30, `${label}: visible question count must be 30`);
  assert(answerQuestionIds.length === 30, `${label}: answerMap must contain 30 answers`);
  assert(
    answerQuestionIds.every((questionId) => visibleQuestionIds.includes(questionId)),
    `${label}: answerMap contains non-visible question answers`
  );
  validateAnswerMapV2(answerMap, visibleQuestions, { strict: true });
}

function assertPruneRemovesInvisibleAnswers(answerMap: PathFitAnswerMapV2): void {
  const pathSelection = derivePathSelectionV2(answerMap, questions);
  const { visibleQuestions, visibleQuestionIds } = getVisibleQuestionsV2(
    questions,
    pathSelection.companyType,
    pathSelection.roleType
  );
  const invisibleQuestion = questions.find(
    (question) => !visibleQuestionIds.includes(question.questionId) && question.options.length > 0
  );

  assert(Boolean(invisibleQuestion), "expected at least one invisible branch question");

  const pollutedAnswerMap = {
    ...answerMap,
    [invisibleQuestion!.questionId]: invisibleQuestion!.options[0].optionId
  };
  const prunedAnswerMap = prunePathFitAnswerMapToVisibleV2(
    pollutedAnswerMap,
    visibleQuestions
  );

  assert(
    !Object.prototype.hasOwnProperty.call(prunedAnswerMap, invisibleQuestion!.questionId),
    "prunePathFitAnswerMapToVisibleV2 must remove invisible answers"
  );
  assert(Object.keys(prunedAnswerMap).length === 30, "pruned answerMap must keep 30 answers");
}

const memoryStorage = new MemoryStorage();
(globalThis as unknown as { localStorage?: MemoryStorage }).localStorage = memoryStorage;
const oldSessionSentinel = JSON.stringify([{ legacy: true }]);
memoryStorage.setItem(OLD_SESSION_STORAGE_KEY, oldSessionSentinel);

clearPathFitPreviewSessionsV2();

for (const sampleKey of PATH_FIT_V2_SAMPLE_KEYS) {
  const label = PATH_FIT_V2_SAMPLE_LABELS[sampleKey];
  const answerMap = getPathFitSampleAnswerMapV2(sampleKey);

  assertAnswerMapIsVisibleOnly(label, answerMap);
  assertPruneRemovesInvisibleAnswers(answerMap);

  const session = createPathFitPreviewSessionV2(answerMap);
  const loadedSession = getPathFitPreviewSessionV2(session.sessionId);

  assert(Boolean(loadedSession), `${label}: session must be readable after save`);
  assert(loadedSession?.version === "v1.2", `${label}: session version must be v1.2`);
  assert(loadedSession?.answeredQuestionCount === 30, `${label}: answeredQuestionCount must be 30`);
  assert(
    loadedSession?.visibleQuestionIds.length === 30,
    `${label}: visibleQuestionIds must contain 30 questions`
  );
  assert(
    JSON.stringify(loadedSession?.answerMap) === JSON.stringify(answerMap),
    `${label}: stored answerMap must match original answerMap`
  );

  const result = buildPathFitResultV2(loadedSession!.answerMap);
  assert(
    result.finalPathFitScore >= 0 && result.finalPathFitScore <= 100,
    `${label}: finalPathFitScore must be within 0-100`
  );
  assertNoForbiddenPublicWording(label, result);

  console.log(
    `[test-flow-v2-preview] PASS: ${sampleKey} -> ${session.sessionId} -> ${result.finalPathFitScore}`
  );
}

const storedSessions = listPathFitPreviewSessionsV2();

assert(
  storedSessions.length === PATH_FIT_V2_SAMPLE_KEYS.length,
  "V2 preview session store must contain all created sample sessions"
);
assert(
  memoryStorage.getItem(V2_SESSION_STORAGE_KEY) !== null,
  "V2 preview session store key must be written"
);
assert(
  memoryStorage.getItem(OLD_SESSION_STORAGE_KEY) === oldSessionSentinel,
  "V2 preview flow must not write the old session key"
);
assert(
  getPathFitPreviewSessionV2("missing_session_id") === null,
  "missing sessionId must return null"
);

console.log(
  `[test-flow-v2-preview] PASS: ${storedSessions.length} V2 preview sessions saved and verified`
);
