import assert from "node:assert/strict";

process.env.GOAL_FIT_DB_PATH = `data/validation-isolated-${Date.now()}.db`;
process.env.NODE_ENV = "test";
process.env.WECHAT_MINIAPP_APP_ID = "wx-test";
process.env.MINIAPP_IDENTITY_ENCRYPTION_KEY = Buffer.alloc(32, 13).toString("base64");
process.env.ASSESSMENT_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 14).toString("base64");

const { app, resetAssessmentRateLimitForTest } = await import("./index.js");
const { db } = await import("./db.js");
const { createWechatMiniappSession } = await import("./miniappIdentity.js");
const { selectGoalFitQuestions } = await import("./goalFitDomain/index.js");
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const questions = selectGoalFitQuestions("D", "PM");
const valid = { submissionId: "sub_validate_123456", targetCompany: "D", targetRole: "PM", selectedQuestionIds: questions.map((q) => q.id), answers: questions.map((q) => ({ questionId: q.id, optionId: q.options[0].id })) };
const token = (await createWechatMiniappSession({ code: "mock-validation-isolated", visitorId: "visitor_12345678" })).sessionToken;
const count = () => ({ assessments: Number((db.prepare("SELECT count(*) count FROM assessments").get() as { count: number }).count), snapshots: Number((db.prepare("SELECT count(*) count FROM report_snapshots").get() as { count: number }).count) });
const post = (body: unknown) => fetch(`${base}/api/miniapp/goal-fit/assessments/complete`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
async function invalid(body: unknown): Promise<void> { resetAssessmentRateLimitForTest(); const before = count(); const response = await post(body); assert.equal(response.status, 400); assert.deepEqual(Object.keys(await response.json() as object), ["error"]); assert.deepEqual(count(), before); }
try {
  resetAssessmentRateLimitForTest(); const response = await post(valid); const success = await response.json() as Record<string, unknown>; assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store"); assert.deepEqual(Object.keys(success).sort(), ["assessmentId", "freeResult", "reportSnapshotId", "versions"].sort()); assert.deepEqual(Object.keys(success.versions as object).sort(), ["questionSetVersion", "scoringVersion", "reportVersion"].sort()); for (const value of Object.values(success.versions as object)) assert.equal(typeof value, "string");
  for (const submissionId of [undefined, null, 1, {}, "", " ", "bad", "sub a", "sub/a", "sub.a", "sub_中文", `sub_${"a".repeat(129)}`]) await invalid({ ...valid, submissionId });
  for (const targetCompany of [undefined, null, 1, "bad"]) await invalid({ ...valid, targetCompany }); for (const targetRole of [undefined, null, 1, "bad"]) await invalid({ ...valid, targetRole });
  for (const selectedQuestionIds of [undefined, null, {}, valid.selectedQuestionIds.slice(1), [...valid.selectedQuestionIds, "NOPE"], [...valid.selectedQuestionIds.slice(0, 33), 1]]) await invalid({ ...valid, selectedQuestionIds });
  for (const answers of [undefined, null, {}, valid.answers.slice(1), [...valid.answers, valid.answers[0]], [null], [{ optionId: valid.answers[0].optionId }], [{ questionId: valid.answers[0].questionId }], [{ questionId: 1, optionId: valid.answers[0].optionId }], [{ questionId: valid.answers[0].questionId, optionId: 1 }]]) await invalid({ ...valid, answers });
  await invalid({ ...valid, selectedQuestionIds: [...valid.selectedQuestionIds.slice(0, 33), valid.selectedQuestionIds[0]] }); await invalid({ ...valid, answers: [...valid.answers].reverse() }); await invalid({ ...valid, answers: [{ ...valid.answers[0], questionId: "NOPE" }, ...valid.answers.slice(1)] }); await invalid({ ...valid, answers: [{ ...valid.answers[0], optionId: "NOPE" }, ...valid.answers.slice(1)] });
  for (const field of ["score", "scores", "overallScore", "riskLevel", "freeResult", "fullReport", "paid", "price", "orderId", "entitlement", "reportSnapshotId", "assessmentId", "platformIdentityId", "visitorId", "openid", "unionid", "token", "sessionToken", "debugField"]) await invalid({ ...valid, submissionId: `sub_field_${field}123`, [field]: "x" });
  console.log("Goal Fit isolated complete validation tests passed.");
} finally { resetAssessmentRateLimitForTest(); server.close(); }
