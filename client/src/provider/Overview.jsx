import { effectiveStatus, formatKes, formatTimestamp, isStale } from './validation.js';

function itemName(request) {
  return request.item?.name || request.listing?.item?.name || 'Unknown item';
}

export default function Overview({ listings, requests, source, onNavigate }) {
  const statuses = requests.reduce((counts, request) => {
    const status = effectiveStatus(request);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  const cards = [
    { label: 'Active listings', value: listings.filter((listing) => listing.available && !isStale(listing.updated_at)).length, hint: 'Available and recently updated' },
    { label: 'Service listings', value: listings.filter((listing) => listing.item?.type === 'service').length, hint: 'Hospital-style offerings' },
    { label: 'Medication listings', value: listings.filter((listing) => listing.item?.type === 'medication').length, hint: 'Pharmacy-style offerings' },
    { label: 'Pending enquiries', value: statuses.pending || 0, hint: 'Awaiting your response' },
    { label: 'Confirmed quotes', value: statuses.confirmed || 0, hint: 'Waiting for patient view' },
    { label: 'Needs review', value: listings.filter((listing) => listing.available && isStale(listing.updated_at)).length, hint: 'Available claim older than 24 hours' }
  ];
  const waiting = requests.filter((request) => effectiveStatus(request) === 'pending').slice(0, 4);

  return (
    <div className="provider-stack">
      <p className="provider-hint">Figures are calculated from the {source === 'demo' ? 'synthetic demo' : 'live API'} records currently loaded. They are not operational statistics.</p>

      <div className="provider-stats">
        {cards.map((card) => (
          <article key={card.label} className="provider-stat">
            <h3>{card.label}</h3>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </article>
        ))}
      </div>

      <section className="provider-form">
        <h3>Needs attention</h3>
        {waiting.length === 0 ? (
          <p className="provider-empty">No pending enquiries. New patient requests will appear here.</p>
        ) : (
          <ul className="provider-attention-list">
            {waiting.map((request) => (
              <li key={request.id}>
                <div>
                  <strong>{itemName(request)}</strong>
                  <small>{request.quantity} × {formatKes(request.listing?.price)} · expires {formatTimestamp(request.expires_at)}</small>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="provider-actions">
          <button type="button" className="provider-button-primary" onClick={() => onNavigate('requests')}>Review enquiries</button>
        </div>
      </section>
    </div>
  );
}
