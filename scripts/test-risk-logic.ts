import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import type { Question, RiskCard, ScoringConfig, TestCase } from "../src/types/config";
import type { ResultDraft } from "../src/types/result";
import type { RiskCardEngineResult } from "../src/types/riskCard";

type JsonObject = Record<string, any>;
type ScoringModule = {
  buildResultDraft(input: {
    testSessionId: string;
    audienceType: "student";
    answers: Record<string, string>;
    questions: Question[];
    scoringConfig: ScoringConfig & { _todo?: string };
    createdAt?: string;
  }): ResultDraft;
};
type RiskCardModule = {
  evaluateRiskCards(
    answers: Record<string, string>,
    resultDraft: ResultDraft,
    riskCards: RiskCard[]
  ): RiskCardEngineResult;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const audienceType = process.env.AUDIENCE_TYPE ?? "student";
const configDir = path.join(projectRoot, "src", "config", "audiences", audienceType);

function readJson(fileName: string): JsonObject {
  return JSON.parse(fs.readFileSync(path.join(configDir, fileName), "utf8"));
}

function asArray<T = JsonObject>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function assertExpectedRiskLevels(testCase: TestCase, resultDraft: ResultDraft): string[] {
  const failures: string[] = [];
  const expectedRiskLevels = testCase.expected?.riskLevels ?? {};

  for (const [riskKey, allowedLevels] of Object.entries(expectedRiskLevels)) {
    const actualLevel = resultDraft.finalRiskScores[riskKey]?.riskLevel;
    if (!actualLevel || !allowedLevels.includes(actualLevel)) {
      failures.push(`${riskKey} expected ${allowedLevels.join("|")} but got ${actualLevel ?? "null"}`);
    }
  }

  return failures;
}

function assertExpectedRiskCards(testCase: TestCase, riskResult: RiskCardEngineResult): string[] {
  const failures: string[] = [];
  const triggeredIds = new Set(riskResult.triggeredRiskCards.map((card) => card.cardId));

  for (const expectedCardId of testCase.expected?.mustTrigger ?? []) {
    if (!triggeredIds.has(expectedCardId)) {
      failures.push(`${expectedCardId} expected in triggeredRiskCards`);
    }
  }

  return failures;
}

function formatIds(ids: string[]): string {
  return ids.length > 0 ? ids.join(", ") : "(none)";
}

console.log(`[test-risk-logic] audience_type=${audienceType}`);

const scoringEngineUrl = pathToFileURL(path.join(projectRoot, "src", "lib", "scoringEngine.ts")).href;
const riskCardEngineUrl = pathToFileURL(path.join(projectRoot, "src", "lib", "riskCardEngine.ts")).href;
const { buildResultDraft } = (await import(scoringEngineUrl)) as ScoringModule;
const { evaluateRiskCards } = (await import(riskCardEngineUrl)) as RiskCardModule;

const questionsRaw = readJson("questions.json");
const scoring = readJson("scoring.json") as ScoringConfig & { _todo?: string };
const riskCardsRaw = readJson("risk_cards.json");
const riskCardCopyRaw = readJson("risk_card_copy.json");
const testCasesRaw = readJson("test_cases.json");

const questions = asArray<Question>(questionsRaw.questions ?? questionsRaw);
const riskCards = asArray<RiskCard>(riskCardsRaw.riskCards ?? riskCardsRaw);
const riskCardCopies = (riskCardCopyRaw.riskCardCopies ?? {}) as Record<string, { status?: string }>;
const testCases = asArray<TestCase>(testCasesRaw.testCases ?? testCasesRaw);

if (testCases.length === 0) {
  console.log("[test-risk-logic] test_cases.json has no test cases yet");
  process.exit(0);
}

if (scoring._todo) {
  console.warn("[test-risk-logic] WARNING: scoring.json is TODO_PLACEHOLDER; output is engineering-only");
}
if (riskCardsRaw._todo) {
  console.warn("[test-risk-logic] WARNING: risk_cards.json is ENGINEERING_SAMPLE_ONLY; output is engineering-only");
}
if (riskCardCopyRaw._todo) {
  console.warn("[test-risk-logic] WARNING: risk_card_copy.json is ENGINEERING_PLACEHOLDER; copy is not formal");
}

console.log(`[test-risk-logic] risk card count: ${riskCards.length}`);

let failed = 0;

for (const testCase of testCases) {
  const resultDraft = buildResultDraft({
    testSessionId: `test_${testCase.id}`,
    audienceType: "student",
    answers: testCase.answers ?? {},
    questions,
    scoringConfig: scoring,
    createdAt: "2026-01-01T00:00:00.000Z"
  });
  const riskResult = evaluateRiskCards(testCase.answers ?? {}, resultDraft, riskCards);
  const assertionFailures = [
    ...assertExpectedRiskLevels(testCase, resultDraft),
    ...assertExpectedRiskCards(testCase, riskResult)
  ];

  if (assertionFailures.length > 0) {
    failed += 1;
    console.error(`[test-risk-logic] FAIL: ${testCase.id}`);
    for (const failure of assertionFailures) {
      console.error(`  ${failure}`);
    }
    continue;
  }

  const triggeredIds = riskResult.triggeredRiskCards.map((card) => card.cardId);
  const topIds = riskResult.topRiskCards.map((card) => card.cardId);
  const topCopyResults = riskResult.topRiskCards.map((card) => {
    const copy = riskCardCopies[card.cardId];
    if (!copy) return `${card.cardId}:missing`;
    if (copy.status === "ENGINEERING_PLACEHOLDER") return `${card.cardId}:copy-found-placeholder`;
    return `${card.cardId}:copy-found`;
  });
  const protectedIds = riskResult.protectedCards.map((card) => card.cardId);
  const skippedIds = riskResult.skippedCards.map((card) => card.cardId);
  const warnings = [...resultDraft.warnings, ...riskResult.warnings];

  console.log(`[test-risk-logic] PASS: ${testCase.id}`);
  console.log(`  answered question count: ${resultDraft.answeredCount}`);
  console.log(`  triggeredRiskCards ids: ${formatIds(triggeredIds)}`);
  console.log(`  topRiskCards ids: ${formatIds(topIds)}`);
  console.log(`  topRiskCards copy: ${formatIds(topCopyResults)}`);
  console.log(`  protected / skipped ids: ${formatIds([...protectedIds, ...skippedIds])}`);
  console.log(`  warnings: ${warnings.length > 0 ? warnings.join(", ") : "(none)"}`);
}

if (failed > 0) {
  process.exit(1);
}

console.log(`[test-risk-logic] PASS: ${testCases.length} test cases`);
