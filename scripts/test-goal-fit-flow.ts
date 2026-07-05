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
const headerPath = path.join(projectRoot, "src", "components", "GoalFitHeader.tsx");
const stylesPath = path.join(projectRoot, "src", "styles", "global.css");
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
const headerSource = fs.readFileSync(headerPath, "utf8");
const stylesSource = fs.readFileSync(stylesPath, "utf8");

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

[
  "第 1 步 / 2 步：先定环境",
  "第 2 步 / 2 步：再定岗位",
  "先建立你的风险预演坐标",
  "再确定你最想试的工作方向",
  "你第一份工作，想先进入哪种环境？",
  "你会优先投哪类公司？",
  "先选一个你最想尝试的环境",
  "第一份工作更怕环境错配。",
  "为什么先看环境？",
  "已记录",
  "继续，看看你更适合什么岗位",
  "你第一份工作，更想先判断哪个岗位方向？",
  "先选一个你最想试、最常投，或者最纠结的岗位方向。",
  "当前预演",
  "当前预演目标",
  "当前阶段",
  "为什么问这个？",
  "准备开始：正式进入风险预演",
  "你的求职风险预演即将开始",
  "本次预演目标",
  "测完你会看到",
  "继续，开始风险预演",
  "开始 34 题判断"
].forEach((text) => {
  assert(pageSource.includes(text), `GoalFitTestPage must contain copy: ${text}`);
});
assert(
  pageSource.includes("GoalFitHeader") && pageSource.includes("../components/GoalFitHeader"),
  "GoalFitTestPage must reuse GoalFitHeader"
);
assert(
  pageSource.includes("/goal-fit-roadmap.png") &&
    pageSource.includes("goal-fit-roadmap-figure"),
  "GoalFitTestPage must render the roadmap image in the first target selection screen"
);
assert(
  pageSource.includes("goal-fit-module-title"),
  "GoalFitTestPage must use a prominent module title for formal question sections"
);
assert(
  pageSource.includes('step === "target"') && pageSource.includes('step === "targetRole"'),
  "GoalFitTestPage must split target selection into company and role steps"
);
assert(
  stylesSource.includes(".goal-fit-roadmap-figure") &&
    stylesSource.includes("object-fit: cover;") &&
    stylesSource.includes("object-position: 50% 52%;"),
  "global.css must crop the roadmap image inside a soft Goal Fit visual card"
);
assert(
  stylesSource.includes(".goal-fit-module-title") &&
    stylesSource.includes("font-size: clamp(21px, 2.4vw, 29px);") &&
    stylesSource.includes("text-align: center;"),
  "global.css must make the formal question module title larger and visually centered"
);
assert(
  stylesSource.includes(".goal-fit-question-layout") &&
    stylesSource.includes("align-items: stretch;") &&
    stylesSource.includes(".goal-fit-question-layout > .goal-fit-side-card") &&
    stylesSource.includes("flex-direction: column;"),
  "global.css must keep formal question cards naturally aligned on desktop"
);

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
const normalizedPageSource = pageSource
  .replace(/\/test-goal-fit-preview/g, "")
  .replace(/\/result-goal-fit-preview\?session=/g, "")
  .replace(/encodeURIComponent\(session\.id\)/g, "")
  .replace(/session/g, "");
const matchedForbidden = forbiddenVisibleTexts.find((text) => normalizedPageSource.includes(text));

assert(!matchedForbidden, `GoalFitTestPage contains forbidden visible wording: ${matchedForbidden}`);

console.log("Goal Fit flow tests passed.");
