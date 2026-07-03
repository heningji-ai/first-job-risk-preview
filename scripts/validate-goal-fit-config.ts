import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CompanyType,
  GoalFitQuestion,
  GoalFitQuestionBank,
  MotivationTag,
  QuestionModule,
  RiskTag,
  RoleType
} from "../src/lib/goalFitTypes";

type JsonObject = Record<string, unknown>;

const { selectGoalFitQuestions } = (await import(
  "../src/lib/goalFitQuestionSelector" + ".ts"
)) as typeof import("../src/lib/goalFitQuestionSelector");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const questionsPath = path.join(projectRoot, "src", "config", "goalFit", "questions.json");

const companyTypes = ["G", "F", "D", "V", "M"] as const satisfies readonly CompanyType[];
const roleTypes = ["SLS", "PM", "OPS", "TECH", "DATA", "FUNC", "MKT", "SUP"] as const satisfies readonly RoleType[];
const questionModules = [
  "A_BACKGROUND",
  "B_PERSONALITY",
  "C_MOTIVATION",
  "D_WORKPLACE_SCENARIO",
  "E_ROLE_SCENARIO"
] as const satisfies readonly QuestionModule[];
const motivationTags = [
  "money",
  "stable",
  "status",
  "growth",
  "create",
  "first_job",
  "anxiety",
  "balanced"
] as const satisfies readonly MotivationTag[];
const riskTags = [
  "HIGH_PRESSURE",
  "SOCIAL_DRAIN",
  "AMBIGUITY",
  "NEEDS_TRAINING",
  "PROCESS_MISMATCH",
  "BOUNDARY_CONFLICT",
  "LOW_RESOURCE_INITIATIVE",
  "REJECTION_SENSITIVE",
  "GROWTH_GAP",
  "MOTIVATION_MISMATCH",
  "LOW_CLARITY"
] as const satisfies readonly RiskTag[];
const expectedModuleCounts: Record<QuestionModule, number> = {
  A_BACKGROUND: 10,
  B_PERSONALITY: 12,
  C_MOTIVATION: 8,
  D_WORKPLACE_SCENARIO: 28,
  E_ROLE_SCENARIO: 64
};
const expectedDrawCounts: Record<QuestionModule, number> = {
  A_BACKGROUND: 8,
  B_PERSONALITY: 6,
  C_MOTIVATION: 4,
  D_WORKPLACE_SCENARIO: 8,
  E_ROLE_SCENARIO: 8
};

let hasError = false;

function fail(message: string): void {
  console.error(`[validate-goal-fit-config] ERROR: ${message}`);
  hasError = true;
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 5;
}

function includesValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function countBy<T extends string>(items: GoalFitQuestion[], key: (item: GoalFitQuestion) => T): Record<T, number> {
  return items.reduce(
    (counts, item) => {
      const value = key(item);
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    },
    {} as Record<T, number>
  );
}

function checkTargetQuestions(questionBank: GoalFitQuestionBank): void {
  if (!Array.isArray(questionBank.targetQuestions)) {
    fail("targetQuestions must be an array");
    return;
  }

  if (questionBank.targetQuestions.length !== 2) {
    fail(`targetQuestions must contain 2 questions, got ${questionBank.targetQuestions.length}`);
  }

  const t01 = questionBank.targetQuestions.find((question) => question.id === "T01");
  const t02 = questionBank.targetQuestions.find((question) => question.id === "T02");

  if (!t01) fail("targetQuestions must include T01");
  if (!t02) fail("targetQuestions must include T02");
  if (t01 && t01.type !== "targetCompany") fail(`T01 type must be targetCompany, got ${t01.type}`);
  if (t02 && t02.type !== "targetRole") fail(`T02 type must be targetRole, got ${t02.type}`);
}

function checkScoreMap(
  questionId: string,
  optionId: string,
  fieldName: "companyScores" | "roleScores",
  value: unknown,
  allowedKeys: readonly string[]
): void {
  if (value === undefined) return;

  if (!isObject(value)) {
    fail(`${questionId}.${optionId}: ${fieldName} must be an object when present`);
    return;
  }

  for (const [key, score] of Object.entries(value)) {
    if (!allowedKeys.includes(key)) {
      fail(`${questionId}.${optionId}: ${fieldName} has invalid key ${key}`);
    }

    if (!isValidScore(score)) {
      fail(`${questionId}.${optionId}: ${fieldName}.${key} must be a number between 0 and 5`);
    }
  }
}

