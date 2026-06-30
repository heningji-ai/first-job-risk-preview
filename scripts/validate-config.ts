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
  "risk_card_copy.json",
  "result_copy.json",
  "viral_copy.json",
  "animation_map.json",
  "service_cards.json",
  "labels.json",
  "test_cases.json"
];

let hasError = false;

function readJson(fileName: string): JsonObject {
  const filePath = path.join(configDir, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value : [];
}

function fail(message: string): void {
  console.error(`[validate-config] ERROR: ${message}`);
  hasError = true;
}

function warn(message: string): void {
  console.warn(`[validate-config] WARNING: ${message}`);
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
    return Object.entries(value).flatMap(([key, nested]) => findBadPlaceholders(nested, `${trail}.${key}`));
  }

  return typeof value === "string" && value.includes("????") ? [trail] : [];
}

function findBadText(value: unknown, pattern: RegExp, trail = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findBadText(item, pattern, `${trail}[${index}]`));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nested]) => findBadText(nested, pattern, `${trail}.${key}`));
  }

  return typeof value === "string" && pattern.test(value) ? [trail] : [];
}

function findForbiddenKeys(value: unknown, forbiddenKeys: Set<string>, trail = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findForbiddenKeys(item, forbiddenKeys, `${trail}[${index}]`));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nested]) => {
      const currentTrail = `${trail}.${key}`;
      const currentMatch = forbiddenKeys.has(key) ? [currentTrail] : [];
      return [...currentMatch, ...findForbiddenKeys(nested, forbiddenKeys, currentTrail)];
    });
  }

  return [];
}

console.log(`[validate-config] audience_type=${audienceType}`);

if (!fs.existsSync(configDir)) {
  fail(`missing config directory: ${configDir}`);
  process.exit(1);
}

const configs: Record<string, JsonObject> = {};

for (const fileName of requiredFiles) {
  const filePath = path.join(configDir, fileName);
  if (!fs.existsSync(filePath)) {
    fail(`missing config file: ${fileName}`);
    continue;
  }

  try {
    configs[fileName] = readJson(fileName);
    const marker = "_todo" in configs[fileName];
    console.log(`[validate-config] OK: ${fileName}${marker ? " (TODO marked)" : ""}`);
  } catch (error) {
    fail(`${fileName} is not valid JSON`);
    console.error(error);
  }
}

const questions = asArray(configs["questions.json"]?.questions ?? configs["questions.json"]);
const scoring = configs["scoring.json"] ?? {};
const riskCards = asArray(configs["risk_cards.json"]?.riskCards ?? configs["risk_cards.json"]);
const riskCardCopy = configs["risk_card_copy.json"] ?? {};
const viralCopy = configs["viral_copy.json"] ?? {};
const testCases = asArray(configs["test_cases.json"]?.testCases ?? configs["test_cases.json"]);
const riskCardCopies = (riskCardCopy.riskCardCopies ?? {}) as JsonObject;

const questionIds = new Set<string>();
const flagKeys = new Set<string>();
const directRKeysFromQuestions = new Set<string>();
const dimensionKeys = new Set<string>(asArray(scoring.dimensions).map(String));
const finalRiskKeys = new Set<string>(asArray(scoring.finalRisks).map(String));
const scoringIsPlaceholder = typeof scoring._todo === "string";
const riskCardIds = new Set<string>();
const companyTypeOptions = new Set<string>();
const workTypeOptions = new Set<string>();
const requiredRiskCardCopyFields = [
  "cardId",
  "displayName",
  "oneLineRiskPrompt",
  "typicalScenes",
  "notSaying",
  "riskReductionActions",
  "preChoiceValidationChecklist",
  "whoToAsk",
  "jiGeCanHelpWith",
  "resultShortCopy",
  "shareShortCopy",
  "status"
];
const allowedRiskCardCopyStatuses = new Set(["ENGINEERING_PLACEHOLDER", "PRODUCT_DRAFT", "APPROVED"]);

for (const question of questions) {
  if (typeof question.id !== "string" || question.id.length === 0) {
    fail("question is missing id");
    continue;
  }

  if (questionIds.has(question.id)) {
    fail(`duplicate question id: ${question.id}`);
  }
  questionIds.add(question.id);

  const optionIds = new Set<string>();
  for (const option of asArray(question.options)) {
    if (typeof option.id !== "string") {
      fail(`question ${question.id} has option without id`);
      continue;
    }
    if (optionIds.has(option.id)) {
      fail(`duplicate option id in question ${question.id}: ${option.id}`);
    }
    optionIds.add(option.id);

    for (const dimensionKey of Object.keys(option.scores?.dimensions ?? {})) {
      if (!dimensionKeys.has(dimensionKey)) {
        fail(`question ${question.id} references missing dimension: ${dimensionKey}`);
      }
    }

    for (const riskKey of Object.keys(option.scores?.directR ?? {})) {
      directRKeysFromQuestions.add(riskKey);
      if (riskKey.startsWith("direct_R")) {
        fail(`question ${question.id} uses forbidden direct_R* key: ${riskKey}`);
      }
      if (!finalRiskKeys.has(riskKey)) {
        fail(`question ${question.id} references missing directR/finalRisk: ${riskKey}`);
      }
    }

    for (const flagKey of Object.keys(option.flags ?? {})) {
      flagKeys.add(flagKey);
    }

    if (question.id === "company_type") {
      companyTypeOptions.add(option.id);
    }
    if (question.id === "work_type") {
      workTypeOptions.add(option.id);
    }
  }
}

