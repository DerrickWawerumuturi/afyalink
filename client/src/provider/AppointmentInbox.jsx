import { useState } from 'react';
import { CalendarDays, CheckCircle2, CircleSlash, Clock, XCircle } from 'lucide-react';
import ConfirmationDialog from './ConfirmationDialog.jsx';
import Pager from './Pager.jsx';
import { formatKes, formatTimestamp, relativeTime } from './validation.js';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'requested', label: 'Requested' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'declined', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
];

const LABELS = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

function itemName(appointment) {
  return appointment.item?.name || 'Service';
}

export default function AppointmentInbox({ appointments, busy, meta, onPageChange, onRespond }) {
  const [filter, setFilter] = useState('all');
  const [pendingDecline, setPendingDecline] = useState(null);

  const counts = appointments.reduce((result, appointment) => {
    result[appointment.status] = (result[appointment.status] || 0) + 1;
    return result;
  }, {});
  const visible = filter === 'all' ? appointments : appointments.filter((appointment) => appointment.status === filter);
  const declineTarget = appointments.find((appointment) => appointment.id === pendingDecline);

  async function confirm(appointment) {
    await onRespond(appointment.id, { status: 'confirmed' });
  }

  async function confirmDecline() {
    const saved = await onRespond(pendingDecline, { status: 'declined' });
    if (saved) setPendingDecline(null);
  }

  return (
    <div className="provider-stack">
      <div className="provider-toolbar">
        <div className="provider-filter-chips" role="group" aria-label="Filter appointments by status">
          {FILTERS.map((option) => {
            const count = option.value === 'all' ? appointments.length : counts[option.value] || 0;
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
        <p className="provider-hint">Confirming an appointment does not take payment or reserve stock.</p>
      </div>

      <p className="provider-hint">
        Showing <strong>{visible.length}</strong> of {appointments.length} appointments on this page
        {meta?.total ? ` · ${meta.total} total` : ''}.
      </p>

      {visible.length === 0 ? (
        <div className="provider-empty provider-empty-card">
          <CalendarDays aria-hidden="true" />
          <strong>No appointments to show</strong>
          <p>{filter === 'all' ? 'Patient appointment requests will appear here.' : 'Try a different status filter.'}</p>
        </div>
      ) : (
        <ul className="provider-request-list">
          {visible.map((appointment) => {
            const status = appointment.status || 'requested';
            const StatusIcon = status === 'confirmed' ? CheckCircle2 : status === 'declined' ? XCircle : status === 'cancelled' ? CircleSlash : Clock;
            return (
              <li key={appointment.id} className={`provider-request provider-request-${status}`}>
                <div className="provider-request-head">
                  <div className="provider-request-title">
                    <span className="provider-item-icon is-service"><StatusIcon aria-hidden="true" /></span>
                    <div>
                      <h3>{itemName(appointment)}</h3>
                      <p className="provider-meta">
                        #{String(appointment.id).slice(0, 8).toUpperCase()} · requested {relativeTime(appointment.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className={`provider-badge provider-badge-${status}`}>{LABELS[status] || status}</span>
                </div>

                <div className="provider-request-grid">
                  <div>
                    <span>Requested for</span>
                    <strong>{formatTimestamp(appointment.requested_for)}</strong>
                  </div>
                  <div>
                    <span>Unit price</span>
                    <strong>{formatKes(appointment.listing?.price)}</strong>
                  </div>
                  <div>
                    <span>Pricing unit</span>
                    <strong>{appointment.listing?.pricing_unit || 'unit'}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{LABELS[status] || status}</strong>
                  </div>
                </div>

                {appointment.notes ? <p className="appointment-card-notes">“{appointment.notes}”</p> : null}

                {status === 'confirmed' ? <p className="provider-outcome provider-outcome-confirmed"><CheckCircle2 aria-hidden="true" /> Confirmed for {formatTimestamp(appointment.requested_for)}.</p> : null}
                {status === 'declined' ? <p className="provider-outcome provider-outcome-declined"><XCircle aria-hidden="true" /> You declined this appointment request.</p> : null}
                {status === 'cancelled' ? <p className="provider-outcome provider-outcome-expired"><CircleSlash aria-hidden="true" /> The patient cancelled this appointment.</p> : null}

                {status === 'requested' ? (
                  <div className="provider-response-actions appointment-provider-actions">
                    <button type="button" className="provider-button-secondary is-danger-text" onClick={() => setPendingDecline(appointment.id)} disabled={busy}>
                      Decline
                    </button>
                    <button type="button" className="provider-button-primary" onClick={() => confirm(appointment)} disabled={busy}>
                      {busy ? 'Saving…' : 'Confirm appointment'}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Pager meta={meta} disabled={busy} label="Appointment" onChange={onPageChange} />

      <ConfirmationDialog
        open={Boolean(declineTarget)}
        title="Decline appointment"
        description={declineTarget ? `Decline the ${itemName(declineTarget)} appointment requested for ${formatTimestamp(declineTarget.requested_for)}? The patient will see it as declined.` : ''}
        confirmLabel="Decline appointment"
        onConfirm={confirmDecline}
        onCancel={() => setPendingDecline(null)}
        busy={busy}
      />
    </div>
  );
}