function checkTagArray(
  questionId: string,
  optionId: string,
  fieldName: "motivationTags" | "riskTags",
  value: unknown,
  allowedTags: readonly string[]
): void {
  if (value === undefined) return;

  if (!Array.isArray(value)) {
    fail(`${questionId}.${optionId}: ${fieldName} must be an array when present`);
    return;
  }

  for (const tag of value) {
    if (!allowedTags.includes(String(tag))) {
      fail(`${questionId}.${optionId}: ${fieldName} has invalid tag ${String(tag)}`);
    }
  }
}

function checkQuestion(question: unknown, seenQuestionIds: Set<string>): void {
  if (!isObject(question)) {
    fail("question must be an object");
    return;
  }

  const id = question.id;
  const module = question.module;

  if (!isNonEmptyString(id)) {
    fail("question.id must be a non-empty string");
    return;
  }

  if (seenQuestionIds.has(id)) {
    fail(`duplicate question id: ${id}`);
  }
  seenQuestionIds.add(id);

  if (!isNonEmptyString(question.text)) {
    fail(`${id}: question text is required`);
  }

  if (!includesValue(questionModules, module)) {
    fail(`${id}: invalid module ${String(module)}`);
  }

  if (!Array.isArray(question.options)) {
    fail(`${id}: options must be an array`);
    return;
  }

  if (question.options.length === 0) {
    fail(`${id}: options must not be empty`);
  }

  if (module === "E_ROLE_SCENARIO") {
    if (!includesValue(roleTypes, question.roleBranch)) {
      fail(`${id}: E_ROLE_SCENARIO question must have valid roleBranch`);
    }
  } else if (question.roleBranch !== undefined) {
    fail(`${id}: non E_ROLE_SCENARIO question must not have roleBranch`);
  }

  const seenOptionIds = new Set<string>();

  for (const option of question.options) {
    if (!isObject(option)) {
      fail(`${id}: option must be an object`);
      continue;
    }

    if (!isNonEmptyString(option.id)) {
      fail(`${id}: option.id is required`);
      continue;
    }

    if (seenOptionIds.has(option.id)) {
      fail(`${id}: duplicate option id ${option.id}`);
    }
    seenOptionIds.add(option.id);

    if (!isNonEmptyString(option.text)) {
      fail(`${id}.${option.id}: option text is required`);
    }

    if (option.mainScore === undefined) {
      fail(`${id}.${option.id}: mainScore is required`);
    } else if (!isValidScore(option.mainScore)) {
      fail(`${id}.${option.id}: mainScore must be a number between 0 and 5`);
    }

    checkScoreMap(id, option.id, "companyScores", option.companyScores, companyTypes);
    checkScoreMap(id, option.id, "roleScores", option.roleScores, roleTypes);
    checkTagArray(id, option.id, "motivationTags", option.motivationTags, motivationTags);
    checkTagArray(id, option.id, "riskTags", option.riskTags, riskTags);
  }
}

function checkModuleCounts(questionBank: GoalFitQuestionBank): void {
  const moduleCounts = countBy(questionBank.questions, (question) => question.module);

  for (const module of questionModules) {
    const actualCount = moduleCounts[module] ?? 0;
    const expectedCount = expectedModuleCounts[module];

    if (actualCount !== expectedCount) {
      fail(`${module} count must be ${expectedCount}, got ${actualCount}`);
    }
  }
}

function checkRoleBranchCounts(questionBank: GoalFitQuestionBank): void {
  const roleBranchQuestions = questionBank.questions.filter(
    (question) => question.module === "E_ROLE_SCENARIO"
  );
  const roleBranchCounts = countBy(roleBranchQuestions, (question) => question.roleBranch as RoleType);

  for (const roleType of roleTypes) {
    const actualCount = roleBranchCounts[roleType] ?? 0;

    if (actualCount !== 8) {
      fail(`${roleType} role branch count must be 8, got ${actualCount}`);
    }
  }
}

