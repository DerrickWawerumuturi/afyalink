import { useEffect, useRef } from 'react';

export default function ConfirmationDialog({ open, title, description, confirmLabel, onConfirm, onCancel, busy }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    confirmRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape' && !busy) onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="provider-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <div className="provider-dialog" role="dialog" aria-modal="true" aria-labelledby="provider-dialog-title" aria-describedby="provider-dialog-description">
        <h3 id="provider-dialog-title">{title}</h3>
        <p id="provider-dialog-description">{description}</p>
        <div className="provider-dialog-actions">
          <button type="button" className="provider-button-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="provider-button-danger" ref={confirmRef} onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
