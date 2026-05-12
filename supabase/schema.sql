-- =====================================================================
-- MediQ — Clinic Appointment System
-- Supabase / PostgreSQL schema with RBAC (admin / doctor / client)
-- =====================================================================
-- Run this in:  Supabase Dashboard → SQL Editor → New query → Run
-- After running:
--   1. Sign up your first user via the app (or Auth → Users → Add user).
--   2. Promote that user to admin:
--        update public.profiles set role = 'admin' where email = 'you@example.com';
-- =====================================================================

-- Extensions ----------------------------------------------------------
create extension if not exists "pgcrypto";    -- gen_random_uuid()
create extension if not exists "btree_gist";  -- needed for the no-overlap constraint

-- Enums ---------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'doctor', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum
    ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- TABLES
-- =====================================================================

-- profiles: 1-to-1 with auth.users, holds role + display data
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text not null,
  phone        text,
  role         public.user_role not null default 'client',
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- doctor-specific data (only rows for users where profiles.role = 'doctor')
create table if not exists public.doctors (
  profile_id      uuid primary key references public.profiles(id) on delete cascade,
  specialty       text,
  bio             text,
  license_number  text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- services / appointment types (e.g. "general checkup", "follow-up")
create table if not exists public.services (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description       text,
  duration_minutes  int  not null check (duration_minutes > 0),
  price_cents       int,                -- nullable when free / pay-at-clinic
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

-- which doctors offer which services
create table if not exists public.doctor_services (
  doctor_id   uuid not null references public.doctors(profile_id) on delete cascade,
  service_id  uuid not null references public.services(id)         on delete cascade,
  primary key (doctor_id, service_id)
);

-- weekly working hours per doctor (0 = Sunday … 6 = Saturday)
create table if not exists public.working_hours (
  id          uuid primary key default gen_random_uuid(),
  doctor_id   uuid not null references public.doctors(profile_id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time,
  end_time    time,
  is_open     boolean not null default true,
  unique (doctor_id, weekday),
  check (
    (is_open = false)
    or (start_time is not null and end_time is not null and end_time > start_time)
  )
);

-- appointments
create table if not exists public.appointments (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles(id) on delete restrict,
  doctor_id    uuid not null references public.doctors(profile_id) on delete restrict,
  service_id   uuid not null references public.services(id) on delete restrict,
  start_at     timestamptz not null,
  end_at       timestamptz not null,
  status       public.appointment_status not null default 'pending',
  notes        text,
  created_by   uuid references public.profiles(id),  -- nullable for AI/system
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_at > start_at)
);

create index if not exists idx_appointments_doctor_start
  on public.appointments (doctor_id, start_at);
create index if not exists idx_appointments_client_start
  on public.appointments (client_id, start_at desc);

-- prevent overlapping appointments per doctor (ignores cancelled ones)
alter table public.appointments
  drop constraint if exists appointments_no_overlap;
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    doctor_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status <> 'cancelled');

-- AI booking chat: a session groups multiple messages of one conversation
create table if not exists public.chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text,
  context     jsonb not null default '{}'::jsonb,
  started_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.chat_sessions(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content     text not null,
  metadata    jsonb not null default '{}'::jsonb,  -- tool calls, function args, etc.
  created_at  timestamptz not null default now()
);

create index if not exists idx_chat_messages_session_time
  on public.chat_messages (session_id, created_at);

-- =====================================================================
-- TRIGGERS & FUNCTIONS
-- =====================================================================

-- updated_at maintenance
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists appointments_touch on public.appointments;
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();

-- create a profile row automatically when a new auth user is inserted.
-- role defaults to 'client'. You can pre-set role via raw_user_meta_data.role
-- (e.g. when an admin creates a doctor account).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'client')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- helper used inside RLS policies (avoids recursion on the profiles table)
create or replace function public.current_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_doctor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'doctor' from public.profiles where id = auth.uid()), false)
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table public.profiles        enable row level security;
alter table public.doctors         enable row level security;
alter table public.services        enable row level security;
alter table public.doctor_services enable row level security;
alter table public.working_hours   enable row level security;
alter table public.appointments    enable row level security;
alter table public.chat_sessions   enable row level security;
alter table public.chat_messages   enable row level security;

-- ── profiles ─────────────────────────────────────────────────────────
drop policy if exists profiles_select_self    on public.profiles;
drop policy if exists profiles_select_admin   on public.profiles;
drop policy if exists profiles_select_doctors on public.profiles;
drop policy if exists profiles_update_self    on public.profiles;
drop policy if exists profiles_all_admin      on public.profiles;

