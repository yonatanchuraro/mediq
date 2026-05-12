-- ===================================================================
-- MediQ migration 0002: Doctor specialties as a normalized lookup table.
-- Run this in Supabase SQL Editor (or paste it directly there).
-- ===================================================================
-- Was:  doctors.specialty TEXT          (free text — typos, no list)
-- Now:  doctors.specialty_id UUID FK → specialties(id)

-- 1) specialties lookup table -----------------------------------------
create table if not exists public.specialties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.specialties enable row level security;

drop policy if exists specialties_select_all on public.specialties;
drop policy if exists specialties_admin      on public.specialties;

-- public read of active rows + admin can read all
create policy specialties_select_all on public.specialties
  for select using (active = true or public.is_admin());

create policy specialties_admin on public.specialties
  for all using (public.is_admin()) with check (public.is_admin());

-- 2) Add the new FK column to doctors --------------------------------
alter table public.doctors
  add column if not exists specialty_id uuid
  references public.specialties(id) on delete set null;

-- 3) Seed a useful starter list ---------------------------------------
insert into public.specialties (name) values
  ('רופא משפחה'),
  ('ילדים'),
  ('עור'),
  ('אף-אוזן-גרון'),
  ('נשים'),
  ('עיניים'),
  ('אורתופד'),
  ('קרדיולוג'),
  ('נוירולוג'),
  ('פסיכיאטר'),
  ('פנימי'),
  ('שיניים')
on conflict (name) do nothing;

-- 4) Migrate existing data: doctors.specialty TEXT → specialty_id ----
-- Only run if the old text column still exists.
do $$
declare
  r        record;
  spec_id  uuid;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'doctors'
      and column_name  = 'specialty'
  ) then
    for r in
      select profile_id, specialty
      from public.doctors
      where specialty is not null and btrim(specialty) <> ''
        and specialty_id is null
    loop
      select id into spec_id from public.specialties where name = btrim(r.specialty);
      if spec_id is null then
        insert into public.specialties (name) values (btrim(r.specialty)) returning id into spec_id;
      end if;
      update public.doctors set specialty_id = spec_id where profile_id = r.profile_id;
    end loop;
  end if;
end $$;

-- 5) Drop the old text column ----------------------------------------
alter table public.doctors drop column if exists specialty;
