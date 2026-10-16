import type { AssignmentContext, ProgressSummary } from '../../../../packages/types.js';
export const ProgressPanel = ({ context, progress }: { context: AssignmentContext; progress: ProgressSummary | null }) => <section className="pane">
  <header className="pane-head"><h2>Learning log</h2><span className="count">Updates from Go</span></header>
  <div className="content">
    <div className="stats"><div><strong>{progress?.attemptsTotal ?? 0}</strong><span>Attempts recorded</span></div><div><strong>{progress?.reviewedAttempts ?? 0}</strong><span>Tutor reviews</span></div></div>
    <h3>Topics to revisit</h3>
    {progress?.practiceTopics.length ? <ul className="weak-list">{progress.practiceTopics.map((topic) => <li key={topic.concept}><span>{topic.concept}</span><span className="badge">{topic.mentions} mention{topic.mentions === 1 ? '' : 's'}</span></li>)}</ul> : <p className="muted">No difficulties recorded yet. Go will save feedback as you work.</p>}
    <p className="fineprint">Historical tutor feedback, not a mastery score or an official grade.</p>
    <h3>Feedback and next steps</h3>
    {context.feedback.length === 0 ? <p className="muted">Ask your connected SuperTutor agent in Go to review your attempt.</p> : [...context.feedback].sort((a, b) => b.updatedAt - a.updatedAt).map((item) => <article className="feedback" key={item.id}>
      <div className="feedback-row"><strong>{item.assessment}</strong><span className="badge">Hint level {item.hintLevel}</span></div>
      <p>{item.explanation}</p><p><strong>Next step:</strong> {item.nextStep}</p>
      <small className="muted">Go tutor assessment · {new Date(item.updatedAt).toLocaleTimeString()}</small>
    </article>)}
  </div>
</section>;
