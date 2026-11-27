import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock,
  LogIn,
  MapPin,
  RefreshCw,
  Stethoscope,
  XCircle,
} from 'lucide-react';
import { appointments, cancelAppointment } from './api.js';

const STATUS_LABELS = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-KE', {
    timeZone: 'Africa/Nairobi',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `KSh ${number.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
}

export default function Appointments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [actionError, setActionError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    setNeedsAuth(false);
    try {
      setRows(await appointments());
    } catch (failure) {
      if (failure.status === 401) setNeedsAuth(true);
      else setError(failure.message || 'Unable to load appointments.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener('carecheck-auth', refresh);
    return () => window.removeEventListener('carecheck-auth', refresh);
  }, []);

  async function cancel(id) {
    setCancelling(id);
    setActionError('');
    try {
      const updated = await cancelAppointment(id);
      setRows((current) => current.map((row) => (row.id === id ? updated : row)));
      setConfirmId(null);
    } catch (failure) {
      setActionError(failure.message || 'Unable to cancel this appointment.');
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="appointments-page">
      <div className="appointments-head">
        <div>
          <span className="appointments-eyebrow">Your care</span>
          <h1>My appointments</h1>
          <p>Appointment requests are confirmed by the provider. They are not payments or guaranteed bookings.</p>
        </div>
        <button type="button" className="appointments-refresh" onClick={load} disabled={loading}>
          <RefreshCw aria-hidden="true" className={loading ? 'is-spinning' : undefined} /> Refresh
        </button>
      </div>

      {actionError ? <p className="appointments-error" role="alert"><CircleAlert aria-hidden="true" /> {actionError}</p> : null}

      {loading ? <p className="appointments-loading" role="status">Loading appointments…</p> : null}

      {!loading && needsAuth ? (
        <div className="appointments-empty">
          <LogIn aria-hidden="true" />
          <h2>Sign in to see your appointments</h2>
          <p>Use your patient account to book services and track provider responses.</p>
          <button type="button" className="appointments-primary" onClick={() => window.dispatchEvent(new Event('carecheck:open-auth'))}>
            Sign in / create account
          </button>
        </div>
      ) : null}

      {!loading && !needsAuth && error ? (
        <p className="appointments-error" role="alert"><CircleAlert aria-hidden="true" /> {error}</p>
      ) : null}

      {!loading && !needsAuth && !error && rows.length === 0 ? (
        <div className="appointments-empty">
          <CalendarDays aria-hidden="true" />
          <h2>No appointments yet</h2>
          <p>Find an available service and book an appointment request.</p>
          <Link className="appointments-primary" to="/services">Find a service</Link>
        </div>
      ) : null}

      {!loading && !needsAuth && !error && rows.length > 0 ? (
        <ul className="appointments-list">
          {rows.map((appointment) => {
            const status = appointment.status || 'requested';
            const cancellable = status === 'requested' || status === 'confirmed';
            const StatusIcon = status === 'confirmed' ? CheckCircle2 : status === 'declined' ? XCircle : status === 'cancelled' ? XCircle : Clock;
            return (
              <li key={appointment.id} className={`appointment-card status-${status}`}>
                <div className="appointment-card-head">
                  <div className="appointment-card-title">
                    <span className="appointment-card-icon"><Stethoscope aria-hidden="true" /></span>
                    <div>
                      <h2>{appointment.item?.name || 'Service'}</h2>
                      <p>
                        <Link to={`/facility/${appointment.provider?.id}`}>{appointment.provider?.name || 'Provider'}</Link>
                        {appointment.provider?.location ? <><MapPin aria-hidden="true" /> {appointment.provider.location}</> : null}
                      </p>
                    </div>
                  </div>
                  <span className={`appointment-status status-${status}`}>
                    <StatusIcon aria-hidden="true" /> {STATUS_LABELS[status] || status}
                  </span>
                </div>

                <div className="appointment-card-grid">
                  <div>
                    <span>Requested for</span>
                    <strong><CalendarDays aria-hidden="true" /> {formatDateTime(appointment.requested_for)} EAT</strong>
                  </div>
                  <div>
                    <span>Unit price</span>
                    <strong>{money(appointment.listing?.price)} per {appointment.listing?.pricing_unit || 'unit'}</strong>
                  </div>
                  <div>
                    <span>Requested</span>
                    <strong>{formatDateTime(appointment.created_at)}</strong>
                  </div>
                </div>

                {appointment.notes ? <p className="appointment-card-notes">“{appointment.notes}”</p> : null}

                {status === 'confirmed' ? <p className="appointment-card-outcome is-confirmed"><CheckCircle2 aria-hidden="true" /> Provider confirmed this appointment.</p> : null}
                {status === 'declined' ? <p className="appointment-card-outcome is-declined"><XCircle aria-hidden="true" /> Provider declined this appointment request.</p> : null}
                {status === 'cancelled' ? <p className="appointment-card-outcome is-cancelled"><XCircle aria-hidden="true" /> You cancelled this appointment.</p> : null}
                {status === 'requested' ? <p className="appointment-card-outcome is-requested"><Clock aria-hidden="true" /> Waiting for the provider to confirm.</p> : null}

                {cancellable ? (
                  <div className="appointment-card-actions">
                    {confirmId === appointment.id ? (
                      <>
                        <span>Cancel this appointment?</span>
                        <button type="button" className="appointments-secondary" onClick={() => setConfirmId(null)} disabled={cancelling === appointment.id}>Keep it</button>
                        <button type="button" className="appointments-danger" onClick={() => cancel(appointment.id)} disabled={cancelling === appointment.id}>
                          {cancelling === appointment.id ? 'Cancelling…' : 'Confirm cancel'}
                        </button>
                      </>
                    ) : (
                      <button type="button" className="appointments-secondary" onClick={() => setConfirmId(appointment.id)}>Cancel appointment</button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
