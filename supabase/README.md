# Database setup — Dev 2

Status: **provisioned and verified on hosted Supabase and locally.** Hosted project: `afyalink-dev` (`iwqqhwgisvzeiyoricpt`, `eu-central-1`). Migration, seed, least-privilege API role and demo memberships are applied, and the backend passed the full E2E suite against both targets. All rows are synthetic.

## Contract

The schema contract is in the root `README.md`; the HTTP contract is in `docs/API.md`. This directory owns:

- `migrations/20261127120000_initial_schema.sql` — tables, constraints, triggers, indexes and RLS.
- `seed.sql` — fictional providers, catalog items and listings (idempotent).
- `api-role.sql` — least-privilege role for local `psql` (uses psql variables).
- `api-role-hosted.sql` — same role/policies as plain SQL for `supabase db query`.

## Pinned tooling

- Supabase CLI: **`supabase@3.4.0`** (verified with `npx supabase@3.4.0 --version`). Re-check `supabase --version` and update this pin before hosted operations if the team upgrades.
- PostgreSQL client: any recent `psql` (used for seed and role setup).
- Target: **Supabase development project only.** Never run this against production.

## Prerequisites

1. Docker (local stack) or Supabase project access.
2. `.env` values kept private; never commit connection strings, passwords or service keys.
3. Do not run the placeholder-seeded flows with real patient data.

## Local workflow

```bash
# Start the local Supabase stack (first run pulls containers)
npx supabase@3.4.0 start

# Apply all migrations and seed.sql, then start clean
npx supabase@3.4.0 db reset

# Copy the local connection details (API URL, DB host/port, keys) into your
# private server/.env; keep them out of git.
npx supabase@3.4.0 status

# Stop the stack
npx supabase@3.4.0 stop
```

`db reset` is destructive and intended for local development only.

### Verified local bootstrap

The full flow was provisioned and tested locally on 2026-11-27. `supabase/config.jsonc` is committed so the team shares ports and auth settings (client site URL `http://localhost:5173`).

```bash
npx supabase@3.4.0 start
npx supabase@3.4.0 db reset        # migration + seed

# Create or refresh the API role (idempotent; omit the password from shell history in real use)
DB=$(docker ps --filter name=supabase_db --format '{{.Names}}' | head -1)
docker exec -i "$DB" psql -U postgres -d postgres \
  -v api_password='<PRIVATE_PASSWORD>' -f - < supabase/api-role.sql

# Create synthetic demo users through the Auth admin API
curl -s -X POST http://127.0.0.1:54321/auth/v1/admin/users \
  -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"hospital.demo@afyalink.test","password":"<PRIVATE_PASSWORD>","email_confirm":true}'

# Assign trusted memberships using the returned user UUIDs
docker exec -i "$DB" psql -U postgres -d postgres -c "
insert into provider_memberships (user_id, provider_id) values
  ('<hospital-user-uuid>', '10000000-0000-4000-8000-000000000001'),
  ('<pharmacy-user-uuid>', '10000000-0000-4000-8000-000000000002')
on conflict do nothing;"
```

Point `server/.env` at the local credentials (`DATABASE_SSL=false`) and run `npm run dev:server`. Verified end to end: health, search, compare (complete/partial), patient request, provider confirm/decline, expiry on read, terminal-state conflict, cross-owner denial, and listing create/update/duplicate/incompatibility. The provider dashboard fixtures align on catalog IDs `...0001`–`...0004`; item `...0003` is "Complete blood count" with unit `test`.

## Hosted development workflow

Hosted project used for the sprint: **`afyalink-dev`** (`iwqqhwgisvzeiyoricpt`, org `myusercloud`, `eu-central-1`). It is a dedicated development project; never point these commands at production.

```bash
npx supabase@3.4.0 login
npx supabase@3.4.0 link --project-ref iwqqhwgisvzeiyoricpt

# Apply migrations and seed in one step
npx supabase@3.4.0 db push --remote --include-seed --yes

# Create or refresh the least-privilege API role (plain SQL, no psql needed)
API_PASSWORD='<PRIVATE_ALPHANUMERIC_PASSWORD>'
sed "s/__API_PASSWORD__/$API_PASSWORD/g" supabase/api-role-hosted.sql > /tmp/api-role.sql
npx supabase@3.4.0 db query --remote -f /tmp/api-role.sql --yes

# Verify
npx supabase@3.4.0 db query --remote --read-only \
  "select (select count(*) from providers) providers, (select count(*) from listings) listings;"
```

Create the synthetic demo users with the project's secret key through the Auth admin API (`POST /auth/v1/admin/users` with `email_confirm: true`), then insert their memberships with `db query --remote`. Do not commit the password or secret key.

