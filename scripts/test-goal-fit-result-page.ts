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
const headerPath = path.join(projectRoot, "src", "components", "GoalFitHeader.tsx");
const stylesPath = path.join(projectRoot, "src", "styles", "global.css");
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
const headerSource = fs.readFileSync(headerPath, "utf8");
const stylesSource = fs.readFileSync(stylesPath, "utf8");

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
  "猎头季哥",
  "21年招聘经验",
  "给你最真实的招聘逻辑",
  "帮助你做最适合的工作选择",
  "招聘端判断",
].forEach((text) => {
  assert(headerSource.includes(text), `GoalFitHeader must contain copy: ${text}`);
});
assert(
  headerSource.includes("goal-fit-header-inner"),
  "GoalFitHeader must contain goal-fit-header-inner"
);
assert(
  headerSource.includes("goal-fit-header-brand-line") &&
    headerSource.includes("goal-fit-header-brand-name") &&
    headerSource.includes("goal-fit-header-brand-meta"),
  "GoalFitHeader must render a single-line brand copy group"
);
assert(
  !headerSource.includes("goal-fit-header-logo") && !headerSource.includes("<i"),
  "GoalFitHeader must not keep a logo or icon placeholder"
);
assert(
  stylesSource.includes(".goal-fit-header-inner") &&
    stylesSource.includes("display: flex;") &&
    stylesSource.includes("justify-content: space-between;"),
  "global.css must define merged left-brand Goal Fit header layout"
);
assert(
  stylesSource.includes("padding-left: 1em;") &&
    stylesSource.includes(".goal-fit-header-brand-line") &&
    stylesSource.includes("flex-wrap: nowrap;"),
  "global.css must keep desktop header brand copy on one line with a subtle right offset"
);
assert(
  stylesSource.includes(".goal-fit-target-layout > .goal-fit-intro-panel") &&
    stylesSource.includes(".goal-fit-target-layout > .goal-fit-choice-panel") &&
    stylesSource.includes("height: 100%;") &&
    stylesSource.includes("flex-direction: column;"),
  "global.css must keep target selection panels equal height on desktop"
);
assert(
  testPageSource.includes("GoalFitHeader") && resultPageSource.includes("GoalFitHeader"),
  "GoalFit pages must reuse GoalFitHeader"
);

[
  "目标适配报告",
  "根据你的测试结果，你选择的公司类型、岗位类型与你当前状态的适配程度如下。",
  "总判断",
  "适配拆解",
  "风险行动",
  "先看总判断",
  "当前匹配度是",
  "这里不是评价你优秀不优秀",
  "针对你的情况，我们建议：",
  "接下来，我们看具体公司类型和岗位类型与你之间的差距",
  "你和目标公司类型的匹配度",
  "你的性格和该类型公司的匹配度",
  "你现在进入该类型公司的准备情况",
  "你入职后的适应度",
  "你的做事风格和该类型公司的匹配度",
  "你和目标岗位类型的匹配度",
  "你的性格和该类型岗位的匹配度",
  "你现在对该岗位的胜任准备度",
  "你面对该岗位典型场景的适应度",
  "你的做事风格和岗位要求的匹配度",
  "看具体差距",
  "最后看风险行动",
  "先看总判断",
  "猎头季哥人才重估实验室",
  "第一份工作怎么选",
  "哪些岗位不能盲投"
].forEach((text) => {
  assert(resultPageSource.includes(text), `GoalFitResultPage must contain copy: ${text}`);
});
assert(
  !resultPageSource.includes("猎头季哥建议："),
  "GoalFitResultPage must not use old advice title"
);
assert(
  resultPageSource.includes("currentResultScreen") &&
    resultPageSource.includes("setCurrentResultScreen"),
  "GoalFitResultPage must use screen state for three-screen reading"
);

const userVisibleSources = [
  testPageSource
    .replace(/\/test-goal-fit-preview/g, "")
    .replace(/\/result-goal-fit-preview\?session=/g, "")
    .replace(/session/g, ""),
  resultPageSource
    .replace(/\/result-goal-fit-preview/g, "")
    .replace(/\/test-goal-fit-preview/g, "")
    .replace(/URLSearchParams\(window\.location\.search\)/g, "")
    .replace(/params\.get\("session"\)/g, "")
    .replace(/session/g, "")
    .replace(/reportId/g, "")
];
const forbiddenVisibleTexts = [
  "V1.3",
  "V2",
  "Preview",
  "预览版",
  "开发",
  "debug",
  "sample",
  "session",
  "测试版",
  "A 档",
  "B 档",
  "C 档",
  "D 档",
  "档位",
  "评级",
  "等级",
  "诊断分数",
  "能力分数",
  "职业匹配分",
  "性格匹配度",
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
