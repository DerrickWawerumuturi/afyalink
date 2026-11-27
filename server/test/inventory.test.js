import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildForecast,
  daysUntilExpiry,
  expiryBucket,
  isMovementQuantityValid,
  nextBalance,
} from '../src/services/inventory.js';

test('movement quantities must match movement direction', () => {
  assert.equal(isMovementQuantityValid('received', 10), true);
  assert.equal(isMovementQuantityValid('returned', 2), true);
  assert.equal(isMovementQuantityValid('dispensed', -5), true);
  assert.equal(isMovementQuantityValid('damaged', -1), true);
  assert.equal(isMovementQuantityValid('quarantined', -3), true);
  assert.equal(isMovementQuantityValid('expired', -4), true);
  assert.equal(isMovementQuantityValid('adjustment', -7), true);
  assert.equal(isMovementQuantityValid('adjustment', 7), true);
  assert.equal(isMovementQuantityValid('dispensed', 5), false);
  assert.equal(isMovementQuantityValid('received', -5), false);
  assert.equal(isMovementQuantityValid('received', 0), false);
  assert.equal(isMovementQuantityValid('unknown', 5), false);
});

test('balances cannot become negative', () => {
  assert.equal(nextBalance(100, -20), 80);
  assert.equal(nextBalance(0, 5), 5);
  assert.equal(nextBalance(4, -5), -1);
});

test('expiry buckets are based on UTC dates', () => {
  const now = new Date('2026-11-27T23:30:00Z');
  assert.equal(daysUntilExpiry('2026-11-27', now), 0);
  assert.equal(daysUntilExpiry('2026-12-27', now), 30);
  assert.equal(expiryBucket(daysUntilExpiry('2026-11-26', now)), 'expired');
  assert.equal(expiryBucket(daysUntilExpiry('2026-12-27', now)), 'within_30_days');
  assert.equal(expiryBucket(daysUntilExpiry('2027-01-26', now)), 'within_60_days');
  assert.equal(expiryBucket(daysUntilExpiry('2027-02-25', now)), 'within_90_days');
  assert.equal(expiryBucket(daysUntilExpiry('2027-03-01', now)), 'safe');
});

test('forecast uses explainable average daily consumption', () => {
  const now = new Date('2026-11-27T12:00:00Z');
  const forecast = buildForecast(
    {
      currentStock: 100,
      dispensedLast30: 600,
      dispensedLast14: 300,
      dispensedPrevious14: 300,
    },
    now,
  );
  assert.equal(forecast.average_daily_consumption, 20);
  assert.equal(forecast.days_remaining, 5);
  assert.equal(forecast.stockout_date, '2026-12-02');
  assert.equal(forecast.trend, 'stable');
  assert.equal(forecast.reorder_warning, true);
  assert.equal(forecast.data_status, 'sufficient');
});

test('forecast reports insufficient history honestly', () => {
  const forecast = buildForecast({
    currentStock: 40,
    dispensedLast30: 0,
    dispensedLast14: 0,
    dispensedPrevious14: 0,
  });
  assert.equal(forecast.days_remaining, null);
  assert.equal(forecast.stockout_date, null);
  assert.equal(forecast.trend, 'insufficient_data');
  assert.equal(forecast.data_status, 'insufficient_history');
  assert.equal(forecast.reorder_warning, false);
});

test('forecast reports no stock without inventing consumption', () => {
  const forecast = buildForecast({
    currentStock: 0,
    dispensedLast30: 100,
    dispensedLast14: 50,
    dispensedPrevious14: 50,
  });
  assert.equal(forecast.days_remaining, 0);
  assert.equal(forecast.data_status, 'no_stock');
  assert.equal(forecast.reorder_warning, true);
});
