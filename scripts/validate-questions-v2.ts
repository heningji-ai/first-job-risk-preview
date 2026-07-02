import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type JsonObject = Record<string, any>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const questionsPath = path.join(projectRoot, "src", "config", "questions_v2.json");

const companyKeys = ["soe", "mnc", "big_platform", "startup", "sme_private"] as const;
const roleKeys = [
  "sales",
  "operation_project",
  "content_marketing",
  "tech_data_product",
  "function_support"
] as const;
const dimensionKeys = [
  "admissionFitScore",
  "motivationFitScore",
  "baseWorkStyleFitScore",
  "companyScenarioFitScore",
  "roleScenarioFitScore"
] as const;
const signalLevels = ["positive", "neutral", "risk", "severeRisk"] as const;
const moduleCounts = {
  admission: 8,
  motivation: 5,
  work_style: 10,
  company_scenario: 15,
  role_scenario: 20
} as const;
const forbiddenVisibleText = [
  "A 档",
  "B 档",
  "C 档",
  "D 档",
  "档位",
  "评级",
  "等级",
  "cardId",
  "pathFitBand",
  "诊断分数",
  "能力分数",
  "职业匹配分",
  "性格匹配度",
  "你不适合",
  "你就是",
  "必须放弃",
  "免费咨询",
  "立即咨询",
  "购买服务",
  "保证入职",
  "企业微信",
  "回复【重估】"
] as const;
const leadingPunctuationDelimiter = /^[\s；;，,、：:]+/u;

let hasError = false;

function fail(message: string): void {
  console.error(`[validate-questions-v2] ERROR: ${message}`);
  hasError = true;
}

function readJson(filePath: string): JsonObject {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIntegerAffinity(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= -2 && value <= 2;
}

function checkNoForbiddenText(value: unknown, trail: string): void {
  if (typeof value !== "string") return;

  for (const forbidden of forbiddenVisibleText) {
    if (value.includes(forbidden)) {
      fail(`${trail} contains forbidden public wording: ${forbidden}`);
    }
  }
}

function checkNoLeadingDelimiter(
  value: unknown,
  trail: string,
  context: { questionId: string; optionId?: string }
): void {
  if (typeof value !== "string") return;

  if (!leadingPunctuationDelimiter.test(value)) return;

  const owner = context.optionId
    ? `${context.questionId}.${context.optionId}`
    : context.questionId;
  fail(
    `${owner}: ${trail} has leading punctuation delimiter: ${JSON.stringify(value)}`
  );
}

function getCompanyFromQuestionId(questionId: string): string | null {
  if (questionId.startsWith("C_SOE_")) return "soe";
  if (questionId.startsWith("C_MNC_")) return "mnc";
  if (questionId.startsWith("C_BIG_PLATFORM_")) return "big_platform";
  if (questionId.startsWith("C_STARTUP_")) return "startup";
  if (questionId.startsWith("C_SME_PRIVATE_")) return "sme_private";
  return null;
}

function getRoleFromQuestionId(questionId: string): string | null {
  if (questionId.startsWith("R_SALES_")) return "sales";
  if (questionId.startsWith("R_OPERATION_PROJECT_")) return "operation_project";
  if (questionId.startsWith("R_OPS_")) return "operation_project";
  if (questionId.startsWith("R_CONTENT_MARKETING_")) return "content_marketing";
  if (questionId.startsWith("R_CONTENT_")) return "content_marketing";
  if (questionId.startsWith("R_TECH_DATA_PRODUCT_")) return "tech_data_product";
  if (questionId.startsWith("R_TECH_")) return "tech_data_product";
  if (questionId.startsWith("R_FUNCTION_SUPPORT_")) return "function_support";
  if (questionId.startsWith("R_FUNCTION_")) return "function_support";
  return null;
}

function validateAffinityMap(
  value: unknown,
  keys: readonly string[],
  trail: string
): void {
  if (!isObject(value)) {
    fail(`${trail} must be an object`);
    return;
  }

  for (const key of keys) {
    if (!(key in value)) {
      fail(`${trail} missing key: ${key}`);
    } else if (!isIntegerAffinity(value[key])) {
      fail(`${trail}.${key} must be an integer between -2 and 2`);
    }
  }

  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      fail(`${trail} contains unknown key: ${key}`);
    }
  }
}

