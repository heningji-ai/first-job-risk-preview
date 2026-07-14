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
const freeResultPagePath = path.join(projectRoot, "src", "pages", "GoalFitFreeResultPage.tsx");
const resultPagePath = path.join(projectRoot, "src", "pages", "GoalFitResultPage.tsx");
const sharePagePath = path.join(projectRoot, "src", "pages", "GoalFitSharePage.tsx");
const unlockPagePath = path.join(projectRoot, "src", "pages", "GoalFitUnlockPage.tsx");
const headerPath = path.join(projectRoot, "src", "components", "GoalFitHeader.tsx");
const orderStorePath = path.join(projectRoot, "src", "lib", "goalFitOrderStore.ts");
const unlockStorePath = path.join(projectRoot, "src", "lib", "goalFitUnlockStore.ts");
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
const freeResultPageSource = fs.readFileSync(freeResultPagePath, "utf8");
const resultPageSource = fs.readFileSync(resultPagePath, "utf8");
const sharePageSource = fs.readFileSync(sharePagePath, "utf8");
const unlockPageSource = fs.readFileSync(unlockPagePath, "utf8");
const headerSource = fs.readFileSync(headerPath, "utf8");
const orderStoreSource = fs.readFileSync(orderStorePath, "utf8");
const unlockStoreSource = fs.readFileSync(unlockStorePath, "utf8");
const stylesSource = fs.readFileSync(stylesPath, "utf8");

assert(
  appSource.includes("/result-goal-fit-preview") && appSource.includes("GoalFitResultPage"),
  "App.tsx must route /result-goal-fit-preview to GoalFitResultPage"
);
assert(
  appSource.includes("/result-goal-fit-free-preview") &&
    appSource.includes("GoalFitFreeResultPage"),
  "App.tsx must route /result-goal-fit-free-preview to GoalFitFreeResultPage"
);
assert(
  appSource.includes("/goal-fit-unlock-preview") && appSource.includes("GoalFitUnlockPage"),
  "App.tsx must route /goal-fit-unlock-preview to GoalFitUnlockPage"
);
assert(
  appSource.includes("/goal-fit-share-preview") && appSource.includes("GoalFitSharePage"),
  "App.tsx must route /goal-fit-share-preview to GoalFitSharePage"
);
assert(
  testPageSource.includes("/result-goal-fit-free-preview?session="),
  "GoalFitTestPage must navigate to free result page after completion"
);
assert(
  unlockStoreSource.includes("goalFitReportUnlocked:") &&
    unlockStoreSource.includes("markGoalFitReportUnlocked") &&
    unlockStoreSource.includes("isGoalFitReportUnlocked"),
  "goalFitUnlockStore must keep local unlock state"
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
  !testPageSource.includes("GoalFitHeader") && resultPageSource.includes("GoalFitHeader"),
  "GoalFit result pages must reuse GoalFitHeader while the task flow keeps the large header removed"
);
assert(
  freeResultPageSource.includes("GoalFitHeader"),
  "GoalFitFreeResultPage must reuse GoalFitHeader"
);

[
  "goalFitOrder:",
  "createGoalFitOrder",
  "getGoalFitOrder",
  "markGoalFitOrderPaid",
  "markGoalFitOrderFailed",
  "clearGoalFitOrder",
  "goal_fit_full_report",
  "完整目标适配报告",
  "amount: 1990",
  "originalAmountCents",
  "discountAmountCents",
  "payAmountCents",
  "couponCode",
  "couponCode === \"share_card\"",
  "payAmountCents = originalAmountCents - discountAmountCents",
  'status: "pending"'
].forEach((text) => {
  assert(orderStoreSource.includes(text), `goalFitOrderStore must contain: ${text}`);
});

