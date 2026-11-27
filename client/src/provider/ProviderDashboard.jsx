import { useCallback, useEffect, useState } from 'react';
import ListingManager from './ListingManager.jsx';
import RequestInbox from './RequestInbox.jsx';
import {
  createListing,
  isDemoMode,
  loadCatalog,
  loadListings,
  loadRequests,
  resetDemoData,
  respondToRequest,
  updateListing
} from './providerApi.js';
import { validateListingInput } from './validation.js';
import './provider.css';

function describeError(error) {
  if (!error) return 'Something went wrong.';
  const fields = error.fields ? Object.values(error.fields).join(' ') : '';
  return fields ? `${error.message} ${fields}` : error.message || 'Something went wrong.';
}

export default function ProviderDashboard() {
  const [tab, setTab] = useState('requests');
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const [listingResult, requestResult] = await Promise.all([loadListings(), loadRequests()]);
      setListings(listingResult.data);
      setRequests(requestResult.data);
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
    const { errors, value } = validateListingInput(change.value, catalog);
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
          <p className="provider-meta">Demo Afya Hospital · Nairobi · fictional listings, prices and requests</p>
        </div>
        <button type="button" className="provider-button-secondary" onClick={() => load({ showLoading: false })} disabled={loading || busy}>Refresh</button>
      </div>

      <p role="note" className="provider-synthetic">Hackathon prototype · Synthetic data only · Confirmations are enquiries, not bookings or reservations.</p>

      {notice ? (
        <div className="provider-notice" role="status">
          <span>{notice}</span>
          {isDemoMode() ? <button type="button" className="provider-button-secondary" onClick={resetDemo} disabled={busy}>Reset demo data</button> : null}
        </div>
      ) : null}
      {error ? <div className="provider-error" role="alert">{error}</div> : null}

      <div className="provider-tabs" role="tablist" aria-label="Provider sections">
        <button
          type="button"
          role="tab"
          id="provider-tab-requests"
          aria-controls="provider-panel-requests"
          aria-selected={tab === 'requests'}
          className={tab === 'requests' ? 'provider-tab provider-tab-active' : 'provider-tab'}
          onClick={() => setTab('requests')}
        >
          Requests ({requests.length})
        </button>
        <button
          type="button"
          role="tab"
          id="provider-tab-listings"
          aria-controls="provider-panel-listings"
          aria-selected={tab === 'listings'}
          className={tab === 'listings' ? 'provider-tab provider-tab-active' : 'provider-tab'}
          onClick={() => setTab('listings')}
        >
          Listings ({listings.length})
        </button>
      </div>

      {loading ? <p role="status">Loading provider data…</p> : null}

      {!loading && tab === 'requests' ? (
        <div role="tabpanel" id="provider-panel-requests" aria-labelledby="provider-tab-requests">
          <RequestInbox requests={requests} busy={busy} onRespond={respond} />
        </div>
      ) : null}
      {!loading && tab === 'listings' ? (
        <div role="tabpanel" id="provider-panel-listings" aria-labelledby="provider-tab-listings">
          <ListingManager listings={listings} catalog={catalog} busy={busy} onSave={saveListing} />
        </div>
      ) : null}
    </section>
  );
}
