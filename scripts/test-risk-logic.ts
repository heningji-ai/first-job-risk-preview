import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import type { Question, ScoringConfig, TestCase } from "../src/types/config";
import type { ResultDraft } from "../src/types/result";

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

function getExpectedWarnings(testCase: TestCase): string[] {
  const warnings: string[] = [];
  if ((testCase.expected?.mustTrigger?.length ?? 0) > 0) {
    warnings.push("EXPECTED_MUST_TRIGGER_NOT_ASSERTED_IN_SCORING_ENGINE_STAGE");
  }
  if (testCase.expected?.viralCopy) {
    warnings.push("EXPECTED_VIRAL_COPY_NOT_ASSERTED_IN_SCORING_ENGINE_STAGE");
  }
  return warnings;
}

console.log(`[test-risk-logic] audience_type=${audienceType}`);

const scoringEngineUrl = pathToFileURL(path.join(projectRoot, "src", "lib", "scoringEngine.ts")).href;
const { buildResultDraft } = (await import(scoringEngineUrl)) as ScoringModule;

const questionsRaw = readJson("questions.json");
const scoring = readJson("scoring.json") as ScoringConfig & { _todo?: string };
const testCasesRaw = readJson("test_cases.json");

const questions = asArray<Question>(questionsRaw.questions ?? questionsRaw);
const testCases = asArray<TestCase>(testCasesRaw.testCases ?? testCasesRaw);

if (testCases.length === 0) {
  console.log("[test-risk-logic] test_cases.json has no test cases yet");
  process.exit(0);
}

if (scoring._todo) {
  console.warn("[test-risk-logic] WARNING: scoring.json is TODO_PLACEHOLDER; output is engineering-only");
}

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

  const assertionFailures = assertExpectedRiskLevels(testCase, resultDraft);
  if (assertionFailures.length > 0) {
    failed += 1;
    console.error(`[test-risk-logic] FAIL: ${testCase.id}`);
    for (const failure of assertionFailures) {
      console.error(`  ${failure}`);
    }
    continue;
  }

  const directRiskKeys = Object.keys(resultDraft.directRiskScores);
  const finalRiskKeys = Object.keys(resultDraft.finalRiskScores);
  const warnings = [...resultDraft.warnings, ...getExpectedWarnings(testCase)];

  console.log(`[test-risk-logic] PASS: ${testCase.id}`);
  console.log(`  answered question count: ${resultDraft.answeredCount}`);
  console.log(`  directRiskScores keys: ${directRiskKeys.length > 0 ? directRiskKeys.join(", ") : "(none)"}`);
  console.log(`  finalRiskScores keys: ${finalRiskKeys.length > 0 ? finalRiskKeys.join(", ") : "(none)"}`);
  console.log(`  warnings: ${warnings.length > 0 ? warnings.join(", ") : "(none)"}`);
}

if (failed > 0) {
  process.exit(1);
}

console.log(`[test-risk-logic] PASS: ${testCases.length} test cases`);