create policy profiles_select_self on public.profiles
  for select using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select using (public.is_admin());

-- Doctors can read clients they have appointments with (for displaying name/phone)
create policy profiles_select_doctors on public.profiles
  for select using (
    public.is_doctor()
    and exists (
      select 1 from public.appointments a
      where a.client_id = profiles.id
        and a.doctor_id = auth.uid()
    )
  );

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    -- prevent a user from escalating their own role
    and role = (select role from public.profiles where id = auth.uid())
  );

create policy profiles_all_admin on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ── doctors (public catalog of practitioners) ────────────────────────
drop policy if exists doctors_select_all   on public.doctors;
drop policy if exists doctors_update_self  on public.doctors;
drop policy if exists doctors_all_admin    on public.doctors;

create policy doctors_select_all on public.doctors
  for select using (true);

create policy doctors_update_self on public.doctors
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy doctors_all_admin on public.doctors
  for all using (public.is_admin()) with check (public.is_admin());

-- ── services (public catalog) ────────────────────────────────────────
drop policy if exists services_select_all on public.services;
drop policy if exists services_all_admin  on public.services;

create policy services_select_all on public.services
  for select using (active = true or public.is_admin());

create policy services_all_admin on public.services
  for all using (public.is_admin()) with check (public.is_admin());

-- ── doctor_services ──────────────────────────────────────────────────
drop policy if exists doctor_services_select_all on public.doctor_services;
drop policy if exists doctor_services_self       on public.doctor_services;
drop policy if exists doctor_services_admin      on public.doctor_services;

create policy doctor_services_select_all on public.doctor_services for select using (true);
create policy doctor_services_self on public.doctor_services
  for all using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());
create policy doctor_services_admin on public.doctor_services
  for all using (public.is_admin()) with check (public.is_admin());

-- ── working_hours ────────────────────────────────────────────────────
drop policy if exists working_hours_select_all on public.working_hours;
drop policy if exists working_hours_self       on public.working_hours;
drop policy if exists working_hours_admin      on public.working_hours;

-- public read so the booking UI can compute availability
create policy working_hours_select_all on public.working_hours for select using (true);
create policy working_hours_self on public.working_hours
  for all using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());
create policy working_hours_admin on public.working_hours
  for all using (public.is_admin()) with check (public.is_admin());

-- ── appointments ─────────────────────────────────────────────────────
drop policy if exists appointments_select_self    on public.appointments;
drop policy if exists appointments_insert_client  on public.appointments;
drop policy if exists appointments_update_self    on public.appointments;
drop policy if exists appointments_admin_all      on public.appointments;

-- A user sees their own appointments (as client or doctor); admins see all.
create policy appointments_select_self on public.appointments
  for select using (
    client_id = auth.uid()
    or doctor_id = auth.uid()
    or public.is_admin()
  );

-- A signed-in client can book for themselves. Admin can book for anyone.
create policy appointments_insert_client on public.appointments
  for insert with check (
    public.is_admin()
    or (client_id = auth.uid())
  );

-- Clients can cancel their own pending/confirmed; doctors can update theirs;
-- admins can update anything.
create policy appointments_update_self on public.appointments
  for update using (
    public.is_admin()
    or doctor_id = auth.uid()
    or (client_id = auth.uid() and status in ('pending', 'confirmed'))
  )
  with check (
    public.is_admin()
    or doctor_id = auth.uid()
    or (client_id = auth.uid() and status in ('pending', 'confirmed', 'cancelled'))
  );

create policy appointments_admin_all on public.appointments
  for delete using (public.is_admin());

-- ── chat sessions / messages (user owns their own conversations) ─────
drop policy if exists chat_sessions_own  on public.chat_sessions;
drop policy if exists chat_messages_own  on public.chat_messages;

create policy chat_sessions_own on public.chat_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy chat_messages_own on public.chat_messages
  for all using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id and s.user_id = auth.uid()
    )
  );

-- =====================================================================
-- SEED DATA
-- =====================================================================
insert into public.services (name, duration_minutes, description) values
  ('בדיקה כללית', 20, 'בדיקה רפואית כללית'),
  ('ביקור מעקב', 15, 'מעקב אחר טיפול קיים'),
  ('ייעוץ ראשוני', 30, 'פגישת ייעוץ ראשונה'),
  ('בדיקת דם', 10, 'דקירה ושליחה למעבדה'),
  ('חיסון', 10, 'מתן חיסון')
on conflict do nothing;
