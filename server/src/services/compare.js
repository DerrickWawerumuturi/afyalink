import { fromMinor, toMinor } from '../validation.js';

export function buildComparison(rows, items, currency = 'KES') {
  const requested = new Map(items.map((item) => [item.item_id, item.quantity]));
  const providers = new Map();

  for (const row of rows) {
    const quantity = requested.get(row.item_id);
    if (!quantity) continue;
    if (!row.available) continue;
    if (row.stock_quantity !== null && row.stock_quantity !== undefined && row.stock_quantity < quantity) {
      continue;
    }

    const unitMinor = toMinor(row.price);
    if (!Number.isFinite(unitMinor) || unitMinor < 0) continue;

    let provider = providers.get(row.provider_id);
    if (!provider) {
      provider = { provider_id: row.provider_id, linesByItem: new Map() };
      providers.set(row.provider_id, provider);
    }

    const existing = provider.linesByItem.get(row.item_id);
    if (!existing || unitMinor < existing.unitMinor) {
      provider.linesByItem.set(row.item_id, {
        item_id: row.item_id,
        listing_id: row.id,
        quantity,
        unitMinor,
      });
    }
  }

  const options = [];
  for (const provider of providers.values()) {
    const lines = [...provider.linesByItem.values()]
      .map((line) => ({
        item_id: line.item_id,
        listing_id: line.listing_id,
        quantity: line.quantity,
        unit_price: fromMinor(line.unitMinor),
        subtotal: fromMinor(line.unitMinor * line.quantity),
      }))
      .sort((a, b) => a.item_id.localeCompare(b.item_id));

    const missingItemIds = items
      .filter((item) => !provider.linesByItem.has(item.item_id))
      .map((item) => item.item_id);

    const complete = missingItemIds.length === 0;
    const totalMinor = lines.reduce(
      (sum, line) => sum + toMinor(line.subtotal),
      0,
    );

    const option = {
      provider_id: provider.provider_id,
      complete,
      lines,
      missing_item_ids: missingItemIds,
      total: complete ? fromMinor(totalMinor) : null,
      currency,
    };
    if (!complete) option.available_subtotal = fromMinor(totalMinor);
    options.push(option);
  }

  options.sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    const aMinor = toMinor(a.complete ? a.total : a.available_subtotal);
    const bMinor = toMinor(b.complete ? b.total : b.available_subtotal);
    if (aMinor !== bMinor) return aMinor - bMinor;
    return a.provider_id.localeCompare(b.provider_id);
  });

  return options;
}
