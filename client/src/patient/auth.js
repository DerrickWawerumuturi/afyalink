import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const auth = url && key ? createClient(url, key) : null;
export async function getSession() {
  if (!auth) return null;
  const { data, error } = await auth.auth.getSession();
  if (error) throw error;
  return data.session;
}
if (auth) {
  auth.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) localStorage.setItem('carecheck_access_token', session.access_token);
    else localStorage.removeItem('carecheck_access_token');
    window.dispatchEvent(new Event('carecheck-auth'));
  });
}