[
  "完整报告 ¥19.9",
  "确认标准价后即可付款查看完整报告。",
  "已获得 ¥10 邀请优惠",
  "优惠 -¥10",
  "本次支付",
  "请使用微信打开当前页面完成支付。",
  "复制当前页面链接",
  "¥19.9",
  "支付准备中",
  "确认解锁完整报告",
  "返回免费判断",
  "没有找到你的测试结果",
  "请先完成测试，再解锁完整报告。",
  "完整报告已解锁",
  "查看完整报告",
  "你已经解锁过这份报告，可以直接继续查看。"
].forEach((text) => {
  assert(unlockPageSource.includes(text), `GoalFitUnlockPage must contain copy: ${text}`);
});
assert(
  unlockPageSource.includes("getGoalFitDiscountStatus") &&
    unlockPageSource.includes("getGoalFitReferralContext") &&
    unlockPageSource.includes("markGoalFitReportUnlocked") &&
    unlockPageSource.includes("isGoalFitReportUnlocked") &&
    !unlockPageSource.includes('params.get("coupon") === "share_card"') &&
    unlockPageSource.includes("/result-goal-fit-preview?session=") &&
    unlockPageSource.includes("/result-goal-fit-free-preview?session=") &&
    unlockPageSource.includes("/result-goal-fit-free-preview?sample=high_fit"),
  "GoalFitUnlockPage must bridge order, unlock store, free page and full report routes"
);
["模拟支付", "测试支付", "立即购买", "免费咨询", "企业微信", "猎头季哥建议："].forEach((text) => {
  assert(!unlockPageSource.includes(text), `GoalFitUnlockPage must not contain forbidden copy: ${text}`);
});

[
  "第一份工作预演",
  "应届生求职场景预演",
  "基础判断",
  "你的当前判断：",
  "这个方向可以继续投递，但需要重点注意",
  "综合匹配度",
  "最大风险：",
  "你当前最容易卡在：",
  "完整报告将继续拆解：",
  "公司环境",
  "岗位差距",
  "投递风险",
  "调整方向",
  "完整报告 ¥19.9",
  "¥19.9 查看完整报告",
  "复制邀请链接，立减 ¥10",
  "分享测试，报告立减 ¥10",
  "专属邀请链接已复制",
  "请分享给微信好友或朋友圈",
  "继续，查看我的优惠",
  "goal-fit-free-sticky-actions",
  "免费页先给你总判断",
  "/goal-fit-unlock-preview?session="
].forEach((text) => {
  assert(freeResultPageSource.includes(text), `GoalFitFreeResultPage must contain copy: ${text}`);
});
assert(
  !freeResultPageSource.includes("markGoalFitReportUnlocked") &&
    !freeResultPageSource.includes("/result-goal-fit-preview?session="),
  "GoalFitFreeResultPage must not directly unlock or jump to full report"
);

