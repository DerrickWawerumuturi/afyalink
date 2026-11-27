import { useEffect, useState } from 'react';
import PatientApp from './patient/PatientApp.jsx';
import ProviderDashboard from './provider/ProviderDashboard.jsx';
import AuthDialog from './components/AuthDialog.jsx';
import { auth, getSession, storeSession } from './patient/auth.js';

export default function App() {
  const [route, setRoute] = useState(window.location.hash);
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!auth);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    const update = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  useEffect(() => {
    const openAuth = () => setAuthOpen(true);
    window.addEventListener('carecheck:open-auth', openAuth);
    return () => window.removeEventListener('carecheck:open-auth', openAuth);
  }, []);

  useEffect(() => {
    const handler = () => {
      auth?.auth.signOut().then(() => {
        storeSession(null);
        setAuthOpen(false);
      });
    };
    window.addEventListener('carecheck:sign-out', handler);
    return () => window.removeEventListener('carecheck:sign-out', handler);
  }, []);

  useEffect(() => {
    if (!auth) { setReady(true); return undefined; }
    let active = true;
    getSession().then((value) => {
      if (!active) return;
      storeSession(value);
      setSession(value);
      setReady(true);
    }).catch(() => { if (active) setReady(true); });
    const { data } = auth.auth.onAuthStateChange((_event, value) => {
      if (value?.access_token) localStorage.setItem('carecheck_access_token', value.access_token);
      else localStorage.removeItem('carecheck_access_token');
      setSession(value);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  async function signOut() {
    if (!auth) return;
    await auth.auth.signOut();
    storeSession(null);
    setAuthOpen(false);
  }

  const isPatientHome = !route || route === '#/' || route.startsWith('#/services') || route.startsWith('#/facility/');
  const navItems = [
    { href: '#/', label: 'Find care', active: isPatientHome },
    { href: '#/medicines', label: 'Medications', active: route.startsWith('#/medicines') },
    { href: '#/appointments', label: 'Appointments', active: route.startsWith('#/appointments') },
    { href: '#/requests', label: 'My requests', active: route.startsWith('#/requests') },
    { href: '#/provider', label: 'For providers', active: route === '#/provider' },
  ];

  return (
    <>
      <div className="app-shell">
        <a className="app-brand" href="#/" aria-label="CareCheck home">CareCheck<span aria-hidden="true">.</span></a>
        <div className="app-nav-actions">
          <nav aria-label="Main navigation">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} aria-current={item.active ? 'page' : undefined}>{item.label}</a>
            ))}
          </nav>
          {auth ? (
            session ? (
              <div className="app-user">
                <span className="app-user-email" title={session.user.email}>{session.user.email}</span>
                <button className="app-auth-button" onClick={signOut}>Sign out</button>
              </div>
            ) : (
              <button className="app-auth-button" onClick={() => setAuthOpen(true)} aria-expanded={authOpen}>Sign in</button>
            )
          ) : (
            <span className="app-auth-unavailable">Sign-in unavailable</span>
          )}
        </div>
      </div>

      {!ready ? (
        <main><p role="status">Starting CareCheck…</p></main>
      ) : route === '#/provider' ? (
        <main className="provider-main"><ProviderDashboard key={session?.user?.id || 'anonymous'} session={session} /></main>
      ) : (
        <PatientApp />
      )}

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
