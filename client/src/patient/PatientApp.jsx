import { useEffect, useState } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Stethoscope,
  Pill,
  MapPin,
  Search,
  ArrowRight,
  ScanLine,
  TestTubeDiagonal,
  Bone,
  Plus,
  Trash2,
  ArrowUpRight,
} from "lucide-react";
import {
  catalog,
  search,
  compare,
  detail,
  enquire,
  requests,
  simulateReply, initialize, getSource,
} from "./api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import "./patient.css";
import { ServicesPage, MedicinesPage } from "./PatientJourneys";
import BookAppointmentButton from "./BookAppointmentButton.jsx";
import Appointments from "./Appointments.jsx";
const money = (n) => "KES " + n.toLocaleString("en-KE");
const label = (i) =>
  [i.name, i.strength, i.dosage_form].filter(Boolean).join(" ");
function Area({ value, onChange }) {
  return (
    <label>
      Location
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {["Nairobi", "Westlands", "Kilimani", "Parklands"].map((a) => (
          <option key={a}>{a}</option>
        ))}
      </select>
    </label>
  );
}
function SearchSuggestions({ mode, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = catalog.filter((item) => item.type === mode && label(item).toLowerCase().includes(value.trim().toLowerCase()));
  const choose = (item) => { onChange(item.name); setOpen(false); setActive(-1); };
  return <div className="home-combobox">
    <input id="search-item" role="combobox" aria-labelledby="search-item-label" aria-expanded={open} aria-controls="home-search-options" aria-autocomplete="list" aria-activedescendant={open && active >= 0 && matches[active] ? `home-option-${matches[active].id}` : undefined} autoComplete="off" value={value} placeholder={mode === "service" ? "Search services, e.g. ultrasound" : "Search medications"}
      onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
      onChange={(e) => { onChange(e.target.value); setActive(-1); setOpen(true); }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" && matches.length) { e.preventDefault(); setOpen(true); setActive((n) => Math.min(n + 1, matches.length - 1)); }
        if (e.key === "ArrowUp" && matches.length) { e.preventDefault(); setActive((n) => Math.max(n - 1, 0)); }
        if (e.key === "Escape") { setOpen(false); setActive(-1); }
        if (e.key === "Enter" && open && matches[active]) { e.preventDefault(); choose(matches[active]); }
      }} />
    {open && <div id="home-search-options" className="home-suggestions" role="listbox" aria-label={mode === "service" ? "Service suggestions" : "Medication suggestions"}>
      {matches.length ? matches.map((item, index) => <div id={`home-option-${item.id}`} role="option" aria-selected={active === index} key={item.id} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(item)}><Search aria-hidden="true" /><span>{label(item)}</span></div>) : <p>No matching items.</p>}
    </div>}
  </div>;
}
function Finder({ onSearch }) {
  const [mode, set] = useState("service"),
    [area, A] = useState("Nairobi"),
    [q, Q] = useState(""),
    [error, setError] = useState("");
  return (
    <form
      className="finder"
      onSubmit={(e) => {
        e.preventDefault();
        const match = catalog.find((item) => item.type === mode && item.name.toLowerCase() === q.trim().toLowerCase());
        if (mode === "medication" && !match) {
          setError("Choose a medication from the suggestions.");
          document.getElementById("search-item")?.focus();
          return;
        }
        setError("");
        onSearch({ type: mode, q: match?.name || q.trim(), area });
      }}
    >
      <Tabs value={mode} onValueChange={(value) => { set(value); Q(""); setError(""); }}>
        <TabsList className="home-tabs" aria-label="Search type">
          <TabsTrigger value="service">Medical services</TabsTrigger>
          <TabsTrigger value="medication">Medications</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="fields">
        <div className="home-field">
          <span id="search-item-label">{mode === "service" ? "Medical service" : "Medication"}</span>
          <SearchSuggestions mode={mode} value={q} onChange={(value) => { Q(value); setError(""); }} />
          {error && <span role="alert" className="home-search-error">{error}</span>}
        </div>
        <div className="home-field">
          <span id="search-area-label">Location</span>
          <Select value={area} onValueChange={A}>
            <SelectTrigger aria-labelledby="search-area-label" className="home-select"><SelectValue /></SelectTrigger>
            <SelectContent position="popper" className="home-select-content">
              {["Nairobi", "Westlands", "Kilimani", "Parklands"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="primary"><Search />Search</Button>
      </div>
    </form>
  );
}
const tiles = [
  ["Ultrasound", "Compare scan prices", ScanLine, "ultra"],
  ["Blood test", "Explore laboratory tests", TestTubeDiagonal, "blood"],
  ["X-ray", "Find imaging services", Bone, "xray"],
];
function Home({ send }) {
  const [query, setQuery] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  useEffect(() => {
    if (!query) return;
    let active = true; setLoading(true); setSearchError('');
    search(query.type, query.q, query.area).then(rows => { if (active) setResults(rows); }).catch(e => { if (active) setSearchError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);
  useEffect(() => { if (query) document.getElementById('quick-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [query]);
  return (
    <div className="home">
      <div className="home-hero">
        <div className="home-intro">

          <h1>Care, with<br />more clarity.</h1>
          <p className="home-deck">Find care and compare costs before you make the journey.</p>
        </div>
        <div className="home-photo">
          <img src="/patient/nairobi-portrait-2.jpg" alt="Portrait of a woman in Nairobi" />

        </div>
        <div className="home-search"><Finder onSearch={setQuery} /><p className="home-disclosure">Prices are estimates until confirmed</p></div>
      </div>

      {query && <section id="quick-results" className="quick-results" aria-live="polite"><h2>{query.type === 'medication' ? 'Medication' : 'Medical service'} results {query.q && `for ${query.q}`}</h2><p>In {query.area} · Prices and availability are provider-reported.</p>{loading ? <p>Searching…</p> : searchError ? <p role="alert">{searchError}</p> : results.length ? results.map(row => <article key={row.id} className="quick-result"><div><span>{label(row.item)}</span><h3><Link to={'/facility/' + row.provider.id}>{row.provider.name}</Link></h3><p>{row.provider.location} · {row.available && row.stock_quantity !== 0 ? 'Reported available' : 'Unavailable'}</p><small>Updated {new Date(row.updated_at).toLocaleString('en-KE', { timeZone:'Africa/Nairobi' })} EAT</small></div><div><strong>{money(row.price)}</strong><p>Estimate per {row.pricing_unit}</p><button disabled={!row.available || row.stock_quantity === 0} onClick={() => send([{listing_id:row.id, quantity:1}])}>Request confirmation</button>{row.item?.type === 'service' ? <BookAppointmentButton listing={row} compact /> : null}</div></article>) : <p>No matches. Try another term or location.</p>}{query.type === 'medication' && <Link to={'/medicines?' + new URLSearchParams({q:query.q, area:query.area})}>Compare a complete prescription <ArrowRight /></Link>}</section>}
    </div>
  );
}
function Listing({ row, send }) {
  return (
    <article>
      <div>
        <small>{label(row.item).toUpperCase()}</small>
        <h3>
          <Link to={"/facility/" + row.provider.id}>{row.provider.name}</Link>
        </h3>
        <p>
          <MapPin />
          {row.provider.location}
        </p>
        <p>
          {row.available ? "Reported available" : "Unavailable"} · Updated{" "}
          {new Date(row.updated_at).toLocaleString("en-KE", {
            timeZone: "Africa/Nairobi",
          })}{" "}
          EAT
        </p>
      </div>
      <div>
        <strong>{money(row.price)}</strong>
        <p>Estimate per {row.pricing_unit}</p>
        <button
          disabled={!row.available}
          onClick={() => send([{ listing_id: row.id, quantity: 1 }])}
        >
          Request confirmation
        </button>
        {row.item?.type === "service" ? <BookAppointmentButton listing={row} compact /> : null}
      </div>
    </article>
  );
}
function Facility({ send }) {
  const rows = detail(useParams().id);
  return rows.length ? (
    <>
      <small>PROVIDER DETAILS</small>
      <h1>{rows[0].provider.name}</h1>
      <p>
        <MapPin />
        {rows[0].provider.location}
      </p>
      <h2>Prices and availability</h2>
      {rows.map((r) => (
        <Listing
          key={r.id}
          row={{ ...r, available: r.available && r.stock_quantity !== 0 }}
          send={send}
        />
      ))}
    </>
  ) : (
    <h1>Provider not found</h1>
  );
}
function Tracking() {
  const [rows, R] = useState([]);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () => requests().then(value => { if (active) { R(value); setLoadError(''); } }).catch(e => { if (active) setLoadError(e.message); });
    refresh(); const t = setInterval(refresh, 10000);
    return () => { active = false; clearInterval(t); };
  }, []);
  return (
    <>
      <h1>My requests</h1>
      <p>
        Requests are refreshed automatically. Pending enquiries expire after 30 minutes.
      </p>
      {loadError && <p role="alert">{loadError}</p>}
      {rows.length ? (
        <>
          <h2>
            Pending estimates ·{" "}
            {money(
              rows
                .filter((r) => r.status === "pending")
                .reduce((s, r) => s + r.quantity * r.listing.price, 0),
            )}
          </h2>
          {rows.map((r) => (
            <article key={r.id}>
              <div>
                <small>{r.status.toUpperCase()}</small>
                <h3>{label(r.listing.item)}</h3>
                <p>
                  {r.listing.provider.name} · Quantity {r.quantity}
                </p>
              </div>
              <div>
                <strong>
                  {money(r.quantity * (r.confirmed_price ?? r.listing.price))}
                </strong>
                <p>
                  {r.status === "confirmed"
                    ? (getSource().source === "demo" ? "Demo confirmed price" : "Provider-confirmed price")
                    : r.status === "expired"
                      ? "Expired enquiry"
                      : "Estimated · No confirmed price"}
                </p>
                <p>
                  Expires{" "}
                  {new Date(r.expires_at).toLocaleTimeString("en-KE", {
                    timeZone: "Africa/Nairobi",
                  })}{" "}
                  EAT
                </p>
                {r.status === "pending" && getSource().source === "demo" && (
                  <button onClick={() => R(simulateReply(r.id))}>
                    Simulate provider confirmation
                  </button>
                )}
              </div>
            </article>
          ))}
        </>
      ) : (
        <div className="box">
          <h2>No requests yet</h2>
          <Link to="/services">
            Find a medical service <ArrowRight />
          </Link>
        </div>
      )}
    </>
  );
}
function Layout() {
  const go = useNavigate(),
    [error, E] = useState("");
  const [source, setSource] = useState(getSource());
  const [busy, setBusy] = useState(false);
  useEffect(() => { const update = () => setSource(getSource()); window.addEventListener('afyalink-source', update); initialize().catch(() => {}); return () => window.removeEventListener('afyalink-source', update); }, []);
  async function send(lines) {
    if (busy) return;
    setBusy(true);
    try {
      await enquire(lines);
      E("");
      go("/requests");
    } catch (e) {
      E(e.message || 'Unable to submit request. Please try again.');
    } finally { setBusy(false); }
  }
  return (
    <div className="patient">
      <main>
        <p role="status" className="source-notice">{source.notice}</p>
        {error && <p role="alert">{error}</p>}
        {source.source === 'loading' ? <p>Loading the care directory…</p> : source.source === 'error' ? <p>Unable to load the directory. Please try again later.</p> : <Routes>
          <Route path="/" element={<Home send={send} />} />
          <Route path="/services" element={<ServicesPage send={send} />} />
          <Route path="/medicines" element={<MedicinesPage send={send} />} />
          <Route path="/facility/:id" element={<Facility send={send} />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/requests" element={<Tracking />} />
          <Route path="*" element={<Link to="/">Return to Find care</Link>} />
        </Routes>}
      </main>
      <footer>
        AfyaLink · Healthcare information{" "}
        <a href="#/provider">
          Provider dashboard <ArrowUpRight />
        </a>
      </footer>
    </div>
  );
}
export default function PatientApp() {
  return (
    <HashRouter>
      <Layout />
    </HashRouter>
  );
}
