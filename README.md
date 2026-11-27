# AfyaLink

**Find the care you need, understand the cost, and confirm availability before travelling.**

Private hackathon project for Kenya. This repository starts with a runnable application shell and agreed implementation contracts; search, database access, authentication and confirmation workflows remain to be implemented during the sprint. All demonstrations must use synthetic data.

## Problem and purpose

Patients in Kenya can face fragmented information about medical service availability, medicine stock and prices. Visiting several hospitals or pharmacies can add transport costs, delay care and make completing prescribed treatment harder. AfyaLink explores whether better price and availability information can reduce avoidable journeys and help people plan healthcare spending. It does not claim to solve medicine supply, clinical decision-making or healthcare financing.

The product combines CareCheck (confirm hospital services before travel) and MediPrice (compare prescribed medicines) in one patient journey. Hospitals and pharmacies share one provider model, listing system and confirmation workflow. Patients and community health promoters can discover care; hospitals and pharmacies maintain their own information. County analytics and provider subscription revenue are future hypotheses, not validated outcomes.

## MVP and acceptance criteria

1. Search medical services and medication by name, location, price and availability. Show provider, pricing unit and last update time.
2. Compare like-for-like listings. Medication matches must include exact catalog item, strength, form and unit; never suggest clinical substitutions.
3. Request price and availability confirmation, then see pending, confirmed, declined or expired status.
4. Let an authenticated provider manage its own listings, prices, availability and incoming requests.
5. Demonstrate a hospital service search and a prescribed medication search using clearly labelled fictional providers and prices.

A successful demo persists a request, confirms it through the correct provider account and shows the resulting confirmed price and expiry to the requesting demo patient. Declines, expired confirmations, empty results, loading and API failures must be visible. Confirmation is an enquiry, not a booking, prescription, payment or stock reservation.

Stretch: compare a whole synthetic prescription and add service + medication + manually entered transport estimates. Incomplete baskets must show missing items and must never be ranked as cheaper complete prescriptions. Insurance/SHA coverage, payments, delivery, maps, AI/OCR prescription uploads, clinical advice and advanced analytics are outside the MVP.

## Stack and architecture

- One React application built with Vite: patient pages and provider dashboard with shared navigation.
- One Node.js / Express API: input validation with Zod, CORS and PostgreSQL access through `pg`.
- Supabase-hosted PostgreSQL: one shared schema and synthetic seed dataset.
- Supabase Auth is the planned identity provider for patient and provider demo accounts. Add its SDK only when implementing auth.

Flow: React → Express `/api` → PostgreSQL. The browser never receives database credentials or privileged Supabase keys. Express owns business rules and checks authenticated ownership on every private operation. Database access is wired through the `pg` pool; `/api/health` reports process health only.

## Team ownership and branches

| Developer | GitHub | Branch | Ownership |
| --- | --- | --- | --- |
| Dev 1 — Derrick | DerrickWawerumuturi | `feat/patient-app` | `client/src/patient/`, shared React shell and integration |
| Dev 2 — Deno | EngD3nnis | `feat/backend` | `server/`, `supabase/`, schema and API contracts |
| Dev 3 — Harry | myusercloud | `feat/provider-dashboard` | `client/src/provider/`, provider interactions |

Dev 1 coordinates `client/src/App.jsx`, global styling, `components/`, `lib/` and client dependencies. Dev 2 coordinates root tooling and `docs/API.md`. Agree before changing shared files; frontend developers can use fixtures matching the documented response shapes while the API is built.

```text
afyalink/
├── client/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── patient/PatientApp.jsx
│       ├── provider/ProviderDashboard.jsx
│       ├── components/
│       ├── lib/api.js
│       ├── App.jsx
│       ├── main.jsx
│       └── index.css
├── server/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── routes/
│       ├── middleware/
│       └── db/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── README.md
├── docs/API.md
├── package.json
├── package-lock.json
└── .gitignore
```

## Database design (implementation contract)

