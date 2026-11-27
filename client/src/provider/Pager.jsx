import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pageCount } from './validation.js';

export default function Pager({ meta, disabled, label, onChange }) {
  const total = Math.max(0, Number(meta?.total) || 0);
  const limit = Math.max(1, Number(meta?.limit) || 20);
  const totalPages = pageCount(total, limit);
  const page = Math.min(Math.max(1, Number(meta?.page) || 1), totalPages);
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <nav className="provider-pager" aria-label={`${label} pagination`}>
      <span className="provider-pager-summary">
        {total === 0 ? 'No results' : `Showing ${start}–${end} of ${total}`}
      </span>
      <div className="provider-pager-controls">
        <button type="button" className="provider-button-secondary" onClick={() => onChange(page - 1)} disabled={disabled || page <= 1}>
          <ChevronLeft aria-hidden="true" /> Prev
        </button>
        <span className="provider-pager-page">Page {page} of {totalPages}</span>
        <button type="button" className="provider-button-secondary" onClick={() => onChange(page + 1)} disabled={disabled || page >= totalPages}>
          Next <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
