import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  GoalFitAnswerMap,
  GoalFitQuestion,
  GoalFitQuestionBank,
  GoalFitSession
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
const appPath = path.join(projectRoot, "src", "App.tsx");
const testPagePath = path.join(projectRoot, "src", "pages", "GoalFitTestPage.tsx");
const resultPagePath = path.join(projectRoot, "src", "pages", "GoalFitResultPage.tsx");
const questionBank = JSON.parse(fs.readFileSync(questionsPath, "utf8")) as GoalFitQuestionBank;

function fail(message: string): never {
  throw new Error(`[test-goal-fit-result-page] ${message}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) fail(message);
}

function createCompleteAnswers(selectedQuestions: GoalFitQuestion[]): GoalFitAnswerMap {
  return Object.fromEntries(
    selectedQuestions.map((question) => [question.id, question.options[0]?.id ?? ""])
  );
}

const appSource = fs.readFileSync(appPath, "utf8");
const testPageSource = fs.readFileSync(testPagePath, "utf8");
const resultPageSource = fs.readFileSync(resultPagePath, "utf8");

assert(
  appSource.includes("/result-goal-fit-preview") && appSource.includes("GoalFitResultPage"),
  "App.tsx must route /result-goal-fit-preview to GoalFitResultPage"
);
assert(
  testPageSource.includes("/result-goal-fit-preview?session="),
  "GoalFitTestPage must navigate to result page after completion"
);

const selectedQuestions = selectGoalFitQuestions(questionBank, "SLS");
const answers = createCompleteAnswers(selectedQuestions);
const result = buildGoalFitResult({
  questionBank,
  answers,
  targetCompany: "G",
  targetRole: "SLS"
});
const session: GoalFitSession = {
  id: "goal_fit_test_session",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  targetCompany: "G",
  targetRole: "SLS",
  answers,
  selectedQuestionIds: selectedQuestions.map((question) => question.id),
  result
};

assert(Boolean(session.result), "GoalFitSession must contain result");
assert(Boolean(result.scores), "result must contain scores");
assert(Boolean(result.overallConclusion), "result must contain overallConclusion");
assert(Boolean(result.companyQuadrant), "result must contain companyQuadrant");
assert(Boolean(result.roleQuadrant), "result must contain roleQuadrant");
assert(Array.isArray(result.riskInsights), "result must contain riskInsights");
assert(Boolean(result.headhunterSummary), "result must contain headhunterSummary");
assert(Array.isArray(result.recommendations), "result must contain recommendations");
assert(Array.isArray(result.cards), "result must contain cards");
assert(result.riskInsights.length >= 1, "riskInsights must contain at least 1");
assert(result.riskInsights.length <= 3, "riskInsights must contain at most 3");
assert(result.recommendations.length >= 1, "recommendations must contain at least 1");
assert(result.recommendations.length <= 3, "recommendations must contain at most 3");
assert(result.cards.length >= 6, "cards must contain at least 6");

[
  "你的目标适配结果",
  "你和目标公司的匹配度",
  "你和目标岗位的匹配度",
  "你需要提前看清的风险",
  "猎头季哥怎么看",
  "接下来更适合怎么做",
  "先看总判断",
  "拆开看：公司和岗位",
  "最后看风险和行动",
  "看公司和岗位适配",
  "看风险和下一步",
  "猎头季哥人才重估实验室"
].forEach((text) => {
  assert(resultPageSource.includes(text), `GoalFitResultPage must contain copy: ${text}`);
});
assert(
  resultPageSource.includes("currentResultScreen") &&
    resultPageSource.includes("setCurrentResultScreen"),
  "GoalFitResultPage must use screen state for three-screen reading"
);

const userVisibleSources = [
  testPageSource.replace(/\/test-goal-fit-preview/g, ""),
  resultPageSource.replace(/\/result-goal-fit-preview/g, "").replace(/session/g, "")
];
const forbiddenVisibleTexts = [
  "V1.3",
  "V2",
  "Preview",
  "预览版",
  "开发",
  "debug",
  "sample",
  "你不适合这个职业",
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

for (const source of userVisibleSources) {
  const matchedForbidden = forbiddenVisibleTexts.find((text) => source.includes(text));
  assert(!matchedForbidden, `page contains forbidden visible wording: ${matchedForbidden}`);
}

console.log("Goal Fit result page tests passed.");
