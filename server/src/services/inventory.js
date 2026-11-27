export const MOVEMENT_TYPES = [
  'received',
  'dispensed',
  'adjustment',
  'damaged',
  'expired',
  'quarantined',
  'returned',
];

export const POSITIVE_MOVEMENTS = new Set(['received', 'returned']);
export const NEGATIVE_MOVEMENTS = new Set(['dispensed', 'damaged', 'expired', 'quarantined']);

export function isMovementQuantityValid(movementType, quantity) {
  if (!MOVEMENT_TYPES.includes(movementType)) return false;
  if (!Number.isInteger(quantity) || quantity === 0) return false;
  if (POSITIVE_MOVEMENTS.has(movementType)) return quantity > 0;
  if (NEGATIVE_MOVEMENTS.has(movementType)) return quantity < 0;
  return true;
}

export function nextBalance(previousBalance, quantity) {
  return previousBalance + quantity;
}

export function utcDayStart(value = new Date()) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function daysUntilExpiry(expiryDate, now = new Date()) {
  const expiry = Date.parse(`${expiryDate}T00:00:00Z`);
  if (Number.isNaN(expiry)) return null;
  return Math.round((expiry - utcDayStart(now)) / 86_400_000);
}

export function expiryBucket(days) {
  if (days === null) return 'unknown';
  if (days < 0) return 'expired';
  if (days <= 30) return 'within_30_days';
  if (days <= 60) return 'within_60_days';
  if (days <= 90) return 'within_90_days';
  return 'safe';
}

export function actorLabel(user) {
  if (!user) return 'system';
  return user.email || user.id || 'unknown';
}

function toDateString(milliseconds) {
  return new Date(milliseconds).toISOString().slice(0, 10);
}

export function buildForecast(
  { currentStock, dispensedLast30, dispensedLast14, dispensedPrevious14 },
  now = new Date(),
) {
  const stock = Math.max(0, Number(currentStock) || 0);
  const averageDailyConsumption = (Number(dispensedLast30) || 0) / 30;
  const sufficientHistory = averageDailyConsumption > 0;
  const daysRemaining = sufficientHistory ? Math.floor(stock / averageDailyConsumption) : null;
  const stockoutDate =
    daysRemaining === null ? null : toDateString(utcDayStart(now) + daysRemaining * 86_400_000);

  let trend = 'insufficient_data';
  if (dispensedLast14 > dispensedPrevious14) trend = 'increasing';
  else if (dispensedLast14 < dispensedPrevious14) trend = 'decreasing';
  else if (dispensedLast14 > 0 || dispensedPrevious14 > 0) trend = 'stable';

  let dataStatus = 'sufficient';
  let explanation = `Based on ${averageDailyConsumption.toFixed(2)} units consumed per day over the last 30 days.`;
  if (stock === 0) {
    dataStatus = 'no_stock';
    explanation = 'No stock is currently recorded for this medicine.';
  } else if (!sufficientHistory) {
    dataStatus = 'insufficient_history';
    explanation = 'No dispensing movements were recorded in the last 30 days, so stockout timing cannot be estimated.';
  }

  return {
    current_stock: stock,
    average_daily_consumption: Number(averageDailyConsumption.toFixed(2)),
    days_remaining: daysRemaining,
    stockout_date: stockoutDate,
    trend,
    reorder_warning: daysRemaining !== null && daysRemaining <= 14,
    data_status: dataStatus,
    explanation,
  };
}

function runner(executor) {
  if (typeof executor === 'function') return executor;
  return (text, params) => executor.query(text, params);
}

export async function logProviderEvent(executor, event) {
  const run = runner(executor);
  await run(
    `insert into public.provider_events
       (provider_id, actor_user_id, actor_label, action, record_type, record_id, previous_value, new_value)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
    [
      event.providerId,
      event.userId ?? null,
      event.actorLabel,
      event.action,
      event.recordType,
      event.recordId,
      event.previousValue ? JSON.stringify(event.previousValue) : null,
      event.newValue ? JSON.stringify(event.newValue) : null,
    ],
  );
}
