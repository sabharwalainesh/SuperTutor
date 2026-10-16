import { useEffect, useState } from 'react';
import type { Session } from '../../../packages/types.js';
import { LessonView } from './components/LessonView.js';
import { QuestionCard } from './components/QuestionCard.js';
import { SourceInput } from './components/SourceInput.js';
import { WeakSpots } from './components/WeakSpots.js';
import { createLesson, gradeAnswer } from './lib/api.js';
import { clearSession, loadSession, saveSession } from './lib/session.js';

export const App = () => {
  const [session, setSession] = useState<Session>(loadSession);
  const [error, setError] = useState<string | null>(null);
  const [lessonBusy, setLessonBusy] = useState(false);
  const [gradingId, setGradingId] = useState<string | null>(null);

  useEffect(() => saveSession(session), [session]);

  const handleGenerate = async (text: string) => {
    setError(null);
    setLessonBusy(true);
    try {
      const lesson = await createLesson(text);
      setSession({ lesson, answers: {}, feedback: {}, updatedAt: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLessonBusy(false);
    }
  };

  const handleGrade = async (questionId: string) => {
    const question = session.lesson?.questions.find((q) => q.id === questionId);
    if (!question) return;

    setError(null);
    setGradingId(questionId);
    try {
      const feedback = await gradeAnswer(question, session.answers[questionId] ?? '');
      setSession((prev) => ({
        ...prev,
        feedback: { ...prev.feedback, [questionId]: feedback },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grading failed.');
    } finally {
      setGradingId(null);
    }
  };

  const handleReset = () => {
    clearSession();
    setSession(loadSession());
    setError(null);
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>Learning Coach</h1>
        <div className="topbar-actions">
          {session.lesson && (
            <button className="link" onClick={handleReset}>
              New session
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="banner error" role="alert">
          {error}
          <button className="link" onClick={() => setError(null)}>
            dismiss
          </button>
        </div>
      )}

      <main className="columns">
        <div className="col">
          <SourceInput busy={lessonBusy} onGenerate={handleGenerate} />
          <WeakSpots feedback={session.feedback} />
        </div>

        <div className="col wide">
          {!session.lesson ? (
            <section className="pane placeholder">
              <p>No lesson yet. Paste material on the left, or load the demo text.</p>
            </section>
          ) : (
            <>
              <LessonView lesson={session.lesson} />
              <section className="pane">
                <header className="pane-head">
                  <h2>Practice</h2>
                  <span className="count">
                    {Object.keys(session.feedback).length} / {session.lesson.questions.length} graded
                  </span>
                </header>
                <div className="scroll cards">
                  {session.lesson.questions.map((question, index) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      index={index}
                      answer={session.answers[question.id] ?? ''}
                      feedback={session.feedback[question.id]}
                      busy={gradingId === question.id}
                      onAnswerChange={(value) =>
                        setSession((prev) => ({
                          ...prev,
                          answers: { ...prev.answers, [question.id]: value },
                        }))
                      }
                      onSubmit={() => handleGrade(question.id)}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
};
