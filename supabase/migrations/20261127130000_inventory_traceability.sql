create extension if not exists pgcrypto;

create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete restrict,
  batch_number text not null check (length(trim(batch_number)) between 1 and 80),
  manufacturer text,
  supplier text,
  date_received date not null,
  expiry_date date not null,
  initial_quantity integer not null check (initial_quantity > 0),
  current_quantity integer not null check (current_quantity >= 0),
  unit text not null check (length(trim(unit)) between 1 and 40),
  storage_info text,
  status text not null default 'active' check (status in ('active', 'quarantined', 'depleted', 'expired', 'damaged', 'returned')),
  created_by uuid references auth.users(id),
  created_by_label text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, batch_number),
  check (expiry_date > date_received)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.inventory_batches(id) on delete restrict,
  provider_id uuid not null references public.providers(id) on delete cascade,
  movement_type text not null check (movement_type in ('received', 'dispensed', 'adjustment', 'damaged', 'expired', 'quarantined', 'returned')),
  quantity integer not null check (quantity <> 0),
  previous_balance integer not null check (previous_balance >= 0),
  new_balance integer not null check (new_balance >= 0),
  reason text,
  reference text,
  actor_user_id uuid references auth.users(id),
  actor_label text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    (movement_type in ('received', 'returned') and quantity > 0)
    or (movement_type in ('dispensed', 'damaged', 'expired', 'quarantined') and quantity < 0)
    or (movement_type = 'adjustment' and quantity <> 0)
  )
);

