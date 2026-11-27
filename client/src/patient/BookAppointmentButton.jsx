import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import AppointmentDialog from './AppointmentDialog.jsx';

export default function BookAppointmentButton({ listing, compact = false }) {
  const [open, setOpen] = useState(false);
  const unavailable = !listing.available || listing.stock_quantity === 0;

  return (
    <>
      <button
        type="button"
        className={compact ? 'book-appointment-button is-compact' : 'book-appointment-button'}
        onClick={() => setOpen(true)}
        disabled={unavailable}
        title={unavailable ? 'This service is currently unavailable' : `Book ${listing.item?.name || 'an appointment'}`}
      >
        <CalendarPlus aria-hidden="true" /> Book appointment
      </button>
      {open ? <AppointmentDialog listing={listing} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
