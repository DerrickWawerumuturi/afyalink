import { useState } from 'react';
import ConfirmationDialog from './ConfirmationDialog.jsx';
import { effectiveStatus, formatKes, formatTimestamp, isStale, toDateTimeLocal, validateResponseInput } from './validation.js';

const FILTERS = ['all', 'pending', 'confirmed', 'declined', 'expired'];

function newDraft(request) {
  return {
    status: 'confirmed',
    confirmed_price: request?.listing?.price === undefined ? '' : String(request.listing.price),
    expires_at: toDateTimeLocal(new Date(Date.now() + 60 * 60000))
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

export default function RequestInbox({ requests, busy, onRespond }) {
  const [filter, setFilter] = useState('all');
  const [drafts, setDrafts] = useState({});
  const [errors, setErrors] = useState({});
  const [pendingDecline, setPendingDecline] = useState(null);

  const visible = filter === 'all' ? requests : requests.filter((request) => effectiveStatus(request) === filter);
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

  async function submit(request) {
    const draft = draftFor(request);
    if (draft.status === 'declined') {
      setPendingDecline(request.id);
      return;
    }
    const { errors: nextErrors, value } = validateResponseInput(draft);
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
        <label className="provider-field provider-field-inline">
          <span>Show</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            {FILTERS.map((value) => <option key={value} value={value}>{value === 'all' ? `All (${requests.length})` : value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
          </select>
        </label>
        <p className="provider-hint">An enquiry is not a booking, payment or stock reservation. Confirmed prices snapshot the quote; expiry is calculated from stored UTC time.</p>
      </div>

      {visible.length === 0 ? (
        <p className="provider-empty">No {filter === 'all' ? '' : `${filter} `}enquiries to show.</p>
      ) : (
        <ul className="provider-request-list">
          {visible.map((request) => {
            const status = effectiveStatus(request);
            const draft = draftFor(request);
            const requestErrors = errors[request.id] || {};
            const detail = itemDetail(request);
            const stale = isStale(request.listing?.updated_at);

            return (
              <li key={request.id} className="provider-request">
                <div className="provider-request-head">
                  <div>
                    <h3>{itemName(request)}{detail ? ` — ${detail}` : ''}</h3>
                    <p className="provider-meta">
                      {request.quantity} × {formatKes(request.listing?.price)} per {request.listing?.pricing_unit || 'unit'} · received {formatTimestamp(request.created_at)}
                    </p>
                  </div>
                  <span className={`provider-badge provider-badge-${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                </div>

                <p className="provider-meta">Expires {formatTimestamp(request.expires_at)}</p>
                {request.request_group_id ? <p className="provider-meta">Linked enquiry group: {request.request_group_id}</p> : null}
                {stale ? <p className="provider-meta">Listing data was last updated {formatTimestamp(request.listing?.updated_at)} and needs review.</p> : null}

                {status === 'confirmed' ? (
                  <p className="provider-outcome">Confirmed unit price {formatKes(request.confirmed_price)} · valid until {formatTimestamp(request.expires_at)}</p>
                ) : null}
                {status === 'declined' ? <p className="provider-outcome">You declined this enquiry.</p> : null}
                {status === 'expired' ? <p className="provider-outcome">This enquiry has expired and can no longer be answered.</p> : null}

                {status === 'pending' ? (
                  <form className="provider-response-form" onSubmit={(event) => { event.preventDefault(); submit(request); }} noValidate>
                    <label className="provider-field">
                      <span>Response</span>
                      <select value={draft.status} onChange={(event) => updateDraft(request, 'status', event.target.value)}>
                        <option value="confirmed">Confirm</option>
                        <option value="declined">Decline</option>
                      </select>
                    </label>
                    {draft.status === 'confirmed' ? (
                      <>
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
                      </>
                    ) : null}
                    {requestErrors.status ? <p role="alert" className="provider-error-text">{requestErrors.status}</p> : null}
                    <div className="provider-actions">
                      <button type="submit" className="provider-button-primary" disabled={busy}>{busy ? 'Sending…' : 'Send response'}</button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmationDialog
        open={Boolean(declineTarget)}
        title="Decline enquiry"
        description={declineTarget ? `Decline the ${itemName(declineTarget)} enquiry from ${formatTimestamp(declineTarget.created_at)}? The patient will see it as declined.` : ''}
        confirmLabel="Decline enquiry"
        onConfirm={confirmDecline}
        onCancel={() => setPendingDecline(null)}
        busy={busy}
      />
    </div>
  );
}