for (const question of questions) {
  for (const rule of asArray(question.showWhen)) {
    if (typeof rule.field === "string" && !questionIds.has(rule.field) && !BASE_FIELDS.has(rule.field)) {
      fail(`question ${question.id} has invalid showWhen.field: ${rule.field}`);
    }
  }
}

for (const [fileName, config] of Object.entries(configs)) {
  if (hasDirectRPrefix(config)) {
    fail(`${fileName} contains forbidden direct_R* naming`);
  }

  for (const badPath of findBadPlaceholders(config)) {
    fail(`${fileName} contains bad placeholder text at ${badPath}`);
  }
}

const badMojibakePattern = /鏈|寰|鍐|涓|���/;
for (const badPath of findBadText(riskCardCopy, badMojibakePattern)) {
  fail(`risk_card_copy.json contains mojibake at ${badPath}`);
}

const formalJudgmentPattern = /你就是|你的职业诊断是|你不适合|必须放弃/;
for (const badPath of findBadText(riskCardCopy, formalJudgmentPattern)) {
  fail(`risk_card_copy.json contains formal judgment wording at ${badPath}`);
}

const hardSalesPattern = /立即咨询|购买服务|领取方案|限时优惠|保证上岸|保证入职|包过面试/;
for (const badPath of findBadText(riskCardCopy, hardSalesPattern)) {
  fail(`risk_card_copy.json contains hard sales wording at ${badPath}`);
}

const forbiddenRiskCardCopyKeys = new Set([
  "triggerBoundary",
  "protectBoundary",
  "strongMatch",
  "primaryRiskSignals",
  "auxiliarySignals",
  "matchedSignals",
  "score",
  "finalRisk",
  "dimension",
  "conditions",
  "protectRules",
  "priority",
  "test_cases"
]);
for (const badPath of findForbiddenKeys(riskCardCopy, forbiddenRiskCardCopyKeys)) {
  fail(`risk_card_copy.json contains internal-only field at ${badPath}`);
}

if (!riskCardCopies.H0_GENERAL_REMINDER) {
  fail("risk_card_copy.json is missing H0_GENERAL_REMINDER");
}

const riskFormulas = scoring.riskFormulas ?? {};
if (scoringIsPlaceholder) {
  warn("scoring.json is TODO_PLACEHOLDER; scoring values are engineering-only");
}

if (riskCards.length !== 16) {
  fail(`risk_cards.json must contain 16 H1-H16 risk cards, found ${riskCards.length}`);
}

for (const [riskKey, formula] of Object.entries(riskFormulas)) {
  if (riskKey.startsWith("direct_R")) {
    fail(`riskFormulas contains forbidden direct_R* key: ${riskKey}`);
  }
  if (!finalRiskKeys.has(riskKey)) {
    fail(`riskFormulas key is not listed in finalRisks: ${riskKey}`);
  }

  if (Number((formula as JsonObject).directRWeight ?? 0) > 0 && !directRKeysFromQuestions.has(riskKey)) {
    const message = `riskFormula ${riskKey} uses directRWeight, but no question option provides ${riskKey}`;
    if (scoringIsPlaceholder) {
      warn(message);
    } else {
      fail(message);
    }
  }

  for (const dimensionKey of Object.keys((formula as JsonObject).dimensionWeights ?? {})) {
    if (!dimensionKeys.has(dimensionKey)) {
      fail(`riskFormula ${riskKey} references missing dimension: ${dimensionKey}`);
    }
  }
}

const mbtiKnownQuestion = questions.find((question) => question.id === "mbti_known");
if (!mbtiKnownQuestion) {
  fail("questions.json is missing mbti_known / A9");
} else {
  const optionIds = new Set(asArray(mbtiKnownQuestion.options).map((option) => option.id));
  if (!optionIds.has("known") || !optionIds.has("unknown")) {
    fail("mbti_known must include known and unknown options");
  }
}

const hasMbtiType = questions.some((question) => question.id === "mbti_type" || question.sourceCode === "B1");
if (!hasMbtiType) {
  warn("B1 / mbti_type is not configured yet; this is allowed in V1");
}

