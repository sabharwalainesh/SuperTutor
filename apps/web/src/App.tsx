import { TutorSidebar } from './components/TutorSidebar.js';
import { TutorOffer } from './components/TutorOffer.js';
import { workspaceRoute, type View } from './lib/workspace-route.js';
import { goConnection } from './lib/go-connection.js';
import { GoOnboarding } from './components/GoOnboarding.js';
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import type { Account, Assignment, AssignmentContext, AssignmentInput, DeploymentConfig, ProgressSummary, WorkInput } from '../../../packages/types.js';
import { DEMO_WORK } from '../../../packages/fixtures.js';
import { EditorBoundary } from './components/EditorBoundary.js';
import { AssignmentForm } from './components/AssignmentForm.js';
import { ConnectGo } from './components/ConnectGo.js';
import { CourseSources } from './components/CourseSources.js';
import { GoSetup } from './components/GoSetup.js';
import { GoGuide } from './components/GoGuide.js';
import { ProgressPanel } from './components/ProgressPanel.js';
import { Landing } from './components/Landing.js';
import { Dashboard } from './components/Dashboard.js';
import { Icon, Logo } from './components/Icons.js';
import { ThemeToggle } from './components/ThemeToggle.js';
import { StudyPractice } from './components/StudyPractice.js';
import { ApiError, createAssignment, getAccount, getConfig, getContext, getProgress, listAssignments, saveDraft, shareOpenAssignment, signOut } from './lib/api.js';

// Monaco is several megabytes, so it loads when a student actually opens an assignment.
const WorkEditor = lazy(() => import('./components/WorkEditor.js').then((module) => ({ default: module.WorkEditor })));

