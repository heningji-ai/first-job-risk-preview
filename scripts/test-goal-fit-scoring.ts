import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CompanyType,
  GoalFitAnswerMap,
  GoalFitQuestion,
  GoalFitQuestionBank,
  GoalFitScoreResult,
  RoleType
} from "../src/lib/goalFitTypes";

const { selectGoalFitQuestions } = (await import(
  "../src/lib/goalFitQuestionSelector" + ".ts"
)) as typeof import("../src/lib/goalFitQuestionSelector");
const { calculateGoalFitScores } = (await import(
  "../src/lib/goalFitScoringEngine" + ".ts"
)) as typeof import("../src/lib/goalFitScoringEngine");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const questionsPath = path.join(projectRoot, "src", "config", "goalFit", "questions.json");
const questionBank = JSON.parse(fs.readFileSync(questionsPath, "utf8")) as GoalFitQuestionBank;
const roleTypes: RoleType[] = ["SLS", "PM", "OPS", "TECH", "DATA", "FUNC", "MKT", "SUP"];

function fail(message: string): never {
  throw new Error(`[test-goal-fit-scoring] ${message}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) fail(message);
}

function createScoreAnswers(
  selectedQuestions: GoalFitQuestion[],
  mode: "max" | "min"
): GoalFitAnswerMap {
  return Object.fromEntries(
    selectedQuestions.map((question) => {
      const sortedOptions = [...question.options].sort((a, b) =>
        mode === "max" ? b.mainScore - a.mainScore : a.mainScore - b.mainScore
      );

      return [question.id, sortedOptions[0].id];
    })
  );
}

function assertIntegerScore(result: GoalFitScoreResult, field: keyof GoalFitScoreResult): void {
  const value = result[field];

  assert(typeof value === "number", `${String(field)} must be a number`);
  if (typeof value !== "number") return;
  assert(Number.isInteger(value), `${String(field)} must be an integer`);
  assert(value >= 0 && value <= 100, `${String(field)} must be within 0-100, got ${value}`);
}

function assertScoreShape(result: GoalFitScoreResult): void {
  const scoreFields: Array<keyof GoalFitScoreResult> = [
    "companyEntryScore",
    "roleEntryScore",
    "companyPersonalityScore",
    "companyBehaviorScore",
    "companyFitScore",
    "rolePersonalityScore",
    "roleBehaviorScore",
    "roleFitScore",
    "motivationFitScore",
    "pairScore",
    "overallScore"
  ];

  for (const field of scoreFields) {
    assertIntegerScore(result, field);
  }

  assert(result.motivationTags.length > 0, "motivationTags must exist");
  assert(result.motivationTags.length <= 2, "motivationTags must contain at most 2 tags");
  assert(Array.isArray(result.riskTagCounts), "riskTagCounts must be an array");
  assert(result.answeredQuestionCount === 34, "answeredQuestionCount must be 34");
  assert(result.selectedQuestionIds.length === 34, "selectedQuestionIds must contain 34 ids");
  assert(result.scoreVersion === "goal-fit-v1.3", "scoreVersion mismatch");
}

function expectThrows(label: string, fn: () => unknown): void {
  try {
    fn();
  } catch {
    return;
  }

  fail(`${label} must throw`);
}

function scoreFor(
  targetCompany: CompanyType,
  targetRole: RoleType,
  answers: GoalFitAnswerMap
): GoalFitScoreResult {
  return calculateGoalFitScores({
    questionBank,
    answers,
    targetCompany,
    targetRole
  });
}

for (const roleType of roleTypes) {
  const selectedQuestions = selectGoalFitQuestions(questionBank, roleType);

  assert(selectedQuestions.length === 34, `${roleType}: selector must return 34 questions`);
  assert(
    selectedQuestions.filter((question) => question.module === "A_BACKGROUND").length === 8,
    `${roleType}: must contain A 8`
  );
  assert(
    selectedQuestions.filter((question) => question.module === "B_PERSONALITY").length === 6,
    `${roleType}: must contain B 6`
  );
  assert(
    selectedQuestions.filter((question) => question.module === "C_MOTIVATION").length === 4,
    `${roleType}: must contain C 4`
  );
  assert(
    selectedQuestions.filter((question) => question.module === "D_WORKPLACE_SCENARIO").length === 8,
    `${roleType}: must contain D 8`
  );
  assert(
    selectedQuestions.filter((question) => question.module === "E_ROLE_SCENARIO").length === 8,
    `${roleType}: must contain E 8`
  );
  assert(
    !selectedQuestions.some((question) => question.id === "A07" || question.id === "A10"),
    `${roleType}: A07/A10 must not participate in MVP 34 questions`
  );

  const maxAnswers = createScoreAnswers(selectedQuestions, "max");
  const minAnswers = createScoreAnswers(selectedQuestions, "min");
  const maxResult = scoreFor("G", roleType, maxAnswers);
  const minResult = scoreFor("G", roleType, minAnswers);

  assertScoreShape(maxResult);
  assertScoreShape(minResult);
  assert(
    maxResult.overallScore > minResult.overallScore,
    `${roleType}: high answer overallScore must be greater than low answer overallScore`
  );
  assert(maxResult.companyFitScore >= minResult.companyFitScore, `${roleType}: companyFitScore should separate`);
  assert(maxResult.roleFitScore >= minResult.roleFitScore, `${roleType}: roleFitScore should separate`);
}

const funcQuestions = selectGoalFitQuestions(questionBank, "FUNC");
const dataQuestions = selectGoalFitQuestions(questionBank, "DATA");
const pmQuestions = selectGoalFitQuestions(questionBank, "PM");
const slsQuestions = selectGoalFitQuestions(questionBank, "SLS");
const maxFuncAnswers = createScoreAnswers(funcQuestions, "max");
const maxDataAnswers = createScoreAnswers(dataQuestions, "max");
const maxPmAnswers = createScoreAnswers(pmQuestions, "max");
const maxSlsAnswers = createScoreAnswers(slsQuestions, "max");

assert(scoreFor("G", "FUNC", maxFuncAnswers).pairScore === 90, "G_FUNC pairScore must be 90");
assert(scoreFor("F", "DATA", maxDataAnswers).pairScore === 88, "F_DATA pairScore must be 88");
assert(scoreFor("D", "PM", maxPmAnswers).pairScore === 84, "D_PM pairScore must be 84");
assert(scoreFor("V", "FUNC", maxFuncAnswers).pairScore === 65, "V_FUNC pairScore must be 65");
assert(scoreFor("G", "SLS", maxSlsAnswers).pairScore === 80, "G_SLS pairScore must use default 80");

const missingAnswerMap = { ...maxSlsAnswers };
delete missingAnswerMap.SLS01;
expectThrows("missing answer", () => scoreFor("G", "SLS", missingAnswerMap));

const invalidOptionMap = { ...maxSlsAnswers, SLS01: "invalid_option" };
expectThrows("invalid optionId", () => scoreFor("G", "SLS", invalidOptionMap));

const pollutedAnswerMap = { ...maxSlsAnswers, PM01: "E" };
const cleanResult = scoreFor("G", "SLS", maxSlsAnswers);
const pollutedResult = scoreFor("G", "SLS", pollutedAnswerMap);
assert(
  JSON.stringify(cleanResult) === JSON.stringify(pollutedResult),
  "non-target role branch answers must not affect scoring"
);

console.log("Goal Fit scoring tests passed.");