[
  "第一份工作预演报告",
  "应届生求职场景预演｜基于你的公司类型与岗位方向生成",
  "你选择的是 ${result.targetCompanyLabel} × ${result.targetRoleLabel}",
  "招聘端判断视角",
  "goal-fit-result-personal-lead",
  "你当前最需要盯住的是",
  "对你来说，你选择的",
  "goal-fit-report-conclusion",
  "fitBreakdownLead",
  "actionSectionLead",
  "一、你的整体情况",
  "当前匹配度",
  "二、工作适配拆解",
  "目标公司的环境和风险",
  "目标岗位的真实要求",
  "这类公司的用人风格",
  "你目前更像哪种状态",
  "如果你进入这类公司，可能会是什么体感",
  "这类公司的入门门槛，和你现在的准备",
  "这类岗位更希望的做事风格",
  "这个岗位真正考验什么能力",
  "你目前和岗位要求之间的差距",
  "如果你真的做这个岗位，可能会有什么感受",
  "三、建议求职行动",
  "原因拆解",
  "关键风险",
  "建议行动 01",
  "建议行动 02",
  "猎头季哥人才重估实验室",
  "/images/wechat-qrcode-talent-revaluation-lab.png",
  "猎头季哥人才重估实验室公众号二维码",
  "你最需要优先处理的问题",
  "你接下来要补什么",
  "性格和做事风格差距，不等于你不适合工作",
  "先找真实岗位描述",
  "学长学姐经历",
  "面试问题",
  "不要只根据岗位名称判断自己适不适合",
  "不要因为追求完美",
  "内心真正想走的路",
  "材料和证据还不够集中",
  "岗位证据还不够清晰",
  "风格适应",
  "求职材料",
  "面试表达",
  "如果差距来自性格或做事风格",
  "继续获得求职方向帮助",
  "599元人工人才重估服务"
].forEach((text) => {
  assert(resultPageSource.includes(text), `GoalFitResultPage must contain copy: ${text}`);
});
["相关匹配度", "准备度：", "适应度：", "你现在最该补的不是兴趣，而是证据", "最后看风险行动", "风险行动建议", "这里不是评价你优秀不优秀", "当前报告只看你选择的目标组合和当前准备状态之间的匹配度，不是能力评价。", "接下来，我们看具体公司类型和岗位类型与你之间的差距。", "免费咨询", "企业微信", "保证入职", "立即购买", "猎头季哥建议：", "保存一张求职方向卡", "生成我的求职方向卡", "/goal-fit-share-preview?session=", "/goal-fit-share-preview?sample=high_fit", "你和目标公司类型之间的差距", "你和目标岗位类型之间的差距"].forEach((text) => {
  assert(!resultPageSource.includes(text), `GoalFitResultPage must not contain deprecated score or role evidence copy: ${text}`);
});
assert(!resultPageSource.includes("<h3>简历怎么改</h3>"), "GoalFitResultPage must not render resume advice as an independent title");
assert(!resultPageSource.includes("<h3>面试怎么解释</h3>"), "GoalFitResultPage must not render interview advice as an independent title");
assert(
  resultPageSource.includes("isGoalFitReportUnlocked") &&
    resultPageSource.includes("请先解锁完整目标适配报告") &&
    resultPageSource.includes("/goal-fit-unlock-preview?session=") &&
    resultPageSource.includes("解锁完整目标适配报告") &&
    resultPageSource.includes("返回查看免费判断"),
  "GoalFitResultPage must block locked session reports and offer unlock or free result actions"
);
assert(
  resultPageSource.includes('sample === "high_fit"') &&
    resultPageSource.includes("createSampleResult"),
  "GoalFitResultPage must allow sample report for validation"
);
assert(
  stylesSource.includes(".goal-fit-result-advice-report") &&
    stylesSource.includes("max-width: 920px") &&
    !stylesSource.includes(".goal-fit-result-advice-report {\n  display: grid;\n  grid-template-columns: repeat(2"),
  "GoalFit result advice report must use a single-column full-width card flow"
);
assert(
  resultPageSource.includes("goal-fit-result-narrative-card") &&
    stylesSource.includes(".goal-fit-result-narrative-card") &&
    stylesSource.includes(".goal-fit-free-unlock-card"),
  "GoalFit result styles must include free page and narrative report classes"
);
assert(
  !resultPageSource.includes("猎头季哥建议："),
  "GoalFitResultPage must not use old advice title"
);
assert(
  !resultPageSource.includes("goal-fit-result-breakdown-summary") &&
    !resultPageSource.includes("goal-fit-result-share-entry"),
  "GoalFitResultPage must remove old section jump summary and share-card entry"
);
assert(
  !resultPageSource.includes("buildSharePagePath") &&
    !resultPageSource.includes('params.get("section") === "action"'),
  "GoalFitResultPage must not expose the old share-card action screen"
);
["优惠券", "领取优惠", "¥9.9 解锁"].forEach((text) => {
  assert(!resultPageSource.includes(text), `GoalFitResultPage action share entry must not contain coupon copy: ${text}`);
});

[
  "正在打开邀请优惠",
  "邀请优惠已经合并到免费结果页",
  "前往领取优惠",
  "invite=1",
  "/result-goal-fit-free-preview?session=",
  "/result-goal-fit-free-preview?sample=high_fit",
  "/goal-fit-preview"
].forEach((text) => {
  assert(sharePageSource.includes(text), `GoalFitSharePage must contain: ${text}`);
});
[
  "匹配度",
  "当前匹配度",
  "公司类型：",
  "岗位类型：",
  "最大风险",
  "我的测试结果",
  "我的匹配度",
  "必须分享到朋友圈",
  "邀请好友解锁",
  "免费解锁完整报告",
  "返现",
  "裂变",
  "仅限移动端",
  "PC 端不可用"
].forEach(
  (text) => {
    assert(!sharePageSource.includes(text), `GoalFitSharePage must not expose private result copy: ${text}`);
  }
);
assert(
  stylesSource.includes(".goal-fit-invite-overlay") &&
    stylesSource.includes(".goal-fit-invite-panel") &&
    stylesSource.includes(".goal-fit-invite-actions"),
  "global.css must include invite coupon panel styles"
);

