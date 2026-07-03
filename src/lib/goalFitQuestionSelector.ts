import type { GoalFitQuestion, GoalFitQuestionBank, QuestionModule, RoleType } from "./goalFitTypes";

export const GOAL_FIT_MVP_DRAW_RULES: Record<Exclude<QuestionModule, "E_ROLE_SCENARIO">, string[]> = {
  A_BACKGROUND: ["A01", "A02", "A03", "A04", "A05", "A06", "A08", "A09"],
  B_PERSONALITY: ["B01", "B02", "B03", "B06", "B07", "B11"],
  C_MOTIVATION: ["C01", "C02", "C03", "C04"],
  D_WORKPLACE_SCENARIO: ["D01", "D03", "D05", "D06", "D07", "D08", "D10", "D16"]
};

export const GOAL_FIT_ROLE_BRANCH_IDS: Record<RoleType, string[]> = {
  SLS: ["SLS01", "SLS02", "SLS03", "SLS04", "SLS05", "SLS06", "SLS07", "SLS08"],
  PM: ["PM01", "PM02", "PM03", "PM04", "PM05", "PM06", "PM07", "PM08"],
  OPS: ["OPS01", "OPS02", "OPS03", "OPS04", "OPS05", "OPS06", "OPS07", "OPS08"],
  TECH: ["TECH01", "TECH02", "TECH03", "TECH04", "TECH05", "TECH06", "TECH07", "TECH08"],
  DATA: ["DATA01", "DATA02", "DATA03", "DATA04", "DATA05", "DATA06", "DATA07", "DATA08"],
  FUNC: ["FUNC01", "FUNC02", "FUNC03", "FUNC04", "FUNC05", "FUNC06", "FUNC07", "FUNC08"],
  MKT: ["MKT01", "MKT02", "MKT03", "MKT04", "MKT05", "MKT06", "MKT07", "MKT08"],
  SUP: ["SUP01", "SUP02", "SUP03", "SUP04", "SUP05", "SUP06", "SUP07", "SUP08"]
};

function getQuestionById(questionBank: GoalFitQuestionBank, questionId: string): GoalFitQuestion {
  const question = questionBank.questions.find((item) => item.id === questionId);

  if (!question) {
    throw new Error(`Goal Fit question missing: ${questionId}`);
  }

  return question;
}

function assertNoDuplicateQuestions(questions: GoalFitQuestion[]): void {
  const seen = new Set<string>();
  const duplicate = questions.find((question) => {
    if (seen.has(question.id)) return true;
    seen.add(question.id);
    return false;
  });

  if (duplicate) {
    throw new Error(`Goal Fit selector returned duplicate question: ${duplicate.id}`);
  }
}

function assertNoTargetQuestions(questions: GoalFitQuestion[]): void {
  const targetQuestion = questions.find((question) => question.id === "T01" || question.id === "T02");

  if (targetQuestion) {
    throw new Error(`Goal Fit selector must not return target question: ${targetQuestion.id}`);
  }
}

function assertRoleBranchOnly(questions: GoalFitQuestion[], targetRole: RoleType): void {
  const wrongBranch = questions.find(
    (question) => question.module === "E_ROLE_SCENARIO" && question.roleBranch !== targetRole
  );

  if (wrongBranch) {
    throw new Error(
      `Goal Fit selector returned non-target role branch question: ${wrongBranch.id} for ${targetRole}`
    );
  }
}

export function selectGoalFitQuestions(
  questionBank: GoalFitQuestionBank,
  targetRole: RoleType
): GoalFitQuestion[] {
  const fixedQuestionIds = [
    ...GOAL_FIT_MVP_DRAW_RULES.A_BACKGROUND,
    ...GOAL_FIT_MVP_DRAW_RULES.B_PERSONALITY,
    ...GOAL_FIT_MVP_DRAW_RULES.C_MOTIVATION,
    ...GOAL_FIT_MVP_DRAW_RULES.D_WORKPLACE_SCENARIO
  ];
  const roleQuestionIds = GOAL_FIT_ROLE_BRANCH_IDS[targetRole];
  const selectedQuestions = [...fixedQuestionIds, ...roleQuestionIds].map((questionId) =>
    getQuestionById(questionBank, questionId)
  );

  if (selectedQuestions.length !== 34) {
    throw new Error(`Goal Fit selector must return 34 questions, got ${selectedQuestions.length}`);
  }

  assertNoDuplicateQuestions(selectedQuestions);
  assertNoTargetQuestions(selectedQuestions);
  assertRoleBranchOnly(selectedQuestions, targetRole);

  return selectedQuestions;
}
