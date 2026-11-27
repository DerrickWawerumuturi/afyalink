const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const WHOLE_NUMBER_PATTERN = /^\d+$/;

export function formatKes(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `KSh ${value.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatTimestamp(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return `${date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

export function parseMoney(value) {
  const text = String(value ?? '').trim();
  if (!MONEY_PATTERN.test(text)) return null;
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : null;
}

export function parseWholeNumber(value) {
  const text = String(value ?? '').trim();
  if (!WHOLE_NUMBER_PATTERN.test(text)) return null;
  const amount = Number(text);
  return Number.isSafeInteger(amount) ? amount : null;
}

export function toDateTimeLocal(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function effectiveStatus(request, now = Date.now()) {
  if (!request) return 'unknown';
  const status = String(request.status || 'unknown');
  if (['pending', 'confirmed'].includes(status) && request.expires_at && new Date(request.expires_at).getTime() <= now) {
    return 'expired';
  }
  return status;
}

export function validateListingInput(input, catalog = []) {
  const errors = {};
  const itemId = String(input.item_id || '');
  const price = parseMoney(input.price);
  const pricingUnit = String(input.pricing_unit || '').trim();
  const stockText = String(input.stock_quantity ?? '').trim();
  const stock = parseWholeNumber(stockText);
  const available = String(input.available) === 'true';
  const item = catalog.find((entry) => entry.id === itemId);

  if (!UUID_PATTERN.test(itemId) || !item) errors.item_id = 'Choose a catalog item.';
  if (price === null) errors.price = 'Enter a non-negative price with at most two decimals.';
  if (!pricingUnit || pricingUnit.length > 40) errors.pricing_unit = 'Enter a pricing unit of at most 40 characters.';
  if (stockText !== '' && stock === null) errors.stock_quantity = 'Stock must be a non-negative whole number.';
  if (item && item.type === 'medication' && pricingUnit.toLowerCase() !== String(item.unit || '').toLowerCase()) {
    errors.pricing_unit = `Medication pricing unit must be ${item.unit}.`;
  }

  return {
    errors,
    value: {
      item_id: itemId,
      price,
      pricing_unit: pricingUnit,
      available,
      stock_quantity: stock
    }
  };
}

export function validateResponseInput(input) {
  const status = String(input.status || '');
  if (status === 'declined') return { errors: {}, value: { status: 'declined' } };
  if (status !== 'confirmed') return { errors: { status: 'Choose confirm or decline.' }, value: null };

  const errors = {};
  const confirmedPrice = parseMoney(input.confirmed_price);
  const expiry = input.expires_at ? new Date(input.expires_at) : null;
  const now = Date.now();
  const latest = now + 24 * 60 * 60 * 1000;

  if (confirmedPrice === null) errors.confirmed_price = 'Enter a non-negative unit price with at most two decimals.';
  if (!expiry || Number.isNaN(expiry.getTime()) || expiry.getTime() <= now) {
    errors.expires_at = 'Choose an expiry in the future.';
  } else if (expiry.getTime() > latest) {
    errors.expires_at = 'Expiry must be within 24 hours.';
  }

  return {
    errors,
    value: Object.keys(errors).length ? null : { status: 'confirmed', confirmed_price: confirmedPrice, expires_at: expiry.toISOString() }
  };
}
