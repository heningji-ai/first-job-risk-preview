import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type JsonObject = Record<string, any>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const audienceType = process.env.AUDIENCE_TYPE ?? "student";
const configDir = path.join(projectRoot, "src", "config", "audiences", audienceType);

const BASE_FIELDS = new Set([
  "current_status",
  "education",
  "gender",
  "postgraduate_exam",
  "company_type",
  "work_type",
  "choice_reason",
  "main_concern",
  "mbti_known",
  "mbti_type",
  "audience_type"
]);

const primaryRiskTypes = new Set(["answer", "dimension", "finalRisk"]);
const requiredFiles = [
  "questions.json",
  "scoring.json",
  "risk_cards.json",
  "result_copy.json",
  "viral_copy.json",
  "animation_map.json",
  "service_cards.json",
  "labels.json",
  "test_cases.json"
];

function readJson(fileName: string): JsonObject {
  const filePath = path.join(configDir, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value : [];
}

function hasDirectRPrefix(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasDirectRPrefix);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, nested]) =>
      key.startsWith("direct_R") || hasDirectRPrefix(nested)
    );
  }

  return typeof value === "string" && value.startsWith("direct_R");
}

function findBadPlaceholders(value: unknown, trail = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findBadPlaceholders(item, `${trail}[${index}]`));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nested]) =>
      findBadPlaceholders(nested, `${trail}.${key}`)
    );
  }

  if (typeof value === "string" && value.includes("????")) {
    return [trail];
  }

  return [];
}

function fail(message: string): void {
  console.error(`[validate-config] ERROR: ${message}`);
  hasError = true;
}

function warn(message: string): void {
  console.warn(`[validate-config] WARNING: ${message}`);
}

console.log(`[validate-config] audience_type=${audienceType}`);

if (!fs.existsSync(configDir)) {
  console.error(`[validate-config] ERROR: 配置目录不存在: ${configDir}`);
  process.exit(1);
}

let hasError = false;
const configs: Record<string, JsonObject> = {};

for (const fileName of requiredFiles) {
  const filePath = path.join(configDir, fileName);

  if (!fs.existsSync(filePath)) {
    fail(`缺少配置文件 ${fileName}`);
    continue;
  }

  try {
    configs[fileName] = readJson(fileName);
    const marker = "_todo" in configs[fileName];
    console.log(`[validate-config] OK: ${fileName}${marker ? " (TODO marked)" : ""}`);
  } catch (error) {
    fail(`${fileName} 不是合法 JSON`);
    console.error(error);
  }
}

const questions = asArray(configs["questions.json"]?.questions ?? configs["questions.json"]);
const scoring = configs["scoring.json"] ?? {};
const riskCards = asArray(configs["risk_cards.json"]?.riskCards ?? configs["risk_cards.json"]);
const viralCopy = configs["viral_copy.json"] ?? {};
const testCases = asArray(configs["test_cases.json"]?.testCases ?? configs["test_cases.json"]);

const questionIds = new Set<string>();
const flagKeys = new Set<string>();
const dimensionKeys = new Set<string>(asArray(scoring.dimensions).map(String));
const finalRiskKeys = new Set<string>(asArray(scoring.finalRisks).map(String));

for (const question of questions) {
  if (typeof question.id !== "string" || question.id.length === 0) {
    fail("存在缺少 id 的 question");
    continue;
  }

  if (questionIds.has(question.id)) {
    fail(`question id 重复: ${question.id}`);
  }
  questionIds.add(question.id);

  const optionIds = new Set<string>();
  for (const option of asArray(question.options)) {
    if (typeof option.id !== "string") {
      fail(`question ${question.id} 存在缺少 id 的 option`);
      continue;
    }
    if (optionIds.has(option.id)) {
      fail(`question ${question.id} 内 option id 重复: ${option.id}`);
    }
    optionIds.add(option.id);

    for (const dimensionKey of Object.keys(option.scores?.dimensions ?? {})) {
      if (!dimensionKeys.has(dimensionKey)) {
        fail(`question ${question.id} 引用了不存在的 dimension: ${dimensionKey}`);
      }
    }

    for (const riskKey of Object.keys(option.scores?.directR ?? {})) {
      if (!finalRiskKeys.has(riskKey)) {
        fail(`question ${question.id} 引用了不存在的 directR/finalRisk: ${riskKey}`);
      }
    }

    for (const flagKey of Object.keys(option.flags ?? {})) {
      flagKeys.add(flagKey);
    }
  }
}

