import type { Question, ShowWhenRule } from "../types/config";

export type Answers = Record<string, string>;

function getAnswerValue(field: string, answers: Answers): string | undefined {
  return answers[field];
}

function matchesRule(rule: ShowWhenRule, answers: Answers): boolean {
  const actual = getAnswerValue(rule.field, answers);
  const expected = rule.value;

  switch (rule.operator) {
    case "eq":
    case "equals":
      return actual === expected;
    case "neq":
    case "notEquals":
      return actual !== expected;
    case "in":
      return Array.isArray(expected) && actual !== undefined && expected.includes(actual);
    case "not_in":
    case "notIn":
      return Array.isArray(expected) && (actual === undefined || !expected.includes(actual));
    default:
      return true;
  }
}

export function getVisibleQuestions(questions: Question[], answers: Answers): Question[] {
  return [...questions]
    .sort((left, right) => left.order - right.order)
    .filter((question) => {
      if (!question.showWhen || question.showWhen.length === 0) return true;
      return question.showWhen.every((rule) => matchesRule(rule, answers));
    });
}

export function filterAnswersByVisibleQuestions(
  answers: Answers,
  visibleQuestions: Question[]
): Answers {
  const visibleQuestionIds = new Set(visibleQuestions.map((question) => question.id));

  return Object.fromEntries(
    Object.entries(answers).filter(([questionId]) => visibleQuestionIds.has(questionId))
  );
}
