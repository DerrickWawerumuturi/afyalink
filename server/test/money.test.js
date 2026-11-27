import test from 'node:test';
import assert from 'node:assert/strict';
import { fromMinor, moneySchema, toMinor } from '../src/validation.js';

test('toMinor/fromMinor round-trip KES amounts', () => {
  assert.equal(toMinor(12.34), 1234);
  assert.equal(toMinor(5), 500);
  assert.equal(toMinor('5.00'), 500);
  assert.equal(fromMinor(1234), 12.34);
});

test('moneySchema rejects negative, non-finite and over-precise values', () => {
  assert.equal(moneySchema.safeParse(12.34).success, true);
  assert.equal(moneySchema.safeParse(0).success, true);
  assert.equal(moneySchema.safeParse(-1).success, false);
  assert.equal(moneySchema.safeParse(Number.NaN).success, false);
  assert.equal(moneySchema.safeParse(Number.POSITIVE_INFINITY).success, false);
  assert.equal(moneySchema.safeParse(1.234).success, false);
});
