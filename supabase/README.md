# Database setup — Dev 2

Status: **not yet applied to any database.** The schema, seed and API role are written and committed; a Supabase development project must still be provisioned and migrated. All rows are synthetic.

## Contract

The schema contract is in the root `README.md`; the HTTP contract is in `docs/API.md`. This directory owns:

- `migrations/20261127120000_initial_schema.sql` — tables, constraints, triggers, indexes and RLS.
- `seed.sql` — fictional providers, catalog items and listings (idempotent).
- `api-role.sql` — least-privilege role used by Express over direct `pg`.

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

## Hosted development workflow

```bash
npx supabase@3.4.0 login
npx supabase@3.4.0 link --project-ref <project-ref>

# Apply the committed migration
npx supabase@3.4.0 db push

# Seed fictional data (repeatable)
psql "$SUPABASE_ADMIN_CONNECTION_STRING" -f supabase/seed.sql

# Create the least-privilege API role (replace with a private password)
psql "$SUPABASE_ADMIN_CONNECTION_STRING" \
  -v api_password="'<CHANGE_ME_PRIVATE>'" -f supabase/api-role.sql
```

Do not use `supabase db reset --linked` against a shared project: it wipes data. Prefer a dedicated development project and re-run `db push` + seed.

## Express connection

Add the private `pg` connection string for the `afyalink_api` role to `server/.env`:

```dotenv
DATABASE_URL=postgresql://afyalink_api:<private-password>@<host>:5432/postgres
DATABASE_SSL=true
```

`DATABASE_SSL=true` enables TLS with certificate verification. Leave `DATABASE_URL` empty for shell-only work; private routes then return `503 DB_NOT_CONFIGURED` instead of leaking details. The browser never receives this value.

## Demo users and memberships

Supabase Auth owns patient and provider demo users. `provider_memberships` is trusted setup data and is **not** self-service. After creating demo accounts, assign memberships with their real user UUIDs:

```sql
insert into public.provider_memberships (user_id, provider_id) values
  ('<hospital-demo-user-uuid>', '10000000-0000-4000-8000-000000000001'),
  ('<pharmacy-demo-user-uuid>', '10000000-0000-4000-8000-000000000002');
```

A provider user with more than one membership must send `x-provider-id` on provider routes.

## Seed contents

| Table | Rows |
| --- | --- |
| `providers` | 4 (2 hospitals, 2 pharmacies) |
| `catalog_items` | 4 (2 services, 2 medications) |
| `listings` | 7 |
| `provider_memberships` | 0 (assigned after Auth demo users exist) |

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

## Security notes

- Existing RLS policies target Supabase `anon` / `authenticated` clients. The `api-role.sql` policies cover the direct `pg` role; Express still enforces patient/provider ownership on every private operation because a direct connection cannot rely on `auth.uid()`.
- `afyalink_api` has no `BYPASSRLS`, no schema ownership and column-scoped write grants.
- Rotate the API role password if exposed; keep it only in the deploy environment's secret store.
- Confirmations expire, prices are estimates until confirmed, and the seed is fiction — never present it as verified provider data.
