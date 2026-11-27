import { effectiveStatus } from './validation.js';

const STORAGE_KEY = 'carecheck.provider.demo.v2';

const providers = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Demo Afya Hospital', type: 'hospital', location: 'Nairobi', verified: false },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Demo Medi Pharmacy', type: 'pharmacy', location: 'Nairobi', verified: false }
];

const catalog = [
  { id: '20000000-0000-4000-8000-000000000001', name: 'Ultrasound', type: 'service', strength: null, dosage_form: null, unit: 'scan' },
  { id: '20000000-0000-4000-8000-000000000002', name: 'Paracetamol', type: 'medication', strength: '500 mg', dosage_form: 'tablet', unit: 'tablet' },
  { id: '20000000-0000-4000-8000-000000000003', name: 'Complete blood count', type: 'service', strength: null, dosage_form: null, unit: 'test' },
  { id: '20000000-0000-4000-8000-000000000004', name: 'Amoxicillin', type: 'medication', strength: '500 mg', dosage_form: 'capsule', unit: 'capsule' },
  { id: '20000000-0000-4000-8000-000000000005', name: 'Ibuprofen', type: 'medication', strength: '200 mg', dosage_form: 'tablet', unit: 'tablet' }
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
    provider: clone(providers[0]),
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
    provider: clone(providers[1]),
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
    provider: clone(providers[0]),
    item: clone(catalog[2]),
    price: 800,
    currency: 'KES',
    pricing_unit: 'test',
    available: false,
    stock_quantity: null,
    updated_at: minutesFromNow(-180)
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    provider: clone(providers[1]),
    item: clone(catalog[3]),
    price: 250,
    currency: 'KES',
    pricing_unit: 'capsule',
    available: true,
    stock_quantity: 30,
    updated_at: minutesFromNow(-3000)
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
  },
  {
    id: '40000000-0000-4000-8000-000000000006',
    listing_id: listingSeed[3].id,
    item_id: catalog[3].id,
    quantity: 30,
    request_group_id: null,
    status: 'pending',
    confirmed_price: null,
    currency: 'KES',
    expires_at: minutesFromNow(40),
    created_at: minutesFromNow(-15),
    listing: clone(listingSeed[3]),
    item: clone(catalog[3])
  }
];

function seedStore() {
  return {
    activeProviderId: providers[0].id,
    profiles: clone(providers),
    listings: clone(listingSeed),
    requests: clone(requestSeed)
  };
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedStore();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.profiles) || !Array.isArray(parsed.listings) || !Array.isArray(parsed.requests)) return seedStore();
    return {
      ...parsed,
      activeProviderId: parsed.activeProviderId || providers[0].id,
      profiles: parsed.profiles.length ? parsed.profiles : clone(providers)
    };
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

function activeProfile(store) {
  return store.profiles.find((profile) => profile.id === store.activeProviderId) || providers[0];
}

export function demoCatalog() {
  return clone(catalog);
}

export function demoListProviders() {
  return clone(readStore().profiles);
}

export function demoSetActiveProvider(id) {
  const store = readStore();
  const profile = store.profiles.find((entry) => entry.id === id);
  if (!profile) throw failure('NOT_FOUND', 'Provider not found.', 404);
  store.activeProviderId = id;
  writeStore(store);
  return clone(profile);
}

export function demoGetProfile() {
  return clone(activeProfile(readStore()));
}

export function demoUpdateProfile(value) {
  const store = readStore();
  const current = activeProfile(store);
  store.profiles = store.profiles.map((profile) => profile.id === current.id ? { ...profile, name: value.name, location: value.location } : profile);
  const updated = activeProfile(store);
  store.listings = store.listings.map((listing) => listing.provider.id === current.id ? { ...listing, provider: clone(updated) } : listing);
  writeStore(store);
  return clone(updated);
}

export function demoListings({ page = 1, limit = 20 } = {}) {
  const store = readStore();
  const current = activeProfile(store);
  const listings = store.listings.filter((listing) => listing.provider.id === current.id);
  const start = (page - 1) * limit;
  return { data: clone(listings.slice(start, start + limit)), meta: { page, limit, total: listings.length } };
}

export function demoRequests({ status = 'all', page = 1, limit = 20 } = {}) {
  const store = readStore();
  const current = activeProfile(store);
  const scoped = store.requests.filter((request) => request.listing.provider.id === current.id);
  const filtered = status && status !== 'all' ? scoped.filter((request) => effectiveStatus(request) === status) : scoped;
  const start = (page - 1) * limit;
  return { data: clone(filtered.slice(start, start + limit)), meta: { page, limit, total: filtered.length } };
}

export function demoCreateListing(value) {
  const store = readStore();
  const current = activeProfile(store);
  const item = catalog.find((entry) => entry.id === value.item_id);
  if (!item) throw failure('VALIDATION_ERROR', 'Choose a catalog item.', 400);
  if (current.type === 'hospital' && item.type === 'medication') throw failure('VALIDATION_ERROR', 'Hospitals list healthcare services only.', 400);
  if (current.type === 'pharmacy' && item.type === 'service') throw failure('VALIDATION_ERROR', 'Pharmacies list medications only.', 400);
  if (item.type === 'medication' && value.pricing_unit.toLowerCase() !== item.unit.toLowerCase()) {
    throw failure('VALIDATION_ERROR', `Medication pricing unit must be ${item.unit}.`, 400);
  }
  const duplicate = store.listings.find((listing) =>
    listing.provider.id === current.id && listing.item.id === item.id && listing.pricing_unit === value.pricing_unit
  );
  if (duplicate) throw failure('CONFLICT', 'A listing for this item and pricing unit already exists.', 409);

  const listing = {
    id: newId(),
    provider: clone(current),
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
  const current = activeProfile(store);
  const index = store.listings.findIndex((listing) => listing.id === id && listing.provider.id === current.id);
  if (index < 0) throw failure('NOT_FOUND', 'Listing not found.', 404);
  store.listings[index] = {
    ...store.listings[index],
    price: value.price,
    available: value.available,
    stock_quantity: value.stock_quantity,
    updated_at: new Date().toISOString()
  };
  writeStore(store);
  return clone(store.listings[index]);
}

export function demoRemoveListing(id) {
  const store = readStore();
  const current = activeProfile(store);
  const index = store.listings.findIndex((listing) => listing.id === id && listing.provider.id === current.id);
  if (index < 0) throw failure('NOT_FOUND', 'Listing not found.', 404);
  store.listings.splice(index, 1);
  writeStore(store);
  return { id };
}

export function demoRespondToRequest(id, value) {
  const store = readStore();
  const current = activeProfile(store);
  const index = store.requests.findIndex((request) => request.id === id && request.listing.provider.id === current.id);
  if (index < 0) throw failure('NOT_FOUND', 'Request not found.', 404);
  if (effectiveStatus(store.requests[index]) !== 'pending') {
    throw failure('INVALID_TRANSITION', 'Only pending requests can be answered.', 409);
  }

  const currentRequest = store.requests[index];
  store.requests[index] = value.status === 'confirmed'
    ? { ...currentRequest, status: 'confirmed', confirmed_price: value.confirmed_price, expires_at: value.expires_at }
    : { ...currentRequest, status: 'declined', confirmed_price: null };
  writeStore(store);
  return clone(store.requests[index]);
}

export function demoReset() {
  writeStore(seedStore());
}
