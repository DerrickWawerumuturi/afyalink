import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarDays,
  CircleAlert,
  Inbox,
  LayoutDashboard,
  MapPin,
  Pill,
  LogIn,
  RefreshCw,
  ShieldX,
  Tags,
  UserRound,
} from 'lucide-react';
import ListingManager from './ListingManager.jsx';
import Overview from './Overview.jsx';
import ProfilePanel from './ProfilePanel.jsx';
import RequestInbox from './RequestInbox.jsx';
import AppointmentInbox from './AppointmentInbox.jsx';
import {
  createListing,
  deleteListing,
  isDemoMode,
  listDemoProviders,
  loadAppointments,
  loadCatalog,
  loadListings,
  checkProviderAccess,
  loadProfile,
  loadRequests,
  resetDemoData,
  respondToAppointment,
  respondToRequest,
  setDemoProvider,
  updateListing,
  updateProfile,
} from './providerApi.js';
import { effectiveStatus, validateListingInput, validateProfileInput } from './validation.js';
import './provider.css';

const PAGE_SIZE = 20;

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'requests', label: 'Requests', icon: Inbox, count: 'requests' },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays, count: 'appointments' },
  { id: 'listings', label: 'Listings', icon: Tags, count: 'listings' },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

function describeError(error) {
  if (!error) return 'Something went wrong.';
  const fields = error.fields ? Object.values(error.fields).join(' ') : '';
  return fields ? `${error.message} ${fields}` : error.message || 'Something went wrong.';
}

