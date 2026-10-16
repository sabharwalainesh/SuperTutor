import { useState } from 'react';
import type { AssignmentInput, Subject } from '../../../../packages/types.js';
import { DEMO_ASSIGNMENT } from '../../../../packages/fixtures.js';
export const AssignmentForm = ({ busy, onCreate, onCancel }: { busy: boolean; onCreate: (input: AssignmentInput, demo: boolean) => Promise<void>; onCancel?: () => void }) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<Subject>('coding');
  const [prompt, setPrompt] = useState('');
  const [material, setMaterial] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  return <section className="pane assignment-form">
    <header className="pane-head"><h2>Bring your assignment</h2>{onCancel && <button className="link" onClick={onCancel}>Cancel</button>}</header>
    <form onSubmit={(event) => {
      event.preventDefault();
      void onCreate({ title, subject, prompt, materials: material.trim() ? [{ title: 'Course excerpt', text: material, ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}) }] : [] }, false);
    }}>
      <label>Assignment title<input required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="For example: loops and termination" /></label>
      <label>Subject<select value={subject} onChange={(e) => setSubject(e.target.value as Subject)}><option value="coding">Coding</option><option value="math">Math</option><option value="writing">Writing</option></select></label>
      <label>Instructions<textarea required maxLength={16000} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Paste the actual problem or assignment instructions." /></label>
      <details><summary>Add course context (optional)</summary>
        <label>Lecture transcript, notes, or rubric excerpt<textarea maxLength={32000} value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Paste an accessible excerpt. A video link alone does not provide its contents." /></label>
        <label>Source link<input type="url" maxLength={2000} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" /></label>
      </details>
      <div className="actions"><button className="primary" disabled={busy || !title.trim() || !prompt.trim()}>{busy ? 'Saving…' : 'Create workspace'}</button>
        <button type="button" disabled={busy} onClick={() => void onCreate(DEMO_ASSIGNMENT, true)}>Try the sample assignment</button></div>
    </form>
  </section>;
};
