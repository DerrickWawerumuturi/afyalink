import {
  demoCatalog,
  demoCreateListing,
  demoGetProfile,
  demoListings,
  demoListProviders,
  demoRemoveListing,
  demoRequests,
  demoReset,
  demoRespondToRequest,
  demoSetActiveProvider,
  demoUpdateListing,
  demoUpdateProfile
} from './fixtures.js';

const baseUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://127.0.0.1:5000/api');
let demoMode = false;

function authHeaders() {
  let token = '';
  try {
    token = localStorage.getItem('afyalink_access_token') || '';
  } catch {
    token = '';
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    const error = new Error('API unavailable');
    error.status = 0;
    error.code = 'NETWORK_ERROR';
    throw error;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = payload?.error?.code || 'REQUEST_FAILED';
    error.fields = payload?.error?.fields || null;
    throw error;
  }
  return payload || {};
}

function canUseDemo(error) {
  return [0, 401, 403, 404].includes(error.status);
}

function demoNotice(error) {
  if (error.status === 404) return 'Provider API routes are not connected yet. Showing labelled synthetic demo data.';
  if (error.status === 401 || error.status === 403) return 'Provider sign-in is required for the live API. Showing labelled synthetic demo data.';
  if (error.status === 0) return 'API unavailable. Showing labelled synthetic demo data.';
  return '';
}

function pageMeta(page, limit) {
  return { page, limit, total: 0 };
}

function unsupported(message) {
  const error = new Error(message);
  error.code = 'UNSUPPORTED';
  error.status = 405;
  return error;
}

export function isDemoMode() {
  return demoMode;
}

export function loadCatalog() {
  return demoCatalog();
}

export async function loadProfile() {
  if (demoMode) return { data: demoGetProfile(), source: 'demo' };
  try {
    const payload = await api('/provider/profile');
    return { data: payload.data, source: 'api', notice: '' };
  } catch (error) {
    if (!canUseDemo(error)) throw error;
    demoMode = true;
    return { data: demoGetProfile(), source: 'demo', notice: demoNotice(error) };
  }
}

export function listDemoProviders() {
  return demoListProviders();
}

export async function setDemoProvider(id) {
  if (!demoMode) throw unsupported('Provider switching is only available in the synthetic demo.');
  return { data: demoSetActiveProvider(id), notice: 'Demo provider switched.' };
}

export async function loadListings({ page = 1, limit = 20 } = {}) {
  if (demoMode) return { ...demoListings({ page, limit }), source: 'demo', notice: 'Synthetic demo data in use.' };
  try {
    const payload = await api(`/provider/listings?page=${page}&limit=${limit}`);
    demoMode = false;
    return {
      data: Array.isArray(payload.data) ? payload.data : [],
      meta: payload.meta || pageMeta(page, limit),
      source: 'api',
      notice: ''
    };
  } catch (error) {
    if (!canUseDemo(error)) throw error;
    demoMode = true;
    return { ...demoListings({ page, limit }), source: 'demo', notice: demoNotice(error) };
  }
}

export async function loadRequests({ status = 'all', page = 1, limit = 20 } = {}) {
  if (demoMode) return { ...demoRequests({ status, page, limit }), source: 'demo', notice: 'Synthetic demo data in use.' };
  const query = status && status !== 'all' ? `&status=${encodeURIComponent(status)}` : '';
  try {
    const payload = await api(`/provider/requests?page=${page}&limit=${limit}${query}`);
    demoMode = false;
    return {
      data: Array.isArray(payload.data) ? payload.data : [],
      meta: payload.meta || pageMeta(page, limit),
      source: 'api',
      notice: ''
    };
  } catch (error) {
    if (!canUseDemo(error)) throw error;
    demoMode = true;
    return { ...demoRequests({ status, page, limit }), source: 'demo', notice: demoNotice(error) };
  }
}

export async function createListing(value) {
  if (!demoMode) {
    try {
      const payload = await api('/provider/listings', { method: 'POST', body: value });
      return { data: payload.data, notice: '' };
    } catch (error) {
      if (!canUseDemo(error)) throw error;
      demoMode = true;
      return { data: demoCreateListing(value), notice: demoNotice(error) };
    }
  }
  return { data: demoCreateListing(value), notice: '' };
}

export async function updateListing(id, value) {
  if (!demoMode) {
    try {
      const payload = await api(`/provider/listings/${encodeURIComponent(id)}`, { method: 'PATCH', body: value });
      return { data: payload.data, notice: '' };
    } catch (error) {
      if (!canUseDemo(error)) throw error;
      demoMode = true;
      return { data: demoUpdateListing(id, value), notice: demoNotice(error) };
    }
  }
  return { data: demoUpdateListing(id, value), notice: '' };
}

export async function deleteListing(id) {
  if (!demoMode) {
    try {
      const payload = await api(`/provider/listings/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return { data: payload.data, notice: '' };
    } catch (error) {
      if (!canUseDemo(error)) throw error;
      demoMode = true;
      return { data: demoRemoveListing(id), notice: demoNotice(error) };
    }
  }
  return { data: demoRemoveListing(id), notice: '' };
}

export async function updateProfile(value) {
  if (!demoMode) throw unsupported('Profile editing needs a provider profile route from the API owner.');
  return { data: demoUpdateProfile(value), notice: 'Demo profile updated locally.' };
}

export async function respondToRequest(id, value) {
  if (!demoMode) {
    try {
      const payload = await api(`/provider/requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: value });
      return { data: payload.data, notice: '' };
    } catch (error) {
      if (!canUseDemo(error)) throw error;
      demoMode = true;
      return { data: demoRespondToRequest(id, value), notice: demoNotice(error) };
    }
  }
  return { data: demoRespondToRequest(id, value), notice: '' };
}

export async function loadAppointments({ page = 1, limit = 20 } = {}) {
  if (demoMode) return { data: [], meta: pageMeta(page, limit), source: 'demo', notice: 'Synthetic demo: no appointments loaded.' };
  try {
    const payload = await api(`/provider/appointments?page=${page}&limit=${limit}`);
    demoMode = false;
    return {
      data: Array.isArray(payload.data) ? payload.data : [],
      meta: payload.meta || pageMeta(page, limit),
      source: 'api',
      notice: ''
    };
  } catch (error) {
    if (!canUseDemo(error)) throw error;
    demoMode = true;
    return { data: [], meta: pageMeta(page, limit), source: 'demo', notice: demoNotice(error) };
  }
}

export async function respondToAppointment(id, value) {
  if (demoMode) throw new Error('Appointments require the live provider API.');
  const payload = await api(`/provider/appointments/${encodeURIComponent(id)}`, { method: 'PATCH', body: value });
  return { data: payload.data, notice: '' };
}

export function resetDemoData() {
  demoReset();
  return { notice: 'Synthetic demo data reset.' };
}
