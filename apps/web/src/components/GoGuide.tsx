import type { Assignment, Draft } from '../../../../packages/types.js';

/**
 * The header of a problem set: what the problem is, when it was last saved, and — only if the
 * tutor cannot reach it yet — what is missing. It never claims Go is listening.
 */
export const GoGuide = ({ assignment, draft }: {
  assignment: Assignment;
  draft: Draft | null;
}) => {
  const source = assignment.materials.find((item) => item.sourceUrl);
  return <section className="pane brief">
    <div className="content">
      <p className="brief-meta">
        <span>{assignment.subject}</span>
        <span>{assignment.materials.length} source{assignment.materials.length === 1 ? '' : 's'}</span>
        <span>{draft ? `work saved ${new Date(draft.updatedAt).toLocaleTimeString()}` : 'no work saved yet'}</span>
        {source?.sourceUrl && <a href={source.sourceUrl} target="_blank" rel="noreferrer">Course page ↗</a>}
      </p>
      <h2 className="brief-title">{assignment.title}</h2>
      <p className="prompt preserve">{assignment.prompt}</p>
      {assignment.materials.map((item) => <details key={item.id}>
        <summary>{item.title}</summary>
        <p className="preserve">{item.text}</p>
        {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open the source ↗</a>}
      </details>)}
      <details className="question-reference"><summary>Question reference</summary><p>SuperTutor assignment ID: <code>{assignment.id}</code></p></details>
    </div>
  </section>;
};
