import type { Question } from "../types/config";

type QuestionCardProps = {
  question: Question;
  selectedAnswer?: string;
  notice?: string | null;
  onSelect: (optionId: string) => void;
};

function getQuestionSectionLabel(question: Question): string {
  if (question.sourceCode?.startsWith("C")) return "\u5feb\u901f\u503e\u5411\u9898";
  if (question.sourceCode?.startsWith("F")) return "\u516c\u53f8\u73af\u5883\u9898";
  if (question.sourceCode?.startsWith("G")) return "\u5de5\u4f5c\u7c7b\u578b\u9898";
  if (question.sourceCode?.startsWith("D")) return "\u901a\u7528\u804c\u4e1a\u53cd\u5e94\u9898";
  if (question.sourceCode?.startsWith("E")) return "\u5e94\u5c4a\u751f\u4e13\u5c5e\u9898";
  if (question.sourceCode?.startsWith("A")) return "\u57fa\u7840\u4fe1\u606f";

  return question.group;
}

function QuestionCard({ question, selectedAnswer, notice, onSelect }: QuestionCardProps) {
  const sectionLabel = getQuestionSectionLabel(question);

  return (
    <section className="question-panel" aria-labelledby="question-title">
      <p className="eyebrow">
        {question.sourceCode ? `${sectionLabel} \u00b7 ${question.sourceCode}` : sectionLabel}
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
              <span className="option-title">{option.text || option.label}</span>
              {option.description ? <span className="option-description">{option.description}</span> : null}
            </button>
          );
        })}
      </div>

      {notice ? <p className="inline-notice">{notice}</p> : null}
    </section>
  );
}

export default QuestionCard;
