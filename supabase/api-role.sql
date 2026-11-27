-- CareCheck least-privilege API role for Express (direct `pg` access).
-- Run this as a privileged Supabase role (for example `postgres`) AFTER the
-- initial migration has been applied. Replace the password placeholder locally
-- and never commit the real value.
--
--   psql "$SUPABASE_ADMIN_CONNECTION_STRING" \
--     -v api_password="'<CHANGE_ME_PRIVATE>'" -f supabase/api-role.sql
--
-- The role has no schema-owner or bypass-RLS rights. It can only read the
-- public catalog, manage listings for its own scope and answer requests; the
-- Express layer enforces patient/provider ownership on every private call.

select exists (select 1 from pg_roles where rolname = 'afyalink_api') as afyalink_api_exists \gset

\if :afyalink_api_exists
  alter role afyalink_api with
    login
    password :'api_password'
    nosuperuser
    nocreatedb
    nocreaterole
    noinherit;
\else
  create role afyalink_api with
    login
    password :'api_password'
    nosuperuser
    nocreatedb
    nocreaterole
    noinherit;
\endif

grant connect on database postgres to afyalink_api;
grant usage on schema public to afyalink_api;

grant select on public.providers to afyalink_api;
grant select on public.catalog_items to afyalink_api;
grant select on public.provider_memberships to afyalink_api;

grant select on public.listings to afyalink_api;
grant insert (provider_id, item_id, price, pricing_unit, available, stock_quantity)
  on public.listings to afyalink_api;
grant update (price, available, stock_quantity, updated_at)
  on public.listings to afyalink_api;
grant delete on public.listings to afyalink_api;

grant select on public.requests to afyalink_api;
grant insert (listing_id, patient_user_id, request_group_id, quantity, status, expires_at)
  on public.requests to afyalink_api;
grant update (status, confirmed_price, expires_at, updated_at)
  on public.requests to afyalink_api;

grant select on public.appointments to afyalink_api;
grant insert (listing_id, patient_user_id, requested_for, status, notes)
  on public.appointments to afyalink_api;
grant update (status, notes, requested_for, updated_at)
  on public.appointments to afyalink_api;

alter role afyalink_api set search_path = public;

-- Explicit RLS policies for the API role. Ownership is enforced in Express;
-- these policies avoid granting BYPASSRLS while still letting the API function.
drop policy if exists providers_api_read on public.providers;
create policy providers_api_read on public.providers
  for select to afyalink_api using (true);

drop policy if exists catalog_items_api_read on public.catalog_items;
create policy catalog_items_api_read on public.catalog_items
  for select to afyalink_api using (true);

drop policy if exists provider_memberships_api_read on public.provider_memberships;
create policy provider_memberships_api_read on public.provider_memberships
  for select to afyalink_api using (true);

drop policy if exists listings_api_access on public.listings;
create policy listings_api_access on public.listings
  for all to afyalink_api using (true) with check (true);

drop policy if exists requests_api_access on public.requests;
create policy requests_api_access on public.requests
  for all to afyalink_api using (true) with check (true);

drop policy if exists appointments_api_access on public.appointments;
create policy appointments_api_access on public.appointments
  for all to afyalink_api using (true) with check (true);