Use UUID primary keys, `timestamptz` stored in UTC, KES prices as non-negative `numeric(12,2)`, and foreign keys. API prices are JSON numbers in KES; perform totals in integer minor units internally to avoid floating-point errors. Format display as KSh. The migration is in `supabase/migrations/` and has been applied to local and hosted development projects.

| Table | Key fields and constraints |
| --- | --- |
| `providers` | `id`, `name`, `type` hospital/pharmacy, `location`, optional `latitude`/`longitude`, `verified` default false, timestamps |
| `catalog_items` | `id`, `name`, `type` service/medication, nullable `strength`, `dosage_form`, `unit`; medication identity includes strength/form/unit |
| `listings` | `id`, `provider_id` FK, `item_id` FK, `price`, `currency` fixed KES, `pricing_unit`, `available`, nullable non-negative integer `stock_quantity`, `updated_at`; unique provider/item/pricing-unit |
| `requests` | `id`, `listing_id` FK, `patient_user_id` FK to auth.users, nullable `request_group_id` UUID, positive integer `quantity`, `status`, nullable `confirmed_price`, `expires_at`, timestamps |
| `provider_memberships` | `user_id` FK to auth.users, `provider_id` FK, unique pair; assigned by trusted setup only |

The four core domain tables are supplemented by provider membership for authorization. A patient may only read their own requests. A provider member may manage listings and respond to requests belonging to that provider. Derive identity and provider scope from a validated session and membership; never trust a submitted user or provider ID as authorization.

Indexes: listings on provider/item and availability; catalog names for search; requests on patient, listing and status; memberships on user/provider. Prevent hospital medication listings and pharmacy service listings in API validation and database integrity logic. Define updated-at triggers and validate confirmed price/expiry before enabling writes. Keep historical request prices stable when a listing changes; confirmations snapshot the quoted unit price.

Transitions: pending → confirmed or declined; pending and confirmed become effectively expired after `expires_at`. Terminal states cannot be re-confirmed. Use a transaction and conditional update to prevent conflicting responses. An expired row must be reported as expired even before any cleanup job runs. Availability is provider-reported, not a live inventory guarantee.

## API contracts

The server implements the routes below; details, examples, errors and authorization are in [docs/API.md](docs/API.md).

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/listings` | Public service/medication search |
| POST | `/api/compare` | Compare an exact synthetic basket across providers |
| POST | `/api/requests` | Authenticated patient creates a confirmation enquiry |
| GET | `/api/requests/:id` | Patient reads their own enquiry |
| GET / POST | `/api/provider/listings` | Provider lists/creates its own offerings |
| PATCH | `/api/provider/listings/:id` | Provider updates its own offering |
| DELETE | `/api/provider/listings/:id` | Provider removes its own offering |
| GET | `/api/provider/requests` | Provider reads incoming enquiries |
| PATCH | `/api/provider/requests/:id` | Provider confirms or declines an enquiry |

## Local setup

Prerequisites: Node.js 22.12+ and npm, Git, and a team Supabase development project when database work starts. Node 22.17 is recorded in `.nvmrc`. Dependencies are pinned in workspace manifests and the root lockfile.

```bash
git clone https://github.com/DerrickWawerumuturi/afyalink.git
cd afyalink
npm ci
cp client/.env.example client/.env
cp server/.env.example server/.env
# Terminal 1
npm run dev:server
# Terminal 2
npm run dev:client
```

Open `http://localhost:5173`; provider shell is `/#/provider`. Check `http://localhost:5000/api/health`. If port 5000 is occupied, set `PORT=5055` in `server/.env` and update `VITE_API_URL` to match. `npm run build` builds the React client. There is one root npm workspace lockfile; run dependency changes from the repo root and commit it with package changes.

Client environment: `VITE_API_URL=http://localhost:5000/api`. Every `VITE_` value is public. Server environment: `PORT=5000`, `CLIENT_URL=http://localhost:5173`, `DATABASE_URL=`. Leave the database URL empty for shell development; Dev 2 obtains the connection string privately from the Supabase dashboard and configures TLS with certificate verification. No privileged Supabase key is needed by the initial `pg` architecture. Authentication configuration will be added with its implementation.

