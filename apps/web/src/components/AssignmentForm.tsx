import { useState } from 'react';
import type { AssignmentInput, Subject } from '../../../../packages/types.js';
import { DEMO_ASSIGNMENT } from '../../../../packages/fixtures.js';

export const AssignmentForm = ({ busy, onCreate, onCancel, onImport }: {
  busy: boolean;
  onCreate: (input: AssignmentInput, demo: boolean) => Promise<void>;
  onCancel?: () => void;
  onImport: () => void;
}) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<Subject>('coding');
  const [prompt, setPrompt] = useState('');
  const [material, setMaterial] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  return <section className="pane brief">
    <header className="pane-head">
      <h2>Start an assignment</h2>
      {onCancel && <button className="link" onClick={onCancel}>Cancel</button>}
    </header>
    <div className="content">
      <p className="prompt">Import an assignment or paste the question below.</p>
      <div className="actions">
        <button onClick={onImport} disabled={busy}>Import from Canvas</button>
        <button disabled={busy} onClick={() => void onCreate(DEMO_ASSIGNMENT, true)}>Load the sample problem</button>
      </div>
    </div>
    <form onSubmit={(event) => {
      event.preventDefault();
      void onCreate({ title, subject, prompt, materials: material.trim() ? [{ title: 'Course excerpt', text: material, ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}) }] : [] }, false);
    }}>
      <label>Assignment title<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Loops and termination" /></label>
      <label>Subject
        <select value={subject} onChange={(event) => setSubject(event.target.value as Subject)}>
          <option value="coding">Coding</option><option value="math">Math</option><option value="writing">Writing</option>
        </select>
      </label>
      <label>Instructions<textarea required maxLength={16000} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Paste the problem or assignment instructions exactly as they were given." /></label>
      <details>
        <summary>Add course material your tutor should use</summary>
        <label>Lecture transcript, notes, or rubric excerpt<textarea maxLength={32000} value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="Paste the passage itself. A video link alone does not give the tutor its contents." /></label>
        <label>Source link<input type="url" maxLength={2000} value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" /></label>
      </details>
      <div className="actions">
        <button className="primary" disabled={busy || !title.trim() || !prompt.trim()}>{busy ? 'Saving…' : 'Create assignment'}</button>
      </div>
    </form>
  </section>;
};
