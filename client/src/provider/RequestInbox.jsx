import { useState } from 'react';
import { effectiveStatus, formatKes, formatTimestamp, toDateTimeLocal, validateResponseInput } from './validation.js';

const FILTERS = ['all', 'pending', 'confirmed', 'declined', 'expired'];

function newDraft() {
  return { status: 'confirmed', confirmed_price: '', expires_at: toDateTimeLocal(new Date(Date.now() + 60 * 60000)) };
}

function itemName(request) {
  return request.item?.name || request.listing?.item?.name || 'Unknown item';
}

function itemDetail(request) {
  const item = request.item || request.listing?.item;
  if (!item) return '';
  return [item.strength, item.dosage_form].filter(Boolean).join(' · ');
}

export default function RequestInbox({ requests, busy, onRespond }) {
  const [filter, setFilter] = useState('all');
  const [drafts, setDrafts] = useState({});
  const [errors, setErrors] = useState({});

  const visible = filter === 'all' ? requests : requests.filter((request) => effectiveStatus(request) === filter);

  function draftFor(request) {
    return drafts[request.id] || newDraft();
  }

  function updateDraft(id, field, value) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] || newDraft()), [field]: value } }));
  }

  async function submit(request) {
    const { errors: nextErrors, value } = validateResponseInput(draftFor(request));
    setErrors((current) => ({ ...current, [request.id]: nextErrors }));
    if (!value) return;
    const saved = await onRespond(request.id, value);
    if (saved) {
      setDrafts((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      setErrors((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
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
        <p className="provider-hint">Confirmed prices snapshot the quote. Expiry is calculated from the stored UTC timestamp.</p>
      </div>

      {visible.length === 0 ? (
        <p className="provider-empty">No {filter === 'all' ? '' : `${filter} `}requests to show.</p>
      ) : (
        <ul className="provider-request-list">
          {visible.map((request) => {
            const status = effectiveStatus(request);
            const draft = draftFor(request);
            const requestErrors = errors[request.id] || {};
            const detail = itemDetail(request);

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

                {status === 'confirmed' ? (
                  <p className="provider-outcome">Confirmed unit price {formatKes(request.confirmed_price)} · valid until {formatTimestamp(request.expires_at)}</p>
                ) : null}
                {status === 'declined' ? <p className="provider-outcome">You declined this enquiry.</p> : null}
                {status === 'expired' ? <p className="provider-outcome">This enquiry has expired and can no longer be answered.</p> : null}

                {status === 'pending' ? (
                  <form className="provider-response-form" onSubmit={(event) => { event.preventDefault(); submit(request); }} noValidate>
                    <label className="provider-field">
                      <span>Response</span>
                      <select value={draft.status} onChange={(event) => updateDraft(request.id, 'status', event.target.value)}>
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
                            onChange={(event) => updateDraft(request.id, 'confirmed_price', event.target.value)}
                            placeholder={request.listing?.price === undefined ? '0' : String(request.listing.price)}
                          />
                          {requestErrors.confirmed_price ? <em role="alert">{requestErrors.confirmed_price}</em> : null}
                        </label>
                        <label className="provider-field">
                          <span>Quote expiry</span>
                          <input type="datetime-local" value={draft.expires_at} onChange={(event) => updateDraft(request.id, 'expires_at', event.target.value)} />
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
    </div>
  );
}
