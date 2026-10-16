import { useState } from 'react';
import type { Feedback, Question } from '../../../../packages/types.js';

type Props = {
  question: Question;
  index: number;
  answer: string;
  feedback?: Feedback;
  onAnswerChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
};

export const QuestionCard = ({
  question,
  index,
  answer,
  feedback,
  onAnswerChange,
  onSubmit,
  busy,
}: Props) => {
  const [open, setOpen] = useState(index === 0);

  return (
    <article className={`card ${feedback ? `graded ${feedback.verdict}` : ''}`}>
      <button className="card-head" onClick={() => setOpen(!open)}>
        <span className="num">{index + 1}</span>
        <span className="prompt">{question.prompt}</span>
        <span className="meta">
          {feedback ? `${feedback.score}` : question.difficulty}
        </span>
      </button>

      {open && (
        <div className="card-body">
          <textarea
            value={answer}
            onChange={(event) => onAnswerChange(event.target.value)}
            placeholder="Answer in your own words…"
            // Cmd/Ctrl+Enter submits — judges never find the button in time otherwise.
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') onSubmit();
            }}
          />
          <div className="card-actions">
            <span className="topic">{question.topic}</span>
            <button className="primary" disabled={busy || !answer.trim()} onClick={onSubmit}>
              {busy ? 'Grading…' : feedback ? 'Re-grade' : 'Submit answer'}
            </button>
          </div>

          {feedback && (
            <div className="feedback">
              <div className="feedback-row">
                <strong>{feedback.verdict}</strong>
                <span className="score">{feedback.score}/100</span>
              </div>
              <p>{feedback.explanation}</p>
              <details>
                <summary>Stronger answer</summary>
                <p>{feedback.improvedAnswer}</p>
              </details>
            </div>
          )}
        </div>
      )}
    </article>
  );
};
