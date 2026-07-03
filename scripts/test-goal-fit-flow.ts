import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  GoalFitAnswerMap,
  GoalFitQuestion,
  GoalFitQuestionBank,
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
const pagePath = path.join(projectRoot, "src", "pages", "GoalFitTestPage.tsx");
const questionBank = JSON.parse(fs.readFileSync(questionsPath, "utf8")) as GoalFitQuestionBank;
const roleTypes: RoleType[] = ["SLS", "PM", "OPS", "TECH", "DATA", "FUNC", "MKT", "SUP"];

function fail(message: string): never {
  throw new Error(`[test-goal-fit-flow] ${message}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) fail(message);
}

function createCompleteAnswers(selectedQuestions: GoalFitQuestion[]): GoalFitAnswerMap {
  return Object.fromEntries(
    selectedQuestions.map((question) => [question.id, question.options[0]?.id ?? ""])
  );
}

function expectThrows(label: string, fn: () => unknown): void {
  try {
    fn();
  } catch {
    return;
  }

  fail(`${label} must throw`);
}

for (const roleType of roleTypes) {
  const selectedQuestions = selectGoalFitQuestions(questionBank, roleType);

  assert(selectedQuestions.length === 34, `${roleType}: must return 34 questions`);
  assert(
    selectedQuestions.filter((question) => question.module === "A_BACKGROUND").length === 8,
    `${roleType}: must contain A8`
  );
  assert(
    selectedQuestions.filter((question) => question.module === "B_PERSONALITY").length === 6,
    `${roleType}: must contain B6`
  );
  assert(
    selectedQuestions.filter((question) => question.module === "C_MOTIVATION").length === 4,
    `${roleType}: must contain C4`
  );
  assert(
    selectedQuestions.filter((question) => question.module === "D_WORKPLACE_SCENARIO").length === 8,
    `${roleType}: must contain D8`
  );
  assert(
    selectedQuestions.filter((question) => question.module === "E_ROLE_SCENARIO").length === 8,
    `${roleType}: must contain E8`
  );
  assert(
    selectedQuestions
      .filter((question) => question.module === "E_ROLE_SCENARIO")
      .every((question) => question.roleBranch === roleType),
    `${roleType}: E module must only contain target role branch`
  );

  const answers = createCompleteAnswers(selectedQuestions);
  const result = buildGoalFitResult({
    questionBank,
    answers,
    targetCompany: "G",
    targetRole: roleType
  });

  assert(result.cards.length >= 6, `${roleType}: result cards must contain at least 6`);
  assert(result.riskInsights.length >= 1, `${roleType}: riskInsights must contain at least 1`);
  assert(result.recommendations.length <= 3, `${roleType}: recommendations must contain at most 3`);

  const missingAnswers = { ...answers };
  delete missingAnswers[selectedQuestions[0].id];
  expectThrows(`${roleType}: missing answer`, () =>
    buildGoalFitResult({
      questionBank,
      answers: missingAnswers,
      targetCompany: "G",
      targetRole: roleType
    })
  );

  expectThrows(`${roleType}: invalid optionId`, () =>
    buildGoalFitResult({
      questionBank,
      answers: {
        ...answers,
        [selectedQuestions[0].id]: "invalid_option"
      },
      targetCompany: "G",
      targetRole: roleType
    })
  );
}

const pageSource = fs.readFileSync(pagePath, "utf8");

[
  "你现在最想去什么类型的公司？",
  "你最想判断哪个岗位方向？",
  "目标已经选好了",
  "开始答题"
].forEach((text) => {
  assert(pageSource.includes(text), `GoalFitTestPage must contain copy: ${text}`);
});
assert(
  pageSource.includes('step === "target"') && pageSource.includes('step === "targetRole"'),
  "GoalFitTestPage must split target selection into company and role steps"
);

const forbiddenVisibleTexts = [
  "V1.3",
  "V2",
  "Preview",
  "预览版",
  "开发",
  "debug",
  "sample",
  "你性格不行",
  "你未来一定痛苦",
  "你只能",
  "全网唯一",
  "必须放弃",
  "保证入职",
  "立即购买",
  "免费咨询",
  "企业微信"
];
const normalizedPageSource = pageSource.replace(/\/test-goal-fit-preview/g, "");
const matchedForbidden = forbiddenVisibleTexts.find((text) => normalizedPageSource.includes(text));

assert(!matchedForbidden, `GoalFitTestPage contains forbidden visible wording: ${matchedForbidden}`);

console.log("Goal Fit flow tests passed.");
