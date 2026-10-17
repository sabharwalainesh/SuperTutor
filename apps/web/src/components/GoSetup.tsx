import { useId, useState } from 'react';
import { getGoBrowser } from '../lib/go-browser.js';

const STORAGE_KEY = 'supertutor:go-user-confirmed:v1';
const Puzzle = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M9 4V3a3 3 0 0 1 6 0v1h5v5h1a3 3 0 0 1 0 6h-1v5h-5v-1a3 3 0 0 0-6 0v1H4v-5h1a3 3 0 0 0 0-6H4V4z" /></svg>;

export function GoSetup({initiallyExpanded = false, linked = false}: {initiallyExpanded?: boolean; linked?: boolean}) {
  const id = useId();
  const nav = navigator as Navigator & { userAgentData?: { brands: { brand: string }[] }; brave?: unknown };
  const browser = getGoBrowser(nav.userAgent, nav.maxTouchPoints, nav.userAgentData?.brands, Boolean(nav.brave));
  const [confirmed, setConfirmed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'yes'; } catch { return false; }
  });
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [copyStatus, setCopyStatus] = useState('');
  const confirm = (value: boolean) => {
    setConfirmed(value);
    try { if (value) localStorage.setItem(STORAGE_KEY, 'yes'); else localStorage.removeItem(STORAGE_KEY); } catch { /* Setup remains usable with storage disabled. */ }
    window.dispatchEvent(new Event('supertutor-go-confirmation'));
  };
  return <section className={`go-setup ${browser.supported ? '' : 'go-unsupported'}`} aria-label="Superhuman Go browser setup">
    <div className="go-summary">
      <span className="go-icon"><Puzzle /></span>
      <div className="go-summary-copy">
        <strong>{!browser.supported ? 'Use desktop Chrome or Edge for your tutor' : linked ? 'Your Go connection is saved' : confirmed ? 'Go installation confirmed by you' : 'Bring your tutor into your browser'}</strong>
        <p>{!browser.supported ? `${browser.name} is not a confirmed supported browser for the Go extension. You can still work here.${linked ? ' Your account connection is still saved.' : ''}` : linked ? 'No need to reconnect after signing in. Review these steps only to set up the extension on this device.' : confirmed ? `${browser.name} supported. Connect SuperTutor to give your tutor access to saved work.` : `${browser.name} supported. Install Superhuman Go, then connect SuperTutor.`}</p>
      </div>
      <button aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>{expanded ? 'Close setup' : linked ? 'Browser options' : confirmed ? 'Review setup' : 'Set up Go'}</button>
    </div>
    {expanded && <div id={id} className="go-setup-body">
      {browser.supported ? <>
        <div className="toolbar-pointer">
          <span aria-hidden="true" className="pointer-arrow">↗</span>
          <strong>Look for the puzzle piece above this page</strong>
          <p>Open Extensions near the address bar. The position may vary with your toolbar settings.</p>
          <div className="toolbar-demo" aria-label="Illustration of the browser toolbar"><span>Address bar</span><Puzzle /><span>⋮</span></div>
        </div>
        <div>
          <h2>Your tutor, one tab away</h2>
          <ol className="install-steps">
            <li><strong>Install Superhuman Go.</strong> Open the official store below, choose {browser.name === 'Microsoft Edge' ? 'Get' : 'Add to Chrome'}, then confirm Add extension. Already installed? Skip this step.</li>
            <li><strong>Pin it to your toolbar.</strong> Open the puzzle-piece Extensions menu, find Superhuman Go, and choose {browser.name === 'Microsoft Edge' ? 'Show in toolbar' : 'the pin icon'}.</li>
            <li><strong>Open Go and sign in.</strong> Then return here and connect your SuperTutor account under Connect your tutor.</li>
          </ol>
          <div className="actions">
            <a className="button primary" href={browser.storeUrl} target="_blank" rel="noreferrer">Install Go for {browser.name === 'Microsoft Edge' ? 'Edge' : 'Chrome'}</a>
            <button onClick={() => confirm(!confirmed)}>{confirmed ? 'Mark installation unconfirmed' : 'I have installed Go'}</button>
          </div>
          <p className="fineprint" role="status">{confirmed ? 'Your confirmation is saved for this browser. ' : ''}This site cannot inspect your installed extensions. Confirmation does not verify a tutor connection.</p>
        </div>
      </> : <div>
        <h2>Continue your tutoring setup on desktop</h2>
        <p>Superhuman publishes the Go extension for Google Chrome and Microsoft Edge. Open this workspace in either browser, sign in, then follow the Go setup steps. Your saved assignments stay with your account.</p>
        <div className="actions">
          <a className="button primary" href="https://www.google.com/chrome/" target="_blank" rel="noreferrer">Download Chrome</a>
          <a className="button" href="https://www.microsoft.com/edge/download" target="_blank" rel="noreferrer">Download Edge</a>
          <button onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopyStatus('Workspace link copied.'); } catch { setCopyStatus('Copy the workspace URL from your address bar.'); } }}>Copy workspace link</button>
        </div>
        <p role="status" className="fineprint">{copyStatus}</p>
      </div>}
      <a className="go-help" href="https://help.superhuman.com/hc/en-us/articles/46550681421965-Install-the-Superhuman-Go-browser-extension" target="_blank" rel="noreferrer">Official Go installation guide</a>
    </div>}
  </section>;
}
