import { useEffect, useState } from 'react';
import PatientApp from './patient/PatientApp.jsx';
import ProviderDashboard from './provider/ProviderDashboard.jsx';
import { auth } from './patient/auth.js';

export default function App() {
  const [route, setRoute] = useState(window.location.hash);
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => { const update = () => setRoute(window.location.hash); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);

  useEffect(() => {
    if (!auth) { setReady(true); return undefined; }
    let active = true;
    auth.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session?.access_token) localStorage.setItem('afyalink_access_token', data.session.access_token);
      else localStorage.removeItem('afyalink_access_token');
      setSession(data.session);
      setReady(true);
    }).catch(() => { if (active) setReady(true); });
    const { data } = auth.auth.onAuthStateChange((_event, value) => {
      if (value?.access_token) localStorage.setItem('afyalink_access_token', value.access_token);
      else localStorage.removeItem('afyalink_access_token');
      setSession(value);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  async function signIn(e) {
    e.preventDefault(); setError('');
    const { error } = await auth.auth.signInWithPassword({ email, password });
    if (error) setError(error.message); else { setPassword(''); setOpen(false); window.location.reload(); }
  }
  return <><div className="app-shell">
    <a className="app-brand" href="#/" aria-label="AfyaLink home">AfyaLink<span aria-hidden="true">.</span></a>
    <div className="app-nav-actions">
      <nav aria-label="Main navigation">
        <a href="#/" aria-current={(!route || route === '#/' || route.startsWith('#/services') || route.startsWith('#/facility/')) ? 'page' : undefined}>Find care</a>
        <a href="#/medicines" aria-current={route.startsWith('#/medicines') ? 'page' : undefined}>Medications</a>
        <a href="#/requests" aria-current={route.startsWith('#/requests') ? 'page' : undefined}>My requests</a>
        <a href="#/provider" aria-current={route === '#/provider' ? 'page' : undefined}>For providers</a>
      </nav>
      {auth ? session ? <button className="app-auth-button" onClick={async () => { await auth.auth.signOut(); window.location.reload(); }}>Sign out</button> : <button className="app-auth-button" onClick={() => setOpen(!open)} aria-expanded={open}>Sign in</button> : <span className="app-auth-unavailable">Sign-in unavailable</span>}
    </div>
    {open && auth && <form onSubmit={signIn} className="app-signin"><label>Email<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label><button>Sign in</button>{error && <p role="alert">{error}</p>}</form>}
  </div>{!ready ? <main><p role="status">Starting AfyaLink…</p></main> : route === '#/provider' ? <main><ProviderDashboard /></main> : <PatientApp />}</>;
}