Database setup is implemented: the migration, least-privilege database role, RLS policies and synthetic seed are in `supabase/`, with exact local/hosted commands in `supabase/README.md`. A local stack and a hosted development project are provisioned; no production resources exist. Keep the Supabase CLI version and target environment explicit before applying migrations.

## Remaining two-hour sprint

| Time | Team checkpoint |
| --- | --- |
| 0–10 min | Confirm API fields, auth flow, demo story and shared styles; Dev 2 creates schema/fixtures |
| 10–55 min | Dev 1 search/comparison UI; Dev 2 listings/request API and ownership; Dev 3 listing editor/request inbox |
| 55–85 min | Integrate one complete search → request → provider response → patient status flow; merge small PRs |
| 85–105 min | Handle errors/expiry, medication matching, ownership checks and synthetic data labels |
| 105–120 min | Freeze features, verify fresh setup, rehearse pitch and keep a local demo fallback |

## Git workflow

All three feature branches start at the same initialized `main` commit. Do not create a separate develop branch.

```bash
git fetch origin
git switch --track origin/feat/patient-app  # Dev 1; others use their assigned branch
# Work only in assigned folders; commit small coherent changes.
git add <changed-paths>
git commit -m "feat: describe completed behavior"
git push -u origin HEAD
# Open a pull request into main; obtain teammate review and verify the integrated flow.
```

Refresh from `origin/main` regularly with a normal merge on your feature branch. Resolve shared-file changes with their owner; avoid force pushes and direct main changes during the sprint. Branch protection is not configured by this initialization. Contributor invitations require acceptance before teammates can access this private repository.

## Synthetic data and security

- Use fictional hospitals/pharmacies, invented prices/stock and dedicated demo accounts. Label every demo screen accordingly; never imply verification of real providers.
- Do not collect real prescriptions, diagnoses, patient identifiers, personal contact details or precise patient locations. Use a typed area such as Nairobi for the demo.
- Do not commit `.env`, credentials, tokens, dumps or contributor emails. Environment examples contain only blank secrets and local URLs. Avoid logging JWTs, database URLs or medical search histories.
- Validate all inputs and use parameterized SQL. Limit result sizes and request rates. CORS restricts browser origins but is not authorization.
- Validate Supabase tokens server-side. Provider memberships are trusted database records, not user-editable metadata. Test attempts to access another patient/provider's resources.
- Enable RLS on tables in exposed schemas and write explicit ownership policies. With direct `pg`, enforce ownership in Express and use a least-privilege database role; privileged connections may bypass RLS. Never assume RLS automatically scopes a direct database connection.
- Keep service-role/secret keys out of browser code. See [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
- Confirmations expire, prices are estimates until confirmed, and availability may change. The product provides discovery, not clinical advice or emergency triage.

Before real use, provider onboarding and verification, data freshness, access controls, retention, consent and applicable Kenyan privacy/health obligations need separate review. This hackathon prototype is not ready for real patient data.

## Demo, deployment and validation

Deployment plan: React on Vercel, Express on Render, PostgreSQL on Supabase; no hosting resources are provisioned by this repository setup. Configure the deployed API URL and exact allowed client origin privately. Verify health and a complete workflow after deployment. Keep both local processes available if hosting is delayed.

Demo story: find a fictional ultrasound service, compare displayed KES prices, send an enquiry, confirm from the corresponding provider, refresh patient status, and repeat with one exact prescribed medication. Show a declined or expired enquiry and explain the freshness limitation.

Validation checklist for implementation: client production build; server health; persistence after reload; invalid-input errors; empty and partial comparison results; confirmation expiry and repeat-response conflict; unauthenticated/other-owner access denial; secret scan; keyboard/mobile usability. No end-to-end healthcare workflow is claimed by the starter shell.

Proposed impact measures after a real pilot: time to locate care, confirmed enquiries, avoided unsuccessful trips and complete prescription fulfilment. These are future evaluation measures, not measured prototype results.
