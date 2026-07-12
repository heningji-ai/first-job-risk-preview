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
const appPath = path.join(projectRoot, "src", "App.tsx");
const pagePath = path.join(projectRoot, "src", "pages", "GoalFitTestPage.tsx");
const landingPagePath = path.join(projectRoot, "src", "pages", "GoalFitLandingPage.tsx");
const freeResultPagePath = path.join(projectRoot, "src", "pages", "GoalFitFreeResultPage.tsx");
const sharePagePath = path.join(projectRoot, "src", "pages", "GoalFitSharePage.tsx");
const unlockPagePath = path.join(projectRoot, "src", "pages", "GoalFitUnlockPage.tsx");
const resultPagePath = path.join(projectRoot, "src", "pages", "GoalFitResultPage.tsx");
const orderStorePath = path.join(projectRoot, "src", "lib", "goalFitOrderStore.ts");
const apiConfigPath = path.join(projectRoot, "src", "config", "api.ts");
const serverPackagePath = path.join(projectRoot, "server", "package.json");
const serverConfigPath = path.join(projectRoot, "server", "src", "config.ts");
const serverDbPath = path.join(projectRoot, "server", "src", "db.ts");
const serverWechatPayPath = path.join(projectRoot, "server", "src", "wechatPay.ts");
const serverWechatJsapiPayPath = path.join(projectRoot, "server", "src", "wechatJsapiPay.ts");
const serverWechatOauthPath = path.join(projectRoot, "server", "src", "wechatOAuth.ts");
const serverWechatNotifyPath = path.join(projectRoot, "server", "src", "wechatNotify.ts");
const serverWechatPlatformCertsPath = path.join(projectRoot, "server", "src", "wechatPlatformCerts.ts");
const serverCryptoPath = path.join(projectRoot, "server", "src", "crypto.ts");
const serverIndexPath = path.join(projectRoot, "server", "src", "index.ts");
const serverGitignorePath = path.join(projectRoot, "server", ".gitignore");
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
const appSource = fs.readFileSync(appPath, "utf8");
const landingPageSource = fs.readFileSync(landingPagePath, "utf8");
const freeResultPageSource = fs.readFileSync(freeResultPagePath, "utf8");
const sharePageSource = fs.readFileSync(sharePagePath, "utf8");
const unlockPageSource = fs.readFileSync(unlockPagePath, "utf8");
const resultPageSource = fs.readFileSync(resultPagePath, "utf8");
const orderStoreSource = fs.readFileSync(orderStorePath, "utf8");
const apiConfigSource = fs.readFileSync(apiConfigPath, "utf8");
const serverPackageSource = fs.readFileSync(serverPackagePath, "utf8");
const serverConfigSource = fs.readFileSync(serverConfigPath, "utf8");
const serverDbSource = fs.readFileSync(serverDbPath, "utf8");
const serverWechatPaySource = fs.readFileSync(serverWechatPayPath, "utf8");
const serverWechatJsapiPaySource = fs.readFileSync(serverWechatJsapiPayPath, "utf8");
const serverWechatOauthSource = fs.readFileSync(serverWechatOauthPath, "utf8");
const serverWechatNotifySource = fs.readFileSync(serverWechatNotifyPath, "utf8");
const serverWechatPlatformCertsSource = fs.readFileSync(serverWechatPlatformCertsPath, "utf8");
const serverCryptoSource = fs.readFileSync(serverCryptoPath, "utf8");
const serverIndexSource = fs.readFileSync(serverIndexPath, "utf8");
const serverGitignoreSource = fs.readFileSync(serverGitignorePath, "utf8");
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
  "第一份工作风险预演",
  "别只看岗位名",
  "先看看你进去后会不会适应",
  "3–5分钟｜34题｜先看基础判断",
  "开始风险预演",
  "先看测完能得到什么",
  "测完先给你 4 个求职判断",
  "这个方向值不值得先投",
  "你和目标岗位差在哪里",
  "哪些问题会影响投递反馈",
  "完整报告继续拆公司、岗位和调整方向",
  "基于21年招聘经验，帮应届生提前看清第一份工作的适应风险。"
].forEach((text) => {
  assert(landingPageSource.includes(text), `GoalFitLandingPage must contain copy: ${text}`);
});

