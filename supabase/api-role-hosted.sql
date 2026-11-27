-- Hosted variant of api-role.sql for `supabase db query` (no psql meta-commands).
-- Replace __API_PASSWORD__ with a private alphanumeric password before running:
--   sed "s/__API_PASSWORD__/$API_PASSWORD/g" supabase/api-role-hosted.sql > /tmp/api-role.sql
--   supabase db query --remote -f /tmp/api-role.sql --yes
-- Requires the initial migration to be applied. Idempotent.

do $do$
begin
  if exists (select 1 from pg_roles where rolname = 'afyalink_api') then
    execute format('alter role afyalink_api with login password %L nosuperuser nocreatedb nocreaterole noinherit', '__API_PASSWORD__');
  else
    execute format('create role afyalink_api with login password %L nosuperuser nocreatedb nocreaterole noinherit', '__API_PASSWORD__');
  end if;
end
$do$;

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

drop policy if exists providers_api_read on public.providers;
create policy providers_api_read on public.providers for select to afyalink_api using (true);
drop policy if exists catalog_items_api_read on public.catalog_items;
create policy catalog_items_api_read on public.catalog_items for select to afyalink_api using (true);
drop policy if exists provider_memberships_api_read on public.provider_memberships;
create policy provider_memberships_api_read on public.provider_memberships for select to afyalink_api using (true);
drop policy if exists listings_api_access on public.listings;
create policy listings_api_access on public.listings for all to afyalink_api using (true) with check (true);
drop policy if exists requests_api_access on public.requests;
create policy requests_api_access on public.requests for all to afyalink_api using (true) with check (true);

drop policy if exists appointments_api_access on public.appointments;
create policy appointments_api_access on public.appointments for all to afyalink_api using (true) with check (true);