export default function ProviderDashboard({ session }) {
  const [tab, setTab] = useState('overview');
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [profile, setProfile] = useState(null);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState(session ? 'checking' : 'signed_out');
  const [accessAttempt, setAccessAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [pages, setPages] = useState({ listings: 1, requests: 1, appointments: 1 });
  const [meta, setMeta] = useState({
    listings: { page: 1, limit: PAGE_SIZE, total: 0 },
    requests: { page: 1, limit: PAGE_SIZE, total: 0 },
    appointments: { page: 1, limit: PAGE_SIZE, total: 0 },
  });

  const load = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const [listingResult, requestResult, appointmentResult] = await Promise.all([
        loadListings({ page: pages.listings, limit: PAGE_SIZE }),
        loadRequests({ page: pages.requests, limit: PAGE_SIZE }),
        loadAppointments({ page: pages.appointments, limit: PAGE_SIZE }),
      ]);
      const profileResult = await loadProfile();
      setListings(listingResult.data);
      setRequests(requestResult.data);
      setAppointments(appointmentResult.data);
      setMeta({ listings: listingResult.meta, requests: requestResult.meta, appointments: appointmentResult.meta });
      setProfile(profileResult.data || listingResult.data[0]?.provider || null);
      setProviders(isDemoMode() ? listDemoProviders() : []);
      setNotice([...new Set([listingResult.notice, requestResult.notice, appointmentResult.notice, profileResult.notice].filter(Boolean))].join(' '));
      setRefreshedAt(new Date());
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [pages]);

  useEffect(() => {
    setCatalog(loadCatalog());
  }, []);

  useEffect(() => {
    let active = true;
    if (!session) {
      setAccess('signed_out');
      return () => { active = false; };
    }
    setAccess('checking');
    checkProviderAccess()
      .then((result) => {
        if (!active) return;
        if (result.status === 'granted') {
          setProfile(result.profile);
          setAccess('granted');
        } else {
          setAccess(result.status);
        }
      })
      .catch(() => { if (active) setAccess('error'); });
    return () => { active = false; };
  }, [session?.user?.id, accessAttempt]);

  useEffect(() => {
    if (access === 'granted') load();
  }, [access, load]);

  function changePage(section, page) {
    setPages((current) => ({ ...current, [section]: page }));
  }

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

  async function respondAppointment(id, value) {
    setBusy(true);
    setError('');
    try {
      const result = await respondToAppointment(id, value);
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

  const isPharmacy = profile?.type === 'pharmacy';
  const ProviderIcon = isPharmacy ? Pill : Building2;
  const pendingCount = requests.filter((request) => effectiveStatus(request) === 'pending').length;
  const demo = isDemoMode();
  const tabCounts = { requests: meta.requests.total, appointments: meta.appointments.total, listings: meta.listings.total };


  if (access !== 'granted') {
    const gate = {
      checking: { icon: RefreshCw, title: 'Checking provider access…', copy: 'Verifying your provider membership.' },
      signed_out: { icon: LogIn, title: 'Provider sign-in required', copy: 'Sign in with a hospital or pharmacy account to manage listings, enquiries and appointments.' },
      denied: { icon: ShieldX, title: 'Provider access required', copy: 'This account is signed in but is not linked to a hospital or pharmacy. Provider access is provisioned by the CareCheck team.' },
      error: { icon: CircleAlert, title: 'Unable to verify provider access', copy: 'The provider service could not be reached. Try again in a moment.' },
    }[access];
    const Icon = gate.icon;
    return (
      <section className="provider-dashboard" aria-labelledby="provider-heading">
        <div className="provider-access">
          <span className={`provider-access-icon access-${access}`}>
            <Icon aria-hidden="true" className={access === 'checking' ? 'is-spinning' : undefined} />
          </span>
          <span className="provider-eyebrow">Provider workspace</span>
          <h2 id="provider-heading">{gate.title}</h2>
          <p>{gate.copy}</p>
          {session?.user?.email ? <p className="provider-access-user">Signed in as {session.user.email}</p> : null}
          <div className="provider-access-actions">
            {access === 'signed_out' ? (
              <button type="button" className="provider-button-primary" onClick={() => window.dispatchEvent(new Event('carecheck:open-auth'))}>
                <LogIn aria-hidden="true" /> Sign in with a provider account
              </button>
            ) : null}
            {access === 'denied' ? (
              <>
                <button type="button" className="provider-button-secondary" onClick={() => window.dispatchEvent(new Event('carecheck:sign-out'))}>Sign out</button>
                <a className="provider-button-primary" href="#/">Go to patient app</a>
              </>
            ) : null}
            {access === 'error' ? (
              <button type="button" className="provider-button-primary" onClick={() => setAccessAttempt((value) => value + 1)}>
                <RefreshCw aria-hidden="true" /> Retry
              </button>
            ) : null}
            {access === 'signed_out' || access === 'error' ? <a className="provider-button-secondary" href="#/">Back to patient app</a> : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="provider-dashboard" aria-labelledby="provider-heading">
      <header className="provider-hero">
        <div className="provider-hero-main">
          <span className={`provider-avatar ${isPharmacy ? 'is-medication' : 'is-service'}`}>
            <ProviderIcon aria-hidden="true" />
          </span>
          <div className="provider-hero-copy">
            <span className="provider-eyebrow">Provider workspace</span>
            <h2 id="provider-heading">{profile?.name || 'Provider workspace'}</h2>
            <div className="provider-hero-meta">
              {profile ? (
                <span className="provider-chip"><ProviderIcon aria-hidden="true" /> {isPharmacy ? 'Pharmacy' : 'Hospital'}</span>
              ) : null}
              {profile?.location ? <span className="provider-chip"><MapPin aria-hidden="true" /> {profile.location}</span> : null}
              {profile ? (
                <span className={`provider-chip ${profile.verified ? 'provider-chip-green' : 'provider-chip-muted'}`}>
                  <BadgeCheck aria-hidden="true" /> {profile.verified ? 'Verified' : 'Unverified'}
                </span>
              ) : null}
              <span className={`provider-chip ${demo ? 'provider-chip-amber' : 'provider-chip-green'}`}>
                <Activity aria-hidden="true" /> {demo ? 'Demo mode' : 'Live API'}
              </span>
            </div>
          </div>
        </div>

        <div className="provider-hero-actions">
          {providers.length > 1 ? (
            <label className="provider-hero-select">
              <span>Demo provider</span>
              <select value={profile?.id || ''} onChange={switchProvider} disabled={busy}>
                {providers.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.type}</option>)}
              </select>
            </label>
          ) : null}
          <button type="button" className="provider-hero-button" onClick={() => load({ showLoading: false })} disabled={loading || busy}>
            <RefreshCw aria-hidden="true" className={loading ? 'is-spinning' : undefined} /> Refresh
          </button>
        </div>

        <div className="provider-hero-facts">
          <div><span>Listings</span><strong>{meta.listings.total}</strong></div>
          <div><span>Enquiries</span><strong>{meta.requests.total}</strong></div>
          <div><span>Pending</span><strong>{pendingCount}</strong></div>
          <div><span>Updated</span><strong>{refreshedAt ? refreshedAt.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '—'}</strong></div>
        </div>
      </header>

      {notice ? (
        <div className="provider-notice" role="status">
          <span>{notice}</span>
          {demo ? <button type="button" className="provider-button-secondary" onClick={resetDemo} disabled={busy}>Reset demo data</button> : null}
        </div>
      ) : null}
      {error ? <div className="provider-error" role="alert">{error}</div> : null}

      <div className="provider-tabs" role="tablist" aria-label="Provider sections">
        {TABS.map((entry) => {
          const Icon = entry.icon;
          const count = entry.count ? tabCounts[entry.count] : undefined;
          return (
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
              <Icon aria-hidden="true" />
              <span>{entry.label}</span>
              {typeof count === 'number' ? <span className="provider-tab-count">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="provider-skeleton-grid" role="status" aria-label="Loading provider data">
          {[0, 1, 2, 3].map((key) => <div key={key} className="provider-skeleton-card" />)}
        </div>
      ) : null}

      {!loading && tab === 'overview' ? (
        <div role="tabpanel" id="provider-panel-overview" aria-labelledby="provider-tab-overview">
          <Overview listings={listings} requests={requests} meta={meta} source={demo ? 'demo' : 'api'} onNavigate={setTab} />
        </div>
      ) : null}
      {!loading && tab === 'requests' ? (
        <div role="tabpanel" id="provider-panel-requests" aria-labelledby="provider-tab-requests">
          <RequestInbox
            requests={requests}
            busy={busy}
            meta={meta.requests}
            onPageChange={(page) => changePage('requests', page)}
            onRespond={respond}
          />
        </div>
      ) : null}
      {!loading && tab === 'appointments' ? (
        <div role="tabpanel" id="provider-panel-appointments" aria-labelledby="provider-tab-appointments">
          <AppointmentInbox
            appointments={appointments}
            busy={busy}
            meta={meta.appointments}
            onPageChange={(page) => changePage('appointments', page)}
            onRespond={respondAppointment}
          />
        </div>
      ) : null}
      {!loading && tab === 'listings' ? (
        <div role="tabpanel" id="provider-panel-listings" aria-labelledby="provider-tab-listings">
          <ListingManager
            listings={listings}
            catalog={catalog}
            providerType={profile?.type}
            busy={busy}
            canRemove
            meta={meta.listings}
            onPageChange={(page) => changePage('listings', page)}
            onSave={saveListing}
            onRemove={removeListing}
          />
        </div>
      ) : null}
      {!loading && tab === 'profile' ? (
        <div role="tabpanel" id="provider-panel-profile" aria-labelledby="provider-tab-profile">
          <ProfilePanel profile={profile} canEdit={demo} busy={busy} onSave={saveProfile} />
        </div>
      ) : null}
    </section>
  );
}
