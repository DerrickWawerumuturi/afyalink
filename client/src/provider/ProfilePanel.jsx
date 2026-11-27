import { useEffect, useState } from 'react';
import { BadgeCheck, Building2, MapPin, Pencil, Pill, ShieldCheck, X } from 'lucide-react';
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
    return (
      <div className="provider-empty provider-empty-card">
        <Building2 aria-hidden="true" />
        <strong>No provider profile</strong>
        <p>Your provider record is attached to the account. Refresh or contact an administrator if this persists.</p>
      </div>
    );
  }

  const isPharmacy = profile.type === 'pharmacy';
  const Icon = isPharmacy ? Pill : Building2;
  const verified = Boolean(profile.verified);

  return (
    <div className="provider-stack">
      <div className="provider-profile-card">
        <div className="provider-profile-hero">
          <span className={`provider-profile-avatar ${isPharmacy ? 'is-medication' : 'is-service'}`}>
            <Icon aria-hidden="true" />
          </span>
          <div className="provider-profile-identity">
            <span className="provider-eyebrow">Provider profile</span>
            <h3>{profile.name}</h3>
            <div className="provider-hero-meta">
              <span className={`provider-chip provider-chip-${isPharmacy ? 'amber' : 'teal'}`}>{isPharmacy ? 'Pharmacy' : 'Hospital'}</span>
              <span className="provider-chip"><MapPin aria-hidden="true" /> {profile.location || 'Location not provided'}</span>
              <span className={`provider-chip ${verified ? 'provider-chip-green' : 'provider-chip-muted'}`}>
                <BadgeCheck aria-hidden="true" /> {verified ? 'Verified' : 'Not verified'}
              </span>
            </div>
          </div>
          {canEdit && !editing ? (
            <button type="button" className="provider-button-secondary" onClick={() => setEditing(true)} disabled={busy}>
              <Pencil aria-hidden="true" /> Edit demo profile
            </button>
          ) : null}
        </div>

        <div className="provider-profile-grid">
          <div className="provider-profile-item">
            <span>Provider ID</span>
            <strong className="provider-mono">{profile.id}</strong>
          </div>
          <div className="provider-profile-item">
            <span>Provider type</span>
            <strong>{isPharmacy ? 'Pharmacy' : 'Hospital'}</strong>
          </div>
          <div className="provider-profile-item">
            <span>Location</span>
            <strong>{profile.location || 'Not provided'}</strong>
          </div>
          <div className="provider-profile-item">
            <span>Verification</span>
            <strong>{verified ? 'Verified provider' : 'Awaiting verification'}</strong>
          </div>
        </div>

        {editing ? (
          <form className="provider-profile-edit" onSubmit={submit} noValidate>
            <div className="provider-form-heading">
              <h3>Edit demo profile</h3>
              <button type="button" className="provider-icon-button" onClick={() => setEditing(false)} disabled={busy} aria-label="Cancel profile edit" title="Cancel">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="provider-form-grid">
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
            </div>
            <div className="provider-actions">
              <button type="button" className="provider-button-secondary" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="provider-button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="provider-card">
        <div className="provider-card-head">
          <div>
            <h3><ShieldCheck aria-hidden="true" /> Trusted provider fields</h3>
            <p className="provider-hint">Type and verification are managed by trusted provider setup and cannot be changed here.</p>
          </div>
        </div>
        <div className="provider-callout">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>Trusted setup</strong>
            <p>Provider name and location are part of the shared record. Contact information, operating hours and verification documents are not part of the current schema and are not displayed or invented.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