const userVisibleSources = [
  testPageSource
    .replace(/\/test-goal-fit-preview/g, "")
    .replace(/\/result-goal-fit-free-preview\?session=/g, "")
    .replace(/\/result-goal-fit-preview\?session=/g, "")
    .replace(/session/g, ""),
  freeResultPageSource
    .replace(/\/goal-fit-unlock-preview\?session=/g, "")
    .replace(/\/goal-fit-unlock-preview\?sample=high_fit/g, "")
    .replace(/\/goal-fit-share-preview\?session=/g, "")
    .replace(/\/goal-fit-share-preview\?sample=high_fit/g, "")
    .replace(/\/result-goal-fit-free-preview/g, "")
    .replace(/URLSearchParams\(window\.location\.search\)/g, "")
    .replace(/params\.get\("session"\)/g, "")
    .replace(/params\.get\("sample"\)/g, "")
    .replace(/sample === "high_fit"/g, "")
    .replace(/sessionId/g, "")
    .replace(/session/g, "")
    .replace(/sample/g, "")
    .replace(/mode/g, "")
    .replace(/coupon/g, ""),
  resultPageSource
    .replace(/\/result-goal-fit-preview/g, "")
    .replace(/\/result-goal-fit-free-preview\?session=/g, "")
    .replace(/\/goal-fit-unlock-preview\?session=/g, "")
    .replace(/\/test-goal-fit-preview/g, "")
    .replace(/URLSearchParams\(window\.location\.search\)/g, "")
    .replace(/params\.get\("session"\)/g, "")
    .replace(/params\.get\("sample"\)/g, "")
    .replace(/sample === "high_fit"/g, "")
    .replace(/session/g, "")
    .replace(/sample/g, "")
    .replace(/reportId/g, ""),
  unlockPageSource
    .replace(/\/goal-fit-unlock-preview/g, "")
    .replace(/\/result-goal-fit-preview\?session=/g, "")
    .replace(/\/result-goal-fit-preview\?sample=high_fit/g, "")
    .replace(/\/result-goal-fit-free-preview\?session=/g, "")
    .replace(/\/result-goal-fit-free-preview\?sample=high_fit/g, "")
    .replace(/\/test-goal-fit-preview/g, "")
    .replace(/URLSearchParams\(window\.location\.search\)/g, "")
    .replace(/params\.get\("session"\)/g, "")
    .replace(/params\.get\("sample"\)/g, "")
    .replace(/params\.get\("coupon"\)/g, "")
    .replace(/sample === "high_fit"/g, "")
    .replace(/coupon === "share_card"/g, "")
    .replace(/hasShareCardCoupon/g, "")
    .replace(/session/g, "")
    .replace(/sample/g, "")
    .replace(/coupon/g, ""),
  sharePageSource
    .replace(/\/goal-fit-share-preview/g, "")
    .replace(/\/result-goal-fit-preview\?session=/g, "")
    .replace(/\/result-goal-fit-preview\?sample=high_fit/g, "")
    .replace(/\/goal-fit-unlock-preview\?session=/g, "")
    .replace(/\/goal-fit-unlock-preview\?sample=high_fit/g, "")
    .replace(/\/result-goal-fit-free-preview\?session=/g, "")
    .replace(/\/result-goal-fit-free-preview\?sample=high_fit/g, "")
    .replace(/\/goal-fit-preview/g, "")
    .replace(/URLSearchParams\(window\.location\.search\)/g, "")
    .replace(/params\.get\("session"\)/g, "")
    .replace(/params\.get\("sample"\)/g, "")
    .replace(/params\.get\("mode"\)/g, "")
    .replace(/sample === "high_fit"/g, "")
    .replace(/mode === "coupon"/g, "")
    .replace(/isCouponMode/g, "")
    .replace(/couponUnlockPath/g, "")
    .replace(/sessionId/g, "")
    .replace(/session/g, "")
    .replace(/sample/g, "")
    .replace(/mode/g, "")
    .replace(/coupon/g, "")
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
  "模拟支付",
  "测试支付",
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
  "企业微信",
  "猎头季哥建议："
];

for (const source of userVisibleSources) {
  const matchedForbidden = forbiddenVisibleTexts.find((text) => source.includes(text));
  assert(!matchedForbidden, `page contains forbidden visible wording: ${matchedForbidden}`);
}

console.log("Goal Fit result page tests passed.");
