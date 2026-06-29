import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type JsonObject = Record<string, any>;
type ScoreBucket = Record<string, number>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const audienceType = process.env.AUDIENCE_TYPE ?? "student";
const configDir = path.join(projectRoot, "src", "config", "audiences", audienceType);

const priorityBonus: Record<string, number> = {
  high: 20,
  medium: 15,
  low: 5
};

function readJson(fileName: string): JsonObject {
  return JSON.parse(fs.readFileSync(path.join(configDir, fileName), "utf8"));
}

function asArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value : [];
}

function addScore(bucket: ScoreBucket, key: string, value: number): void {
  bucket[key] = (bucket[key] ?? 0) + value;
}

function normalize(actual: ScoreBucket, max: ScoreBucket): ScoreBucket {
  const result: ScoreBucket = {};
  for (const [key, maxValue] of Object.entries(max)) {
    result[key] = maxValue > 0 ? ((actual[key] ?? 0) / maxValue) * 100 : 0;
  }
  return result;
}

function getRiskLevel(score: number): "low" | "medium" | "high" {
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function calculateScores(questions: JsonObject[], scoring: JsonObject, answers: Record<string, string>) {
  const actualScores = { dimensions: {} as ScoreBucket, directR: {} as ScoreBucket };
  const maxScores = { dimensions: {} as ScoreBucket, directR: {} as ScoreBucket };
  const flags: Record<string, boolean | string> = {};

  for (const question of questions) {
    if (!(question.id in answers)) continue;

    const selectedOption = asArray(question.options).find((option) => option.id === answers[question.id]);
    if (!selectedOption) continue;

    for (const option of asArray(question.options)) {
      for (const [key, value] of Object.entries(option.scores?.dimensions ?? {})) {
        maxScores.dimensions[key] = Math.max(maxScores.dimensions[key] ?? 0, Number(value));
      }
      for (const [key, value] of Object.entries(option.scores?.directR ?? {})) {
        maxScores.directR[key] = Math.max(maxScores.directR[key] ?? 0, Number(value));
      }
    }

    for (const [key, value] of Object.entries(selectedOption.scores?.dimensions ?? {})) {
      addScore(actualScores.dimensions, key, Number(value));
    }
    for (const [key, value] of Object.entries(selectedOption.scores?.directR ?? {})) {
      addScore(actualScores.directR, key, Number(value));
    }
    Object.assign(flags, selectedOption.flags ?? {});
  }

  const normalizedScores = {
    dimensions: normalize(actualScores.dimensions, maxScores.dimensions),
    directR: normalize(actualScores.directR, maxScores.directR)
  };

  const finalRisks: ScoreBucket = {};
  const riskLevels: Record<string, "low" | "medium" | "high"> = {};

  for (const riskKey of asArray(scoring.finalRisks).map(String)) {
    const formula = scoring.riskFormulas?.[riskKey] ?? {};
    let weightedSum = 0;
    let weightSum = 0;

    if ((maxScores.directR[riskKey] ?? 0) > 0) {
      const weight = Number(formula.directRWeight ?? 0);
      weightedSum += (normalizedScores.directR[riskKey] ?? 0) * weight;
      weightSum += weight;
    }

    for (const [dimensionKey, rawWeight] of Object.entries(formula.dimensionWeights ?? {})) {
      if ((maxScores.dimensions[dimensionKey] ?? 0) > 0) {
        const weight = Number(rawWeight);
        weightedSum += (normalizedScores.dimensions[dimensionKey] ?? 0) * weight;
        weightSum += weight;
      }
    }

    finalRisks[riskKey] = weightSum > 0 ? weightedSum / weightSum : 0;
    riskLevels[riskKey] = getRiskLevel(finalRisks[riskKey]);
  }

  return { actualScores, maxScores, normalizedScores, finalRisks, riskLevels, flags };
}

function compare(operator: string, actual: unknown, expected: unknown): boolean {
  if (operator === "eq") return actual === expected;
  if (operator === "neq") return actual !== expected;
  if (operator === "in") return Array.isArray(expected) && expected.includes(actual);
  if (operator === "not_in") return Array.isArray(expected) && !expected.includes(actual);
  if (operator === "gte") return Number(actual ?? 0) >= Number(expected);
  if (operator === "lte") return Number(actual ?? 0) <= Number(expected);
  return false;
}

function matchCondition(condition: JsonObject, context: JsonObject): boolean {
  if (condition.type === "answer" || condition.type === "field") {
    return compare(condition.operator, context.answers[condition.field], condition.value);
  }
  if (condition.type === "dimension") {
    return compare(condition.operator, context.normalizedScores.dimensions[condition.field], condition.value);
  }
  if (condition.type === "finalRisk") {
    return compare(condition.operator, context.finalRisks[condition.field], condition.value);
  }
  if (condition.type === "flag") {
    return compare(condition.operator, context.flags[condition.field], condition.value);
  }
  return false;
}

function matchStrongMatch(card: JsonObject, answers: Record<string, string>): boolean {
  const companyTypes = card.strongMatch?.companyType;
  const workTypes = card.strongMatch?.workType;

  if (Array.isArray(companyTypes) && !companyTypes.includes(answers.company_type)) return false;
  if (Array.isArray(workTypes) && !workTypes.includes(answers.work_type)) return false;

  return true;
}

function triggerRiskCards(riskCards: JsonObject[], context: JsonObject): string[] {
  const triggered: Array<{ id: string; score: number }> = [];

  for (const card of riskCards) {
    if (asArray(card.protectRules).some((rule) => matchCondition(rule, context))) continue;
    if (!matchStrongMatch(card, context.answers)) continue;

    const matchedConditions = asArray(card.conditions).filter((condition) => matchCondition(condition, context));
    const primaryMatches = matchedConditions.filter((condition) =>
      ["answer", "dimension", "finalRisk"].includes(condition.type)
    );
    const conditionScore = matchedConditions
      .filter((condition) => condition.type !== "field")
      .reduce((sum, condition) => sum + Number(condition.score ?? 0), 0);
    const score = Number(card.baseTriggerScore ?? 0) + conditionScore + (priorityBonus[card.priority] ?? 0);

    if (score >= 60 && primaryMatches.length >= 1) {
      triggered.push({ id: card.id, score });
    }
  }

  return triggered.sort((left, right) => right.score - left.score).map((card) => card.id);
}

function generateViralCopy(viralCopy: JsonObject, topRiskCardId?: string): JsonObject {
  if (topRiskCardId && viralCopy.viralCopies?.[topRiskCardId]) {
    return viralCopy.viralCopies[topRiskCardId];
  }
  return viralCopy.defaultViralCopy;
}

console.log(`[test-risk-logic] audience_type=${audienceType}`);

const questionsRaw = readJson("questions.json");
const scoring = readJson("scoring.json");
const riskCardsRaw = readJson("risk_cards.json");
const viralCopy = readJson("viral_copy.json");
const testCasesRaw = readJson("test_cases.json");

const questions = asArray(questionsRaw.questions ?? questionsRaw);
const riskCards = asArray(riskCardsRaw.riskCards ?? riskCardsRaw);
const testCases = asArray(testCasesRaw.testCases ?? testCasesRaw);

if (testCases.length === 0) {
  console.log("[test-risk-logic] test_cases.json 当前没有测试用例。");
  process.exit(0);
}

let failed = 0;

for (const testCase of testCases) {
  const answers = testCase.answers ?? {};
  const scoreResult = calculateScores(questions, scoring, answers);
  const triggeredRiskCards = triggerRiskCards(riskCards, { ...scoreResult, answers });
  const topRiskCardId = triggeredRiskCards[0] ?? "H0_GENERAL_REMINDER";
  const selectedViralCopy = generateViralCopy(viralCopy, triggeredRiskCards[0]);
  const missingCards = asArray(testCase.expected?.mustTrigger).filter(
    (cardId) => !triggeredRiskCards.includes(String(cardId))
  );
  const viralTargetText = testCase.expected?.viralCopy?.targetText;
  const viralMismatch = viralTargetText && selectedViralCopy?.targetText !== viralTargetText;

  if (missingCards.length > 0 || viralMismatch) {
    failed += 1;
    console.error(`[test-risk-logic] FAIL: ${testCase.id}`);
    if (missingCards.length > 0) {
      console.error(`  missing mustTrigger: ${missingCards.join(", ")}`);
    }
    if (viralMismatch) {
      console.error(`  viralCopy targetText mismatch: ${selectedViralCopy?.targetText}`);
    }
    continue;
  }

  console.log(`[test-risk-logic] PASS: ${testCase.id} -> ${topRiskCardId}`);
}

if (failed > 0) {
  process.exit(1);
}

console.log(`[test-risk-logic] PASS: ${testCases.length} test cases`);