[
  "¥19.9",
  "测试免费，完成后可先看免费判断；完整报告 ¥19.9 解锁",
  "大学生第一次求职目标适配测试",
  "这不是性格测试，也不是职业算命。",
  "完整报告会继续拆解",
  "立即购买",
  "免费咨询",
  "企业微信",
  "专为应届生量身定做的职场适应度测试",
  "先看免费判断",
  "你是不是也在想这些问题？",
  "每年预计帮助超100万应届生少走弯路",
  "我到底适合什么样的公司？",
  "我现在能做哪些岗位？",
  "找工作听父母的，还是自己拿主意？",
  "什么公司会让我成长，什么公司会让我煎熬？",
  "选择公司类型和岗位方向，完成 34 题判断"
].forEach((text) => {
  assert(!landingPageSource.includes(text), `GoalFitLandingPage must not contain removed copy: ${text}`);
});

assert(
  !landingPageSource.includes("const worryCards") &&
    landingPageSource.includes("goal-fit-landing-text-link") &&
    landingPageSource.includes("goal-fit-landing-judgement-list"),
  "GoalFitLandingPage must use the mobile-first two-screen landing structure"
);
assert(
  landingPageSource.includes('id="goal-fit-what-you-see"') &&
    landingPageSource.includes('navigateTo("/test-goal-fit-preview")') &&
    landingPageSource.includes("scrollToPreview"),
  "GoalFitLandingPage must keep CTA navigation and preview scroll target"
);
assert(
  appSource.includes("/goal-fit-share-preview") && appSource.includes("GoalFitSharePage"),
  "App.tsx must route /goal-fit-share-preview to GoalFitSharePage"
);
[
  "保存这张求职风险预演海报",
  "分享给同学或朋友，一起提前看看第一份工作的适应风险。",
  "/images/goal-fit-share-poster.png",
  "goal-fit-share-poster-image",
  "保存并分享后，可按 ¥9.9 解锁完整报告。",
  "保存图片并分享",
  "coupon=share_card",
  "复制链接，发给同学也测一下",
  "返回完整报告",
  "返回结果页"
].forEach((text) => {
  assert(sharePageSource.includes(text), `GoalFitSharePage must contain copy: ${text}`);
});
["我已保存或分享，领取 ¥10 优惠券", "让同学也测一次", "领取优惠券，¥9.9 解锁完整报告", "保存分享图，领取优惠"].forEach((text) => {
  assert(!sharePageSource.includes(text), `GoalFitSharePage must not keep confusing share CTA copy: ${text}`);
});
["匹配度", "公司类型：", "岗位类型：", "最大风险", "我的测试结果", "我的匹配度"].forEach(
  (text) => {
    assert(!sharePageSource.includes(text), `GoalFitSharePage must not expose private result copy: ${text}`);
  }
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
  "为什么问这个？",
  "准备开始：正式进入风险预演",
  "你的求职风险预演即将开始",
  "本次预演目标",
  "测完后，你会先看到",
  "这个目标当前值不值得优先尝试",
  "你的综合匹配度意味着什么",
  "最容易影响你求职反馈的问题",
  "后续会继续拆公司、岗位和调整方向",
  "基础判断先帮你看方向",
  "这类公司怎么用人",
  "这类岗位真实要求什么",
  "你接下来该怎么调整",
  "继续，开始风险预演",
  "开始 34 题判断"
].forEach((text) => {
  assert(pageSource.includes(text), `GoalFitTestPage must contain copy: ${text}`);
});

