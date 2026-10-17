import { CanvasSignIn } from './CanvasSignIn.js';
import { useState } from 'react';
import type { Account, Credentials } from '../../../../packages/types.js';
import { signIn, signUp } from '../lib/api.js';

export const SignIn = ({ onAuthenticated, initialMode = 'signin', initialError = '' }: { onAuthenticated: (account: Account) => void; initialMode?: 'signin' | 'signup'; initialError?: string }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    const credentials: Credentials = { email, password };
    try { onAuthenticated(await (mode === 'signup' ? signUp(credentials) : signIn(credentials))); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not sign in.'); }
    finally { setBusy(false); }
  };
  return <div className="auth">
      <section className="auth-form">
        <h2>{mode === 'signup' ? 'Create your account' : 'Sign in'}</h2>
        <p className="auth-intro">Pick up where you left off, or start with a question.</p>
        <CanvasSignIn/>
        <div className="auth-divider"><span>or use email</span></div>
        <form onSubmit={submit}>
          <label>Email<input required type="email" autoComplete="username" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input required type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={10} maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button type="button" className="password-toggle link" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide password' : 'Show password'}</button>
          {mode === 'signup' && <p className="fineprint">At least 10 characters. There is no password reset yet, so keep it in your password manager.</p>}
          {error && <p className="banner error" role="alert">{error}</p>}
          <div className="actions">
            <button className="primary" disabled={busy || !email.trim() || password.length < 10}>
              {busy ? 'Working…' : mode === 'signup' ? 'Create my account' : 'Sign in'}
            </button>
            <button type="button" className="link" disabled={busy} onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); }}>
              {mode === 'signup' ? 'I already have an account' : 'Create an account'}
            </button>
          </div>
        </form>
        <p className="fineprint">Only the assignments and excerpts you save are available to your tutor. Nothing is shared with other students.</p>
      </section>
  </div>;
};
