import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPANY_TYPES, QUESTION_BANK_SHA256, ROLE_TYPES, buildGoalFitFreeResult, buildGoalFitReport, goalFitQuestionBank, normalizeGoalFitAnswers, scoreGoalFit, selectGoalFitQuestions, verifyGoalFitQuestionBank } from "./goalFitDomain/index.js";
import { goalFitQuestionBank as officialBank } from "../../src/lib/goalFitQuestionBank.ts";
import { selectGoalFitQuestions as officialSelect } from "../../src/lib/goalFitQuestionSelector.ts";
import { calculateGoalFitScores as officialScore } from "../../src/lib/goalFitScoringEngine.ts";
import { buildGoalFitResult as officialReport } from "../../src/lib/goalFitResultBuilder.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const sourceBytes = fs.readFileSync(path.join(root, "src", "config", "goalFit", "questions.json"));
const serverBytes = fs.readFileSync(path.join(root, "server", "src", "goalFitDomain", "questions.json"));
assert.equal(crypto.createHash("sha256").update(sourceBytes).digest("hex"), QUESTION_BANK_SHA256);
assert.equal(crypto.createHash("sha256").update(serverBytes).digest("hex"), QUESTION_BANK_SHA256);
assert.deepEqual(serverBytes, sourceBytes);
verifyGoalFitQuestionBank();
assert.equal(goalFitQuestionBank.questions.length, 122);

for (const company of COMPANY_TYPES) for (const role of ROLE_TYPES) {
  const server = selectGoalFitQuestions(company, role); const official = officialSelect(officialBank, role);
  assert.deepEqual(server.map((item) => item.id), official.map((item) => item.id)); assert.equal(server.length, 34);
  assert.deepEqual(server.reduce((result, item) => ({ ...result, [item.module]: (result[item.module] ?? 0) + 1 }), {} as Record<string, number>), { A_BACKGROUND: 8, B_PERSONALITY: 6, C_MOTIVATION: 4, D_WORKPLACE_SCENARIO: 8, E_ROLE_SCENARIO: 8 });
}

const role = "PM" as const, company = "D" as const, questions = selectGoalFitQuestions(company, role);
const fixtures = [
  questions.map((q) => q.options[0].id), questions.map((q) => q.options.at(-1)!.id),
  questions.map((q, i) => q.options[i % q.options.length].id), questions.map((q, i) => q.options[(q.options.length - 1 - (i % q.options.length))].id),
  questions.map((q, i) => q.options[(i * 7 + 3) % q.options.length].id)
];
for (const optionIds of fixtures) {
  const answers = Object.fromEntries(questions.map((q, index) => [q.id, optionIds[index]]));
  const serverScore = scoreGoalFit({ targetCompany: company, targetRole: role, answers }); const officialScores = officialScore({ questionBank: officialBank, targetCompany: company, targetRole: role, answers });
  assert.deepEqual(serverScore, officialScores);
  const serverReport = buildGoalFitReport({ targetCompany: company, targetRole: role, answers }); const official = officialReport({ questionBank: officialBank, targetCompany: company, targetRole: role, answers });
  assert.deepEqual(serverReport, official);
  assert.deepEqual(buildGoalFitFreeResult({ targetCompany: company, targetRole: role, answers }), { overallScore: official.scores.overallScore, overallConclusion: official.overallConclusion, primaryRisk: official.riskInsights[0], riskInsights: official.riskInsights, recommendations: official.recommendations });
}
assert.throws(() => selectGoalFitQuestions("bad" as never, role)); assert.throws(() => selectGoalFitQuestions(company, "bad" as never));
const validSubmission = { targetCompany: company, targetRole: role, selectedQuestionIds: questions.map((question) => question.id), answers: questions.map((question) => ({ questionId: question.id, optionId: question.options[0].id })) };
assert.equal(Object.keys(normalizeGoalFitAnswers(validSubmission)).length, 34);
assert.throws(() => normalizeGoalFitAnswers({ ...validSubmission, selectedQuestionIds: validSubmission.selectedQuestionIds.slice(1) }));
assert.throws(() => normalizeGoalFitAnswers({ ...validSubmission, selectedQuestionIds: [...validSubmission.selectedQuestionIds.slice(0, 33), validSubmission.selectedQuestionIds[0]] }));
assert.throws(() => normalizeGoalFitAnswers({ ...validSubmission, selectedQuestionIds: [...validSubmission.selectedQuestionIds].reverse() }));
assert.throws(() => normalizeGoalFitAnswers({ ...validSubmission, answers: [{ questionId: questions[0].id, optionId: "wrong" }] }));
console.log("Goal Fit server domain parity tests passed.");
