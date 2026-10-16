import { useEffect, useState } from 'react';
import type { Assignment, AssignmentContext, AssignmentInput, ProgressSummary, WorkInput } from '../../../packages/types.js';
import { DEMO_WORK } from '../../../packages/fixtures.js';
import { AssignmentForm } from './components/AssignmentForm.js';
import { WorkEditor } from './components/WorkEditor.js';
import { ProgressPanel } from './components/ProgressPanel.js';
import { GoGuide } from './components/GoGuide.js';
import { createAssignment, getContext, getProgress, listAssignments, saveDraft } from './lib/api.js';

export const App = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeId, setActiveId] = useState('');
  const [context, setContext] = useState<AssignmentContext | null>(null);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let canceled = false;
    listAssignments().then(({ assignments: items }) => {
      if (canceled) return;
      setAssignments(items); setActiveId(items[0]?.id ?? '');
    }).catch((e) => { if (!canceled) setError(e.message); }).finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, []);
  useEffect(() => {
    setContext(null); setProgress(null);
    if (!activeId) return;
    let canceled = false;
    let running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const [nextContext, nextProgress] = await Promise.all([getContext(activeId), getProgress(activeId)]);
        if (!canceled) { setContext(nextContext); setProgress(nextProgress); }
      } catch (e) { if (!canceled) setError(e instanceof Error ? e.message : 'Could not refresh progress.'); }
      finally { running = false; }
    };
    void refresh(); const timer = setInterval(() => void refresh(), 2500);
    return () => { canceled = true; clearInterval(timer); };
  }, [activeId]);
  const handleCreate = async (input: AssignmentInput, demo: boolean) => {
    setBusy(true); setError('');
    try {
      const assignment = await createAssignment(input);
      if (demo) await saveDraft(assignment.id, DEMO_WORK);
      setAssignments((previous) => [assignment, ...previous]); setActiveId(assignment.id); setCreating(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create workspace.'); }
    finally { setBusy(false); }
  };
  const handleSave = (input: WorkInput) => saveDraft(activeId, input).then(() => undefined);
  return <div className="app">
    <header className="topbar"><div><h1>SuperTutor</h1><span className="muted">Your work here. Your tutor in Go.</span></div><button onClick={() => setCreating(true)}>New assignment</button></header>
    {error && <div className="banner error" role="alert"><span>{error}</span><button className="link" onClick={() => setError('')}>Dismiss</button></div>}
    <main className="layout">
      <aside className="sidebar"><h2>Your assignments</h2>{assignments.map((assignment) => <button className={`assignment-link ${assignment.id === activeId && !creating ? 'selected' : ''}`} key={assignment.id} onClick={() => { setCreating(false); setActiveId(assignment.id); }}><strong>{assignment.title}</strong><span>{assignment.subject}</span></button>)}<p className="fineprint">Only materials you save or explicitly connect are available to the tutor.</p></aside>
      <div className="workspace">
        {loading ? <section className="pane content" role="status">Loading your workspace…</section> : creating || !activeId ? <AssignmentForm busy={busy} onCreate={handleCreate} onCancel={activeId ? () => setCreating(false) : undefined} /> : !context ? <section className="pane content" role="status">Loading assignment…</section> : <>
          <GoGuide title={context.assignment.title} id={activeId} />
          <div className="work-columns"><div className="col"><section className="pane"><header className="pane-head"><h2>{context.assignment.title}</h2></header><div className="content"><p className="preserve">{context.assignment.prompt}</p>{context.assignment.materials.map((material) => <details key={material.id}><summary>{material.title}</summary><p className="preserve">{material.text}</p>{material.sourceUrl && <a href={material.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>}</details>)}</div></section><WorkEditor key={activeId} context={context} onSave={handleSave} /></div><ProgressPanel context={context} progress={progress} /></div>
        </>}
      </div>
    </main>
  </div>;
};