if (!viralCopy.defaultViralCopy?.targetText || !viralCopy.defaultViralCopy?.copyText) {
  fail("viral_copy.json is missing required defaultViralCopy.targetText/copyText");
}

for (const card of riskCards) {
  if (typeof card.id !== "string") {
    fail("risk card is missing id");
    continue;
  }

  if (card.id === "H0_GENERAL_REMINDER") {
    fail("H0_GENERAL_REMINDER must not be configured as a formal triggerable risk card");
  }

  if (riskCardIds.has(card.id)) {
    fail(`duplicate risk card id: ${card.id}`);
  }
  riskCardIds.add(card.id);

  const cardCopy = riskCardCopies[card.id] as JsonObject | undefined;
  if (!cardCopy) {
    fail(`risk_card_copy.json is missing copy for risk card: ${card.id}`);
  } else {
    if (cardCopy.cardId !== card.id) {
      fail(`risk_card_copy.json cardId mismatch for ${card.id}`);
    }
  }

  const conditions = asArray(card.conditions);
  if (!conditions.some((condition) => primaryRiskTypes.has(condition.type))) {
    fail(`risk card ${card.id} has no answer/dimension/finalRisk primary signal`);
  }

  for (const companyType of asArray(card.strongMatch?.companyType).map(String)) {
    if (!companyTypeOptions.has(companyType)) {
      fail(`risk card ${card.id} strongMatch.companyType references invalid option: ${companyType}`);
    }
  }

  for (const workType of asArray(card.strongMatch?.workType).map(String)) {
    if (!workTypeOptions.has(workType)) {
      fail(`risk card ${card.id} strongMatch.workType references invalid option: ${workType}`);
    }
  }

  for (const riskKey of asArray(card.relatedRisks).map(String)) {
    if (!finalRiskKeys.has(riskKey)) {
      fail(`risk card ${card.id} references missing relatedRisk: ${riskKey}`);
    }
  }

  for (const condition of conditions) {
    if (condition.type === "answer" && !questionIds.has(condition.field) && !BASE_FIELDS.has(condition.field)) {
      fail(`risk card ${card.id} has invalid answer field: ${condition.field}`);
    }
    if (condition.type === "dimension" && !dimensionKeys.has(condition.field)) {
      fail(`risk card ${card.id} has invalid dimension field: ${condition.field}`);
    }
    if (condition.type === "finalRisk" && !finalRiskKeys.has(condition.field)) {
      fail(`risk card ${card.id} has invalid finalRisk field: ${condition.field}`);
    }
    if (condition.type === "flag" && !flagKeys.has(condition.field)) {
      warn(`risk card ${card.id} uses flag not produced by questions: ${condition.field}`);
    }
    if (condition.type === "field" && !BASE_FIELDS.has(condition.field) && !questionIds.has(condition.field)) {
      fail(`risk card ${card.id} has invalid field condition: ${condition.field}`);
    }
  }

  for (const rule of asArray(card.protectRules)) {
    if (rule.score !== undefined) {
      fail(`risk card ${card.id} protectRule must not require score`);
    } else {
      console.log(`[validate-config] OK: ${card.id} protectRule has no score`);
    }
  }

  if (!viralCopy.viralCopies?.[card.id]) {
    warn(`risk card ${card.id} has no dedicated viral copy; defaultViralCopy will be used`);
  }
}

for (const [copyId, copy] of Object.entries(riskCardCopies)) {
  const copyObject = copy as JsonObject;
  if (copyObject.cardId !== copyId) {
    fail(`risk_card_copy.json entry ${copyId} must include matching cardId`);
  }
  for (const field of requiredRiskCardCopyFields) {
    if (!(field in copyObject)) {
      fail(`risk_card_copy.json entry ${copyId} is missing required field: ${field}`);
    }
  }
  if (!allowedRiskCardCopyStatuses.has(String(copyObject.status))) {
    fail(`risk_card_copy.json entry ${copyId} has invalid status: ${copyObject.status}`);
  }
  if (copyObject.status === "ENGINEERING_PLACEHOLDER") {
    warn(`risk_card_copy.json copy for ${copyId} is ENGINEERING_PLACEHOLDER`);
  }
}

for (const testCase of testCases) {
  for (const cardId of asArray(testCase.expected?.mustTrigger)) {
    if (!riskCards.some((card) => card.id === cardId)) {
      fail(`test case ${testCase.id} mustTrigger references missing risk card: ${cardId}`);
    }
  }

  for (const riskKey of Object.keys(testCase.expected?.riskLevels ?? {})) {
    if (!finalRiskKeys.has(riskKey)) {
      fail(`test case ${testCase.id} riskLevels references missing finalRisk: ${riskKey}`);
    }
  }
}

if (hasError) {
  process.exit(1);
}

console.log(`[validate-config] PASS: ${questions.length} questions, ${riskCards.length} risk cards, ${testCases.length} test cases`);
