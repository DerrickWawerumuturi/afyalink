import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CalendarPlus, CheckCircle2, CircleAlert, LogIn, X } from 'lucide-react';
import { bookAppointment } from './api.js';
import { getSession } from './auth.js';

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `KSh ${number.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
}

function toDateTimeLocal(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function defaultSlot() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return toDateTimeLocal(date);
}

function formatSlot(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString('en-KE', {
    timeZone: 'Africa/Nairobi',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AppointmentDialog({ listing, onClose }) {
  const [session, setSession] = useState(undefined);
  const [slot, setSlot] = useState(defaultSlot);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState(null);
  const slotRef = useRef(null);

  useEffect(() => {
    let active = true;
    const check = () => {
      getSession()
        .then((value) => { if (active) setSession(value); })
        .catch(() => { if (active) setSession(null); });
    };
    check();
    window.addEventListener('afyalink-auth', check);
    return () => {
      active = false;
      window.removeEventListener('afyalink-auth', check);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!session) {
      setError('Sign in to book an appointment.');
      window.dispatchEvent(new Event('afyalink:open-auth'));
      return;
    }
    const when = new Date(slot);
    const now = Date.now();
    if (!slot || Number.isNaN(when.getTime()) || when.getTime() <= now) {
      setError('Choose a future date and time.');
      slotRef.current?.focus();
      return;
    }
    if (when.getTime() > now + 90 * 24 * 60 * 60 * 1000) {
      setError('Appointments can be requested up to 90 days ahead.');
      slotRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      const appointment = await bookAppointment({
        listing_id: listing.id,
        requested_for: when.toISOString(),
        notes,
      });
      setBooked(appointment);
    } catch (failure) {
      if (failure.status === 401) {
        setSession(null);
        setError('Please sign in to book an appointment.');
        window.dispatchEvent(new Event('afyalink:open-auth'));
      } else {
        setError(failure.message || 'Unable to book this appointment. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  const itemName = listing.item?.name || 'Service';
  const providerName = listing.provider?.name || 'Provider';

  return (
    <div className="appointment-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="appointment-dialog" role="dialog" aria-modal="true" aria-labelledby="appointment-title">
        <button type="button" className="appointment-close" onClick={onClose} disabled={busy} aria-label="Close appointment dialog">
          <X aria-hidden="true" />
        </button>

        <div className="appointment-head">
          <span className="appointment-mark" aria-hidden="true"><CalendarPlus /></span>
          <div>
            <h2 id="appointment-title">Book an appointment</h2>
            <p>{itemName} at <strong>{providerName}</strong> · {money(listing.price)} per {listing.pricing_unit}</p>
          </div>
        </div>

        {booked ? (
          <div className="appointment-success">
            <CheckCircle2 aria-hidden="true" />
            <h3>Appointment requested</h3>
            <p>{itemName} with {providerName}</p>
            <p><CalendarCheck aria-hidden="true" /> {formatSlot(booked.requested_for)}</p>
            <p className="appointment-note">Status: requested. The provider will confirm or decline, and you can track it under My appointments.</p>
            <div className="appointment-actions">
              <button type="button" className="appointment-secondary" onClick={onClose}>Close</button>
              <Link className="appointment-primary" to="/appointments" onClick={onClose}>View my appointments</Link>
            </div>
          </div>
        ) : session === undefined ? (
          <p className="appointment-loading" role="status">Checking your session…</p>
        ) : !session ? (
          <div className="appointment-gate">
            <CircleAlert aria-hidden="true" />
            <h3>Sign in required</h3>
            <p>You need an account to book an appointment. Sign in or create a patient account, then try again.</p>
            <div className="appointment-actions">
              <button type="button" className="appointment-secondary" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="appointment-primary"
                onClick={() => window.dispatchEvent(new Event('afyalink:open-auth'))}
              >
                <LogIn aria-hidden="true" /> Sign in / sign up
              </button>
            </div>
          </div>
        ) : (
          <form className="appointment-form" onSubmit={submit} noValidate>
            <p className="appointment-hint">
              This sends an appointment request. The provider must confirm before it is a booking; no payment or stock reservation is made.
              {session.user?.email ? ` Booking as ${session.user.email}.` : ''}
            </p>
            <label className="appointment-field">
              <span>Preferred date and time</span>
              <input ref={slotRef} type="datetime-local" value={slot} min={toDateTimeLocal(new Date())} onChange={(event) => setSlot(event.target.value)} required />
            </label>
            <label className="appointment-field">
              <span>Notes for the provider <small>(optional)</small></span>
              <textarea rows="3" maxLength="500" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything the provider should know before the visit" />
            </label>
            {error ? <p className="appointment-error" role="alert"><CircleAlert aria-hidden="true" /> {error}</p> : null}
            <div className="appointment-actions">
              <button type="button" className="appointment-secondary" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="appointment-primary" disabled={busy}>
                {busy ? 'Requesting…' : 'Request appointment'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