export const App = () => {
  const [account, setAccount] = useState<Account | null>(null);
  const [config, setConfig] = useState<DeploymentConfig | null>(null);
  const [checking, setChecking] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeId, setActiveId] = useState('');
  const [view, updateView] = useState<View>(() => workspaceRoute(window.location.hash).view);
  const setView = (next: View, id = activeId) => { window.location.hash = next === 'work' && id ? `work/${id}` : next; updateView(next); };
  useEffect(() => {
    const sync = () => {
      const route = workspaceRoute(window.location.hash);
      updateView(route.view);
      if (route.assignmentId && assignments.length) {
        if (assignments.some(item => item.id === route.assignmentId)) setActiveId(route.assignmentId);
        else { setError('That question is not in your workspace.'); setView('home'); }
      }
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [assignments]);
  const [context, setContext] = useState<AssignmentContext | null>(null);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(()=>new URLSearchParams(window.location.search).get('canvas_error')??'');
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // A session cookie survives a reload, so ask the server who is signed in before rendering.
  useEffect(() => {
    let canceled = false;
    void getConfig().then((value) => { if (!canceled) setConfig(value); }).catch(() => { /* Links are optional. */ });
    getAccount()
      .then((value) => { if (!canceled) setAccount(value); })
      .catch(() => { /* Not signed in is the normal case here. */ })
      .finally(() => { if (!canceled) setChecking(false); });
    return () => { canceled = true; };
  }, []);

  // Go authenticates independently. Refresh its token-use metadata without asking for setup again.
  useEffect(() => {
    if (!account) return;
    let canceled = false;
    let running = false;
    const refresh = async () => {
      if (document.hidden || running) return;
      running = true;
      try {
        const latest = await getAccount();
        if (!canceled) setAccount(current => current?.id === latest.id && JSON.stringify(current) !== JSON.stringify(latest) ? latest : current);
      } catch (problem) {
        if (!canceled && problem instanceof ApiError && problem.status === 401) { setAccount(null); setError('Your session expired. Sign in again.'); }
      } finally { running = false; }
    };
    const timer = setInterval(() => void refresh(), 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { canceled = true; clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [account?.id]);

  const handleFailure = useCallback((problem: unknown, fallback: string) => {
    if (problem instanceof ApiError && problem.status === 401) { setAccount(null); setError('Your session expired. Sign in again.'); return; }
    setError(problem instanceof Error ? problem.message : fallback);
  }, []);

  useEffect(() => {
    if (!account) { setAssignments([]); setActiveId(''); setContext(null); setProgress(null); return; }
    let canceled = false;
    setLoadingAssignments(true);
    listAssignments()
      .then(({ assignments: items }) => {
        if (canceled) return;
        setAssignments(items);
        let recent = ''; try { recent = localStorage.getItem(`supertutor.active.${account.id}`) ?? ''; } catch { /* Preference only. */ }
        const linked = workspaceRoute(window.location.hash).assignmentId;
        if (linked && !items.some(item => item.id === linked)) {
          setError('That question is not in your workspace.'); setView('home');
        }
        setActiveId(items.find(item => item.id === linked)?.id ?? (items.some(item=>item.id===recent) ? recent : items[0]?.id ?? ''));
        try { const pending = sessionStorage.getItem('supertutor.after-auth'); if(pending === 'sources') { setView('sources'); sessionStorage.removeItem('supertutor.after-auth'); } } catch { /* Optional navigation. */ }
      })
      .catch((problem) => { if (!canceled) handleFailure(problem, 'Could not load your assignments.'); })
      .finally(() => { if (!canceled) setLoadingAssignments(false); });
    return () => { canceled = true; };
  }, [account?.id, handleFailure]);

  const [handoff, setHandoff] = useState<'sharing' | 'ready' | 'error'>('sharing');
  useEffect(() => {
    if (view !== 'work' || !activeId || !account) return;
    let canceled = false;
    setHandoff('sharing');
    const share = async () => {
      if (document.hidden) return;
      try { await shareOpenAssignment(activeId); if (!canceled) setHandoff('ready'); }
      catch { if (!canceled) setHandoff('error'); }
    };
    void share();
    const timer = setInterval(() => void share(), 60_000);
    window.addEventListener('focus', share);
    document.addEventListener('visibilitychange', share);
    return () => { canceled = true; clearInterval(timer); window.removeEventListener('focus', share); document.removeEventListener('visibilitychange', share); };
  }, [view, activeId, account?.id]);
  useEffect(() => {
    document.title = view === 'work' && context?.assignment.id === activeId ? `${context.assignment.title} | SuperTutor` : 'SuperTutor — Make it click';
  }, [view, context?.assignment.title, activeId]);

  // Go writes attempts and feedback through its own connector, so poll for what it saved.
  useEffect(() => {
    setContext(null); setProgress(null);
    if (!activeId || !account) return;
    let canceled = false;
    let running = false;
    const refresh = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        const [nextContext, nextProgress] = await Promise.all([getContext(activeId), getProgress(activeId)]);
        if (!canceled) { setContext(nextContext); setProgress(nextProgress); }
      } catch (problem) { if (!canceled) handleFailure(problem, 'Could not refresh the margin.'); }
      finally { running = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 3_000);
    return () => { canceled = true; clearInterval(timer); };
  }, [activeId, account?.id, handleFailure]);

  const handleCreate = async (input: AssignmentInput, demo: boolean) => {
    setBusy(true); setError('');
    try {
      const assignment = await createAssignment(input);
      if (demo) await saveDraft(assignment.id, DEMO_WORK);
      adopt(assignment);
    } catch (problem) { handleFailure(problem, 'Could not create the assignment.'); }
    finally { setBusy(false); }
  };
  const adopt = (assignment: Assignment) => {
    setAssignments((previous) => [assignment, ...previous.filter((item) => item.id !== assignment.id)]);
    setActiveId(assignment.id);
    setView('work', assignment.id);
  };
  const handleSave = (input: WorkInput) => saveDraft(activeId, input).then(() => undefined);
  const handleSignOut = async () => {
    try { await signOut(); setAccount(null); setView('home'); } catch (problem) { handleFailure(problem, 'Could not sign out. Please try again.'); }
  };

  if (checking) return <main className="auth"><section className="pane auth-sheet"><div className="content" role="status">Opening your workspace…</div></section></main>;
  if (!account) return <><GoOnboarding autoPrompt={false}/><Landing initialError={error} onAuthenticated={(value) => { setError(''); setAccount(value); }} /></>;

  const connected = goConnection(account).linked;
  const openAssignment = (id: string) => { setActiveId(id); setView('work', id); try { localStorage.setItem(`supertutor.active.${account.id}`,id); } catch { /* Preference only. */ } };
  return <div className="app">
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <aside className="app-sidebar">
      <button className="logo-link" onClick={() => setView('home')} aria-label="SuperTutor home"><Logo /></button>
      <button className="primary new-assignment" onClick={() => setView('new')}><Icon name="plus" size={18}/> New assignment</button>
      <nav className="workspace-nav" aria-label="Workspace navigation">
        {([{id:'home', label:'Overview', icon:'grid'},{id:'work',label:'My assignments',icon:'book'},{id:'study',label:'Study & practice',icon:'spark'},{id:'sources',label:'Canvas & bCourses',icon:'download'},{id:'connect',label:'Connect your tutor',icon:'spark'}] as const).map(item => <button key={item.id} aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}><Icon name={item.icon} size={19}/>{item.label}{item.id === 'work' && <span className="nav-count">{assignments.length}</span>}</button>)}
      </nav>
      {assignments.length > 0 && <div className="recent-list"><p>Recent work</p>{assignments.slice(0,4).map(a => <button key={a.id} className={view==='work'&&activeId===a.id?'active':''} onClick={()=>openAssignment(a.id)}><span className={`subject-dot ${a.subject}`}/><span>{a.title}</span></button>)}</div>}
      <div className="sidebar-bottom"><div className="sidebar-tip"><Icon name="spark"/><strong>A hint can change everything.</strong><p>Your tutor is ready to meet your thinking.</p><button className="link" onClick={()=>setView('connect')}>{connected ? 'Go connection settings' : 'Set up Superhuman Go'}</button></div><div className="sidebar-account"><span className="account-avatar">{(account.displayName??account.email)[0].toUpperCase()}</span><span className="account-email">{account.displayName??account.email}</span><button className="icon-button" aria-label="Sign out" onClick={()=>void handleSignOut()}><Icon name="logout" size={18}/></button></div></div>
    </aside>
    <div className="app-main">
      <header className="workspace-topbar"><span>{view==='sources'?'Canvas & bCourses':view==='connect'?'Tutor setup':view==='study'?'Study & practice':view==='new'?'New assignment':view==='work'?'Assignment workspace':'Overview'}</span><div className="header-actions"><span className="connection-status"><span className={connected?'status-dot':'status-dot pending'}/>{connected?'Go connection saved':'Tutor setup'}</span><ThemeToggle/><button className="icon-button mobile-signout" aria-label="Sign out" onClick={()=>void handleSignOut()}><Icon name="logout" size={18}/></button><button className="icon-button" aria-label="Help with tutor setup" onClick={()=>setView('connect')}><Icon name="help"/></button></div></header>
      <GoOnboarding linked={connected}/>
      <main className="workspace" id="workspace">
        {error && <div className="banner error" role="alert"><span>{error}</span><button className="link" onClick={()=>setError('')}>Dismiss</button></div>}
        {view === 'home' ? <Dashboard assignments={assignments} loading={loadingAssignments} onOpen={openAssignment} onNew={()=>setView('new')} onCanvas={()=>setView('sources')} onStudy={()=>setView('study')}/> : view === 'study' ? <StudyPractice accountId={account.id} connected={connected} onConnect={()=>setView('connect')}/> : <>
        {view !== 'work' && <div className="workspace-heading"><h1>{view==='sources'?'Your courses, right here.':view==='connect'?'Meet your study partner.':'Bring your next challenge.'}</h1></div>}
        {view === 'connect' && <GoSetup linked={connected}/>}
        {view === 'connect'
          ? <ConnectGo account={account} config={config} onAccountChange={setAccount} onClose={() => setView(activeId ? 'work' : 'home')} />
          : view === 'sources'
            ? <CourseSources onImported={adopt} onClose={() => setView('home')} />
            : view === 'new' || !activeId
              ? <AssignmentForm busy={busy} onCreate={handleCreate} onImport={() => setView('sources')} onCancel={() => setView('home')} />
              : !context
                ? <section className="pane"><div className="content" role="status">Opening the assignment…</div></section>
                : <>
                  <TutorOffer key={activeId} feedback={context.feedback}/>
                  <div className="work-columns">
                    <div className="col">
                  <GoGuide
                    assignment={context.assignment}
                    draft={context.draft}
                  />
                      <EditorBoundary key={activeId}><Suspense fallback={<section className="pane"><div className="editor-loading" role="status">Loading the editor…</div></section>}>
                        <WorkEditor key={activeId} context={context} onSave={handleSave} />
                      </Suspense></EditorBoundary>
                    </div>
                    <aside className="tutor-column" aria-label="Tutor sidebar">
                      <TutorSidebar key={activeId} assignment={context.assignment} draft={context.draft} shared={handoff} connected={connected} onConnect={() => setView('connect')} />
                      <ProgressPanel context={context} progress={progress} />
                    </aside>
                  </div>
                </>}
        </>}
      </main>
    </div>
  </div>;
};
