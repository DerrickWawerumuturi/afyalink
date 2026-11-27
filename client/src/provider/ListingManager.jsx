import { useState } from 'react';
import { formatKes, formatTimestamp } from './validation.js';

const EMPTY_FORM = { item_id: '', price: '', pricing_unit: '', available: 'true', stock_quantity: '' };

function catalogLabel(item) {
  const details = [item.strength, item.dosage_form].filter(Boolean).join(' · ');
  return details ? `${item.name} — ${details} (${item.unit})` : `${item.name} (${item.unit})`;
}

export default function ListingManager({ listings, catalog, busy, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);

  const selectedItem = catalog.find((item) => item.id === form.item_id);
  const isService = selectedItem?.type === 'service';

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function chooseItem(id) {
    const item = catalog.find((entry) => entry.id === id);
    setForm((current) => ({
      ...current,
      item_id: id,
      pricing_unit: item?.unit || current.pricing_unit,
      stock_quantity: item?.type === 'service' ? '' : current.stock_quantity
    }));
  }

  function startEdit(listing) {
    setEditingId(listing.id);
    setForm({
      item_id: listing.item.id,
      price: String(listing.price),
      pricing_unit: listing.pricing_unit,
      available: String(listing.available),
      stock_quantity: listing.stock_quantity === null ? '' : String(listing.stock_quantity)
    });
    setErrors({});
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  async function submit(event) {
    event.preventDefault();
    const saved = await onSave(editingId ? { type: 'update', id: editingId, value: form } : { type: 'create', value: form }, setErrors);
    if (saved) resetForm();
  }

  return (
    <div className="provider-stack">
      <form className="provider-form" onSubmit={submit} noValidate>
        <div className="provider-form-heading">
          <h3>{editingId ? 'Edit listing' : 'Add a listing'}</h3>
          {editingId ? <button type="button" className="provider-button-secondary" onClick={resetForm}>Cancel edit</button> : null}
        </div>
        <p className="provider-hint">Synthetic catalog and prices. Availability is provider-reported, not a stock guarantee.</p>

        <div className="provider-form-grid">
          <label className="provider-field">
            <span>Catalog item</span>
            <select value={form.item_id} onChange={(event) => chooseItem(event.target.value)} disabled={Boolean(editingId)}>
              <option value="">Choose an item</option>
              {catalog.map((item) => <option key={item.id} value={item.id}>{catalogLabel(item)}</option>)}
            </select>
            {errors.item_id ? <em role="alert">{errors.item_id}</em> : null}
          </label>

          <label className="provider-field">
            <span>Unit price (KES)</span>
            <input type="text" inputMode="decimal" value={form.price} onChange={(event) => updateField('price', event.target.value)} placeholder="1200" />
            {errors.price ? <em role="alert">{errors.price}</em> : null}
          </label>

          <label className="provider-field">
            <span>Pricing unit</span>
            <input type="text" value={form.pricing_unit} onChange={(event) => updateField('pricing_unit', event.target.value)} placeholder="scan" />
            {errors.pricing_unit ? <em role="alert">{errors.pricing_unit}</em> : null}
          </label>

          <label className="provider-field">
            <span>Availability</span>
            <select value={form.available} onChange={(event) => updateField('available', event.target.value)}>
              <option value="true">Available</option>
              <option value="false">Unavailable</option>
            </select>
          </label>

          <label className="provider-field">
            <span>Stock quantity</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.stock_quantity}
              onChange={(event) => updateField('stock_quantity', event.target.value)}
              placeholder="Optional"
              disabled={isService}
            />
            {isService ? <small>Services do not use stock counts.</small> : null}
            {errors.stock_quantity ? <em role="alert">{errors.stock_quantity}</em> : null}
          </label>
        </div>

        <div className="provider-actions">
          <button type="submit" className="provider-button-primary" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create listing'}</button>
        </div>
      </form>

      <div className="provider-table-wrap">
        <table className="provider-table">
          <thead>
            <tr><th scope="col">Item</th><th scope="col">Price</th><th scope="col">Availability</th><th scope="col">Updated</th><th scope="col">Action</th></tr>
          </thead>
          <tbody>
            {listings.length === 0 ? (
              <tr><td colSpan="5" className="provider-empty">No listings yet. Add a synthetic listing above.</td></tr>
            ) : listings.map((listing) => (
              <tr key={listing.id}>
                <td>
                  <strong>{listing.item?.name || 'Unknown item'}</strong>
                  <small>{[listing.item?.strength, listing.item?.dosage_form].filter(Boolean).join(' · ') || listing.item?.type} · per {listing.pricing_unit}</small>
                </td>
                <td>{formatKes(listing.price)}</td>
                <td>
                  <span className={`provider-badge ${listing.available ? 'provider-badge-available' : 'provider-badge-unavailable'}`}>
                    {listing.available ? `Available${listing.stock_quantity === null ? '' : ` · ${listing.stock_quantity} in stock`}` : 'Unavailable'}
                  </span>
                </td>
                <td><small>{formatTimestamp(listing.updated_at)}</small></td>
                <td><button type="button" className="provider-button-secondary" onClick={() => startEdit(listing)} disabled={busy}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
