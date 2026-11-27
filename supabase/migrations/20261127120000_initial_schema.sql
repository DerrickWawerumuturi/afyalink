-- CareCheck initial schema.
-- Target: Supabase Postgres (development project). All data in this prototype is synthetic.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('hospital', 'pharmacy')),
  location text not null,
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('service', 'medication')),
  strength text,
  dosage_form text,
  unit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type = 'medication' or (strength is null and dosage_form is null))
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  item_id uuid not null references public.catalog_items(id) on delete restrict,
  price numeric(12, 2) not null check (price >= 0),
  currency text not null default 'KES' check (currency = 'KES'),
  pricing_unit text not null,
  available boolean not null default true,
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, item_id, pricing_unit)
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  request_group_id uuid,
  quantity integer not null check (quantity > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined')),
  confirmed_price numeric(12, 2) check (confirmed_price is null or confirmed_price >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'confirmed' and confirmed_price is not null)
    or (status <> 'confirmed' and confirmed_price is null)
  )
);

create table if not exists public.provider_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, provider_id)
);

-- ---------------------------------------------------------------------------
-- Listing integrity: provider type must match item type; medication unit match
-- ---------------------------------------------------------------------------
create or replace function public.enforce_listing_rules()
returns trigger
language plpgsql
as $$
declare
  provider_type text;
  item_type text;
  item_unit text;
begin
  select type into provider_type from public.providers where id = new.provider_id;
  select type, unit into item_type, item_unit from public.catalog_items where id = new.item_id;

  if (provider_type = 'hospital' and item_type <> 'service')
     or (provider_type = 'pharmacy' and item_type <> 'medication') then
    raise exception 'provider type % cannot list % items', provider_type, item_type
      using errcode = '23514';
  end if;

  if item_type = 'medication' and item_unit is not null and new.pricing_unit <> item_unit then
    raise exception 'pricing unit must match catalog unit'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists providers_set_updated_at on public.providers;
create trigger providers_set_updated_at
  before update on public.providers
  for each row execute function public.set_updated_at();

drop trigger if exists catalog_items_set_updated_at on public.catalog_items;
create trigger catalog_items_set_updated_at
  before update on public.catalog_items
  for each row execute function public.set_updated_at();

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

drop trigger if exists requests_set_updated_at on public.requests;
create trigger requests_set_updated_at
  before update on public.requests
  for each row execute function public.set_updated_at();

drop trigger if exists listings_enforce_rules on public.listings;
create trigger listings_enforce_rules
  before insert or update on public.listings
  for each row execute function public.enforce_listing_rules();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists listings_provider_item_idx on public.listings (provider_id, item_id);
create index if not exists listings_available_idx on public.listings (available) where available;
create index if not exists listings_item_availability_price_idx
  on public.listings (item_id, available, price);
create index if not exists catalog_items_name_trgm_idx
  on public.catalog_items using gin (name gin_trgm_ops);
create index if not exists providers_name_trgm_idx
  on public.providers using gin (name gin_trgm_ops);
create index if not exists requests_patient_idx
  on public.requests (patient_user_id, created_at desc);
create index if not exists requests_listing_idx on public.requests (listing_id);
create index if not exists requests_status_idx on public.requests (status, expires_at);
create index if not exists provider_memberships_user_idx on public.provider_memberships (user_id);
create index if not exists provider_memberships_provider_idx
  on public.provider_memberships (provider_id);

-- ---------------------------------------------------------------------------
-- Row level security (defence in depth for Supabase clients).
-- Express uses a least-privilege role and enforces ownership in application code.
-- ---------------------------------------------------------------------------
alter table public.providers enable row level security;
alter table public.catalog_items enable row level security;
alter table public.listings enable row level security;
alter table public.requests enable row level security;
alter table public.provider_memberships enable row level security;

drop policy if exists providers_public_read on public.providers;
create policy providers_public_read on public.providers
  for select to anon, authenticated using (true);

drop policy if exists catalog_items_public_read on public.catalog_items;
create policy catalog_items_public_read on public.catalog_items
  for select to anon, authenticated using (true);

drop policy if exists listings_public_read on public.listings;
create policy listings_public_read on public.listings
  for select to anon, authenticated using (true);

drop policy if exists listings_provider_manage on public.listings;
create policy listings_provider_manage on public.listings
  for all to authenticated
  using (
    exists (
      select 1 from public.provider_memberships pm
      where pm.user_id = auth.uid() and pm.provider_id = listings.provider_id
    )
  )
  with check (
    exists (
      select 1 from public.provider_memberships pm
      where pm.user_id = auth.uid() and pm.provider_id = listings.provider_id
    )
  );

drop policy if exists provider_memberships_self_read on public.provider_memberships;
create policy provider_memberships_self_read on public.provider_memberships
  for select to authenticated using (user_id = auth.uid());

drop policy if exists requests_patient_read on public.requests;
create policy requests_patient_read on public.requests
  for select to authenticated using (patient_user_id = auth.uid());

drop policy if exists requests_patient_insert on public.requests;
create policy requests_patient_insert on public.requests
  for insert to authenticated with check (patient_user_id = auth.uid());

drop policy if exists requests_provider_read on public.requests;
create policy requests_provider_read on public.requests
  for select to authenticated
  using (
    exists (
      select 1
      from public.listings l
      join public.provider_memberships pm on pm.provider_id = l.provider_id
      where l.id = requests.listing_id and pm.user_id = auth.uid()
    )
  );

drop policy if exists requests_provider_update on public.requests;
create policy requests_provider_update on public.requests
  for update to authenticated
  using (
    exists (
      select 1
      from public.listings l
      join public.provider_memberships pm on pm.provider_id = l.provider_id
      where l.id = requests.listing_id and pm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.listings l
      join public.provider_memberships pm on pm.provider_id = l.provider_id
      where l.id = requests.listing_id and pm.user_id = auth.uid()
    )
  );
