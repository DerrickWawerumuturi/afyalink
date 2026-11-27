import { daysUntilExpiry, expiryBucket } from './services/inventory.js';

export const LISTING_COLUMNS = `
  l.id, l.price, l.currency, l.pricing_unit, l.available, l.stock_quantity, l.updated_at,
  l.provider_id AS provider_id,
  p.name AS provider_name, p.type AS provider_type, p.location AS provider_location, p.verified AS provider_verified,
  l.item_id AS item_id,
  i.name AS item_name, i.type AS item_type, i.strength AS item_strength, i.dosage_form AS item_dosage_form, i.unit AS item_unit
`;

function toIso(value) {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toListing(row) {
  return {
    id: row.id,
    provider: {
      id: row.provider_id,
      name: row.provider_name,
      type: row.provider_type,
      location: row.provider_location,
      verified: row.provider_verified,
    },
    item: {
      id: row.item_id,
      name: row.item_name,
      type: row.item_type,
      strength: row.item_strength,
      dosage_form: row.item_dosage_form,
      unit: row.item_unit,
    },
    price: Number(row.price),
    currency: row.currency,
    pricing_unit: row.pricing_unit,
    available: row.available,
    stock_quantity: row.stock_quantity,
    updated_at: toIso(row.updated_at),
  };
}

export function toRequest(row) {
  return {
    id: row.id,
    listing_id: row.listing_id,
    quantity: row.quantity,
    request_group_id: row.request_group_id ?? null,
    status: row.effective_status ?? row.status,
    confirmed_price:
      row.confirmed_price === null || row.confirmed_price === undefined
        ? null
        : Number(row.confirmed_price),
    currency: row.currency || 'KES',
    expires_at: toIso(row.expires_at),
    created_at: toIso(row.created_at),
  };
}

export function toProviderRequest(row) {
  return {
    ...toRequest(row),
    listing: {
      id: row.listing_id,
      price: Number(row.listing_price),
      currency: row.currency,
      pricing_unit: row.pricing_unit,
    },
    item: {
      id: row.item_id,
      name: row.item_name,
      type: row.item_type,
      strength: row.item_strength,
      dosage_form: row.item_dosage_form,
      unit: row.item_unit,
    },
  };
}

export const INVENTORY_BATCH_COLUMNS = `
  b.id, b.batch_number, b.manufacturer, b.supplier,
  b.date_received::text AS date_received, b.expiry_date::text AS expiry_date,
  b.initial_quantity, b.current_quantity, b.unit, b.storage_info, b.status,
  b.created_at, b.updated_at, b.provider_id, b.listing_id,
  l.price AS listing_price, l.currency, l.pricing_unit,
  i.id AS item_id, i.name AS item_name, i.type AS item_type,
  i.strength AS item_strength, i.dosage_form AS item_dosage_form, i.unit AS item_unit
`;

export const INVENTORY_MOVEMENT_COLUMNS = `
  m.id, m.batch_id, m.provider_id, m.movement_type, m.quantity,
  m.previous_balance, m.new_balance, m.reason, m.reference,
  m.actor_user_id, m.actor_label, m.occurred_at, m.created_at,
  b.batch_number, b.unit,
  l.id AS listing_id, i.id AS item_id, i.name AS item_name
`;

export function toInventoryBatch(row, now = new Date()) {
  const days = daysUntilExpiry(row.expiry_date, now);
  return {
    id: row.id,
    provider_id: row.provider_id,
    listing_id: row.listing_id,
    batch_number: row.batch_number,
    manufacturer: row.manufacturer,
    supplier: row.supplier,
    date_received: row.date_received,
    expiry_date: row.expiry_date,
    initial_quantity: row.initial_quantity,
    current_quantity: row.current_quantity,
    unit: row.unit,
    storage_info: row.storage_info,
    status: row.status,
    expiry_bucket: expiryBucket(days),
    days_to_expiry: days,
    inventory_value: row.current_quantity * Number(row.listing_price),
    currency: row.currency,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    listing: {
      id: row.listing_id,
      price: Number(row.listing_price),
      currency: row.currency,
      pricing_unit: row.pricing_unit,
    },
    item: {
      id: row.item_id,
      name: row.item_name,
      type: row.item_type,
      strength: row.item_strength,
      dosage_form: row.item_dosage_form,
      unit: row.item_unit,
    },
  };
}

export function toInventoryMovement(row) {
  return {
    id: row.id,
    batch_id: row.batch_id,
    provider_id: row.provider_id,
    batch_number: row.batch_number,
    movement_type: row.movement_type,
    quantity: row.quantity,
    previous_balance: row.previous_balance,
    new_balance: row.new_balance,
    reason: row.reason,
    reference: row.reference,
    actor: {
      id: row.actor_user_id,
      label: row.actor_label,
    },
    item: {
      id: row.item_id,
      name: row.item_name,
      unit: row.unit,
    },
    listing_id: row.listing_id,
    occurred_at: toIso(row.occurred_at),
    created_at: toIso(row.created_at),
  };
}

export function toInventoryAudit(row) {
  return {
    id: row.id,
    provider_id: row.provider_id,
    notes: row.notes,
    counted_by: {
      id: row.counted_by,
      label: row.counted_by_label,
    },
    counted_at: toIso(row.counted_at),
    created_at: toIso(row.created_at),
    total_expected: Number(row.total_expected ?? 0),
    total_counted: Number(row.total_counted ?? 0),
    discrepancy: Number(row.total_discrepancy ?? 0),
  };
}

export function toInventoryAuditLine(row) {
  return {
    id: row.id,
    audit_id: row.audit_id,
    batch_id: row.batch_id,
    batch_number: row.batch_number,
    item_name: row.item_name,
    unit: row.unit,
    expected_quantity: row.expected_quantity,
    counted_quantity: row.counted_quantity,
    discrepancy: row.discrepancy,
  };
}

export function toProviderEvent(row) {
  return {
    id: row.id,
    provider_id: row.provider_id,
    action: row.action,
    record_type: row.record_type,
    record_id: row.record_id,
    previous_value: row.previous_value,
    new_value: row.new_value,
    actor: {
      id: row.actor_user_id,
      label: row.actor_label,
    },
    occurred_at: toIso(row.occurred_at),
  };
}
