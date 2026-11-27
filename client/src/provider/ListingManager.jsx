import { useEffect, useState } from 'react';
import ConfirmationDialog from './ConfirmationDialog.jsx';
import Pager from './Pager.jsx';
import { formatKes, formatTimestamp, isStale } from './validation.js';

const EMPTY_FORM = { item_id: '', price: '', pricing_unit: '', available: 'true', stock_quantity: '' };

function catalogLabel(item) {
  const details = [item.strength, item.dosage_form].filter(Boolean).join(' · ');
  return details ? `${item.name} — ${details} (${item.unit})` : `${item.name} (${item.unit})`;
}

function listingName(listing) {
  return listing.item?.name || 'Unknown item';
}

export default function ListingManager({ listings, catalog, providerType, busy, canRemove, meta, onPageChange, onSave, onRemove }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [pendingRemove, setPendingRemove] = useState(null);

  useEffect(() => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setErrors({});
  }, [providerType]);

  const expectedType = providerType === 'pharmacy' ? 'medication' : providerType === 'hospital' ? 'service' : null;
  const visibleCatalog = expectedType ? catalog.filter((item) => item.type === expectedType) : catalog;
  const selectedItem = catalog.find((item) => item.id === form.item_id);
  const disableStock = selectedItem?.type === 'service' || providerType === 'hospital';
  const filtered = typeFilter === 'all' ? listings : listings.filter((listing) => listing.item?.type === typeFilter);

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

  async function confirmRemove() {
    const removed = await onRemove(pendingRemove.id);
    if (removed) setPendingRemove(null);
  }

  function renderTable(items, title) {
    if (items.length === 0) return null;
    return (
      <div className="provider-table-wrap">
        <h4 className="provider-section-title">{title}</h4>
        <table className="provider-table">
          <thead>
            <tr><th scope="col">Item</th><th scope="col">Price</th><th scope="col">Availability</th><th scope="col">Updated</th><th scope="col">Actions</th></tr>
          </thead>
          <tbody>
            {items.map((listing) => {
              const stale = isStale(listing.updated_at);
              const badgeClass = stale ? 'provider-badge-review' : listing.available ? 'provider-badge-available' : 'provider-badge-unavailable';
              const badgeText = stale ? 'Needs review' : listing.available ? `Available${listing.stock_quantity === null ? '' : ` · ${listing.stock_quantity} in stock`}` : 'Unavailable';
              return (
                <tr key={listing.id}>
                  <td>
                    <strong>{listingName(listing)}</strong>
                    <small>{[listing.item?.strength, listing.item?.dosage_form].filter(Boolean).join(' · ') || listing.item?.type} · per {listing.pricing_unit}</small>
                  </td>
                  <td>{formatKes(listing.price)}</td>
                  <td><span className={`provider-badge ${badgeClass}`}>{badgeText}</span></td>
                  <td><small>{formatTimestamp(listing.updated_at)}{stale ? ' · older than 24 hours' : ''}</small></td>
                  <td>
                    <div className="provider-row-actions">
                      <button type="button" className="provider-button-secondary" onClick={() => startEdit(listing)} disabled={busy}>Edit</button>
                      {canRemove ? <button type="button" className="provider-button-danger" onClick={() => setPendingRemove(listing)} disabled={busy}>Remove</button> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="provider-stack">
      <form className="provider-form" onSubmit={submit} noValidate>
        <div className="provider-form-heading">
          <h3>{editingId ? 'Edit listing' : 'Add a listing'}</h3>
          {editingId ? <button type="button" className="provider-button-secondary" onClick={resetForm}>Cancel edit</button> : null}
        </div>
        <p className="provider-hint">
          {providerType === 'pharmacy' ? 'Pharmacies list medications with an exact strength, form and unit.' : 'Hospitals list healthcare services with a clear pricing unit.'}
          Availability is provider-reported, not a stock guarantee.
        </p>

        <div className="provider-form-grid">
          <label className="provider-field">
            <span>Catalog item</span>
            <select value={form.item_id} onChange={(event) => chooseItem(event.target.value)} disabled={Boolean(editingId)}>
              <option value="">Choose an item</option>
              {visibleCatalog.map((item) => <option key={item.id} value={item.id}>{catalogLabel(item)}</option>)}
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
              disabled={disableStock}
            />
            {disableStock ? <small>Services do not use stock counts.</small> : null}
            {errors.stock_quantity ? <em role="alert">{errors.stock_quantity}</em> : null}
          </label>
        </div>

        <div className="provider-actions">
          <button type="submit" className="provider-button-primary" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create listing'}</button>
        </div>
      </form>

      <div className="provider-toolbar">
        <label className="provider-field provider-field-inline">
          <span>Show</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All types</option>
            <option value="service">Services</option>
            <option value="medication">Medications</option>
          </select>
        </label>
        <p className="provider-hint">Data older than 24 hours is marked “Needs review” and is not presented as currently available.</p>
      </div>

      {filtered.length === 0 ? (
        <p className="provider-empty">No listings match this filter.</p>
      ) : (
        <>
          {renderTable(filtered.filter((listing) => listing.item?.type === 'service'), 'Healthcare services')}
          {renderTable(filtered.filter((listing) => listing.item?.type === 'medication'), 'Medications')}
        </>
      )}

      <Pager meta={meta} disabled={busy} label="Listing" onChange={onPageChange} />

      <ConfirmationDialog
        open={Boolean(pendingRemove)}
        title="Remove listing"
        description={pendingRemove ? `Remove ${listingName(pendingRemove)} at ${formatKes(pendingRemove.price)} per ${pendingRemove.pricing_unit}? This cannot be undone. Listings with request history may be protected by the API.` : ''}
        confirmLabel="Remove listing"
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemove(null)}
        busy={busy}
      />
    </div>
  );
}
