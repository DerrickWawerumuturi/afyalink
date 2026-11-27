import { useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Inbox,
  Search,
  XCircle,
} from 'lucide-react';
import ConfirmationDialog from './ConfirmationDialog.jsx';
import Pager from './Pager.jsx';
import {
  effectiveStatus,
  expiresIn,
  formatKes,
  formatTimestamp,
  isStale,
  relativeTime,
  toDateTimeLocal,
  validateResponseInput,
} from './validation.js';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
];

function newDraft(request) {
  return {
    confirmed_price: request?.listing?.price === undefined ? '' : String(request.listing.price),
    expires_at: toDateTimeLocal(new Date(Date.now() + 60 * 60000)),
  };
}

function itemName(request) {
  return request.item?.name || request.listing?.item?.name || 'Unknown item';
}

function itemDetail(request) {
  const item = request.item || request.listing?.item;
  if (!item) return '';
  return [item.strength, item.dosage_form, item.unit].filter(Boolean).join(' · ');
}

export default function RequestInbox({ requests, busy, meta, onPageChange, onRespond }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState({});
  const [errors, setErrors] = useState({});
  const [pendingDecline, setPendingDecline] = useState(null);

  const counts = requests.reduce((result, request) => {
    const status = effectiveStatus(request);
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {});

  const needle = query.trim().toLowerCase();
  const visible = requests.filter((request) => {
    if (filter !== 'all' && effectiveStatus(request) !== filter) return false;
    if (!needle) return true;
    return `${itemName(request)} ${itemDetail(request)}`.toLowerCase().includes(needle);
  });

  const declineTarget = requests.find((request) => request.id === pendingDecline);

  function draftFor(request) {
    return drafts[request.id] || newDraft(request);
  }

  function updateDraft(request, field, value) {
    const id = request.id;
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] || newDraft(request)), [field]: value } }));
  }

  function clearDraft(id) {
    setDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function confirm(request) {
    const draft = draftFor(request);
    const { errors: nextErrors, value } = validateResponseInput({ ...draft, status: 'confirmed' });
    setErrors((current) => ({ ...current, [request.id]: nextErrors }));
    if (!value) return;
    const saved = await onRespond(request.id, value);
    if (saved) clearDraft(request.id);
  }

  async function confirmDecline() {
    const saved = await onRespond(pendingDecline, { status: 'declined' });
    if (saved) {
      clearDraft(pendingDecline);
      setPendingDecline(null);
    }
  }

  return (
    <div className="provider-stack">
      <div className="provider-toolbar">
        <div className="provider-filter-chips" role="group" aria-label="Filter enquiries by status">
          {FILTERS.map((option) => {
            const count = option.value === 'all' ? requests.length : counts[option.value] || 0;
            return (
              <button
                key={option.value}
                type="button"
                className={filter === option.value ? 'provider-chip-button is-active' : 'provider-chip-button'}
                onClick={() => setFilter(option.value)}
                aria-pressed={filter === option.value}
              >
                {option.label}
                <span>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="provider-search provider-search-compact">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search enquiries"
            aria-label="Search enquiries"
          />
        </div>
      </div>

      <p className="provider-hint">
        Showing <strong>{visible.length}</strong> of {requests.length} enquiries on this page
        {meta?.total ? ` · ${meta.total} total` : ''}. Confirmed prices snapshot the quote and expire automatically.
      </p>

      {visible.length === 0 ? (
        <div className="provider-empty provider-empty-card">
          <Inbox aria-hidden="true" />
          <strong>No enquiries to show</strong>
          <p>{needle || filter !== 'all' ? 'Try a different search or status filter.' : 'New patient enquiries will appear here.'}</p>
          {(needle || filter !== 'all') ? (
            <button type="button" className="provider-button-secondary" onClick={() => { setQuery(''); setFilter('all'); }}>
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="provider-request-list">
          {visible.map((request) => {
            const status = effectiveStatus(request);
            const draft = draftFor(request);
            const requestErrors = errors[request.id] || {};
            const detail = itemDetail(request);
            const stale = Boolean(request.listing?.updated_at) && isStale(request.listing.updated_at);
            const unitPrice = Number(request.listing?.price) || 0;
            const urgent = status === 'pending' && request.expires_at && new Date(request.expires_at).getTime() - Date.now() < 60 * 60 * 1000;
            const StatusIcon = status === 'confirmed' ? CheckCircle2 : status === 'declined' ? XCircle : status === 'expired' ? CircleSlash : CalendarClock;

            return (
              <li key={request.id} className={`provider-request provider-request-${status}`}>
                <div className="provider-request-head">
                  <div className="provider-request-title">
                    <span className={`provider-item-icon ${request.item?.type === 'medication' ? 'is-medication' : 'is-service'}`}>
                      <StatusIcon aria-hidden="true" />
                    </span>
                    <div>
                      <h3>{itemName(request)}</h3>
                      <p className="provider-meta">
                        {detail ? `${detail} · ` : ''}#{String(request.id).slice(0, 8).toUpperCase()} · received {relativeTime(request.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className={`provider-badge provider-badge-${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                </div>

                <div className="provider-request-grid">
                  <div><span>Quantity</span><strong>{request.quantity}</strong></div>
                  <div><span>Unit price</span><strong>{formatKes(unitPrice)}</strong></div>
                  <div><span>Estimate</span><strong>{formatKes(unitPrice * request.quantity)}</strong></div>
                  <div>
                    <span>Expires</span>
                    <strong className={urgent ? 'provider-countdown is-urgent' : 'provider-countdown'} title={formatTimestamp(request.expires_at)}>
                      {expiresIn(request.expires_at)}
                    </strong>
                  </div>
                </div>

                {stale ? (
                  <p className="provider-inline-warning"><AlertCircle aria-hidden="true" /> The listing was last updated {relativeTime(request.listing?.updated_at)} and needs review.</p>
                ) : null}
                {request.request_group_id ? <p className="provider-meta">Grouped enquiry · {String(request.request_group_id).slice(0, 8).toUpperCase()}</p> : null}

                {status === 'confirmed' ? (
                  <p className="provider-outcome provider-outcome-confirmed">
                    <CheckCircle2 aria-hidden="true" /> Confirmed at {formatKes(request.confirmed_price)} per unit · valid until {formatTimestamp(request.expires_at)}
                  </p>
                ) : null}
                {status === 'declined' ? (
                  <p className="provider-outcome provider-outcome-declined"><XCircle aria-hidden="true" /> You declined this enquiry.</p>
                ) : null}
                {status === 'expired' ? (
                  <p className="provider-outcome provider-outcome-expired"><CircleSlash aria-hidden="true" /> This enquiry expired and can no longer be answered.</p>
                ) : null}

                {status === 'pending' ? (
                  <form className="provider-response-form" onSubmit={(event) => { event.preventDefault(); confirm(request); }} noValidate>
                    <label className="provider-field">
                      <span>Confirmed unit price (KES)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draft.confirmed_price}
                        onChange={(event) => updateDraft(request, 'confirmed_price', event.target.value)}
                        placeholder={request.listing?.price === undefined ? '0' : String(request.listing.price)}
                      />
                      {requestErrors.confirmed_price ? <em role="alert">{requestErrors.confirmed_price}</em> : null}
                    </label>
                    <label className="provider-field">
                      <span>Quote expiry</span>
                      <input type="datetime-local" value={draft.expires_at} onChange={(event) => updateDraft(request, 'expires_at', event.target.value)} />
                      {requestErrors.expires_at ? <em role="alert">{requestErrors.expires_at}</em> : null}
                    </label>
                    <div className="provider-response-actions">
                      <button type="button" className="provider-button-secondary is-danger-text" onClick={() => setPendingDecline(request.id)} disabled={busy}>
                        Decline
                      </button>
                      <button type="submit" className="provider-button-primary" disabled={busy}>
                        {busy ? 'Sending…' : 'Confirm quote'}
                      </button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Pager meta={meta} disabled={busy} label="Enquiry" onChange={onPageChange} />

      <ConfirmationDialog
        open={Boolean(declineTarget)}
        title="Decline enquiry"
        description={declineTarget ? `Decline the ${itemName(declineTarget)} enquiry received ${formatTimestamp(declineTarget.created_at)}? The patient will see it as declined.` : ''}
        confirmLabel="Decline enquiry"
        onConfirm={confirmDecline}
        onCancel={() => setPendingDecline(null)}
        busy={busy}
      />
    </div>
  );
}
