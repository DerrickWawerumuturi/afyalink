import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const auth = url && key ? createClient(url, key) : null;

let currentSession = null;
let pendingSession = null;

export function storeSession(session) {
  currentSession = session;
  try {
    if (session?.access_token) localStorage.setItem('carecheck_access_token', session.access_token);
    else localStorage.removeItem('carecheck_access_token');
  } catch {}
  window.dispatchEvent(new Event('carecheck-auth'));
}

export function getAccessToken() {
  return currentSession?.access_token || null;
}

export async function getSession() {
  if (!auth) return null;
  if (currentSession) return currentSession;
  if (!pendingSession) {
    pendingSession = auth.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        currentSession = data.session;
        return data.session;
      })
      .finally(() => {
        pendingSession = null;
      });
  }
  return pendingSession;
}

if (auth) {
  auth.auth.onAuthStateChange((_event, session) => {
    storeSession(session);
  });
  auth.auth.getSession()
    .then(({ data }) => {
      if (!currentSession) currentSession = data.session;
    })
    .catch(() => {});
}
