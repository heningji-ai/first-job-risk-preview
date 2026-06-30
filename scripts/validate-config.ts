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
const viralCopy = configs["viral_copy.json"] ?? {};
const testCases = asArray(configs["test_cases.json"]?.testCases ?? configs["test_cases.json"]);

const questionIds = new Set<string>();
const flagKeys = new Set<string>();
const directRKeysFromQuestions = new Set<string>();
const dimensionKeys = new Set<string>(asArray(scoring.dimensions).map(String));
const finalRiskKeys = new Set<string>(asArray(scoring.finalRisks).map(String));
const scoringIsPlaceholder = typeof scoring._todo === "string";

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

const riskFormulas = scoring.riskFormulas ?? {};
if (scoringIsPlaceholder) {
  warn("scoring.json is TODO_PLACEHOLDER; scoring values are engineering-only");
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

  const conditions = asArray(card.conditions);
  if (!conditions.some((condition) => primaryRiskTypes.has(condition.type))) {
    fail(`risk card ${card.id} has no answer/dimension/finalRisk primary signal`);
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
    if (rule.score === undefined) {
      console.log(`[validate-config] OK: ${card.id} protectRule does not require score`);
    }
  }

  if (!viralCopy.viralCopies?.[card.id]) {
    warn(`risk card ${card.id} has no dedicated viral copy; defaultViralCopy will be used`);
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
