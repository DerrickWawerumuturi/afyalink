import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComparison } from '../src/services/compare.js';

function row(overrides) {
  return {
    id: 'listing',
    provider_id: 'provider',
    item_id: 'item',
    price: '10.00',
    available: true,
    stock_quantity: null,
    ...overrides,
  };
}

test('ranks complete baskets first and separates partial options', () => {
  const rows = [
    row({ id: 'l1', provider_id: 'p1', item_id: 'i1', price: '10.00', stock_quantity: 50 }),
    row({ id: 'l2', provider_id: 'p1', item_id: 'i2', price: '5.00', stock_quantity: 50 }),
    row({ id: 'l3', provider_id: 'p2', item_id: 'i1', price: '9.00', stock_quantity: 50 }),
    row({ id: 'l4', provider_id: 'p2', item_id: 'i2', price: '5.00', available: false }),
  ];
  const items = [
    { item_id: 'i1', quantity: 10 },
    { item_id: 'i2', quantity: 2 },
  ];

  const result = buildComparison(rows, items);

  assert.equal(result.length, 2);
  assert.equal(result[0].provider_id, 'p1');
  assert.equal(result[0].complete, true);
  assert.equal(result[0].total, 110);
  assert.deepEqual(result[0].missing_item_ids, []);
  assert.equal(result[0].available_subtotal, undefined);

  assert.equal(result[1].provider_id, 'p2');
  assert.equal(result[1].complete, false);
  assert.equal(result[1].total, null);
  assert.equal(result[1].available_subtotal, 90);
  assert.deepEqual(result[1].missing_item_ids, ['i2']);
});

test('chooses the cheapest eligible listing per provider and item', () => {
  const rows = [
    row({ id: 'expensive', provider_id: 'p1', item_id: 'i1', price: '12.00', stock_quantity: 50 }),
    row({ id: 'cheapest', provider_id: 'p1', item_id: 'i1', price: '10.00', stock_quantity: 50 }),
    row({ id: 'cheap-but-short', provider_id: 'p1', item_id: 'i1', price: '1.00', stock_quantity: 1 }),
  ];
  const items = [{ item_id: 'i1', quantity: 5 }];

  const result = buildComparison(rows, items);

  assert.equal(result.length, 1);
  assert.equal(result[0].lines[0].listing_id, 'cheapest');
  assert.equal(result[0].lines[0].unit_price, 10);
  assert.equal(result[0].total, 50);
});

test('treats null stock as unlimited and skips unavailable listings', () => {
  const rows = [
    row({ id: 'unlimited', provider_id: 'p1', item_id: 'i1', price: '2.50', stock_quantity: null }),
    row({ id: 'off', provider_id: 'p2', item_id: 'i1', price: '2.00', available: false }),
  ];
  const items = [{ item_id: 'i1', quantity: 3 }];

  const result = buildComparison(rows, items);

  assert.equal(result.length, 1);
  assert.equal(result[0].provider_id, 'p1');
  assert.equal(result[0].total, 7.5);
});

test('computes subtotals without floating point drift', () => {
  const rows = [row({ id: 'l1', provider_id: 'p1', item_id: 'i1', price: '0.10' })];
  const items = [{ item_id: 'i1', quantity: 3 }];

  const result = buildComparison(rows, items);

  assert.equal(result[0].lines[0].subtotal, 0.3);
  assert.equal(result[0].total, 0.3);
});
