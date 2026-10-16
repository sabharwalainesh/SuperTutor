import type { Feedback } from '../../../../packages/types.js';

export const WeakSpots = ({ feedback }: { feedback: Record<string, Feedback> }) => {
  const counts = new Map<string, number>();
  for (const item of Object.values(feedback)) {
    for (const topic of item.missedTopics) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <section className="pane weak">
      <header className="pane-head">
        <h2>Weak spots</h2>
      </header>
      {ranked.length === 0 ? (
        <p className="empty">Answer a few questions and the topics you miss collect here.</p>
      ) : (
        <ul className="weak-list">
          {ranked.map(([topic, count]) => (
            <li key={topic}>
              <span>{topic}</span>
              <span className="badge">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
