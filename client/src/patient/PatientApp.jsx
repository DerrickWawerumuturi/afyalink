import { useEffect, useState } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Cross,
  Stethoscope,
  Pill,
  MapPin,
  Search,
  ArrowRight,
  ClipboardList,
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
  simulateReply,
} from "./api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import "./patient.css";
import { ServicesPage, MedicinesPage } from "./PatientJourneys";
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
    <input id="search-item" role="combobox" aria-labelledby="search-item-label" aria-expanded={open} aria-controls="home-search-options" aria-autocomplete="list" aria-activedescendant={open && active >= 0 && matches[active] ? `home-option-${matches[active].id}` : undefined} autoComplete="off" value={value} placeholder={mode === "service" ? "Search services, e.g. ultrasound" : "Search demo medications"}
      onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
      onChange={(e) => { onChange(e.target.value); setActive(-1); setOpen(true); }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" && matches.length) { e.preventDefault(); setOpen(true); setActive((n) => Math.min(n + 1, matches.length - 1)); }
        if (e.key === "ArrowUp" && matches.length) { e.preventDefault(); setActive((n) => Math.max(n - 1, 0)); }
        if (e.key === "Escape") { setOpen(false); setActive(-1); }
        if (e.key === "Enter" && open && matches[active]) { e.preventDefault(); choose(matches[active]); }
      }} />
    {open && <div id="home-search-options" className="home-suggestions" role="listbox" aria-label={mode === "service" ? "Service suggestions" : "Medication suggestions"}>
      {matches.length ? matches.map((item, index) => <div id={`home-option-${item.id}`} role="option" aria-selected={active === index} key={item.id} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(item)}><Search aria-hidden="true" /><span>{label(item)}</span></div>) : <p>No matching demo items.</p>}
    </div>}
  </div>;
}
function Finder() {
  const [mode, set] = useState("service"),
    [area, A] = useState("Nairobi"),
    [q, Q] = useState(""),
    [error, setError] = useState("");
  const go = useNavigate();
  return (
    <form
      className="finder"
      onSubmit={(e) => {
        e.preventDefault();
        const match = catalog.find((item) => item.type === mode && item.name.toLowerCase() === q.trim().toLowerCase());
        if (mode === "medication" && !match) {
          setError("Choose a medication from the demo suggestions.");
          document.getElementById("search-item")?.focus();
          return;
        }
        setError("");
        go(
          "/" +
            (mode === "service" ? "services" : "medicines") +
            "?" +
            new URLSearchParams({ q: match?.name || q.trim(), area }),
        );
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
          <span id="search-item-label">{mode === "service" ? "Medical service" : "Demo medication"}</span>
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
function Home() {
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
        <div className="home-search"><Finder /><p className="home-disclosure">Synthetic demo data · Prices are estimates until confirmed</p></div>
      </div>
      <div className="home-pathways">
        <div className="pathways-heading"><span>FIND YOUR WAY TO CARE</span><h2>Two ways to start.</h2></div>
        <Link className="pathway service-path" to="/services"><span className="pathway-number">01 / MEDICAL SERVICES</span><strong>Find care<br />with confidence.</strong><p>Explore services and compare estimated prices before you travel.</p><span className="pathway-action">Explore medical services <ArrowRight /></span><span className="pathway-art pathway-art-service" aria-hidden="true"><span>ULTRASOUND</span><b>Compare care</b><small>PRICE · LOCATION · AVAILABILITY</small></span></Link>
        <Link className="pathway medicine-path" to="/medicines"><span className="pathway-number">02 / MEDICATIONS</span><strong>Your prescription,<br />made clearer.</strong><p>See the estimated cost of your medications at different pharmacies.</p><span className="pathway-action">Compare medications <ArrowRight /></span><span className="pathway-art pathway-art-medicine" aria-hidden="true"><span>YOUR PRESCRIPTION</span><b>Compare costs</b><small>ONE LIST · MORE OPTIONS</small></span></Link>
      </div>
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
      </div>
    </article>
  );
}
function Services({ send }) {
  const [p, P] = useSearchParams(),
    q = p.get("q") || "",
    area = p.get("area") || "Nairobi",
    [rows, R] = useState([]);
  useEffect(() => {
    let active = true;
    search("service", q.trim(), area).then((v) => active && R(v));
    return () => {
      active = false;
    };
  }, [q, area]);
  return (
    <>
      <h1>Medical services</h1>
      <div className="fields box">
        <label>
          Search services
          <input
            value={q}
            placeholder="e.g. Ultrasound"
            onChange={(e) => P({ q: e.target.value, area }, { replace: true })}
          />
        </label>
        <Area value={area} onChange={(area) => P({ q, area })} />
      </div>
      <h2>{rows.length} listings</h2>
      {rows.map((r) => (
        <Listing key={r.id} row={r} send={send} />
      ))}
      {!rows.length && <p>Try a different service or area.</p>}
    </>
  );
}
const meds = catalog.filter((i) => i.type === "medication");
function Medicines({ send }) {
  const [p] = useSearchParams(),
    [area, A] = useState(p.get("area") || "Nairobi"),
    [items, S] = useState([
      {
        item_id: (meds.find((i) => i.name === p.get("q")) || meds[0]).id,
        quantity: 1,
      },
    ]),
    [options, O] = useState([]);
  useEffect(() => {
    let active = true;
    O([]);
    if (items.every((i) => Number.isSafeInteger(i.quantity) && i.quantity > 0))
      compare(items, area).then((v) => active && O(v));
    return () => {
      active = false;
    };
  }, [items, area]);
  const update = (n, v) =>
    S(items.map((i, k) => (k === n ? { ...i, ...v } : i)));
  return (
    <>
      <h1>Compare medications</h1>
      <p>Build a sample prescription using the demo catalog.</p>
      <div className="box">
        <Area value={area} onChange={A} />
        {items.map((i, n) => (
          <div className="fields" key={n}>
            <label>
              Medication
              <select
                value={i.item_id}
                onChange={(e) => update(n, { item_id: e.target.value })}
              >
                {meds
                  .filter(
                    (m) =>
                      m.id === i.item_id ||
                      !items.some((v) => v.item_id === m.id),
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {label(m)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Quantity
              <input
                type="number"
                min="1"
                step="1"
                value={i.quantity}
                onChange={(e) =>
                  update(n, {
                    quantity:
                      e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
            </label>
            {items.length > 1 && (
              <button
                aria-label={
                  "Remove " + label(meds.find((m) => m.id === i.item_id))
                }
                onClick={() => S(items.filter((_, k) => k !== n))}
              >
                <Trash2 />
              </button>
            )}
          </div>
        ))}
        {items.length < meds.length && (
          <button
            onClick={() =>
              S([
                ...items,
                {
                  item_id: meds.find(
                    (m) => !items.some((i) => i.item_id === m.id),
                  ).id,
                  quantity: 1,
                },
              ])
            }
          >
            <Plus /> Add medication
          </button>
        )}
      </div>
      {!options.length && <p>Enter a positive whole quantity for each item.</p>}
      {[true, false].map(
        (complete) =>
          options.some((o) => o.complete === complete) && (
            <div key={String(complete)}>
              <h2>
                {complete ? "Complete prescriptions" : "Partial availability"}
              </h2>
              {options
                .filter((o) => o.complete === complete)
                .map((o) => (
                  <article key={o.provider_id}>
                    <div>
                      <h3>
                        <Link to={"/facility/" + o.provider_id}>
                          {detail(o.provider_id)[0].provider.name}
                        </Link>
                      </h3>
                      {o.lines.map((l) => (
                        <p key={l.item_id}>
                          {label(meds.find((i) => i.id === l.item_id))} ·{" "}
                          {l.quantity} × {money(l.unit_price)}
                        </p>
                      ))}
                      {o.missing_item_ids.map((id) => (
                        <p key={id}>
                          Unavailable in requested quantity ·{" "}
                          {label(meds.find((i) => i.id === id))}
                        </p>
                      ))}
                    </div>
                    <div>
                      <strong>{money(o.total ?? o.available_subtotal)}</strong>
                      <p>
                        {complete ? "Estimated total" : "Available items only"}
                      </p>
                      {complete && (
                        <button onClick={() => send(o.lines)}>
                          Request confirmation
                        </button>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          ),
      )}
    </>
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
  const [rows, R] = useState(requests);
  useEffect(() => {
    const t = setInterval(() => R(requests()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <h1>My requests</h1>
      <p>
        Demo enquiries saved in this browser. Pending enquiries expire after 30
        minutes.
      </p>
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
                    ? "Demo confirmed price"
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
                {r.status === "pending" && (
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
  function send(lines) {
    try {
      enquire(lines);
      E("");
      go("/requests");
    } catch {
      E(
        "Your browser could not save the request. Enable local storage and try again.",
      );
    }
  }
  return (
    <div className="patient">
      <div className="top">
        <div className="bar">
          <Link className="brand" to="/">
            <Cross /> AfyaLink
          </Link>
          <nav>
            <NavLink end to="/">
              Find care
            </NavLink>
            <NavLink to="/medicines">Medications</NavLink>
            <NavLink to="/requests">
              <ClipboardList /> My requests
            </NavLink>
          </nav>
        </div>
      </div>
      <main>
        {error && <p role="alert">{error}</p>}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<ServicesPage send={send} />} />
          <Route path="/medicines" element={<MedicinesPage send={send} />} />
          <Route path="/facility/:id" element={<Facility send={send} />} />
          <Route path="/requests" element={<Tracking />} />
          <Route path="*" element={<Link to="/">Return to Find care</Link>} />
        </Routes>
      </main>
      <footer>
        AfyaLink · Synthetic demo data{" "}
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