create table if not exists public.inventory_audits (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  notes text,
  counted_by uuid references auth.users(id),
  counted_by_label text not null,
  counted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_audit_lines (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.inventory_audits(id) on delete restrict,
  batch_id uuid not null references public.inventory_batches(id) on delete restrict,
  expected_quantity integer not null check (expected_quantity >= 0),
  counted_quantity integer not null check (counted_quantity >= 0),
  discrepancy integer generated always as (counted_quantity - expected_quantity) stored,
  unique (audit_id, batch_id)
);

create table if not exists public.provider_events (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  actor_label text not null,
  action text not null check (length(trim(action)) between 1 and 80),
  record_type text not null check (length(trim(record_type)) between 1 and 40),
  record_id text not null check (length(trim(record_id)) between 1 and 80),
  previous_value jsonb,
  new_value jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.listing_availability_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  provider_id uuid not null references public.providers(id) on delete cascade,
  available boolean not null,
  previous_available boolean,
  actor_user_id uuid references auth.users(id),
  actor_label text not null,
  changed_at timestamptz not null default now()
);

create or replace function public.enforce_inventory_batch_rules()
returns trigger
language plpgsql
as $$
declare
  listing_provider uuid;
  item_type text;
  listing_unit text;
begin
  select l.provider_id, i.type, l.pricing_unit
    into listing_provider, item_type, listing_unit
    from public.listings l
    join public.catalog_items i on i.id = l.item_id
   where l.id = new.listing_id;

  if not found then
    raise exception 'listing not found' using errcode = '23503';
  end if;
  if listing_provider <> new.provider_id then
    raise exception 'listing belongs to another provider' using errcode = '23514';
  end if;
  if item_type <> 'medication' then
    raise exception 'inventory batches require a medication listing' using errcode = '23514';
  end if;
  if listing_unit is not null and new.unit <> listing_unit then
    raise exception 'batch unit must match listing unit' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
as $$
declare
  batch_provider uuid;
  batch_balance integer;
  batch_status text;
begin
  select provider_id, current_quantity, status
    into batch_provider, batch_balance, batch_status
    from public.inventory_batches
   where id = new.batch_id
   for update;

  if not found then
    raise exception 'batch not found' using errcode = '23503';
  end if;
  if batch_provider <> new.provider_id then
    raise exception 'batch belongs to another provider' using errcode = '23514';
  end if;
  if batch_balance <> new.previous_balance then
    raise exception 'previous balance does not match current batch balance' using errcode = '23514';
  end if;
  if new.new_balance <> new.previous_balance + new.quantity then
    raise exception 'new balance does not match movement quantity' using errcode = '23514';
  end if;

  update public.inventory_batches
     set current_quantity = new.new_balance,
         status = case
           when new.new_balance = 0 then 'depleted'
           when new.movement_type = 'quarantined' then 'quarantined'
           when new.movement_type = 'damaged' then 'damaged'
           when new.movement_type = 'expired' then 'expired'
           when batch_status in ('depleted', 'quarantined', 'damaged', 'expired')
                and new.movement_type in ('received', 'returned', 'adjustment') then 'active'
           else batch_status
         end
   where id = new.batch_id;

  return new;
end;
$$;

create or replace function public.sync_listing_stock_from_batches()
returns trigger
language plpgsql
as $$
declare
  target_listing uuid;
begin
  target_listing := coalesce(new.listing_id, old.listing_id);
  if target_listing is not null then
    update public.listings
       set stock_quantity = (
         select coalesce(sum(current_quantity), 0)::integer
           from public.inventory_batches
          where listing_id = target_listing
       )
     where id = target_listing;
  end if;
  return null;
end;
$$;

create or replace function public.enforce_inventory_audit_lines()
returns trigger
language plpgsql
as $$
declare
  audit_provider uuid;
  batch_provider uuid;
begin
  select provider_id into audit_provider from public.inventory_audits where id = new.audit_id;
  select provider_id into batch_provider from public.inventory_batches where id = new.batch_id;
  if audit_provider is null or batch_provider is null or audit_provider <> batch_provider then
    raise exception 'audit line provider mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.reject_immutable_change()
returns trigger
language plpgsql
as $$
begin
  raise exception '% records cannot be modified', tg_table_name using errcode = '23514';
end;
$$;

drop trigger if exists inventory_batches_set_updated_at on public.inventory_batches;
create trigger inventory_batches_set_updated_at
  before update on public.inventory_batches
  for each row execute function public.set_updated_at();

drop trigger if exists inventory_batches_enforce_rules on public.inventory_batches;
create trigger inventory_batches_enforce_rules
  before insert or update of provider_id, listing_id, unit on public.inventory_batches
  for each row execute function public.enforce_inventory_batch_rules();

drop trigger if exists inventory_batches_sync_listing_stock on public.inventory_batches;
create trigger inventory_batches_sync_listing_stock
  after insert or update of current_quantity, listing_id or delete on public.inventory_batches
  for each row execute function public.sync_listing_stock_from_batches();

drop trigger if exists inventory_movements_apply on public.inventory_movements;
create trigger inventory_movements_apply
  before insert on public.inventory_movements
  for each row execute function public.apply_inventory_movement();

drop trigger if exists inventory_audit_lines_enforce on public.inventory_audit_lines;
create trigger inventory_audit_lines_enforce
  before insert on public.inventory_audit_lines
  for each row execute function public.enforce_inventory_audit_lines();

drop trigger if exists inventory_movements_immutable on public.inventory_movements;
create trigger inventory_movements_immutable
  before update or delete on public.inventory_movements
  for each row execute function public.reject_immutable_change();

drop trigger if exists inventory_audits_immutable on public.inventory_audits;
create trigger inventory_audits_immutable
  before update or delete on public.inventory_audits
  for each row execute function public.reject_immutable_change();

drop trigger if exists inventory_audit_lines_immutable on public.inventory_audit_lines;
create trigger inventory_audit_lines_immutable
  before update or delete on public.inventory_audit_lines
  for each row execute function public.reject_immutable_change();

drop trigger if exists provider_events_immutable on public.provider_events;
create trigger provider_events_immutable
  before update or delete on public.provider_events
  for each row execute function public.reject_immutable_change();

drop trigger if exists listing_availability_events_immutable on public.listing_availability_events;
create trigger listing_availability_events_immutable
  before update or delete on public.listing_availability_events
  for each row execute function public.reject_immutable_change();

create index if not exists inventory_batches_provider_idx
  on public.inventory_batches (provider_id, created_at desc);
create index if not exists inventory_batches_listing_expiry_idx
  on public.inventory_batches (listing_id, expiry_date);
create index if not exists inventory_batches_provider_expiry_idx
  on public.inventory_batches (provider_id, expiry_date)
  where status not in ('depleted');
create index if not exists inventory_movements_batch_idx
  on public.inventory_movements (batch_id, occurred_at desc);
create index if not exists inventory_movements_provider_idx
  on public.inventory_movements (provider_id, occurred_at desc);
create index if not exists inventory_movements_type_idx
  on public.inventory_movements (provider_id, movement_type, occurred_at desc);
create index if not exists inventory_audits_provider_idx
  on public.inventory_audits (provider_id, counted_at desc);
create index if not exists inventory_audit_lines_audit_idx
  on public.inventory_audit_lines (audit_id);
create index if not exists provider_events_provider_idx
  on public.provider_events (provider_id, occurred_at desc);
create index if not exists provider_events_action_idx
  on public.provider_events (provider_id, action, occurred_at desc);
create index if not exists listing_availability_events_listing_idx
  on public.listing_availability_events (listing_id, changed_at desc);

alter table public.inventory_batches enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_audits enable row level security;
alter table public.inventory_audit_lines enable row level security;
alter table public.provider_events enable row level security;
alter table public.listing_availability_events enable row level security;

drop policy if exists inventory_batches_provider_read on public.inventory_batches;
create policy inventory_batches_provider_read on public.inventory_batches
  for select to authenticated
  using (
    exists (
      select 1 from public.provider_memberships pm
      where pm.user_id = auth.uid() and pm.provider_id = inventory_batches.provider_id
    )
  );

drop policy if exists inventory_movements_provider_read on public.inventory_movements;
create policy inventory_movements_provider_read on public.inventory_movements
  for select to authenticated
  using (
    exists (
      select 1 from public.provider_memberships pm
      where pm.user_id = auth.uid() and pm.provider_id = inventory_movements.provider_id
    )
  );

drop policy if exists inventory_audits_provider_read on public.inventory_audits;
create policy inventory_audits_provider_read on public.inventory_audits
  for select to authenticated
  using (
    exists (
      select 1 from public.provider_memberships pm
      where pm.user_id = auth.uid() and pm.provider_id = inventory_audits.provider_id
    )
  );

drop policy if exists inventory_audit_lines_provider_read on public.inventory_audit_lines;
create policy inventory_audit_lines_provider_read on public.inventory_audit_lines
  for select to authenticated
  using (
    exists (
      select 1
      from public.inventory_audits a
      join public.provider_memberships pm on pm.provider_id = a.provider_id
      where a.id = inventory_audit_lines.audit_id and pm.user_id = auth.uid()
    )
  );

drop policy if exists provider_events_provider_read on public.provider_events;
create policy provider_events_provider_read on public.provider_events
  for select to authenticated
  using (
    exists (
      select 1 from public.provider_memberships pm
      where pm.user_id = auth.uid() and pm.provider_id = provider_events.provider_id
    )
  );

drop policy if exists listing_availability_events_provider_read on public.listing_availability_events;
create policy listing_availability_events_provider_read on public.listing_availability_events
  for select to authenticated
  using (
    exists (
      select 1 from public.provider_memberships pm
      where pm.user_id = auth.uid() and pm.provider_id = listing_availability_events.provider_id
    )
  );
