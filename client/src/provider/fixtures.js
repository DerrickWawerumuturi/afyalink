import { effectiveStatus } from './validation.js';

const STORAGE_KEY = 'afyalink.provider.demo.v1';

const provider = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Demo Afya Hospital',
  type: 'hospital',
  location: 'Nairobi',
  verified: false
};

const catalog = [
  { id: '20000000-0000-4000-8000-000000000001', name: 'Ultrasound', type: 'service', strength: null, dosage_form: null, unit: 'scan' },
  { id: '20000000-0000-4000-8000-000000000002', name: 'Paracetamol', type: 'medication', strength: '500 mg', dosage_form: 'tablet', unit: 'tablet' },
  { id: '20000000-0000-4000-8000-000000000003', name: 'Complete blood count', type: 'service', strength: null, dosage_form: null, unit: 'test' },
  { id: '20000000-0000-4000-8000-000000000004', name: 'Amoxicillin', type: 'medication', strength: '500 mg', dosage_form: 'capsule', unit: 'capsule' }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60000).toISOString();
}

const listingSeed = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    provider: clone(provider),
    item: clone(catalog[0]),
    price: 1200,
    currency: 'KES',
    pricing_unit: 'scan',
    available: true,
    stock_quantity: null,
    updated_at: minutesFromNow(-45)
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    provider: clone(provider),
    item: clone(catalog[1]),
    price: 5,
    currency: 'KES',
    pricing_unit: 'tablet',
    available: true,
    stock_quantity: 120,
    updated_at: minutesFromNow(-20)
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    provider: clone(provider),
    item: clone(catalog[2]),
    price: 800,
    currency: 'KES',
    pricing_unit: 'test',
    available: false,
    stock_quantity: null,
    updated_at: minutesFromNow(-180)
  }
];

const requestSeed = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    listing_id: listingSeed[0].id,
    item_id: catalog[0].id,
    quantity: 1,
    request_group_id: null,
    status: 'pending',
    confirmed_price: null,
    currency: 'KES',
    expires_at: minutesFromNow(25),
    created_at: minutesFromNow(-5),
    listing: clone(listingSeed[0]),
    item: clone(catalog[0])
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    listing_id: listingSeed[1].id,
    item_id: catalog[1].id,
    quantity: 10,
    request_group_id: null,
    status: 'pending',
    confirmed_price: null,
    currency: 'KES',
    expires_at: minutesFromNow(8),
    created_at: minutesFromNow(-12),
    listing: clone(listingSeed[1]),
    item: clone(catalog[1])
  },
  {
    id: '40000000-0000-4000-8000-000000000003',
    listing_id: listingSeed[0].id,
    item_id: catalog[0].id,
    quantity: 1,
    request_group_id: null,
    status: 'pending',
    confirmed_price: null,
    currency: 'KES',
    expires_at: minutesFromNow(-30),
    created_at: minutesFromNow(-60),
    listing: clone(listingSeed[0]),
    item: clone(catalog[0])
  },
  {
    id: '40000000-0000-4000-8000-000000000004',
    listing_id: listingSeed[1].id,
    item_id: catalog[1].id,
    quantity: 20,
    request_group_id: null,
    status: 'confirmed',
    confirmed_price: 5,
    currency: 'KES',
    expires_at: minutesFromNow(90),
    created_at: minutesFromNow(-40),
    listing: clone(listingSeed[1]),
    item: clone(catalog[1])
  },
  {
    id: '40000000-0000-4000-8000-000000000005',
    listing_id: listingSeed[2].id,
    item_id: catalog[2].id,
    quantity: 1,
    request_group_id: null,
    status: 'declined',
    confirmed_price: null,
    currency: 'KES',
    expires_at: minutesFromNow(60),
    created_at: minutesFromNow(-120),
    listing: clone(listingSeed[2]),
    item: clone(catalog[2])
  }
];

function seedStore() {
  return { listings: clone(listingSeed), requests: clone(requestSeed) };
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedStore();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.listings) || !Array.isArray(parsed.requests)) return seedStore();
    return parsed;
  } catch {
    return seedStore();
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

function failure(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function newId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `50000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, '0')}`;
}

export function demoCatalog() {
  return clone(catalog);
}

export function demoListings({ page = 1, limit = 20 } = {}) {
  const { listings } = readStore();
  const start = (page - 1) * limit;
  return { data: clone(listings.slice(start, start + limit)), meta: { page, limit, total: listings.length } };
}

export function demoRequests({ status = 'all', page = 1, limit = 20 } = {}) {
  const { requests } = readStore();
  const filtered = status && status !== 'all' ? requests.filter((request) => effectiveStatus(request) === status) : requests;
  const start = (page - 1) * limit;
  return { data: clone(filtered.slice(start, start + limit)), meta: { page, limit, total: filtered.length } };
}

export function demoCreateListing(value) {
  const store = readStore();
  const item = catalog.find((entry) => entry.id === value.item_id);
  if (!item) throw failure('VALIDATION_ERROR', 'Choose a catalog item.', 400);
  if (item.type === 'medication' && value.pricing_unit.toLowerCase() !== item.unit.toLowerCase()) {
    throw failure('VALIDATION_ERROR', `Medication pricing unit must be ${item.unit}.`, 400);
  }
  const duplicate = store.listings.find((listing) =>
    listing.provider.id === provider.id && listing.item.id === item.id && listing.pricing_unit === value.pricing_unit
  );
  if (duplicate) throw failure('CONFLICT', 'A listing for this item and pricing unit already exists.', 409);

  const listing = {
    id: newId(),
    provider: clone(provider),
    item: clone(item),
    price: value.price,
    currency: 'KES',
    pricing_unit: value.pricing_unit,
    available: value.available,
    stock_quantity: value.stock_quantity,
    updated_at: new Date().toISOString()
  };
  store.listings.unshift(listing);
  writeStore(store);
  return clone(listing);
}

export function demoUpdateListing(id, value) {
  const store = readStore();
  const index = store.listings.findIndex((listing) => listing.id === id && listing.provider.id === provider.id);
  if (index < 0) throw failure('NOT_FOUND', 'Listing not found.', 404);
  const current = store.listings[index];
  store.listings[index] = {
    ...current,
    price: value.price,
    available: value.available,
    stock_quantity: value.stock_quantity,
    updated_at: new Date().toISOString()
  };
  writeStore(store);
  return clone(store.listings[index]);
}

export function demoRespondToRequest(id, value) {
  const store = readStore();
  const index = store.requests.findIndex((request) => request.id === id && request.listing.provider.id === provider.id);
  if (index < 0) throw failure('NOT_FOUND', 'Request not found.', 404);
  if (effectiveStatus(store.requests[index]) !== 'pending') {
    throw failure('INVALID_TRANSITION', 'Only pending requests can be answered.', 409);
  }

  const current = store.requests[index];
  store.requests[index] = value.status === 'confirmed'
    ? { ...current, status: 'confirmed', confirmed_price: value.confirmed_price, expires_at: value.expires_at }
    : { ...current, status: 'declined', confirmed_price: null };
  writeStore(store);
  return clone(store.requests[index]);
}

export function demoReset() {
  writeStore(seedStore());
}
