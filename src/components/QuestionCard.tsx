import type { Question } from "../types/config";

type QuestionCardProps = {
  question: Question;
  selectedAnswer?: string;
  notice?: string | null;
  onSelect: (optionId: string) => void;
};

function getQuestionSectionLabel(question: Question): string {
  if (question.sourceCode?.startsWith("C")) return "快速倾向题";
  if (question.sourceCode?.startsWith("F")) return "公司环境题";
  if (question.sourceCode?.startsWith("G")) return "工作类型题";
  if (question.sourceCode?.startsWith("D")) return "通用职业反应题";
  if (question.sourceCode?.startsWith("E")) return "应届生专属题";
  if (question.sourceCode?.startsWith("A")) return "基础信息";

  return question.group;
}

function QuestionCard({ question, selectedAnswer, notice, onSelect }: QuestionCardProps) {
  const sectionLabel = getQuestionSectionLabel(question);

  return (
    <section className="question-panel" aria-labelledby="question-title">
      <p className="eyebrow">
        {question.sourceCode ? `${sectionLabel} · ${question.sourceCode}` : sectionLabel}
      </p>
      <h1 id="question-title">{question.text}</h1>

      <div className="option-list">
        {question.options.map((option) => {
          const isSelected = option.id === selectedAnswer;
          return (
            <button
              className={`option-button${isSelected ? " selected" : ""}`}
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              aria-pressed={isSelected}
            >
              <span>{option.text || option.label}</span>
            </button>
          );
        })}
      </div>

      {notice ? <p className="inline-notice">{notice}</p> : null}
    </section>
  );
}

export default QuestionCard;