[
  "测完你会看到",
  "这个方向是否适合优先投递",
  "最大风险点是什么",
  "哪些能力需要提前补",
  "简历和面试应该怎么解释"
].forEach((text) => {
  assert(!pageSource.includes(text), `GoalFitTestPage must not contain outdated copy: ${text}`);
});
assert(
  !pageSource.includes("GoalFitHeader") && !pageSource.includes("../components/GoalFitHeader"),
  "GoalFitTestPage must remove the large brand header from the task flow"
);
assert(
  pageSource.includes("/result-goal-fit-free-preview?session="),
  "GoalFitTestPage must navigate to free result page after completion"
);
assert(
  freeResultPageSource.includes("getGoalFitSession") &&
    freeResultPageSource.includes("第一份工作风险预演") &&
    freeResultPageSource.includes("基础判断") &&
    freeResultPageSource.includes("综合匹配度") &&
    freeResultPageSource.includes("这个方向可以先投吗？") &&
    freeResultPageSource.includes("最大风险：") &&
    freeResultPageSource.includes("当前预演：") &&
    freeResultPageSource.includes("主要风险") &&
    freeResultPageSource.includes("行动提醒") &&
    freeResultPageSource.includes("解锁完整报告") &&
    freeResultPageSource.includes("完整报告解锁价 ¥19.9") &&
    freeResultPageSource.includes("保存并分享本次测试海报，可以享受 ¥10 优惠，优惠后 ¥9.9 解锁完整报告。") &&
    freeResultPageSource.includes("保存求职方向卡，也可以发给同学一起测。") &&
    freeResultPageSource.includes("保存图片并分享，¥9.9 解锁") &&
    freeResultPageSource.includes("不分享，直接 ¥19.9 解锁") &&
    freeResultPageSource.includes("/goal-fit-share-preview?session=") &&
    freeResultPageSource.includes("/goal-fit-share-preview?sample=high_fit&mode=coupon") &&
    freeResultPageSource.includes("/images/goal-fit-share-poster.png") &&
    freeResultPageSource.includes("/goal-fit-unlock-preview?session="),
  "GoalFitFreeResultPage must build a diagnosis-first free result and keep unlock/share CTA logic"
);
[
  "你的第一份工作目标判断已生成",
  "我们先给你一个总判断",
  "[\"总判断\", \"适配拆解\", \"建议行动\"]",
  "先看总体判断",
  "保存一张求职方向卡",
  "不展示你的具体分数、公司类型、岗位方向和风险点",
  "生成我的求职方向卡",
  "生成求职方向卡",
  "领取 ¥10 优惠券，¥9.9 解锁完整报告"
].forEach((text) => {
  assert(!freeResultPageSource.includes(text), `GoalFitFreeResultPage must not keep old hero copy: ${text}`);
});
assert(
  freeResultPageSource.includes("getRiskPoints") &&
    freeResultPageSource.includes("getActionReminder") &&
    freeResultPageSource.includes("result.overallConclusion") &&
    freeResultPageSource.includes("result.scores.overallScore"),
  "GoalFitFreeResultPage must derive score, headline, risks and action reminder from result data"
);
assert(
  orderStoreSource.includes("createGoalFitOrderFromApi") &&
    orderStoreSource.includes("/api/orders/create") &&
    orderStoreSource.includes("getGoalFitOrderFromApi") &&
    orderStoreSource.includes("markGoalFitApiOrderPaid") &&
    orderStoreSource.includes("/mock-paid") &&
    orderStoreSource.includes("getGoalFitUnlockStatusFromApi") &&
    orderStoreSource.includes("/api/unlock/status?sessionId="),
  "goalFitOrderStore must expose order and unlock API helpers"
);
assert(
  unlockPageSource.includes("createGoalFitOrderFromApi") &&
    unlockPageSource.includes("QRCode.toDataURL") &&
    unlockPageSource.includes("getGoalFitOrderFromApi") &&
    unlockPageSource.includes("markGoalFitApiOrderPaid") &&
    unlockPageSource.includes("isWechatBrowser") &&
    unlockPageSource.includes("MicroMessenger") &&
    unlockPageSource.includes("wechatOpenidToken") &&
    unlockPageSource.includes('paymentMethod: isWechatInAppBrowser ? "jsapi" : "native"') &&
    unlockPageSource.includes("/api/wechat/oauth/start?returnTo=") &&
    unlockPageSource.includes("WeixinJSBridge.invoke") &&
    unlockPageSource.includes("getBrandWCPayRequest") &&
    unlockPageSource.includes("jsapiPaymentParams") &&
    unlockPageSource.includes('accessMode: context.hasShareCardCoupon ? "share_coupon" : "direct"') &&
    unlockPageSource.includes('couponCode: context.hasShareCardCoupon ? "share_card" : null') &&
    !unlockPageSource.includes("paymentMode: PAYMENT_MODE") &&
    !unlockPageSource.includes("PAYMENT_MODE") &&
    unlockPageSource.includes("order?.wechatCodeUrl ?") &&
    unlockPageSource.includes("isMockOrder") &&
    unlockPageSource.includes("确认解锁完整报告") &&
    unlockPageSource.includes("完整报告原价") &&
    unlockPageSource.includes("已享 ¥10 优惠") &&
    unlockPageSource.includes("本次支付") &&
    unlockPageSource.includes("完整报告解锁价 ¥19.9") &&
    unlockPageSource.includes("想优惠后 ¥9.9？返回保存并分享海报") &&
    unlockPageSource.includes("返回保存并分享海报") &&
    unlockPageSource.includes("应付") &&
    unlockPageSource.includes("formatYuan(displayedPayAmount)") &&
    unlockPageSource.includes("实际支付金额：") &&
    unlockPageSource.includes("微信扫码支付") &&
    unlockPageSource.includes("我已支付，刷新状态") &&
    !unlockPageSource.includes("开发环境"),
  "GoalFitUnlockPage must create backend orders without frontend paymentMode, show QR only when code URL exists, and use neutral mock unlock copy"
);
["模拟支付", "测试支付", "mock pay", "Native Pay", "API v3", "code_url", "notify_url", "mchid", "appid", "serial_no", "开发", "debug"].forEach((text) => {
  assert(!unlockPageSource.includes(text), `GoalFitUnlockPage must not expose forbidden payment wording: ${text}`);
});
assert(
  resultPageSource.includes("getGoalFitUnlockStatusFromApi") &&
    resultPageSource.includes("IS_PRODUCTION") &&
    resultPageSource.includes("正在确认解锁状态") &&
    resultPageSource.includes("LockedReportPage") &&
    resultPageSource.includes("apiUnlocked === true || (!IS_PRODUCTION && reportContext.isUnlocked)"),
  "GoalFitResultPage must check backend unlock status and only keep local compatibility outside production"
);
assert(
  apiConfigSource.includes("VITE_PAYMENT_MODE") &&
    apiConfigSource.includes('viteEnv?.PROD ? "native" : "mock"'),
  "api config must default to native in production and mock in local development"
);
assert(
  serverPackageSource.includes('"engines"') &&
    serverPackageSource.includes('"node": ">=24"') &&
    !serverPackageSource.includes("better-sqlite3") &&
    !serverPackageSource.includes('"sqlite3"'),
  "server package must require Node >=24 and avoid third-party SQLite native dependencies"
);
assert(
  serverConfigSource.includes("WECHAT_PAY_PUBLIC_KEY_ID") &&
    serverConfigSource.includes("WECHAT_PAY_PUBLIC_KEY_PATH") &&
    serverConfigSource.includes("WECHAT_PAY_JSAPI_APP_ID") &&
    serverConfigSource.includes("WECHAT_PAY_JSAPI_APP_SECRET") &&
    serverConfigSource.includes("WECHAT_PAY_JSAPI_OAUTH_CALLBACK_URL") &&
    serverConfigSource.includes("publicKeyId") &&
    serverConfigSource.includes("publicKeyPath") &&
    serverConfigSource.includes("jsapiAppId") &&
    serverConfigSource.includes("jsapiAppSecret") &&
    serverConfigSource.includes("jsapiOauthCallbackUrl"),
  "server config must read WeChat Pay public key and JSAPI OAuth config"
);
assert(
  serverDbSource.includes('from "node:sqlite"') &&
    serverDbSource.includes("wechatTransactionId") &&
    serverDbSource.includes("ALTER TABLE orders ADD COLUMN wechatTransactionId") &&
    serverDbSource.includes("CREATE TABLE IF NOT EXISTS wechat_oauth_states") &&
    serverDbSource.includes("CREATE TABLE IF NOT EXISTS wechat_openid_tokens"),
  "server db must keep node:sqlite and persist WeChat transaction ids plus OAuth state/token tables"
);
assert(
  serverWechatPaySource.includes("createWechatNativeOrder") &&
    serverWechatPaySource.includes("/v3/pay/transactions/native") &&
    serverWechatPaySource.includes('"Accept-Language": "zh-CN"') &&
    serverWechatPaySource.includes("order.payAmountCents") &&
    serverWechatPaySource.includes("saveWechatNativePayment") &&
    serverWechatPaySource.includes("支付订单创建失败") === false,
  "wechatPay must create native orders with backend-calculated amount and no frontend-facing sensitive error"
);
assert(
  serverWechatJsapiPaySource.includes("createWechatJsapiOrder") &&
    serverWechatJsapiPaySource.includes("/v3/pay/transactions/jsapi") &&
    serverWechatJsapiPaySource.includes("serverConfig.wechatPay.jsapiAppId") &&
    serverWechatJsapiPaySource.includes("payer") &&
    serverWechatJsapiPaySource.includes("openid") &&
    serverWechatJsapiPaySource.includes("order.payAmountCents") &&
    serverWechatJsapiPaySource.includes("buildWechatJsapiPaySign") &&
    serverWechatJsapiPaySource.includes("jsapiPaymentParams") === false &&
    serverWechatJsapiPaySource.includes('"Accept-Language": "zh-CN"'),
  "wechatJsapiPay must create JSAPI orders using backend amount and generate signed payment params"
);
assert(
  serverCryptoSource.includes("WECHATPAY2-SHA256-RSA2048") &&
    serverCryptoSource.includes("RSA-SHA256") &&
    serverCryptoSource.includes("aes-256-gcm") &&
    serverCryptoSource.includes("readPrivateKey") &&
    serverCryptoSource.includes("readWechatPayPublicKey") &&
    serverCryptoSource.includes("buildWechatJsapiPaySign") &&
    serverCryptoSource.includes("decryptWechatResource"),
  "crypto helpers must implement WeChat signing, public key reading and AES-GCM resource decryption"
);
assert(
  serverWechatOauthSource.includes("normalizeOauthReturnTo") &&
    serverWechatOauthSource.includes("startsWith(\"/\")") &&
    serverWechatOauthSource.includes("startsWith(\"//\")") &&
    serverWechatOauthSource.includes("createWechatOauthState") &&
    serverWechatOauthSource.includes("snsapi_base") &&
    serverWechatOauthSource.includes("handleWechatOauthCallback") &&
    serverWechatOauthSource.includes("wechatOpenidToken") &&
    serverWechatOauthSource.includes("consumeWechatOpenidToken") &&
    !serverWechatOauthSource.includes("console.log") &&
    !serverWechatOauthSource.includes("console.error"),
  "wechatOAuth must constrain returnTo, store state/token, and avoid logging openid or app secret"
);
assert(
  serverWechatPlatformCertsSource.includes("/v3/certificates") &&
    serverWechatPlatformCertsSource.includes('"Accept-Language": "zh-CN"') &&
    serverWechatPlatformCertsSource.includes("decryptWechatResource<string>") &&
    serverWechatPlatformCertsSource.includes("cachedCertificates") &&
    serverWechatPlatformCertsSource.includes("getWechatPlatformCertificate"),
  "platform certificate module must fetch, decrypt, cache and select certificates"
);
assert(
  serverWechatNotifySource.includes("handleWechatNotify") &&
    serverWechatNotifySource.includes("verifyWechatSignature") &&
    serverWechatNotifySource.includes('startsWith("PUB_KEY_ID_")') &&
    serverWechatNotifySource.includes("readWechatPayPublicKey") &&
    serverWechatNotifySource.includes("WeChat Pay public key is not configured.") &&
    serverWechatNotifySource.includes("WeChat Pay public key id mismatch.") &&
    serverWechatNotifySource.includes("getWechatPlatformCertificate") &&
    serverWechatNotifySource.includes("decryptWechatResource<WechatTransaction>") &&
    serverWechatNotifySource.includes('transaction.trade_state !== "SUCCESS"') &&
    serverWechatNotifySource.includes("paidAmount !== order.payAmountCents") &&
    serverWechatNotifySource.includes("markOrderPaidByOutTradeNo") &&
    serverWechatNotifySource.includes('order.status === "paid"'),
  "wechat notify handler must support public-key and platform-certificate signature verification, decrypt resource, check amount and update paid idempotently"
);
assert(
  serverIndexSource.indexOf('/api/wechat/notify", express.raw') < serverIndexSource.indexOf("app.use(express.json())") &&
    serverIndexSource.includes("handleWechatNotify") &&
    serverIndexSource.includes("/api/wechat/oauth/start") &&
    serverIndexSource.includes("/api/wechat/oauth/callback") &&
    serverIndexSource.includes("normalizeOauthReturnTo") &&
    serverIndexSource.includes("createWechatJsapiOrder") &&
    serverIndexSource.includes("paymentMethod === \"jsapi\"") &&
    serverIndexSource.includes("wechatOpenidToken") &&
    serverIndexSource.includes("jsapiPaymentParams") &&
    serverIndexSource.includes("const serverPaymentMode = serverConfig.paymentMode") &&
    !serverIndexSource.includes("req.body as Record<string, unknown>).paymentMode") &&
    serverIndexSource.includes("mock payment is not available in production"),
  "server index must register raw notify route before express.json, support OAuth/JSAPI, ignore request paymentMode, and keep production mock blocked"
);
[".env", "*.db", "*.sqlite", "certs/", "apiclient_key.pem", "apiclient_cert.pem"].forEach((text) => {
  assert(serverGitignoreSource.includes(text), `server .gitignore must contain ${text}`);
});
assert(
  !serverPackageSource.includes("WECHAT_PAY_API_V3_KEY") &&
    !serverWechatPaySource.includes("WECHAT_PAY_API_V3_KEY=") &&
    !serverCryptoSource.includes("WECHAT_PAY_API_V3_KEY="),
  "server code must not contain real WeChat Pay secret values"
);
assert(
  pageSource.includes("/goal-fit-roadmap.png") &&
    pageSource.includes("goal-fit-roadmap-figure"),
  "GoalFitTestPage must render the roadmap image in the first target selection screen"
);
assert(
  pageSource.includes("goal-fit-task-header") &&
    pageSource.includes("goal-fit-task-progress-copy") &&
    pageSource.includes("goal-fit-task-target") &&
    pageSource.includes("第 {currentIndex + 1} / {selectedQuestions.length} 题｜已完成 {progressPercent}%"),
  "GoalFitTestPage must show the progress-first task header in formal questions"
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
  stylesSource.includes(".goal-fit-task-header") &&
    stylesSource.includes(".goal-fit-task-progress-copy") &&
    stylesSource.includes(".goal-fit-task-target") &&
    stylesSource.includes("white-space: nowrap;"),
  "global.css must define a compact progress-first task header"
);
assert(
  pageSource.includes("currentIndex > 0") &&
    pageSource.includes("goal-fit-question-reason") &&
    !pageSource.includes("<p className=\"goal-fit-question-hint\""),
  "GoalFitTestPage must hide previous on the first question and collapse question explanations by default"
);
assert(
  stylesSource.includes(".goal-fit-question-actions-single") &&
    stylesSource.includes("position: fixed;") &&
    stylesSource.includes("env(safe-area-inset-bottom)") &&
    stylesSource.includes(".goal-fit-question .goal-fit-option-button"),
  "global.css must support compact mobile question options and a safe-area bottom action bar"
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
  "企业微信",
  "给你最真实的招聘逻辑，帮助你做最适合的工作选择",
  "先看免费判断",
  "¥9.9",
  "优惠券"
];
const normalizedPageSource = pageSource
  .replace(/\/test-goal-fit-preview/g, "")
  .replace(/\/result-goal-fit-free-preview\?session=/g, "")
  .replace(/\/result-goal-fit-preview\?session=/g, "")
  .replace(/encodeURIComponent\(session\.id\)/g, "")
  .replace(/session/g, "");
const matchedForbidden = forbiddenVisibleTexts.find((text) => normalizedPageSource.includes(text));

assert(!matchedForbidden, `GoalFitTestPage contains forbidden visible wording: ${matchedForbidden}`);

console.log("Goal Fit flow tests passed.");
