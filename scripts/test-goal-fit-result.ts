import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CompanyType,
  GoalFitAnswerMap,
  GoalFitQuestion,
  GoalFitQuestionBank,
  GoalFitResult,
  RoleType
} from "../src/lib/goalFitTypes";

const { selectGoalFitQuestions } = (await import(
  "../src/lib/goalFitQuestionSelector" + ".ts"
)) as typeof import("../src/lib/goalFitQuestionSelector");
const { buildGoalFitResult } = (await import(
  "../src/lib/goalFitResultBuilder" + ".ts"
)) as typeof import("../src/lib/goalFitResultBuilder");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const questionsPath = path.join(projectRoot, "src", "config", "goalFit", "questions.json");
const questionBank = JSON.parse(fs.readFileSync(questionsPath, "utf8")) as GoalFitQuestionBank;
const roleTypes: RoleType[] = ["SLS", "PM", "OPS", "TECH", "DATA", "FUNC", "MKT", "SUP"];
const forbiddenTexts = [
  "你不适合这个职业",
  "你性格不行",
  "你未来一定痛苦",
  "你只能",
  "全网唯一",
  "必须放弃",
  "保证入职",
  "立即购买",
  "免费咨询",
  "企业微信",
  "V1.2",
  "V2",
  "Preview",
  "debug",
  "sample"
];

function fail(message: string): never {
  throw new Error(`[test-goal-fit-result] ${message}`);
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

function buildFor(
  targetCompany: CompanyType,
  targetRole: RoleType,
  answers: GoalFitAnswerMap
): GoalFitResult {
  return buildGoalFitResult({
    questionBank,
    answers,
    targetCompany,
    targetRole
  });
}

function assertResultShape(result: GoalFitResult, label: string): void {
  assert(result.targetCompanyLabel.length > 0, `${label}: targetCompanyLabel must exist`);
  assert(result.targetRoleLabel.length > 0, `${label}: targetRoleLabel must exist`);
  assert(result.scores.overallScore >= 0 && result.scores.overallScore <= 100, `${label}: overallScore`);
  assert(result.overallConclusion.title.length > 0, `${label}: overallConclusion title`);
  assert(result.companyQuadrant.title.length > 0, `${label}: companyQuadrant title`);
  assert(result.roleQuadrant.title.length > 0, `${label}: roleQuadrant title`);
  assert(result.riskInsights.length >= 1 && result.riskInsights.length <= 3, `${label}: riskInsights 1-3`);
  assert(
    result.recommendations.length >= 1 && result.recommendations.length <= 3,
    `${label}: recommendations 1-3`
  );
  assert(result.cards.length >= 6, `${label}: cards must contain at least 6 items`);
  assert(result.resultVersion === "goal-fit-result-v1.3", `${label}: resultVersion mismatch`);
}

function flattenResultText(result: GoalFitResult): string {
  return JSON.stringify({
    overallConclusion: result.overallConclusion,
    companyQuadrant: result.companyQuadrant,
    roleQuadrant: result.roleQuadrant,
    riskInsights: result.riskInsights,
    headhunterSummary: result.headhunterSummary,
    recommendations: result.recommendations,
    cards: result.cards
  });
}

function assertNoForbiddenText(result: GoalFitResult, label: string): void {
  const text = flattenResultText(result);
  const forbidden = forbiddenTexts.find((item) => text.includes(item));

  assert(!forbidden, `${label}: forbidden text found: ${forbidden}`);
}

function expectThrows(label: string, fn: () => unknown): void {
  try {
    fn();
  } catch {
    return;
  }

  fail(`${label} must throw`);
}

function cloneQuestionBank(): GoalFitQuestionBank {
  return JSON.parse(JSON.stringify(questionBank)) as GoalFitQuestionBank;
}

for (const roleType of roleTypes) {
  const selectedQuestions = selectGoalFitQuestions(questionBank, roleType);
  const highAnswers = createScoreAnswers(selectedQuestions, "max");
  const lowAnswers = createScoreAnswers(selectedQuestions, "min");
  const highResult = buildFor("G", roleType, highAnswers);
  const lowResult = buildFor("G", roleType, lowAnswers);

  assertResultShape(highResult, `${roleType} high`);
  assertResultShape(lowResult, `${roleType} low`);
  assertNoForbiddenText(highResult, `${roleType} high`);
  assertNoForbiddenText(lowResult, `${roleType} low`);
  assert(
    highResult.scores.overallScore > lowResult.scores.overallScore,
    `${roleType}: high result must be greater than low result`
  );
}

const funcQuestions = selectGoalFitQuestions(questionBank, "FUNC");
const slsQuestions = selectGoalFitQuestions(questionBank, "SLS");
const maxFuncAnswers = createScoreAnswers(funcQuestions, "max");
const maxSlsAnswers = createScoreAnswers(slsQuestions, "max");

assert(buildFor("G", "FUNC", maxFuncAnswers).scores.pairScore === 90, "G_FUNC pairScore must be 90");
assert(buildFor("V", "FUNC", maxFuncAnswers).scores.pairScore === 65, "V_FUNC pairScore must be 65");
assert(buildFor("G", "SLS", maxSlsAnswers).scores.pairScore === 80, "G_SLS pairScore must use default 80");

const stableStartupAnswers = { ...maxSlsAnswers, C01: "A" };
const stableStartupResult = buildFor("V", "SLS", stableStartupAnswers);
assert(
  stableStartupResult.riskInsights.some((insight) => insight.id === "stable_startup_conflict"),
  "stable + V must trigger stable startup risk"
);

const socialDrainAnswers = { ...maxSlsAnswers, B01: "E" };
const socialDrainResult = buildFor("G", "SLS", socialDrainAnswers);
assert(
  socialDrainResult.riskInsights.some((insight) => insight.id === "external_communication_drain"),
  "SLS + SOCIAL_DRAIN must trigger external communication risk"
);

const missingAnswerMap = { ...maxSlsAnswers };
delete missingAnswerMap.SLS01;
expectThrows("missing answer", () => buildFor("G", "SLS", missingAnswerMap));

const invalidOptionMap = { ...maxSlsAnswers, SLS01: "invalid_option" };
expectThrows("invalid optionId", () => buildFor("G", "SLS", invalidOptionMap));

const originalQuestionBankText = JSON.stringify(questionBank);
const originalAnswersText = JSON.stringify(maxSlsAnswers);
buildFor("G", "SLS", maxSlsAnswers);
assert(JSON.stringify(questionBank) === originalQuestionBankText, "builder must not mutate questionBank");
assert(JSON.stringify(maxSlsAnswers) === originalAnswersText, "builder must not mutate answers");

const clonedQuestionBank = cloneQuestionBank();
buildGoalFitResult({
  questionBank: clonedQuestionBank,
  answers: maxSlsAnswers,
  targetCompany: "G",
  targetRole: "SLS"
});
assert(
  JSON.stringify(clonedQuestionBank) === JSON.stringify(questionBank),
  "builder must not mutate cloned questionBank"
);

console.log("Goal Fit result builder tests passed.");
