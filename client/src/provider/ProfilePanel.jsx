import { useEffect, useState } from 'react';
import { validateProfileInput } from './validation.js';

export default function ProfilePanel({ profile, canEdit, busy, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', location: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm({ name: profile?.name || '', location: profile?.location || '' });
    setEditing(false);
    setErrors({});
  }, [profile]);

  async function submit(event) {
    event.preventDefault();
    const { errors: nextErrors, value } = validateProfileInput(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const saved = await onSave(value, setErrors);
    if (saved) setEditing(false);
  }

  if (!profile) {
    return <p className="provider-empty">Provider details are attached to the loaded listings. No profile is available from the API yet.</p>;
  }

  return (
    <div className="provider-stack">
      <section className="provider-form">
        <div className="provider-form-heading">
          <h3>Provider profile</h3>
          {canEdit && !editing ? <button type="button" className="provider-button-secondary" onClick={() => setEditing(true)} disabled={busy}>Edit demo profile</button> : null}
        </div>

        <div className="provider-profile-grid">
          <div className="provider-profile-item">
            <span>Provider name</span>
            <strong>{profile.name}</strong>
          </div>
          <div className="provider-profile-item">
            <span>Provider type</span>
            <strong><span className={`provider-badge provider-badge-${profile.type === 'pharmacy' ? 'pharmacy' : 'hospital'}`}>{profile.type === 'pharmacy' ? 'Pharmacy' : 'Hospital'}</span></strong>
          </div>
          <div className="provider-profile-item">
            <span>Location</span>
            <strong>{profile.location || 'Not provided'}</strong>
          </div>
          <div className="provider-profile-item">
            <span>Verification</span>
            <strong>{profile.verified ? 'Verified' : 'Not verified'}</strong>
          </div>
        </div>

        <p className="provider-hint">Type and verification are controlled by trusted provider setup. They cannot be changed from this dashboard.</p>

        {editing ? (
          <form className="provider-form-grid" onSubmit={submit} noValidate>
            <label className="provider-field">
              <span>Provider name</span>
              <input type="text" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              {errors.name ? <em role="alert">{errors.name}</em> : null}
            </label>
            <label className="provider-field">
              <span>Location</span>
              <input type="text" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} />
              {errors.location ? <em role="alert">{errors.location}</em> : null}
            </label>
            <div className="provider-actions">
              <button type="button" className="provider-button-secondary" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="provider-button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="provider-form">
        <h3>Information not in the current schema</h3>
        <p className="provider-hint">Contact information and operating hours are not part of the agreed provider model. They are not displayed or invented here.</p>
      </section>
    </div>
  );
}
