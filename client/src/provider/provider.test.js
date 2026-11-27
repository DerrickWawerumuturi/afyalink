import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = {
  values: new Map(),
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  },
  setItem(key, value) {
    this.values.set(key, String(value));
  },
  removeItem(key) {
    this.values.delete(key);
  }
};

const validation = await import('./validation.js');
const fixtures = await import('./fixtures.js');

const hospitalId = '10000000-0000-4000-8000-000000000001';
const pharmacyId = '10000000-0000-4000-8000-000000000002';
const serviceId = '20000000-0000-4000-8000-000000000001';
const medicationId = '20000000-0000-4000-8000-000000000002';
const newMedicationId = '20000000-0000-4000-8000-000000000005';

test('money and stock validation reject invalid values', () => {
  assert.equal(validation.parseMoney('0'), 0);
  assert.equal(validation.parseMoney('5.50'), 5.5);
  assert.equal(validation.parseMoney('-1'), null);
  assert.equal(validation.parseMoney('5.123'), null);
  assert.equal(validation.parseWholeNumber('12'), 12);
  assert.equal(validation.parseWholeNumber('1.5'), null);
});

test('medication listings require the exact catalog unit and provider type', () => {
  const item = fixtures.demoCatalog().find((entry) => entry.id === medicationId);
  const wrongUnit = validation.validateListingInput(
    { item_id: medicationId, price: '5', pricing_unit: 'capsule', available: 'true', stock_quantity: '0' },
    [item],
    'pharmacy'
  );
  assert.match(wrongUnit.errors.pricing_unit, /tablet/);

  const hospital = validation.validateListingInput(
    { item_id: medicationId, price: '5', pricing_unit: 'tablet', available: 'true', stock_quantity: '0' },
    [item],
    'hospital'
  );
  assert.match(hospital.errors.item_id, /Hospitals list healthcare services only/);

  const valid = validation.validateListingInput(
    { item_id: medicationId, price: '5.50', pricing_unit: 'tablet', available: 'true', stock_quantity: '0' },
    [item],
    'pharmacy'
  );
  assert.deepEqual(valid.errors, {});
  assert.equal(valid.value.price, 5.5);
});

test('confirmation validation enforces a future expiry within 24 hours', () => {
  const decline = validation.validateResponseInput({ status: 'declined' });
  assert.deepEqual(decline.value, { status: 'declined' });

  const tooLate = validation.validateResponseInput({
    status: 'confirmed',
    confirmed_price: '10',
    expires_at: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString()
  });
  assert.match(tooLate.errors.expires_at, /within 24 hours/);

  const valid = validation.validateResponseInput({
    status: 'confirmed',
    confirmed_price: '10',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });
  assert.deepEqual(valid.errors, {});
  assert.equal(valid.value.confirmed_price, 10);
});

test('effective status and stale data are derived from timestamps', () => {
  const expired = validation.effectiveStatus({ status: 'pending', expires_at: new Date(Date.now() - 1000).toISOString() });
  assert.equal(expired, 'expired');
  assert.equal(validation.effectiveStatus({ status: 'declined' }), 'declined');
  assert.equal(validation.isStale(new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()), true);
  assert.equal(validation.isStale(new Date(Date.now() - 60 * 1000).toISOString()), false);
  assert.equal(validation.isStale(null), true);
});

test('profile validation requires a name and location', () => {
  const result = validation.validateProfileInput({ name: ' Demo Pharmacy ', location: ' Nairobi ' });
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.value, { name: 'Demo Pharmacy', location: 'Nairobi' });
  assert.match(validation.validateProfileInput({ name: '', location: 'Nairobi' }).errors.name, /2 to 80/);
});

test('page count handles empty, partial and invalid page sizes', () => {
  assert.equal(validation.pageCount(0, 20), 1);
  assert.equal(validation.pageCount(21, 20), 2);
  assert.equal(validation.pageCount(40, 20), 2);
  assert.equal(validation.pageCount(10, 0), 1);
});

test('demo provider switching scopes listings and requests', () => {
  fixtures.demoReset();
  const hospitalListings = fixtures.demoListings();
  assert.equal(hospitalListings.meta.total, 2);
  assert.ok(hospitalListings.data.every((listing) => listing.provider.id === hospitalId));
  assert.ok(hospitalListings.data.every((listing) => listing.item.type === 'service'));

  const pharmacy = fixtures.demoSetActiveProvider(pharmacyId);
  assert.equal(pharmacy.type, 'pharmacy');
  const pharmacyListings = fixtures.demoListings();
  assert.equal(pharmacyListings.meta.total, 2);
  assert.ok(pharmacyListings.data.every((listing) => listing.item.type === 'medication'));
  assert.ok(fixtures.demoRequests().data.every((request) => request.listing.provider.id === pharmacyId));
});

test('demo listing create, edit, remove and duplicate conflict', () => {
  fixtures.demoReset();
  fixtures.demoSetActiveProvider(pharmacyId);
  const before = fixtures.demoListings().meta.total;
  const created = fixtures.demoCreateListing({
    item_id: newMedicationId,
    price: 12,
    pricing_unit: 'tablet',
    available: true,
    stock_quantity: 40
  });
  assert.equal(fixtures.demoListings().meta.total, before + 1);

  const updated = fixtures.demoUpdateListing(created.id, { price: 15, available: false, stock_quantity: null });
  assert.equal(updated.price, 15);
  assert.equal(updated.available, false);

  assert.throws(
    () => fixtures.demoCreateListing({ item_id: newMedicationId, price: 9, pricing_unit: 'tablet', available: true, stock_quantity: null }),
    /already exists/
  );
  assert.throws(
    () => fixtures.demoCreateListing({ item_id: serviceId, price: 9, pricing_unit: 'scan', available: true, stock_quantity: null }),
    /Pharmacies list medications only/
  );

  fixtures.demoRemoveListing(created.id);
  assert.equal(fixtures.demoListings().meta.total, before);
});

test('demo profile edits persist on the active provider', () => {
  fixtures.demoReset();
  fixtures.demoSetActiveProvider(pharmacyId);
  const updated = fixtures.demoUpdateProfile({ name: 'Demo Community Pharmacy', location: 'Mombasa' });
  assert.equal(fixtures.demoGetProfile().name, 'Demo Community Pharmacy');
  assert.ok(fixtures.demoListings().data.every((listing) => listing.provider.location === 'Mombasa'));

  fixtures.demoReset();
  assert.equal(fixtures.demoGetProfile().id, hospitalId);
});

test('demo request responses and expired filtering work', () => {
  fixtures.demoReset();
  const pending = fixtures.demoRequests({ status: 'pending' });
  assert.equal(pending.meta.total, 1);
  const answered = fixtures.demoRespondToRequest(pending.data[0].id, {
    status: 'confirmed',
    confirmed_price: 1200,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });
  assert.equal(answered.status, 'confirmed');
  assert.throws(() => fixtures.demoRespondToRequest(pending.data[0].id, { status: 'declined' }), /Only pending requests/);

  fixtures.demoSetActiveProvider(pharmacyId);
  assert.throws(() => fixtures.demoRespondToRequest(pending.data[0].id, { status: 'declined' }), /Request not found/);
  assert.equal(fixtures.demoRequests({ status: 'expired' }).meta.total, 0);
});
