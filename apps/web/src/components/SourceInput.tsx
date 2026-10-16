import { useState } from 'react';
import { MAX_SOURCE_CHARS } from '../../../../packages/types.js';

type Props = {
  busy: boolean;
  onGenerate: (text: string) => void;
};

const DEMO_TEXT = `Memory decays on a predictable curve. Material reviewed once is mostly gone within days, but each successful recall flattens the curve and buys more time before the next review. That is why spacing beats cramming: a massed review happens while the answer is still in working memory, so nothing has to be reconstructed, and reconstruction is the part that strengthens the memory trace.

This gives the idea of desirable difficulty. A review that feels easy did almost no work. A review that is effortful but still successful does the most. Schedulers exploit this by stretching the interval after each pass and collapsing it sharply after a failure, since a failure means the interval overshot what the learner could hold.`;

export const SourceInput = ({ busy, onGenerate }: Props) => {
  const [text, setText] = useState('');
  const tooLong = text.length > MAX_SOURCE_CHARS;

  return (
    <section className="pane">
      <header className="pane-head">
        <h2>Source material</h2>
        <button className="link" onClick={() => setText(DEMO_TEXT)} disabled={busy}>
          Load demo text
        </button>
      </header>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste lecture notes, a chapter, documentation — anything you need to learn."
        spellCheck={false}
      />

      <footer className="pane-foot">
        <span className={tooLong ? 'count over' : 'count'}>
          {text.length.toLocaleString()} / {MAX_SOURCE_CHARS.toLocaleString()}
        </span>
        <button
          className="primary"
          disabled={busy || tooLong || text.trim().length < 20}
          onClick={() => onGenerate(text)}
        >
          {busy ? 'Building lesson…' : 'Generate lesson'}
        </button>
      </footer>
    </section>
  );
};
