import type { Lesson } from '../../../../packages/types.js';

export const LessonView = ({ lesson }: { lesson: Lesson }) => (
  <section className="pane">
    <header className="pane-head">
      <h2>{lesson.sourceTitle}</h2>
    </header>

    <div className="scroll">
      <h3>Summary</h3>
      <ul className="bullets">
        {lesson.summary.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>

      <h3>Concepts</h3>
      <div className="chips">
        {lesson.concepts.map((concept) => (
          <span className="chip" key={concept}>
            {concept}
          </span>
        ))}
      </div>
    </div>
  </section>
);
