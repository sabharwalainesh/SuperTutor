import { useEffect, useRef, useState } from 'react';
import type { Account } from '../../../../packages/types.js';
import { SignIn } from './SignIn.js';
import { Icon, Logo } from './Icons.js';
import { ThemeToggle } from './ThemeToggle.js';
import { GoSetup } from './GoSetup.js';

const examples = {
  coding: { label: 'Coding', title: 'A loop that never ends', file: 'loops.py', work: 'def sum_to(n):\n    total = 0\n    i = 1\n    while i <= n:\n        total += i\n    return total', question: 'What happens to i after the first pass through your loop?', note: 'Your starting values look right. Trace one iteration before changing anything.' },
  math: { label: 'Math', title: 'Finding the missing step', file: 'my-reasoning.txt', work: 'Solve: 2(x + 3) = 14\n\nMy attempt:\n2x + 3 = 14\n2x = 11\nx = 5.5', question: 'When you expand 2(x + 3), which terms does the 2 multiply?', note: 'Let’s look at the first line of your working. Try drawing two groups of (x + 3).' },
  writing: { label: 'Writing', title: 'An argument with a point', file: 'essay-draft.md', work: 'Public libraries matter.\n\nThey offer books and computers.\nMany people use them every day.\nCities should fund them.', question: 'Who benefits from those computers, and why might that strengthen your argument?', note: 'You have a clear position. Choose one specific example to connect your evidence to it.' },
};
export function Landing({ onAuthenticated, initialError = '' }: {onAuthenticated: (account: Account) => void;initialError?:string}) {
  const [subject, setSubject] = useState<keyof typeof examples>('coding');
  const [mode, setMode] = useState<'signin'|'signup'>('signup');
  const dialog = useRef<HTMLDialogElement>(null);
  const example = examples[subject];
  const open = (next: typeof mode) => { setMode(next); document.body.style.overflow = 'hidden'; dialog.current?.showModal(); };
  useEffect(() => { if(initialError){setMode('signin');document.body.style.overflow='hidden';dialog.current?.showModal();} return () => { document.body.style.overflow = ''; }; }, []);
  return <div className="landing">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><a href="#main" className="logo-link" aria-label="SuperTutor home"><Logo /></a>
      <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#canvas">Canvas integration</a><a href="#faq">FAQ</a></nav>
      <div className="header-actions"><ThemeToggle/><button className="quiet" onClick={() => open('signin')}>Log in</button><button className="primary" onClick={() => open('signup')}>Get started <Icon name="arrow" size={16}/></button></div>
    </header>
    <main id="main">
      <section className="hero">
        <div className="hero-copy"><span className="hero-badge"><span/> Your coursework. Your thinking. A little help.</span>
          <h1>Less stuck.<br/>More <span className="understanding">“I get it.”<svg viewBox="0 0 460 24" preserveAspectRatio="none" aria-hidden="true"><path d="M4 16Q210-7 455 10M50 22Q230 4 410 18"/></svg></span></h1>
          <p>Bring your coursework. Meet your next breakthrough.</p>
          <div className="hero-actions"><button className="primary large" onClick={() => open('signup')}>Start learning <Icon name="arrow"/></button><a className="button quiet large" href="#live-example">Explore an example <span aria-hidden="true">↘</span></a></div>
          <div className="hero-footnote"><Icon name="check" size={16}/> Coding, math, and writing <span>Powered by Superhuman Go</span></div>
        </div>
        <div className="study-scene" id="live-example">
          <div className="scene-label"><span className="status-dot"/> A little look inside <span>Interactive example</span></div>
          <div className="example-tabs" role="group" aria-label="Example subject">{Object.entries(examples).map(([key,value]) => <button key={key} aria-pressed={subject === key} onClick={() => setSubject(key as keyof typeof examples)}><Icon name={key === 'coding' ? 'code' : key === 'math' ? 'math' : 'pen'} size={16}/>{value.label}</button>)}</div>
          <div className="example-work"><div className="example-file"><span>{example.file}</span><span>Your attempt</span></div><h2>{example.title}</h2><pre>{example.work}</pre></div>
          <div className="example-feedback" aria-live="polite"><span className="tutor-avatar"><Icon name="spark"/></span><div><div className="feedback-title">SuperTutor <span>A hint, not the answer</span></div><p>{example.question}</p><small>{example.note}</small></div></div>
          <div className="scene-footer"><span>Think it through. Try again.</span><span>Sample content</span></div>
        </div>
      </section>
      <div className="subject-strip"><span>Built for the work on your desk</span><strong><Icon name="code"/> Code that makes sense</strong><strong><Icon name="math"/> Math you can explain</strong><strong><Icon name="pen"/> Writing in your voice</strong></div>
      <section className="how-section" id="how-it-works"><div className="section-heading"><span className="section-kicker">A better study loop</span><h2>From blank page<br/>to your next breakthrough.</h2><p>You do the learning. SuperTutor helps you keep moving.</p></div>
        <div className="journey">{[['01','Bring the real assignment','Import from Canvas. Or paste your notes.'],['02','Show your thinking','Write code. Work a problem. Start a draft.'],['03','Find your next step','Ask for a hint. Practice. Try again.']].map(([n,t,d]) => <article key={n}><span className="journey-number">{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div>
      </section>
      <section className="canvas-section" id="canvas"><div className="canvas-art" aria-hidden="true"><div className="canvas-emblem">C</div><span className="connection-line"/><span className="canvas-destination"><Icon name="spark" size={38}/></span><div className="import-slip"><Icon name="check"/><div><strong>Your assignment, ready to work on</strong><span>Instructions · Due date · Source link</span></div></div></div><div><span className="section-kicker">Canvas & bCourses</span><h2>Your courses.<br/>Already part of the picture.</h2><p>Choose your course. Import the assignment. Get straight to the good part.</p><button className="primary" onClick={() => { try { sessionStorage.setItem('supertutor.after-auth','sources'); } catch { /* Optional navigation. */ } open('signup'); }}>Connect Canvas <Icon name="arrow" size={17}/></button><p className="fineprint">Connect with your school. Never submits work or reads grades.</p></div></section>
      <section className="faq-section" id="faq"><div><span className="section-kicker">Good questions</span><h2>A few things<br/>before you begin.</h2></div><div className="faq-list"><details><summary>Will SuperTutor do my homework?</summary><p>No. It asks diagnostic questions, explains concepts, and offers hints. You write the work and decide what to try next.</p></details><details><summary>Where is my tutor?</summary><p>Your tutor lives in Superhuman Go. This website holds your assignments, saves your work, and displays the feedback your tutor records. Set up Go and the SuperTutor connector from your workspace.</p></details><details><summary>Can I use Canvas or Berkeley bCourses?</summary><p>Choose your school under Sign in with Canvas. Once your school enables sign-in, your account connects automatically. You can also sign in with email and connect a Canvas access token. Then choose a course and import an assignment.</p></details><details><summary>What if I do not use Canvas?</summary><p>Create an assignment manually. Paste its instructions and add a course excerpt, lecture transcript, or rubric. You can also try the sample assignment.</p></details><details><summary>Which browsers work with Go?</summary><p>Use desktop Chrome or Edge for the Go extension. You can still save work in other browsers. The setup guide helps you install Go and pin it to your browser.</p></details></div></section>
      <section className="closing-cta"><Icon name="spark" size={32}/><h2>Bring the question.<br/>Leave with a next step.</h2><button className="primary large" onClick={() => open('signup')}>Create your workspace <Icon name="arrow"/></button></section>
      <section className="landing-go" aria-label="Browser compatibility"><GoSetup/></section>
    </main>
    <footer className="site-footer"><Logo/><span>Built for understanding. Designed around you.</span><a href="#faq">Help & FAQ</a></footer>
    <dialog ref={dialog} onClose={()=>{document.body.style.overflow='';}} className="auth-dialog" aria-label={mode === 'signup' ? 'Create your account' : 'Sign in'} onClick={(event) => { if(event.target === dialog.current) dialog.current?.close(); }}><button className="dialog-close icon-button" aria-label="Close sign in" onClick={() => dialog.current?.close()}><Icon name="close"/></button><SignIn key={mode} initialMode={mode} initialError={initialError} onAuthenticated={onAuthenticated}/></dialog>
  </div>;
}