function validateOptionSignal(
  signal: unknown,
  trail: string,
  allowEmptyDim: boolean
): void {
  if (!isObject(signal)) {
    fail(`${trail} must be an object`);
    return;
  }

  if (!signalLevels.includes(signal.signalLevel)) {
    fail(`${trail}.signalLevel is invalid`);
  }

  if (!isIntegerAffinity(signal.scoreDelta)) {
    fail(`${trail}.scoreDelta must be an integer between -2 and 2`);
  }

  if (!Array.isArray(signal.dim)) {
    fail(`${trail}.dim must be an array`);
  } else {
    if (!allowEmptyDim && signal.dim.length === 0) {
      fail(`${trail}.dim must not be empty except for A7/A8 selectors`);
    }

    for (const dim of signal.dim) {
      if (!dimensionKeys.includes(dim)) {
        fail(`${trail}.dim contains unknown dimension: ${dim}`);
      }
    }
  }

  validateAffinityMap(signal.company, companyKeys, `${trail}.company`);
  validateAffinityMap(signal.role, roleKeys, `${trail}.role`);

  if (!Array.isArray(signal.tags)) {
    fail(`${trail}.tags must be an array`);
  } else if (!signal.tags.every((tag: unknown) => typeof tag === "string" && tag.length > 0)) {
    fail(`${trail}.tags must contain non-empty strings`);
  }

  if (typeof signal.explain !== "boolean") {
    fail(`${trail}.explain must be boolean`);
  }
}

