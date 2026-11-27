import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Pencil, Pill, Plus, Search, Stethoscope, Trash2, X } from 'lucide-react';
import ConfirmationDialog from './ConfirmationDialog.jsx';
import Pager from './Pager.jsx';
import { formatKes, isStale, relativeTime } from './validation.js';

const EMPTY_FORM = { item_id: '', price: '', pricing_unit: '', available: 'true', stock_quantity: '' };

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'review', label: 'Needs review' },
];

const SORTS = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name', label: 'Item name' },
];

function catalogLabel(item) {
  const details = [item.strength, item.dosage_form].filter(Boolean).join(' · ');
  return details ? `${item.name} — ${details} (${item.unit})` : `${item.name} (${item.unit})`;
}

function listingName(listing) {
  return listing.item?.name || 'Unknown item';
}

function listingDetail(listing) {
  const item = listing.item;
  if (!item) return '';
  return [item.strength, item.dosage_form, item.unit].filter(Boolean).join(' · ');
}

export default function ListingManager({ listings, catalog, providerType, busy, canRemove, meta, onPageChange, onSave, onRemove }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('updated');
  const [pendingRemove, setPendingRemove] = useState(null);

  useEffect(() => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setErrors({});
    setFormOpen(false);
  }, [providerType]);

  const expectedType = providerType === 'pharmacy' ? 'medication' : providerType === 'hospital' ? 'service' : null;
  const visibleCatalog = expectedType ? catalog.filter((item) => item.type === expectedType) : catalog;
  const selectedItem = catalog.find((item) => item.id === form.item_id);
  const disableStock = selectedItem?.type === 'service' || providerType === 'hospital';

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = listings.filter((listing) => {
      if (needle) {
        const haystack = `${listing.item?.name || ''} ${listing.item?.strength || ''} ${listing.item?.dosage_form || ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (statusFilter === 'available' && !listing.available) return false;
      if (statusFilter === 'unavailable' && listing.available) return false;
      if (statusFilter === 'review' && !(listing.available && isStale(listing.updated_at))) return false;
      return true;
    });

    return rows.sort((a, b) => {
      if (sort === 'price_asc') return a.price - b.price;
      if (sort === 'price_desc') return b.price - a.price;
      if (sort === 'name') return listingName(a).localeCompare(listingName(b));
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [listings, query, statusFilter, sort]);

  const serviceRows = filtered.filter((listing) => listing.item?.type === 'service');
  const medicationRows = filtered.filter((listing) => listing.item?.type === 'medication');

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function chooseItem(id) {
    const item = catalog.find((entry) => entry.id === id);
    setForm((current) => ({
      ...current,
      item_id: id,
      pricing_unit: item?.unit || current.pricing_unit,
      stock_quantity: item?.type === 'service' ? '' : current.stock_quantity,
    }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  }

  function startEdit(listing) {
    setEditingId(listing.id);
    setForm({
      item_id: listing.item.id,
      price: String(listing.price),
      pricing_unit: listing.pricing_unit,
      available: String(listing.available),
      stock_quantity: listing.stock_quantity === null ? '' : String(listing.stock_quantity),
    });
    setErrors({});
    setFormOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(false);
  }

  function clearFilters() {
    setQuery('');
    setStatusFilter('all');
    setSort('updated');
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

  function renderGroup(items, type) {
    if (items.length === 0) return null;
    const Icon = type === 'service' ? Stethoscope : Pill;
    return (
      <div className="provider-list-group" key={type}>
        <div className="provider-list-group-head">
          <span className={`provider-list-group-title ${type === 'medication' ? 'is-medication' : 'is-service'}`}>
            <Icon aria-hidden="true" /> {type === 'service' ? 'Healthcare services' : 'Medications'}
          </span>
          <span className="provider-count-pill">{items.length}</span>
        </div>
        <div className="provider-table-wrap">
          <table className="provider-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Price</th>
                <th scope="col">Availability</th>
                <th scope="col">Updated</th>
                <th scope="col"><span className="provider-visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((listing) => {
                const stale = isStale(listing.updated_at);
                const badge = stale ? 'review' : listing.available ? 'available' : 'unavailable';
                const label = stale ? 'Needs review' : listing.available ? 'Available' : 'Unavailable';
                const detail = listingDetail(listing);
                return (
                  <tr key={listing.id}>
                    <td>
                      <div className="provider-item-cell">
                        <span className={`provider-item-icon ${type === 'medication' ? 'is-medication' : 'is-service'}`}>
                          <Icon aria-hidden="true" />
                        </span>
                        <div>
                          <strong>{listingName(listing)}</strong>
                          <small>{detail || type} · per {listing.pricing_unit}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong className="provider-price">{formatKes(listing.price)}</strong>
                      <small>per {listing.pricing_unit}</small>
                    </td>
                    <td>
                      <span className={`provider-badge provider-badge-${badge}`}>{label}</span>
                      <small>{listing.stock_quantity === null ? 'No stock count' : `${listing.stock_quantity} in stock`}</small>
                    </td>
                    <td>
                      <span className="provider-updated">{relativeTime(listing.updated_at)}</span>
                      {stale ? <em className="provider-updated-warning">Older than 24h</em> : null}
                    </td>
                    <td>
                      <div className="provider-row-actions">
                        <button type="button" className="provider-icon-button" onClick={() => startEdit(listing)} disabled={busy} aria-label={`Edit ${listingName(listing)}`} title="Edit listing">
                          <Pencil aria-hidden="true" />
                        </button>
                        {canRemove ? (
                          <button type="button" className="provider-icon-button is-danger" onClick={() => setPendingRemove(listing)} disabled={busy} aria-label={`Remove ${listingName(listing)}`} title="Remove listing">
                            <Trash2 aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="provider-stack">
      <div className="provider-toolbar">
        <div className="provider-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your listings by item, strength or form"
            aria-label="Search listings"
          />
        </div>
        <div className="provider-filter-group">
          <label className="provider-select-field">
            <span className="provider-visually-hidden">Filter by status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="provider-select-field">
            <span className="provider-visually-hidden">Sort listings</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" className={formOpen ? 'provider-button-secondary' : 'provider-button-primary'} onClick={formOpen ? resetForm : openCreate} disabled={busy}>
            {formOpen ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {formOpen ? 'Close form' : 'Add listing'}
          </button>
        </div>
      </div>

      <p className="provider-hint">
        Showing <strong>{filtered.length}</strong> of {listings.length} listings on this page
        {meta?.total ? ` · ${meta.total} total` : ''}. Stale availability claims are marked for review.
      </p>

      {formOpen ? (
        <form className="provider-form provider-form-card" onSubmit={submit} noValidate>
          <div className="provider-form-heading">
            <div>
              <h3>{editingId ? 'Edit listing' : 'Add a listing'}</h3>
              <p className="provider-hint">
                {providerType === 'pharmacy' ? 'Medications require an exact strength, form and unit.' : 'Services need a clear pricing unit.'}
              </p>
            </div>
            <button type="button" className="provider-icon-button" onClick={resetForm} aria-label="Close listing form" title="Close">
              <X aria-hidden="true" />
            </button>
          </div>

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
              {selectedItem ? <small>Catalog unit: {selectedItem.unit}</small> : null}
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
            <button type="button" className="provider-button-secondary" onClick={resetForm} disabled={busy}>Cancel</button>
            <button type="submit" className="provider-button-primary" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create listing'}
            </button>
          </div>
        </form>
      ) : null}

      {filtered.length === 0 ? (
        <div className="provider-empty provider-empty-card">
          <AlertCircle aria-hidden="true" />
          <strong>No listings match</strong>
          <p>Try a different search, status filter or sort.</p>
          <button type="button" className="provider-button-secondary" onClick={clearFilters}>Clear filters</button>
        </div>
      ) : (
        <>
          {renderGroup(serviceRows, 'service')}
          {renderGroup(medicationRows, 'medication')}
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
