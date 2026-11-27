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

export const APPOINTMENT_COLUMNS = `
  a.id, a.listing_id, a.requested_for, a.status, a.notes, a.created_at, a.updated_at,
  l.price AS listing_price, l.currency, l.pricing_unit,
  p.id AS provider_id, p.name AS provider_name, p.type AS provider_type,
  p.location AS provider_location, p.verified AS provider_verified,
  i.id AS item_id, i.name AS item_name, i.type AS item_type,
  i.strength AS item_strength, i.dosage_form AS item_dosage_form, i.unit AS item_unit
`;

export const APPOINTMENT_FROM = `
  FROM appointments a
  JOIN listings l ON l.id = a.listing_id
  JOIN providers p ON p.id = l.provider_id
  JOIN catalog_items i ON i.id = l.item_id
`;

export function toAppointment(row) {
  return {
    id: row.id,
    listing_id: row.listing_id,
    requested_for: toIso(row.requested_for),
    status: row.status,
    notes: row.notes ?? null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    listing: {
      id: row.listing_id,
      price: Number(row.listing_price),
      currency: row.currency,
      pricing_unit: row.pricing_unit,
    },
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
  };
}
