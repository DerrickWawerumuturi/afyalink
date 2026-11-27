import { pageCount } from './validation.js';

export default function Pager({ meta, disabled, label, onChange }) {
  const totalPages = pageCount(meta?.total, meta?.limit);
  const page = Math.min(Math.max(1, Number(meta?.page) || 1), totalPages);

  return (
    <nav className="provider-pager" aria-label={`${label} pagination`}>
      <button type="button" className="provider-button-secondary" onClick={() => onChange(page - 1)} disabled={disabled || page <= 1}>Previous</button>
      <span>Page {page} of {totalPages}</span>
      <button type="button" className="provider-button-secondary" onClick={() => onChange(page + 1)} disabled={disabled || page >= totalPages}>Next</button>
    </nav>
  );
}
