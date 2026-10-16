import { useEffect, useState } from 'react';
import type { AssignmentContext, WorkInput } from '../../../../packages/types.js';
export const WorkEditor = ({ context, onSave }: { context: AssignmentContext; onSave: (input: WorkInput) => Promise<void> }) => {
  const key = `supertutor.unsaved.${context.assignment.id}`;
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved && typeof saved.work === 'string' && typeof saved.question === 'string' && typeof saved.errorOutput === 'string' && saved.updatedAt > (context.draft?.updatedAt ?? 0) && (saved.work !== context.draft?.work || saved.question !== (context.draft?.question ?? '') || saved.errorOutput !== (context.draft?.errorOutput ?? ''))) return saved as WorkInput;
    } catch { /* Local recovery is optional; the API remains authoritative. */ }
    return context.draft;
  });
  const [work, setWork] = useState(initial?.work ?? '');
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [errorOutput, setErrorOutput] = useState(initial?.errorOutput ?? '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(initial !== context.draft ? 'Recovered local work — save to share this version with Go.' : '');
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ work, question, errorOutput, updatedAt: Date.now() })); } catch { /* Keep editing when browser storage is unavailable. */ }
  }, [key, work, question, errorOutput]);
  const edited = () => setStatus('Unsaved changes — save before asking Go about this version.');
  return <section className="pane">
    <header className="pane-head"><h2>Your work</h2><span className="chip">{context.assignment.subject}</span></header>
    <form onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setStatus('');
      try { await onSave({ work, question, errorOutput }); setStatus('Saved. SuperTutor can read this version in Go.'); try { localStorage.removeItem(key); } catch { /* Recovery only. */ } }
      catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save.'); }
      finally { setBusy(false); }
    }}>
      <label>Current code, math steps, or draft<textarea className={context.assignment.subject === 'coding' ? 'code-editor' : 'work-editor'} required disabled={busy} maxLength={16000} value={work} onChange={(e) => { setWork(e.target.value); edited(); }} spellCheck={context.assignment.subject !== 'coding'} placeholder="Start with what you have tried, even if it is incomplete." /></label>
      <label>Where are you stuck?<input disabled={busy} maxLength={2000} value={question} onChange={(e) => { setQuestion(e.target.value); edited(); }} placeholder="What do you want to understand?" /></label>
      <label>Error or unexpected result (optional)<textarea className="short" disabled={busy} maxLength={8000} value={errorOutput} onChange={(e) => { setErrorOutput(e.target.value); edited(); }} /></label>
      <div className="actions"><button className="primary" disabled={busy || !work.trim()}>{busy ? 'Saving…' : 'Save current work'}</button><span className="muted" role="status">{status || 'Your work stays here. Teaching happens in Go.'}</span></div>
    </form>
  </section>;
};