function checkDrawRules(questionBank: GoalFitQuestionBank): void {
  const questionIds = new Set(questionBank.questions.map((question) => question.id));

  for (const module of ["A_BACKGROUND", "B_PERSONALITY", "C_MOTIVATION", "D_WORKPLACE_SCENARIO"] as const) {
    const drawRule = questionBank.drawRules[module];

    if (!Array.isArray(drawRule)) {
      fail(`drawRules.${module} must be an array`);
      continue;
    }

    for (const questionId of drawRule) {
      if (!questionIds.has(questionId)) {
        fail(`drawRules.${module} references missing question ${questionId}`);
      }
    }
  }
}

function checkSelectedQuestions(questionBank: GoalFitQuestionBank): void {
  for (const roleType of roleTypes) {
    let selectedQuestions: GoalFitQuestion[] = [];

    try {
      selectedQuestions = selectGoalFitQuestions(questionBank, roleType);
    } catch (error) {
      fail(`selectGoalFitQuestions(${roleType}) failed: ${(error as Error).message}`);
      continue;
    }

    if (selectedQuestions.length !== 34) {
      fail(`${roleType}: selector must return 34 questions, got ${selectedQuestions.length}`);
    }

    const selectedIds = selectedQuestions.map((question) => question.id);
    const uniqueSelectedIds = new Set(selectedIds);

    if (uniqueSelectedIds.size !== selectedIds.length) {
      fail(`${roleType}: selector returned duplicate questions`);
    }

    if (selectedIds.includes("T01") || selectedIds.includes("T02")) {
      fail(`${roleType}: selector must not include T01/T02`);
    }

    const selectedModuleCounts = countBy(selectedQuestions, (question) => question.module);

    for (const module of questionModules) {
      const actualCount = selectedModuleCounts[module] ?? 0;
      const expectedCount = expectedDrawCounts[module];

      if (actualCount !== expectedCount) {
        fail(`${roleType}: selected ${module} count must be ${expectedCount}, got ${actualCount}`);
      }
    }

    const wrongRoleBranch = selectedQuestions.find(
      (question) => question.module === "E_ROLE_SCENARIO" && question.roleBranch !== roleType
    );

    if (wrongRoleBranch) {
      fail(`${roleType}: selected non-target role branch question ${wrongRoleBranch.id}`);
    }
  }
}

const parsedConfig = readJson(questionsPath);

if (!isObject(parsedConfig)) {
  fail("Goal Fit questions config must be a JSON object");
  process.exit(1);
}

const questionBank = parsedConfig as GoalFitQuestionBank;

if (!isNonEmptyString(questionBank.version)) {
  fail("version is required");
}

checkTargetQuestions(questionBank);

if (!Array.isArray(questionBank.questions)) {
  fail("questions must be an array");
} else {
  if (questionBank.questions.length !== 122) {
    fail(`questions count must be 122, got ${questionBank.questions.length}`);
  }

  const seenQuestionIds = new Set<string>();

  for (const question of questionBank.questions) {
    checkQuestion(question, seenQuestionIds);
  }

  checkModuleCounts(questionBank);
  checkRoleBranchCounts(questionBank);
  checkDrawRules(questionBank);
  checkSelectedQuestions(questionBank);
}

if (hasError) {
  process.exit(1);
}

console.log("Goal Fit config validation passed.");
console.log(`version: ${questionBank.version}`);
console.log(`targetQuestions: ${questionBank.targetQuestions.length}`);
console.log(`questions: ${questionBank.questions.length}`);
console.log("modules:");
for (const module of questionModules) {
  const count = questionBank.questions.filter((question) => question.module === module).length;
  console.log(`${module}: ${count}`);
}
console.log("roleBranches:");
for (const roleType of roleTypes) {
  const count = questionBank.questions.filter((question) => question.roleBranch === roleType).length;
  console.log(`${roleType}: ${count}`);
}
console.log("selector:");
console.log("all role types return 34 questions");