for (const question of questions) {
  for (const rule of asArray(question.showWhen)) {
    if (typeof rule.field === "string" && !questionIds.has(rule.field) && !BASE_FIELDS.has(rule.field)) {
      fail(`question ${question.id} 的 showWhen.field 不合法: ${rule.field}`);
    }
  }
}

for (const [fileName, config] of Object.entries(configs)) {
  if (hasDirectRPrefix(config)) {
    fail(`${fileName} 中出现 direct_R* 命名`);
  }

  for (const badPath of findBadPlaceholders(config)) {
    fail(`${fileName} 中存在 ???? 乱码: ${badPath}`);
  }
}

const mbtiKnownQuestion = questions.find((question) => question.id === "mbti_known");
if (!mbtiKnownQuestion) {
  fail("questions.json 缺少 mbti_known / A9");
} else {
  const optionIds = new Set(asArray(mbtiKnownQuestion.options).map((option) => option.id));
  if (!optionIds.has("known") || !optionIds.has("unknown")) {
    fail("mbti_known 必须包含 known 和 unknown 两个选项");
  }
}

const hasMbtiType = questions.some((question) => question.id === "mbti_type" || question.sourceCode === "B1");
if (!hasMbtiType) {
  warn("B1 / mbti_type 尚未配置，当前 mbti_known=known 需要后续承接");
}

if (!viralCopy.defaultViralCopy?.targetText || !viralCopy.defaultViralCopy?.copyText) {
  fail("viral_copy.json 缺少必填 defaultViralCopy.targetText/copyText");
}

for (const card of riskCards) {
  if (typeof card.id !== "string") {
    fail("存在缺少 id 的 risk card");
    continue;
  }

  const conditions = asArray(card.conditions);
  if (!conditions.some((condition) => primaryRiskTypes.has(condition.type))) {
    fail(`risk card ${card.id} 没有 answer/dimension/finalRisk 主风险信号，不能只靠 flag/field 触发`);
  }

  for (const riskKey of asArray(card.relatedRisks).map(String)) {
    if (!finalRiskKeys.has(riskKey)) {
      fail(`risk card ${card.id} relatedRisks 引用不存在: ${riskKey}`);
    }
  }

  for (const condition of conditions) {
    if (condition.type === "answer" && !questionIds.has(condition.field) && !BASE_FIELDS.has(condition.field)) {
      fail(`risk card ${card.id} answer condition field 不合法: ${condition.field}`);
    }
    if (condition.type === "dimension" && !dimensionKeys.has(condition.field)) {
      fail(`risk card ${card.id} dimension condition field 不合法: ${condition.field}`);
    }
    if (condition.type === "finalRisk" && !finalRiskKeys.has(condition.field)) {
      fail(`risk card ${card.id} finalRisk condition field 不合法: ${condition.field}`);
    }
    if (condition.type === "flag" && !flagKeys.has(condition.field)) {
      warn(`risk card ${card.id} 使用了尚未由 questions 产生的 flag: ${condition.field}`);
    }
    if (condition.type === "field" && !BASE_FIELDS.has(condition.field) && !questionIds.has(condition.field)) {
      fail(`risk card ${card.id} field condition field 不合法: ${condition.field}`);
    }
  }

  for (const rule of asArray(card.protectRules)) {
    if (rule.score === undefined) {
      console.log(`[validate-config] OK: ${card.id} protectRule 不要求 score`);
    }
  }

  if (!viralCopy.viralCopies?.[card.id]) {
    warn(`risk card ${card.id} 缺少专属 viral copy，将使用 defaultViralCopy`);
  }
}

for (const testCase of testCases) {
  for (const cardId of asArray(testCase.expected?.mustTrigger)) {
    if (!riskCards.some((card) => card.id === cardId)) {
      fail(`test case ${testCase.id} mustTrigger 引用不存在的风险卡: ${cardId}`);
    }
  }
}

if (hasError) {
  process.exit(1);
}

console.log(`[validate-config] PASS: ${questions.length} questions, ${riskCards.length} risk cards, ${testCases.length} test cases`);
