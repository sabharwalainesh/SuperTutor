import { useState } from 'react';
import type { Account, DeploymentConfig } from '../../../../packages/types.js';
import { createConnectorToken, revokeConnectorToken } from '../lib/api.js';
import { goConnection } from '../lib/go-connection.js';

const CopyButton = ({ value, label = 'Copy' }: { value: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); } catch { setCopied(false); }
  }}>{copied ? 'Copied' : label}</button>;
};

export const ConnectGo = ({ account, config, onAccountChange, onClose }: {
  account: Account;
  config: DeploymentConfig | null;
  onAccountChange: (account: Account) => void;
  onClose: () => void;
}) => {
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endpoint = config?.mcpEndpoint ?? `${window.location.origin}/mcp`;
  const agentDirectory = config?.agentDirectoryUrl ?? 'https://go.superhuman.com/agent-directory';
  const published = config?.connectorPublished ?? false;
  const host = new URL(endpoint).hostname;
  const local = /^(localhost|127\.0\.0\.1)$/.test(host);
  const connection = goConnection(account);
  const lastUse = Math.max(0, ...account.connectors.filter(token => token.expiresAt > Date.now()).map(token => token.lastUsedAt ?? 0));
  const issue = async () => {
    setBusy(true); setError('');
    try {
      const issued = await createConnectorToken('Superhuman Go');
      setSecret(issued.secret);
      onAccountChange({ ...account, connectors: [...account.connectors, issued.token] });
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not create a token.'); }
    finally { setBusy(false); }
  };
  const revoke = async (id: string) => {
    setBusy(true); setError('');
    try { onAccountChange(await revokeConnectorToken(id)); setSecret(''); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not revoke that token.'); }
    finally { setBusy(false); }
  };
  return <section className="pane brief">
    <header className="pane-head">
      <h2>Connect your tutor</h2>
      <button className="link" onClick={onClose}>Back to my work</button>
    </header>
    <div className="content">
      {connection.linked ? <div className="go-connection-saved" role="status">
        <strong>Go connection saved</strong>
        <p>Signing out of SuperTutor does not disconnect Go. Keep using your existing connection.</p>
        <p className="fineprint">Last successful use: {new Date(lastUse).toLocaleString()}. Reconnect only if your token expires, you revoke it, or Go reports an authentication error.</p>
        <button className="primary" onClick={onClose}>Back to my work</button>
      </div> : <p className="prompt">{connection.pending ? 'Your token is ready. Finish connecting it in Go once; future sign-ins will keep the connection.' : connection.expired ? 'Your connector token has expired. Create a new token and update the credential in Go.' : 'Link your workspace once. Go keeps its connection when you sign out and back in.'}</p>}
      {error && <p className="banner error" role="alert">{error}</p>}

      <details className="go-connection-manage" open={!connection.linked}>
      <summary>{connection.linked ? 'Manage connection & tokens' : 'Connection steps'}</summary>
      {/* Numbered because the order is load-bearing: the token has to exist before the install asks for it. */}
      <div className="step">
        <span className="step-number">01</span>
        <div className="step-body">
          <h3 className="step-label">Create your access token</h3>
          <p>This credential lets Go read your saved work and save tutoring feedback. It appears once and is stored as a hash. You do not need a new one each time you sign in.</p>
          <div className="actions"><button className="primary" disabled={busy} onClick={() => void issue()}>{busy ? 'Working…' : account.connectors.some(token => token.expiresAt > Date.now()) ? 'Create another token' : 'Create my token'}</button></div>
          {secret && <div className="token-reveal">
            <code>{secret}</code>
            <CopyButton value={secret} label="Copy token" />
            <p className="fineprint">Copy it now. You cannot see it again, but you can revoke it here and create another.</p>
          </div>}
          {account.connectors.length > 0 && <ul className="token-list">
            {account.connectors.map((token) => <li key={token.id}>
              <span>
                <strong>{token.label}</strong>
                <span className="token-meta">{token.expiresAt <= Date.now() ? 'Expired' : token.lastUsedAt ? `Last used ${new Date(token.lastUsedAt).toLocaleString()}` : 'Waiting for first use'} · expires {new Date(token.expiresAt).toLocaleDateString()}</span>
              </span>
              <button className="link" disabled={busy} onClick={() => void revoke(token.id)}>Revoke</button>
            </li>)}
          </ul>}
        </div>
      </div>

      <div className="step">
        <span className="step-number">02</span>
        <div className="step-body">
          <h3 className="step-label">Install the SuperTutor connector</h3>
          {published
            ? <>
              <p>Open the SuperTutor connector and connect your account. When it asks for a credential, paste the token above. Your Superhuman account must have access to this connector.</p>
              <div className="actions"><a className="button primary" href={config?.connectorListingUrl ?? '#'} target="_blank" rel="noreferrer">Open the connector ↗</a></div>
            </>
            : <>
              <p className="banner warn">The SuperTutor connector is not available for this workspace yet. Ask your workspace administrator to publish it. You can keep working and saving assignments in the meantime.</p>
              <details>
                <summary>Publishing instructions, for whoever runs this instance</summary>
                <p>Upload <code>agents/connector.pack.ts.example</code> and <code>agents/agent.pack.ts.example</code> once from Pack Studio, publish them, then set <code>CONNECTOR_LISTING_URL</code> and restart. Students never paste pack source. This instance's endpoint is:</p>
                <pre className="snippet">{endpoint}</pre>
                {local && <p className="fineprint">This endpoint is a local address, which Superhuman cannot reach. Deploy the app or expose it over HTTPS first.</p>}
              </details>
            </>}
        </div>
      </div>

      <div className="step">
        <span className="step-number">03</span>
        <div className="step-body">
          <h3 className="step-label">Find your tutor in the agent directory</h3>
          <p>Search the Superhuman agent directory for <strong>SuperTutor</strong> and install the one that fits your course — a coding tutor, a math tutor, or a writing tutor. Pick the agent, then ask it about the assignment you are stuck on.</p>
          <div className="actions">
            <a className="button primary" href={agentDirectory} target="_blank" rel="noreferrer">Search the agent directory ↗</a>
            <CopyButton value="SuperTutor" label="Copy the search term" />
          </div>
          <p className="fineprint">A tutor agent only reaches your work after step 02, and an agent's tools and triggers are copied when you install it — reinstall it after it changes.</p>
        </div>
      </div>
      </details>
    </div>
  </section>;
};
