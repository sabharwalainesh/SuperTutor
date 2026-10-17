import Editor from '@monaco-editor/react';
import { useEffect, useRef, useState } from 'react';
import type { AssignmentContext, WorkInput } from '../../../../packages/types.js';
import { CODE_LANGUAGES, EDITOR_OPTIONS, editorTheme, type CodeLanguage } from '../lib/monaco.js';

const AUTOSAVE_DELAY_MS = 4_000;

export const WorkEditor = ({ context, onSave }: { context: AssignmentContext; onSave: (input: WorkInput) => Promise<void> }) => {
  const { subject, id: assignmentId } = { subject: context.assignment.subject, id: context.assignment.id };
  const key = `supertutor.unsaved.${assignmentId}`;
  const languageKey = `supertutor.language.${assignmentId}`;
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved && typeof saved.work === 'string' && typeof saved.question === 'string' && typeof saved.errorOutput === 'string' && saved.updatedAt > (context.draft?.updatedAt ?? 0) && (saved.work !== context.draft?.work || saved.question !== (context.draft?.question ?? '') || saved.errorOutput !== (context.draft?.errorOutput ?? ''))) return saved as WorkInput;
    } catch { /* Local recovery is optional; the API remains authoritative. */ }
    return context.draft;
  });
  const [language, setLanguage] = useState<CodeLanguage>(() => {
    try {
      const saved = localStorage.getItem(languageKey);
      if (saved && (CODE_LANGUAGES as readonly string[]).includes(saved)) return saved as CodeLanguage;
    } catch { /* Fall through to the default. */ }
    return 'python';
  });
  const [theme, setTheme] = useState(editorTheme);
  // Go's while-writing trigger needs a real editable field. Monaco virtualizes
  // its text, so keep it available as an opt-in rather than the default.
  const [advancedEditor, setAdvancedEditor] = useState(false);
  useEffect(() => { const update = () => setTheme(editorTheme()); window.addEventListener('supertutor-theme', update); return () => window.removeEventListener('supertutor-theme', update); }, []);
  const [work, setWork] = useState(initial?.work ?? '');
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [errorOutput, setErrorOutput] = useState(initial?.errorOutput ?? '');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(initial !== context.draft);
  const [status, setStatus] = useState(initial !== context.draft ? 'Recovered local work — save to share this version with Go.' : '');
  const latest = useRef({ work, question, errorOutput });
  latest.current = { work, question, errorOutput };

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ work, question, errorOutput, updatedAt: Date.now() })); } catch { /* Keep editing when browser storage is unavailable. */ }
  }, [key, work, question, errorOutput]);
  useEffect(() => {
    try { localStorage.setItem(languageKey, language); } catch { /* Preference only. */ }
  }, [languageKey, language]);

  const save = async (manual: boolean) => {
    const snapshot = latest.current;
    if (!snapshot.work.trim()) return;
    setBusy(true); if (manual) setStatus('');
    try {
      await onSave(snapshot);
      const unchanged = latest.current.work === snapshot.work && latest.current.question === snapshot.question && latest.current.errorOutput === snapshot.errorOutput;
      setDirty(!unchanged);
      setStatus(unchanged ? (manual ? 'Saved. Your tutor can read this version in Go.' : `Autosaved at ${new Date().toLocaleTimeString()}. Your tutor reads this version.`) : 'Saving your latest changes…');
      if (unchanged) try { localStorage.removeItem(key); } catch { /* Recovery only. */ }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save.');
    } finally { setBusy(false); }
  };

  // Autosave so the version Go reads is the version on screen, without the student remembering to save.
  useEffect(() => {
    if (!dirty || busy) return;
    const timer = setTimeout(() => void save(false), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [dirty, busy, work, question, errorOutput]);

  const edited = () => { setDirty(true); setStatus('Unsaved changes…'); };
  const coding = subject === 'coding';
  return <section className="pane">
    <header className="pane-head">
      <h2>Your work</h2>
      <div className="head-actions">
        <button type="button" className="link" aria-pressed={advancedEditor} onClick={() => setAdvancedEditor(value => !value)}>{advancedEditor ? 'Use Go-compatible editor' : 'Use advanced editor'}</button>
        <span className="chip">{subject}</span>
        {coding && <label className="inline-select">Language
          <select value={language} disabled={busy} onChange={(event) => setLanguage(event.target.value as CodeLanguage)}>
            {CODE_LANGUAGES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>}
      </div>
    </header>
    <form onSubmit={(event) => { event.preventDefault(); void save(true); }}>
      <div className="editor-shell">
        {advancedEditor ? <Editor
          height="340px"
          language={coding ? language : subject === 'writing' ? 'markdown' : 'plaintext'}
          theme={theme}
          value={work}
          options={{ ...EDITOR_OPTIONS, readOnly: busy }}
          onChange={(value) => { setWork(value ?? ''); edited(); }}
          loading={<div className="editor-loading">Loading the editor…</div>}
        /> : <textarea
          className={`go-work-editor ${coding ? 'code-work' : ''}`}
          aria-label="Your answer"
          name="student-answer"
          value={work}
          spellCheck
          onChange={(event) => { setWork(event.target.value); edited(); }}
          placeholder="Work through your answer here. Go can offer suggestions as you write."
        />}
      </div>
      <p className="fineprint">{advancedEditor ? 'Go may not detect typing in the advanced editor. Switch back for inline coaching.' : 'For automatic suggestions, enable Obsidian Artisan in the Go extension on this site. Suggestions appear inline; Go controls its own sidebar.'}</p>
      <details>
        <summary>Add context (optional)</summary>
        <label>Note for your tutor<input disabled={busy} maxLength={2000} value={question} onChange={(event) => { setQuestion(event.target.value); edited(); }} placeholder="Anything else your tutor should know" /></label>
        <label>Error or unexpected result (optional)<textarea className="short" disabled={busy} maxLength={8000} value={errorOutput} onChange={(event) => { setErrorOutput(event.target.value); edited(); }} placeholder="Paste the real error or the output you did not expect." /></label>
      </details>
      <div className="actions">
        <button className="primary" disabled={busy || !work.trim() || !dirty}>{busy ? 'Saving…' : dirty ? 'Save my work' : 'Saved'}</button>
        <span className={`save-state ${dirty ? 'unsaved' : ''}`} role="status">{status || 'Saved work is what your tutor reads.'}</span>
      </div>
    </form>
  </section>;
};