if (!fs.existsSync(questionsPath)) {
  fail("src/config/questions_v2.json must exist");
} else {
  const config = readJson(questionsPath);
  const questions = Array.isArray(config.questions) ? config.questions : [];

  if (config.version !== "v1.2") fail("version must be v1.2");
  if (config.audience !== "student_first_job") fail("audience must be student_first_job");
  if (config.totalQuestionBankSize !== 58) fail("totalQuestionBankSize must be 58");
  if (config.actualAnswerCountPerUser !== 30) fail("actualAnswerCountPerUser must be 30");
  if (questions.length !== 58) fail(`questions length must be 58, got ${questions.length}`);

  for (const [moduleName, count] of Object.entries(moduleCounts)) {
    if (config.modules?.[moduleName] !== count) {
      fail(`modules.${moduleName} must be ${count}`);
    }

    const actual = questions.filter((question: JsonObject) => question.module === moduleName).length;
    if (actual !== count) {
      fail(`module ${moduleName} must contain ${count} questions, got ${actual}`);
    }
  }

  const questionIds = new Set<string>();
  const a7SelectorValues = new Set<string>();
  const a8SelectorValues = new Set<string>();

  questions.forEach((question: JsonObject, questionIndex: number) => {
    const questionTrail = `questions[${questionIndex}]`;
    const questionId = question.questionId;
    const isA7OrA8 = questionId === "A7" || questionId === "A8";

    if (typeof questionId !== "string" || questionId.length === 0) {
      fail(`${questionTrail}.questionId is required`);
      return;
    }

    if (questionIds.has(questionId)) {
      fail(`duplicate questionId: ${questionId}`);
    }
    questionIds.add(questionId);

    checkNoForbiddenText(question.title, `${questionTrail}.title`);
    checkNoLeadingDelimiter(question.title, "question.title", { questionId });
    checkNoForbiddenText(question.scoringIntent, `${questionTrail}.scoringIntent`);

    if (!Array.isArray(question.options) || question.options.length < 4) {
      fail(`${questionId} must have at least 4 options`);
    }

    if ((question.module === "company_scenario" || question.module === "role_scenario") && question.options?.length !== 4) {
      fail(`${questionId} scenario questions must have exactly 4 options`);
    }

    const optionIds = new Set<string>();
    question.options?.forEach((option: JsonObject, optionIndex: number) => {
      const optionTrail = `${questionTrail}.options[${optionIndex}]`;

      if (typeof option.optionId !== "string" || option.optionId.length === 0) {
        fail(`${optionTrail}.optionId is required`);
      } else if (optionIds.has(option.optionId)) {
        fail(`${questionId} has duplicate optionId: ${option.optionId}`);
      }
      optionIds.add(option.optionId);

      checkNoForbiddenText(option.label, `${optionTrail}.label`);
      checkNoLeadingDelimiter(option.label, "option.label", {
        questionId,
        optionId: option.optionId
      });
      validateOptionSignal(option.optionSignal, `${optionTrail}.optionSignal`, isA7OrA8);

      if (questionId === "A7") {
        if (companyKeys.includes(option.selectorValue)) {
          a7SelectorValues.add(option.selectorValue);
        } else {
          fail(`${optionTrail}.selectorValue must be a company key`);
        }

        if (
          option.optionSignal?.signalLevel !== "neutral" ||
          option.optionSignal?.scoreDelta !== 0 ||
          option.optionSignal?.dim?.length !== 0
        ) {
          fail(`${optionTrail}.optionSignal must be neutral selector signal`);
        }
      }

      if (questionId === "A8") {
        if (roleKeys.includes(option.selectorValue)) {
          a8SelectorValues.add(option.selectorValue);
        } else {
          fail(`${optionTrail}.selectorValue must be a role key`);
        }

        if (
          option.optionSignal?.signalLevel !== "neutral" ||
          option.optionSignal?.scoreDelta !== 0 ||
          option.optionSignal?.dim?.length !== 0
        ) {
          fail(`${optionTrail}.optionSignal must be neutral selector signal`);
        }
      }
    });

    if (question.module === "company_scenario") {
      const expectedCompany = getCompanyFromQuestionId(questionId);
      if (question.visibleToAll !== false) fail(`${questionId}.visibleToAll must be false`);
      if (question.displayCondition?.field !== "company_type") {
        fail(`${questionId}.displayCondition.field must be company_type`);
      }
      if (question.displayCondition?.equals !== expectedCompany) {
        fail(`${questionId}.displayCondition.equals must be ${expectedCompany}`);
      }
    }

    if (question.module === "role_scenario") {
      const expectedRole = getRoleFromQuestionId(questionId);
      if (question.visibleToAll !== false) fail(`${questionId}.visibleToAll must be false`);
      if (question.displayCondition?.field !== "work_type") {
        fail(`${questionId}.displayCondition.field must be work_type`);
      }
      if (question.displayCondition?.equals !== expectedRole) {
        fail(`${questionId}.displayCondition.equals must be ${expectedRole}`);
      }
    }

    if (!["company_scenario", "role_scenario"].includes(question.module)) {
      if (question.visibleToAll !== true) fail(`${questionId}.visibleToAll must be true`);
      if (question.displayCondition !== null) fail(`${questionId}.displayCondition must be null`);
    }
  });

  for (const key of companyKeys) {
    if (!a7SelectorValues.has(key)) fail(`A7 missing selectorValue: ${key}`);
  }

  for (const key of roleKeys) {
    if (!a8SelectorValues.has(key)) fail(`A8 missing selectorValue: ${key}`);
  }

  for (const companyType of companyKeys) {
    for (const roleType of roleKeys) {
      const visibleQuestions = questions.filter((question: JsonObject) => {
        if (question.visibleToAll) return true;
        if (question.displayCondition?.field === "company_type") {
          return question.displayCondition.equals === companyType;
        }
        if (question.displayCondition?.field === "work_type") {
          return question.displayCondition.equals === roleType;
        }
        return false;
      });

      if (visibleQuestions.length !== 30) {
        fail(`${companyType} + ${roleType} must show 30 questions, got ${visibleQuestions.length}`);
      }
    }
  }
}

if (hasError) {
  process.exit(1);
}

console.log("[validate-questions-v2] OK");
