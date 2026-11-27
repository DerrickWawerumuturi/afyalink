-- Appointment requests for service listings.

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  requested_for timestamptz not null,
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'declined', 'cancelled')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_patient_idx
  on public.appointments (patient_user_id, requested_for desc);
create index if not exists appointments_listing_idx
  on public.appointments (listing_id);
create index if not exists appointments_status_idx
  on public.appointments (status, requested_for);

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;

drop policy if exists appointments_patient_read on public.appointments;
create policy appointments_patient_read on public.appointments
  for select to authenticated using (patient_user_id = auth.uid());

drop policy if exists appointments_patient_insert on public.appointments;
create policy appointments_patient_insert on public.appointments
  for insert to authenticated with check (patient_user_id = auth.uid());

drop policy if exists appointments_patient_update on public.appointments;
create policy appointments_patient_update on public.appointments
  for update to authenticated
  using (patient_user_id = auth.uid())
  with check (patient_user_id = auth.uid());

drop policy if exists appointments_provider_read on public.appointments;
create policy appointments_provider_read on public.appointments
  for select to authenticated
  using (
    exists (
      select 1
      from public.listings l
      join public.provider_memberships pm on pm.provider_id = l.provider_id
      where l.id = appointments.listing_id and pm.user_id = auth.uid()
    )
  );

drop policy if exists appointments_provider_update on public.appointments;
create policy appointments_provider_update on public.appointments
  for update to authenticated
  using (
    exists (
      select 1
      from public.listings l
      join public.provider_memberships pm on pm.provider_id = l.provider_id
      where l.id = appointments.listing_id and pm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.listings l
      join public.provider_memberships pm on pm.provider_id = l.provider_id
      where l.id = appointments.listing_id and pm.user_id = auth.uid()
    )
  );
