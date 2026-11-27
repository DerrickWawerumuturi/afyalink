import * as demo from './demoApi';
import { getSession } from './auth';

const base = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://127.0.0.1:5000/api');
const idKey = 'afyalink.live.requests.v1';
const snapshotKey = 'afyalink.live.listings.v1';
export const catalog = [];
const listings = new Map();
let source = 'loading';
let notice = 'Connecting to the care directory…';
const announce = () => window.dispatchEvent(new Event('afyalink-source'));
function mode(value, text) { source = value; notice = text; announce(); }
export const getSource = () => ({ source, notice });
function cache(rows) { rows.forEach(row => listings.set(row.id, row)); try { sessionStorage.setItem(snapshotKey, JSON.stringify([...listings.values()])); } catch {} }
try { JSON.parse(sessionStorage.getItem(snapshotKey) || '[]').forEach(row => listings.set(row.id, row)); } catch {}
function replaceCatalog(items) { catalog.splice(0, catalog.length, ...items); announce(); }
async function call(path, options = {}) {
  let response;
  const session = options.auth ? await getSession() : null;
  if (options.auth && !session) throw Object.assign(new Error('Please sign in to send or view real requests.'), { status: 401 });
  try {
    response = await fetch(base + path, { method: options.method || 'GET', headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
  } catch { throw Object.assign(new Error('The care directory is unavailable.'), { status: 0 }); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error?.message || `Request failed (${response.status})`), { status: response.status, code: payload.error?.code, fields: payload.error?.fields });
  return payload;
}
function canFallback(e) { return e.status === 0 || e.status === 503; }
export async function initialize() {
  try {
    async function allListings(type) {
      const rows = []; let page = 1, total = 0;
      do {
        const response = await call(`/listings?${new URLSearchParams({ type, limit: '100', page: String(page) })}`);
        rows.push(...response.data); total = response.meta?.total ?? rows.length;
        if (!response.data.length) break;
        page++;
      } while (rows.length < total);
      return rows;
    }
    const [services, medicines] = await Promise.all(['service', 'medication'].map(allListings));
    const rows = [...services, ...medicines]; listings.clear(); cache(rows);
    replaceCatalog([...new Map(rows.map(row => [row.item.id, row.item])).values()]);
    mode('live', 'Connected to the care directory. Availability and prices are provider-reported.');
  } catch (e) {
    if (!canFallback(e)) { mode('error', e.message); throw e; }
    replaceCatalog(demo.catalog); mode('demo', 'Demo data: the care directory is unavailable. Requests remain on this device.');
  }
}
export async function search(type, q = '', area = '') {
  if (source === 'demo') return demo.search(type, q, area);
  const query = new URLSearchParams({ type, limit: '100' });
  if (q.trim()) query.set('q', q.trim());
  if (area.trim()) query.set('location', area.trim());
  const result = await call(`/listings?${query}`); cache(result.data); return result.data;
}
export function detail(id) { return source === 'demo' ? demo.detail(id) : [...listings.values()].filter(row => row.provider.id === id); }
export async function compare(items, area) {
  if (source === 'demo') return demo.compare(items, area);
  return (await call('/compare', { method:'POST', body:{ items:items.map(({item_id, quantity}) => ({ item_id, quantity })), ...(area.trim() ? {location:area.trim()} : {}) } })).data;
}
async function sessionKey() { const session = await getSession(); if (!session) throw Object.assign(new Error('Please sign in to send or view real requests.'), {status:401}); return `${idKey}.${session.user.id}`; }
export async function enquire(lines) {
  if (source === 'demo') return demo.enquire(lines);
  if (!lines.length || lines.some(line => !line.listing_id || !Number.isSafeInteger(line.quantity) || line.quantity <= 0)) throw new Error('Each request needs a valid listing and positive whole quantity.');
  const key = await sessionKey();
  const group = lines.length > 1 ? crypto.randomUUID() : null;
  const saved = JSON.parse(localStorage.getItem(key) || '[]');
  for (const { listing_id, quantity } of lines) {
    const listing = listings.get(listing_id);
    if (!listing) throw new Error('Listing details are unavailable. Search again before requesting confirmation.');
    try {
      const result = await call('/requests', { method:'POST', auth:true, body:{ listing_id, quantity, request_group_id:group } });
      saved.unshift({ id:result.data.id, listing });
      localStorage.setItem(key, JSON.stringify(saved));
    } catch (e) { if (saved.length) e.message += ' Any requests already submitted remain in My requests.'; throw e; }
  }
}
export async function requests() {
  if (source === 'demo') return demo.requests();
  const key = await sessionKey();
  const saved = JSON.parse(localStorage.getItem(key) || '[]');
  return Promise.all(saved.map(async entry => ({ ...(await call(`/requests/${encodeURIComponent(entry.id)}`, {auth:true})).data, listing:entry.listing })));
}
export function simulateReply(id) { if (source !== 'demo') throw new Error('Simulated confirmations are only available in demo mode.'); return demo.simulateReply(id); }
