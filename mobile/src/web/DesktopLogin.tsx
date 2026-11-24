import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { BRAND_ICON } from './brandIcon';

const ICON = BRAND_ICON;

// Entrar e criar conta no ecrã de computador. Usa a mesma conta e o mesmo backend da app.
export default function DesktopLogin() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'up' && name.trim().length < 2) return setError('Enter your name.');
    if (password.length < 8) return setError('The password needs at least 8 characters.');
    setBusy(true);
    try {
      if (mode === 'in') await login(email.trim(), password);
      else await register(name.trim(), email.trim(), password);
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pf pf-login">
      <section className="pf-lp" aria-hidden="true">
        <img className="pf-lp-icon" src={ICON} alt="" />
      </section>
      <section className="pf-rp">
        <div className="pf-ground" style={{ position: 'absolute' }} />
        <form className="pf-form" onSubmit={submit}>
          <h1 className="w8" style={{ fontSize: 30 }}>{mode === 'in' ? 'Welcome back' : 'Create your account'}</h1>
          <div className="pf-sub">Use the same account as the mobile app.</div>
          <div className="pf-seg" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'on w6' : 'w6'} onClick={() => setMode('in')}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'on w6' : 'w6'} onClick={() => setMode('up')}>Create account</button>
          </div>
          <div className="pf-f">
            {mode === 'up' && (<><label className="w6" htmlFor="pf-name">Name</label>
              <input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="First and last name" /></>)}
            <label className="w6" htmlFor="pf-email">Email</label>
            <input id="pf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required />
            <label className="w6" htmlFor="pf-pass">Password</label>
            <input id="pf-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'} placeholder="at least 8 characters" required />
          </div>
          {error && <div className="pf-err" role="alert">{error}</div>}
          <button className="pf-btn g w7" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
          <div className="pf-small">
            {mode === 'in' ? 'New to PondiFarm? Create an account, then ask your organization leader to approve you.' : 'After creating the account, join your organization or create a new one.'}
          </div>
        </form>
      </section>
    </div>
  );
}
