import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Inbox,
  Pill,
  Stethoscope,
  Tags,
} from 'lucide-react';
import { effectiveStatus, expiresIn, formatKes, isStale, relativeTime } from './validation.js';

function itemName(request) {
  return request.item?.name || request.listing?.item?.name || 'Unknown item';
}

function listingName(listing) {
  return listing.item?.name || 'Unknown item';
}

function listingDetail(listing) {
  const item = listing.item;
  if (!item) return '';
  return [item.strength, item.dosage_form].filter(Boolean).join(' · ');
}

export default function Overview({ listings, requests, meta, source, onNavigate }) {
  const statuses = requests.reduce((counts, request) => {
    const status = effectiveStatus(request);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  const available = listings.filter((listing) => listing.available && !isStale(listing.updated_at)).length;
  const needsReview = listings.filter((listing) => listing.available && isStale(listing.updated_at)).length;
  const unavailable = listings.length - available - needsReview;
  const services = listings.filter((listing) => listing.item?.type === 'service').length;
  const medications = listings.filter((listing) => listing.item?.type === 'medication').length;
  const totalListings = meta?.listings?.total ?? listings.length;
  const totalRequests = meta?.requests?.total ?? requests.length;
  const denominator = Math.max(listings.length, 1);

  const waiting = requests
    .filter((request) => effectiveStatus(request) === 'pending')
    .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime())
    .slice(0, 4);

  const recent = [...listings]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 4);

  const kpis = [
    {
      label: 'Total listings',
      value: totalListings,
      hint: `${available} available · ${needsReview} need review`,
      icon: Tags,
      tone: 'teal',
    },
    {
      label: 'Pending enquiries',
      value: statuses.pending || 0,
      hint: 'Awaiting your response',
      icon: Inbox,
      tone: 'amber',
    },
    {
      label: 'Confirmed quotes',
      value: statuses.confirmed || 0,
      hint: 'Shared with patients',
      icon: BadgeCheck,
      tone: 'green',
    },
    {
      label: 'Needs review',
      value: needsReview,
      hint: 'Available claims older than 24h',
      icon: AlertCircle,
      tone: 'rose',
    },
  ];

  return (
    <div className="provider-stack">
      <div className="provider-section-head">
        <div>
          <h3 className="provider-section-heading">Workspace overview</h3>
          <p className="provider-hint">
            {source === 'demo' ? 'Synthetic demo records' : 'Live API records'} · {totalRequests} enquiries in total.
          </p>
        </div>
        <div className="provider-quick-actions">
          <button type="button" className="provider-button-secondary" onClick={() => onNavigate('requests')}>
            <Inbox aria-hidden="true" /> Replies
          </button>
          <button type="button" className="provider-button-primary" onClick={() => onNavigate('listings')}>
            <Tags aria-hidden="true" /> Manage listings
          </button>
        </div>
      </div>

      <div className="provider-kpis">
        {kpis.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className={`provider-kpi provider-kpi-${card.tone}`}>
              <span className="provider-kpi-icon"><Icon aria-hidden="true" /></span>
              <div>
                <span className="provider-kpi-label">{card.label}</span>
                <strong className="provider-kpi-value">{card.value}</strong>
                <small className="provider-kpi-hint">{card.hint}</small>
              </div>
            </article>
          );
        })}
      </div>

      <div className="provider-overview-grid">
        <div className="provider-card">
          <div className="provider-card-head">
            <div>
              <h3>Availability health</h3>
              <p className="provider-hint">Based on the listings loaded on this page.</p>
            </div>
            <span className={`provider-chip provider-chip-${source === 'demo' ? 'amber' : 'green'}`}>
              {source === 'demo' ? 'Demo snapshot' : 'Live snapshot'}
            </span>
          </div>

          {listings.length === 0 ? (
            <div className="provider-empty provider-empty-inline">
              <Tags aria-hidden="true" />
              <strong>No listings yet</strong>
              <p>Add your first listing to start receiving enquiries.</p>
              <button type="button" className="provider-button-primary" onClick={() => onNavigate('listings')}>
                Add a listing
              </button>
            </div>
          ) : (
            <>
              <div className="provider-meter provider-meter-lg" aria-hidden="true">
                <span className="meter-available" style={{ width: `${(available / denominator) * 100}%` }} />
                <span className="meter-review" style={{ width: `${(needsReview / denominator) * 100}%` }} />
                <span className="meter-unavailable" style={{ width: `${(unavailable / denominator) * 100}%` }} />
              </div>
              <div className="provider-legend">
                <span><i className="provider-dot dot-available" /> Available <strong>{available}</strong></span>
                <span><i className="provider-dot dot-review" /> Needs review <strong>{needsReview}</strong></span>
                <span><i className="provider-dot dot-unavailable" /> Unavailable <strong>{unavailable}</strong></span>
              </div>

              <div className="provider-split">
                <div className="provider-split-row">
                  <span><Stethoscope aria-hidden="true" /> Services <strong>{services}</strong></span>
                  <div className="provider-meter"><span style={{ width: `${(services / denominator) * 100}%` }} /></div>
                </div>
                <div className="provider-split-row">
                  <span><Pill aria-hidden="true" /> Medications <strong>{medications}</strong></span>
                  <div className="provider-meter"><span style={{ width: `${(medications / denominator) * 100}%` }} /></div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="provider-card">
          <div className="provider-card-head">
            <div>
              <h3>Needs attention</h3>
              <p className="provider-hint">Pending enquiries that expire soonest.</p>
            </div>
            <span className="provider-count-pill">{waiting.length}</span>
          </div>

          {waiting.length === 0 ? (
            <div className="provider-empty provider-empty-inline">
              <Inbox aria-hidden="true" />
              <strong>You are all caught up</strong>
              <p>New patient enquiries will appear here.</p>
            </div>
          ) : (
            <ul className="provider-attention-list">
              {waiting.map((request) => {
                const urgent = new Date(request.expires_at).getTime() - Date.now() < 60 * 60 * 1000;
                return (
                  <li key={request.id} className={urgent ? 'is-urgent' : undefined}>
                    <span className="provider-attention-icon"><CalendarClock aria-hidden="true" /></span>
                    <div className="provider-attention-main">
                      <strong>{itemName(request)}</strong>
                      <small>{request.quantity} × {formatKes(request.listing?.price)} · {expiresIn(request.expires_at)}</small>
                    </div>
                    <button type="button" className="provider-icon-button" onClick={() => onNavigate('requests')} aria-label={`Review ${itemName(request)} enquiry`}>
                      <ArrowRight aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button type="button" className="provider-text-button" onClick={() => onNavigate('requests')}>
            Open request inbox <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="provider-card">
        <div className="provider-card-head">
          <div>
            <h3>Recently updated</h3>
            <p className="provider-hint">Freshness matters: stale prices are marked for review.</p>
          </div>
          <button type="button" className="provider-text-button" onClick={() => onNavigate('listings')}>
            View all listings <ArrowRight aria-hidden="true" />
          </button>
        </div>

        {recent.length === 0 ? (
          <p className="provider-empty">No listings to show yet.</p>
        ) : (
          <ul className="provider-activity-list">
            {recent.map((listing) => {
              const stale = isStale(listing.updated_at);
              const badge = stale ? 'review' : listing.available ? 'available' : 'unavailable';
              const label = stale ? 'Needs review' : listing.available ? 'Available' : 'Unavailable';
              const detail = listingDetail(listing);
              return (
                <li key={listing.id}>
                  <span className={`provider-item-icon ${listing.item?.type === 'medication' ? 'is-medication' : 'is-service'}`}>
                    {listing.item?.type === 'medication' ? <Pill aria-hidden="true" /> : <Stethoscope aria-hidden="true" />}
                  </span>
                  <div className="provider-activity-main">
                    <strong>{listingName(listing)}</strong>
                    <small>{detail ? `${detail} · ` : ''}{formatKes(listing.price)} per {listing.pricing_unit} · {relativeTime(listing.updated_at)}</small>
                  </div>
                  <span className={`provider-badge provider-badge-${badge}`}>{label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
