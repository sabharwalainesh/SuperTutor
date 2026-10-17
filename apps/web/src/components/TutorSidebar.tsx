import { useState } from 'react';
import type { Assignment, Draft } from '../../../../packages/types.js';
import { assignmentStarter } from '../lib/workspace-route.js';
import { getGoBrowser } from '../lib/go-browser.js';
import { Icon } from './Icons.js';

export function TutorSidebar({assignment, draft, shared, connected, onConnect}: {
  assignment: Assignment; draft: Draft | null; shared: 'sharing' | 'ready' | 'error'; connected: boolean; onConnect: () => void;
}) {
  const [status, setStatus] = useState('');
  const browser = getGoBrowser(navigator.userAgent, navigator.maxTouchPoints);
  const starter = assignmentStarter(assignment.id, assignment.title);
  return <section className="pane tutor-dock" aria-labelledby="tutor-dock-title">
    <header className="pane-head"><h2 id="tutor-dock-title"><Icon name="spark" size={18}/> Tutor beside you</h2><span className="chip">Go</span></header>
    <div className="content">
      <div className="tutor-current"><span className="tutor-eyebrow">Current question</span><strong>{assignment.title}</strong><span role="status" className="tutor-share-state"><span className={`status-dot ${shared === 'ready' ? '' : 'pending'}`}/>{shared === 'ready' ? 'Available to your Go connector' : shared === 'error' ? 'Could not share — reconnect or reload' : 'Sharing question…'}</span></div>
      {connected ? <>
        <p className="tutor-invitation"><strong>Keep working on your answer.</strong> Your question and saved work are available to Go.</p>
        <p className="fineprint">For automatic hints, add your tutoring agent in Go and enable its automatic while-writing trigger. It can then offer suggestions when it notices a mistake. A connected workspace alone does not activate an agent.</p>
        <details><summary>Ask for help manually</summary>
        <button className="primary tutor-copy" onClick={async () => {
          try { await navigator.clipboard.writeText(starter); setStatus('Copied. Paste into the Go sidebar to begin.'); }
          catch { setStatus('Clipboard unavailable. Use the message below.'); }
        }}><Icon name="spark" size={16}/> Copy starter for this question</button>
        </details>
        <p className="tutor-saved">{draft ? `Saved work · ${new Date(draft.updatedAt).toLocaleTimeString()}` : 'Your question is ready. Add work on the left when you have an attempt.'}</p>
      </> : <><p className="tutor-invitation">Connect Go once to read this question and save hints beside your work.</p><button className="primary tutor-copy" onClick={onConnect}>Connect Go</button></>}
      <p className="fineprint" role="status">{status}</p>
      <details><summary>Where is the Go sidebar?</summary>
        <p>In desktop Chrome or Edge, click the Go tab at the right edge of the page, or open Superhuman Go from the Extensions puzzle piece. Keep this assignment page attached in Go.</p>
        <p>The website cannot open or type into another extension’s sidebar.</p>
        {!browser.supported && <p>Open this question in desktop Chrome or Edge to use the extension.</p>}
        <a href="https://help.superhuman.com/hc/en-us/articles/46550769535117-Superhuman-Go-browser-extension-user-guide" target="_blank" rel="noreferrer">Go sidebar guide ↗</a>
        <p><a href="https://go.superhuman.com/" target="_blank" rel="noreferrer">Use Go in a separate tab ↗</a></p>
      </details>
      <details><summary>Exact question message</summary><p className="starter">{starter}</p></details>
    </div>
  </section>;
}
