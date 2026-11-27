import { useCallback, useEffect, useState } from 'react';
import ListingManager from './ListingManager.jsx';
import Overview from './Overview.jsx';
import ProfilePanel from './ProfilePanel.jsx';
import RequestInbox from './RequestInbox.jsx';
import {
  createListing,
  deleteListing,
  isDemoMode,
  listDemoProviders,
  loadCatalog,
  loadListings,
  loadProfile,
  loadRequests,
  resetDemoData,
  respondToRequest,
  setDemoProvider,
  updateListing,
  updateProfile
} from './providerApi.js';
import { validateListingInput, validateProfileInput } from './validation.js';
import './provider.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'requests', label: 'Requests' },
  { id: 'listings', label: 'Listings' },
  { id: 'profile', label: 'Profile' }
];

function describeError(error) {
  if (!error) return 'Something went wrong.';
  const fields = error.fields ? Object.values(error.fields).join(' ') : '';
  return fields ? `${error.message} ${fields}` : error.message || 'Something went wrong.';
}

export default function ProviderDashboard() {
  const [tab, setTab] = useState('overview');
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [profile, setProfile] = useState(null);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const [listingResult, requestResult] = await Promise.all([loadListings(), loadRequests()]);
      const profileResult = await loadProfile();
      setListings(listingResult.data);
      setRequests(requestResult.data);
      setProfile(profileResult.data || listingResult.data[0]?.provider || null);
      setProviders(isDemoMode() ? listDemoProviders() : []);
      setNotice([...new Set([listingResult.notice, requestResult.notice].filter(Boolean))].join(' '));
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCatalog(loadCatalog());
    load();
  }, [load]);

  async function saveListing(change, setErrors) {
    const { errors, value } = validateListingInput(change.value, catalog, profile?.type);
    setErrors(errors);
    if (Object.keys(errors).length) return false;

    setBusy(true);
    setError('');
    try {
      const result = change.type === 'create' ? await createListing(value) : await updateListing(change.id, value);
      if (result.notice) setNotice(result.notice);
      await load({ showLoading: false });
      return true;
    } catch (failure) {
      setError(describeError(failure));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function removeListing(id) {
    setBusy(true);
    setError('');
    try {
      const result = await deleteListing(id);
      if (result.notice) setNotice(result.notice);
      await load({ showLoading: false });
      return true;
    } catch (failure) {
      setError(describeError(failure));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(value, setErrors) {
    const { errors, value: clean } = validateProfileInput(value);
    setErrors(errors);
    if (Object.keys(errors).length) return false;

    setBusy(true);
    setError('');
    try {
      const result = await updateProfile(clean);
      if (result.notice) setNotice(result.notice);
      await load({ showLoading: false });
      return true;
    } catch (failure) {
      setError(describeError(failure));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function respond(id, value) {
    setBusy(true);
    setError('');
    try {
      const result = await respondToRequest(id, value);
      if (result.notice) setNotice(result.notice);
      await load({ showLoading: false });
      return true;
    } catch (failure) {
      setError(describeError(failure));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function switchProvider(event) {
    setBusy(true);
    setError('');
    try {
      const result = await setDemoProvider(event.target.value);
      if (result.notice) setNotice(result.notice);
      await load({ showLoading: false });
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  function resetDemo() {
    const result = resetDemoData();
    setNotice(result.notice);
    load({ showLoading: false });
  }

  return (
    <section className="provider-dashboard" aria-labelledby="provider-heading">
      <div className="provider-header">
        <div>
          <h2 id="provider-heading">Provider workspace</h2>
          <p className="provider-meta">{profile ? `${profile.name} · ${profile.type === 'pharmacy' ? 'Pharmacy' : 'Hospital'} · ${profile.location || 'Location not provided'}` : 'Loading provider details…'}</p>
        </div>
        <div className="provider-header-actions">
          {providers.length > 1 ? (
            <label className="provider-field provider-field-inline">
              <span>Demo provider</span>
              <select value={profile?.id || ''} onChange={switchProvider} disabled={busy}>
                {providers.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.type}</option>)}
              </select>
            </label>
          ) : null}
          <button type="button" className="provider-button-secondary" onClick={() => load({ showLoading: false })} disabled={loading || busy}>Refresh</button>
        </div>
      </div>

      <p role="note" className="provider-synthetic">Hackathon prototype · Synthetic data only · Confirmations are enquiries, not bookings, payments or stock reservations.</p>

      {notice ? (
        <div className="provider-notice" role="status">
          <span>{notice}</span>
          {isDemoMode() ? <button type="button" className="provider-button-secondary" onClick={resetDemo} disabled={busy}>Reset demo data</button> : null}
        </div>
      ) : null}
      {error ? <div className="provider-error" role="alert">{error}</div> : null}

      <div className="provider-tabs" role="tablist" aria-label="Provider sections">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`provider-tab-${entry.id}`}
            aria-controls={`provider-panel-${entry.id}`}
            aria-selected={tab === entry.id}
            className={tab === entry.id ? 'provider-tab provider-tab-active' : 'provider-tab'}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {loading ? <p role="status">Loading provider data…</p> : null}

      {!loading && tab === 'overview' ? (
        <div role="tabpanel" id="provider-panel-overview" aria-labelledby="provider-tab-overview">
          <Overview listings={listings} requests={requests} source={isDemoMode() ? 'demo' : 'api'} onNavigate={setTab} />
        </div>
      ) : null}
      {!loading && tab === 'requests' ? (
        <div role="tabpanel" id="provider-panel-requests" aria-labelledby="provider-tab-requests">
          <RequestInbox requests={requests} busy={busy} onRespond={respond} />
        </div>
      ) : null}
      {!loading && tab === 'listings' ? (
        <div role="tabpanel" id="provider-panel-listings" aria-labelledby="provider-tab-listings">
          <ListingManager
            listings={listings}
            catalog={catalog}
            providerType={profile?.type}
            busy={busy}
            canRemove={isDemoMode()}
            onSave={saveListing}
            onRemove={removeListing}
          />
        </div>
      ) : null}
      {!loading && tab === 'profile' ? (
        <div role="tabpanel" id="provider-panel-profile" aria-labelledby="provider-tab-profile">
          <ProfilePanel profile={profile} canEdit={isDemoMode()} busy={busy} onSave={saveProfile} />
        </div>
      ) : null}
    </section>
  );
}