Do not use `supabase db reset --linked` against a shared project: it wipes data. Prefer `db push` plus the idempotent seed.

## Express connection

Add the private `pg` connection string for the `afyalink_api` role to `server/.env`. For hosted Supabase use the IPv4 pooler (session mode, port 5432):

```dotenv
DATABASE_URL=postgresql://afyalink_api.iwqqhwgisvzeiyoricpt:<private-password>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
DATABASE_SSL=true
# Optional override; defaults to server/certs/supabase-pooler-ca.pem
# DATABASE_SSL_CA=/absolute/path/to/ca.pem
```

`DATABASE_SSL=true` enables TLS with full certificate verification. Supabase's pooler presents a Supabase Root 2021 CA chain, so the public root certificate is pinned at `server/certs/supabase-pooler-ca.pem` (SHA-256 `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`). The direct `db.<ref>.supabase.co` host is IPv6-only on the free plan; the pooler is used for IPv4. Leave `DATABASE_URL` empty for shell-only work; private routes then return `503 DB_NOT_CONFIGURED` instead of leaking details. The browser never receives this value.

## Demo users and memberships

Supabase Auth owns patient and provider demo users. `provider_memberships` is trusted setup data and is **not** self-service. After creating demo accounts, assign memberships with their real user UUIDs:

```sql
insert into public.provider_memberships (user_id, provider_id) values
  ('<hospital-demo-user-uuid>', '10000000-0000-4000-8000-000000000001'),
  ('<pharmacy-demo-user-uuid>', '10000000-0000-4000-8000-000000000002');
```

A provider user with more than one membership must send `x-provider-id` on provider routes.

For synthetic sign-ups, the hosted development project has email confirmations disabled (`auth.email.enable_confirmations = false`). Sign-up therefore returns a session immediately. Never carry this setting into production, and do not use real email addresses or patient data.

## Seed contents

| Table | Rows |
| --- | --- |
| `providers` | 4 (2 hospitals, 2 pharmacies) |
| `catalog_items` | 5 (2 services, 3 medications) |
| `listings` | 8 |
| `provider_memberships` | 0 in seed; 2 after demo setup (hospital + pharmacy) |

### Optional bulk demo dataset

`seed-demo-500.sql` adds **50 clearly synthetic providers** (25 hospitals, 25 pharmacies), **20 catalog items** and **500 listings** (idempotent, deterministic UUIDs, no real data). Apply it after the base seed:

```bash
npx supabase@3.4.0 db query --remote -f supabase/seed-demo-500.sql --yes
# local stack alternative: psql "$DATABASE_URL" -f supabase/seed-demo-500.sql
```

Combined with the base seed this yields 54 providers, 25 catalog items and 508 listings.

### Large bulk demo dataset

For a higher-volume demo, `seed-bulk-5000-listings.sql` adds **300 providers**, **40 catalog items** and **4,500 listings** (idempotent, deterministic UUIDs). Apply it after the base seed:

```bash
npx supabase@3.4.0 db query --remote -f supabase/seed-bulk-5000-listings.sql --yes
```

`seed-bulk-activity.sql` adds **200 requests** and **150 appointments** for the demo patient. It resolves the patient by email, so create the Auth demo users first:

```bash
npx supabase@3.4.0 db query --remote -f supabase/seed-bulk-activity.sql --yes
```

Current hosted development totals: **354 providers, 65 catalog items, 5,008 listings, 203 requests, 150 appointments, 2 memberships**. The patient client bootstraps from `GET /api/directory` (catalog + providers only) and fetches provider listings on demand, so this volume stays fast.

## Verification

```sql
select type, count(*) from public.providers group by type;
select type, count(*) from public.catalog_items group by type;
select count(*) from public.listings;
select count(*) from public.provider_memberships;

-- Integrity checks
select * from public.listings l
  join public.providers p on p.id = l.provider_id
  join public.catalog_items i on i.id = l.item_id
 where (p.type = 'hospital' and i.type <> 'service')
    or (p.type = 'pharmacy' and i.type <> 'medication');
```

The last query must return zero rows.

Observed on the hosted development project with the bulk demo datasets: 354 providers, 65 catalog items, 5,008 listings, 203 requests, 150 appointments and 2 memberships. The 14-check UI flow and API E2E suite passed against the hosted target.

## Security notes

- Existing RLS policies target Supabase `anon` / `authenticated` clients. The `api-role.sql` policies cover the direct `pg` role; Express still enforces patient/provider ownership on every private operation because a direct connection cannot rely on `auth.uid()`.
- `afyalink_api` has no `BYPASSRLS`, no schema ownership and column-scoped write grants.
- Rotate the API role password if exposed; keep it only in the deploy environment's secret store.
- Confirmations expire, prices are estimates until confirmed, and the seed is fiction — never present it as verified provider data.
