import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, LogIn, ShieldCheck, UserPlus, X } from 'lucide-react';
import { auth, storeSession } from '../patient/auth.js';
import './auth.css';

const DEMO_ACCOUNTS = [
  { label: 'Patient', email: 'patient.demo@afyalink.test' },
  { label: 'Hospital', email: 'hospital.demo@afyalink.test' },
  { label: 'Pharmacy', email: 'pharmacy.demo@afyalink.test' },
];
const DEMO_PASSWORD = 'DemoPass123!';

function friendlyError(message) {
  if (!message) return 'Something went wrong. Please try again.';
  const text = String(message);
  if (/invalid login credentials/i.test(text)) return 'Incorrect email or password. Try a demo account below.';
  if (/email_address_invalid|invalid email/i.test(text)) return 'Use a valid email address. Reserved domains such as .test or example.com are rejected.';
  if (/already registered|already exists/i.test(text)) return 'An account with this email already exists. Sign in instead.';
  if (/rate limit|too many/i.test(text)) return 'Too many attempts. Wait a minute and try again.';
  if (/email not confirmed/i.test(text)) return 'Confirm your email before signing in.';
  return text;
}

export default function AuthDialog({ open, onClose, initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setMode(initialMode);
    setError('');
    setInfo('');
    const timer = setTimeout(() => firstFieldRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  function switchMode(next) {
    setMode(next);
    setError('');
    setInfo('');
    setPassword('');
    setConfirmPassword('');
  }

  function fillDemo(account) {
    setMode('signin');
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    setError('');
    setInfo('');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setInfo('');
    if (!auth) {
      setError('Sign-in is unavailable because Supabase environment variables are missing.');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        const { data, error: failure } = await auth.auth.signInWithPassword({ email: email.trim(), password });
        if (failure) {
          setError(friendlyError(failure.message));
          return;
        }
        storeSession(data.session);
        setPassword('');
        onClose();
        return;
      }

      const { data, error: failure } = await auth.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim(), role: 'patient' } },
      });
      if (failure) {
        setError(friendlyError(failure.message));
        return;
      }
      if (data.session) {
        storeSession(data.session);
        setPassword('');
        setConfirmPassword('');
        onClose();
      } else {
        setInfo('Account created. Check your email to confirm before signing in.');
      }
    } catch {
      setError('The authentication service is unavailable. Try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" aria-describedby="auth-description">
        <button type="button" className="auth-close" onClick={onClose} disabled={busy} aria-label="Close authentication dialog">
          <X aria-hidden="true" />
        </button>

        <div className="auth-head">
          <span className="auth-mark" aria-hidden="true"><ShieldCheck /></span>
          <div>
            <h2 id="auth-title">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
            <p id="auth-description">
              {mode === 'signin' ? 'Sign in to send enquiries, book appointments and track responses.' : 'Create a patient account to book services and manage your care requests.'}
            </p>
          </div>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'auth-tab is-active' : 'auth-tab'} onClick={() => switchMode('signin')}>
            <LogIn aria-hidden="true" /> Sign in
          </button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'auth-tab is-active' : 'auth-tab'} onClick={() => switchMode('signup')}>
            <UserPlus aria-hidden="true" /> Sign up
          </button>
        </div>

        {!auth ? (
          <p className="auth-message auth-message-error"><CircleAlert aria-hidden="true" /> Supabase sign-in is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p>
        ) : (
          <form className="auth-form" onSubmit={submit} noValidate>
            {mode === 'signup' ? (
              <label className="auth-field">
                <span>Full name <small>(optional)</small></span>
                <input ref={firstFieldRef} type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Amina Wanjiku" />
              </label>
            ) : null}
            <label className="auth-field">
              <span>Email</span>
              <input
                ref={mode === 'signin' ? firstFieldRef : undefined}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === 'signin' ? 'Your password' : 'At least 8 characters'}
                required
              />
            </label>
            {mode === 'signup' ? (
              <label className="auth-field">
                <span>Confirm password</span>
                <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
              </label>
            ) : null}

            {error ? <p className="auth-message auth-message-error" role="alert"><CircleAlert aria-hidden="true" /> {error}</p> : null}
            {info ? <p className="auth-message auth-message-info" role="status"><CheckCircle2 aria-hidden="true" /> {info}</p> : null}

            <div className="auth-actions">
              <button type="button" className="auth-secondary" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="auth-primary" disabled={busy}>
                {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </div>
          </form>
        )}

        {mode === 'signin' && auth ? (
          <div className="auth-demo">
            <span>Demo accounts (password: <code>{DEMO_PASSWORD}</code>)</span>
            <div className="auth-demo-buttons">
              {DEMO_ACCOUNTS.map((account) => (
                <button key={account.email} type="button" onClick={() => fillDemo(account)}>
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {mode === 'signup' ? (
          <p className="auth-note">New accounts are patient accounts. Provider accounts are provisioned by the CareCheck team with trusted membership.</p>
        ) : null}
      </div>
    </div>
  );
}
