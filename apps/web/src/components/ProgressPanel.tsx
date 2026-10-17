import { useEffect, useRef } from 'react';
import type { AssignmentContext, ProgressSummary } from '../../../../packages/types.js';

const HINT_LABELS = ['diagnostic question', 'concept', 'analogous example', 'next action', 'prerequisite lesson'];

/** 0–4 is a real escalation, so it is drawn as rungs filled to the level the tutor actually used. */
const HintLadder = ({ level }: { level: number }) => <span className="ladder" title={`Hint level ${level}: ${HINT_LABELS[level] ?? 'unknown'}`}>
  {[0, 1, 2, 3, 4].map((rung) => <span key={rung} className={`ladder-rung ${rung <= level ? 'filled' : ''}`} />)}
  <span className="ladder-caption">{HINT_LABELS[level] ?? `level ${level}`}</span>
</span>;

export const ProgressPanel = ({ context, progress }: { context: AssignmentContext; progress: ProgressSummary | null }) => {
  const attemptNumber = new Map(context.attempts.map((attempt, index) => [attempt.id, index + 1]));
  const marks = [...context.feedback].sort((a, b) => b.updatedAt - a.updatedAt);
  // Animate only a mark that arrived after this panel mounted, since that is the one piece of
  // genuinely new information written by someone else.
  const seen = useRef<Set<string>>(new Set());
  const firstRender = useRef(true);
  useEffect(() => {
    for (const mark of marks) seen.current.add(`${mark.id}:${mark.updatedAt}`);
    firstRender.current = false;
  }, [marks]);

  return <div className="margin">
    <section className="pane">
      <header className="pane-head"><h2>Tutor feedback</h2><span className="chip">written by Go</span></header>
      <div className="content">
        {marks.length === 0
          ? <p className="empty">Nothing yet. Save your attempt, then ask your tutor in Go to read it.</p>
          : marks.map((mark) => {
            const key = `${mark.id}:${mark.updatedAt}`;
            const arriving = !firstRender.current && !seen.current.has(key);
            return <article className={`note ${arriving ? 'arriving' : ''}`} key={mark.id}>
              <div className="note-head">
                <span className="note-attempt">Attempt {String(attemptNumber.get(mark.attemptId) ?? '?').padStart(2, '0')}</span>
                <span className={`stamp ${mark.assessment}`}>{mark.assessment}</span>
              </div>
              <p>{mark.explanation}</p>
              <div className="next-step"><strong>Next step</strong>{mark.nextStep}</div>
              {mark.missedConcepts.length > 0 && <p className="fineprint">Concepts named: {mark.missedConcepts.join(', ')}</p>}
              <HintLadder level={mark.hintLevel} />
              <p><time dateTime={new Date(mark.updatedAt).toISOString()}>{new Date(mark.updatedAt).toLocaleString()}</time></p>
            </article>;
          })}
      </div>
    </section>

    <section className="pane">
      <header className="pane-head"><h2>Learning log</h2></header>
      <div className="content">
        <dl className="tally">
          <div><dt>Attempts you saved</dt><strong>{progress?.attemptsTotal ?? 0}</strong></div>
          <div><dt>Marks from your tutor</dt><strong>{progress?.reviewedAttempts ?? 0}</strong></div>
          <div><dt>Marked demonstrated</dt><strong>{progress?.demonstratedAttempts ?? 0}</strong></div>
        </dl>
        <h3>Worth revisiting</h3>
        {progress?.practiceTopics.length
          ? <ul className="topic-list">
            {progress.practiceTopics.map((topic) => <li key={topic.concept}>
              <span>{topic.concept}</span>
              <span className="mentions">{topic.mentions}×</span>
            </li>)}
          </ul>
          : <p className="empty">No concepts named yet.</p>}
        <p className="fineprint">Based on your tutor’s recorded feedback.</p>
      </div>
    </section>
  </div>;
};
