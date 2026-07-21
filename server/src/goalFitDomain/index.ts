import crypto from "node:crypto";
import questionBankJson from "./questions.json" with { type: "json" };
import type { CompanyType, GoalFitAnswerMap, GoalFitQuestionBank, RoleType } from "./goalFitTypes.js";
import { selectGoalFitQuestions as select } from "./goalFitQuestionSelector.js";
import { calculateGoalFitScores } from "./goalFitScoringEngine.js";
import { buildGoalFitResult } from "./goalFitResultBuilder.js";

export const QUESTION_SET_VERSION = "goal-fit-question-set-v1.3";
export const SCORING_VERSION = "goal-fit-v1.3";
export const REPORT_VERSION = "goal-fit-result-v1.3";
export const QUESTION_BANK_SHA256 = "b0bfeb350c4412698d3ed7bcd5d164758158893b15e04b423485c2e1b7a91964";
export const goalFitQuestionBank = questionBankJson as GoalFitQuestionBank;
export const COMPANY_TYPES = Object.keys(goalFitQuestionBank.companyTypes) as CompanyType[];
export const ROLE_TYPES = Object.keys(goalFitQuestionBank.roleTypes) as RoleType[];

export function verifyGoalFitQuestionBank(): void {
  const serialized = JSON.stringify(goalFitQuestionBank);
  // JSON semantic validation is kept separate from the byte-level parity test.
  if (goalFitQuestionBank.questions.length !== 122) throw new Error("Goal Fit question bank must contain 122 questions");
  const ids = new Set<string>();
  for (const question of goalFitQuestionBank.questions) {
    if (ids.has(question.id)) throw new Error(`Duplicate questionId: ${question.id}`);
    ids.add(question.id);
    const optionIds = new Set<string>();
    for (const option of question.options) { if (optionIds.has(option.id)) throw new Error(`Duplicate optionId: ${question.id}/${option.id}`); optionIds.add(option.id); }
  }
  if (!serialized) throw new Error("Goal Fit question bank is empty");
}

export function questionBankSha256Bytes(bytes: Buffer): string { return crypto.createHash("sha256").update(bytes).digest("hex"); }
export function assertCompany(value: unknown): asserts value is CompanyType { if (typeof value !== "string" || !COMPANY_TYPES.includes(value as CompanyType)) throw new Error("INVALID_COMPANY_TYPE"); }
export function assertRole(value: unknown): asserts value is RoleType { if (typeof value !== "string" || !ROLE_TYPES.includes(value as RoleType)) throw new Error("INVALID_ROLE_TYPE"); }
export function selectGoalFitQuestions(targetCompany: CompanyType, targetRole: RoleType) { assertCompany(targetCompany); assertRole(targetRole); return select(goalFitQuestionBank, targetRole); }
export function normalizeGoalFitAnswers(input: { targetCompany: CompanyType; targetRole: RoleType; selectedQuestionIds: string[]; answers: Array<{ questionId: string; optionId: string }> }): GoalFitAnswerMap {
  const expected = selectGoalFitQuestions(input.targetCompany, input.targetRole);
  if (!Array.isArray(input.selectedQuestionIds) || input.selectedQuestionIds.length !== 34 || new Set(input.selectedQuestionIds).size !== 34) throw new Error("INVALID_QUESTION_SET");
  if (input.selectedQuestionIds.join("\u0000") !== expected.map((question) => question.id).join("\u0000")) throw new Error("INVALID_QUESTION_SET");
  if (!Array.isArray(input.answers) || input.answers.length !== 34) throw new Error("ASSESSMENT_INCOMPLETE");
  const answerMap: GoalFitAnswerMap = {};
  for (const answer of input.answers) {
    if (!answer || typeof answer.questionId !== "string" || typeof answer.optionId !== "string" || answerMap[answer.questionId]) throw new Error("INVALID_QUESTION");
    const question = expected.find((item) => item.id === answer.questionId);
    if (!question) throw new Error("INVALID_QUESTION");
    if (!question.options.some((option) => option.id === answer.optionId)) throw new Error("INVALID_OPTION");
    answerMap[answer.questionId] = answer.optionId;
  }
  if (Object.keys(answerMap).length !== 34) throw new Error("ASSESSMENT_INCOMPLETE");
  return answerMap;
}
export function scoreGoalFit(input: { targetCompany: CompanyType; targetRole: RoleType; answers: GoalFitAnswerMap }) { assertCompany(input.targetCompany); assertRole(input.targetRole); return calculateGoalFitScores({ questionBank: goalFitQuestionBank, ...input }); }
export function buildGoalFitReport(input: { targetCompany: CompanyType; targetRole: RoleType; answers: GoalFitAnswerMap }) { assertCompany(input.targetCompany); assertRole(input.targetRole); return buildGoalFitResult({ questionBank: goalFitQuestionBank, ...input }); }
export function buildGoalFitFreeResult(input: { targetCompany: CompanyType; targetRole: RoleType; answers: GoalFitAnswerMap }) {
  const report = buildGoalFitReport(input);
  return { overallScore: report.scores.overallScore, overallConclusion: report.overallConclusion, primaryRisk: report.riskInsights[0], riskInsights: report.riskInsights, recommendations: report.recommendations };
}
