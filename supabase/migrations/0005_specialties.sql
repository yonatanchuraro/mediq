-- ====================================================================
-- MediQ — 0005: Medical specialties as a first-class table
-- ====================================================================
-- Before: doctors.specialty was a free-text column ("רופאת משפחה", "ילדים", …)
-- After:  specialties table + doctors.specialty_id FK + services.specialty_id FK
-- ====================================================================
-- Run in Supabase SQL Editor. Idempotent — safe to re-run.

-- 1) specialties lookup table -----------------------------------------
create table if not exists public.specialties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  color       text not null default 'teal',   -- visual identity in UI
  icon        text,                            -- lucide icon name (optional)
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.specialties enable row level security;

drop policy if exists specialties_select_all on public.specialties;
drop policy if exists specialties_admin      on public.specialties;

create policy specialties_select_all on public.specialties
  for select using (active = true or public.is_admin());

create policy specialties_admin on public.specialties
  for all using (public.is_admin()) with check (public.is_admin());

-- 2) Seed common specialties ------------------------------------------
insert into public.specialties (name, slug, color, icon, sort_order) values
  ('רפואת משפחה',  'family',        'teal',     'Stethoscope', 10),
  ('ילדים',          'pediatrics',    'amber',    'Baby',         20),
  ('עור',            'dermatology',   'rose',     'Sparkles',     30),
  ('אף-אוזן-גרון',    'ent',           'sky',      'Ear',          40),
  ('גינקולוגיה',    'gynecology',    'pink',     'Heart',        50),
  ('קרדיולוגיה',    'cardiology',    'red',      'HeartPulse',   60),
  ('אורתופדיה',     'orthopedics',   'blue',     'Bone',         70),
  ('נוירולוגיה',    'neurology',     'violet',   'Brain',        80),
  ('פסיכיאטריה',   'psychiatry',    'indigo',   'Brain',        90),
  ('עיניים',         'ophthalmology', 'cyan',     'Eye',         100),
  ('פנימי',         'internal',      'slate',    'Activity',    110),
  ('שיניים',        'dental',        'emerald',  'Smile',       120)
on conflict (slug) do nothing;

-- 3) Add FK columns ---------------------------------------------------
alter table public.doctors
  add column if not exists specialty_id uuid
  references public.specialties(id) on delete set null;

alter table public.services
  add column if not exists specialty_id uuid
  references public.specialties(id) on delete set null;

create index if not exists idx_doctors_specialty_id  on public.doctors(specialty_id);
create index if not exists idx_services_specialty_id on public.services(specialty_id);

-- 4) Backfill doctors.specialty_id from old text specialty -----------
-- Maps the free-text "specialty" we used before to a row in specialties.
-- Heuristic on substring (so "רופאת משפחה" / "משפחה" both match family).
do $$
declare
  d record;
  sid uuid;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'doctors' and column_name = 'specialty'
  ) then
    for d in
      select profile_id, specialty from public.doctors
      where specialty_id is null and specialty is not null and btrim(specialty) <> ''
    loop
      sid := null;
      select id into sid from public.specialties
        where d.specialty ilike '%' || name || '%'
           or name ilike '%' || d.specialty || '%'
        order by length(name) desc
        limit 1;
      if sid is not null then
        update public.doctors set specialty_id = sid where profile_id = d.profile_id;
      end if;
    end loop;
  end if;
end $$;

-- 5) Backfill services.specialty_id ----------------------------------
-- Pick the most common specialty among doctors that already offer that
-- service via doctor_services. Services that nobody offers yet (or that
-- are generic across departments) stay NULL.
with svc_specialty as (
  select ds.service_id, d.specialty_id, count(*) as c
  from public.doctor_services ds
  join public.doctors d on d.profile_id = ds.doctor_id
  where d.specialty_id is not null
  group by ds.service_id, d.specialty_id
),
ranked as (
  select service_id, specialty_id,
         row_number() over (partition by service_id order by c desc) as rn
  from svc_specialty
)
update public.services s
   set specialty_id = r.specialty_id
  from ranked r
 where r.rn = 1 and s.id = r.service_id and s.specialty_id is null;

-- 6) Drop the legacy text column on doctors (now redundant) ----------
-- Keep this commented in case you want to delay; once UI is wired the
-- text column is no longer read anywhere.
alter table public.doctors drop column if exists specialty;

-- ────────────────────────────────────────────────────────────────────
-- Verify
select s.name, s.color,
       (select count(*) from public.doctors d where d.specialty_id = s.id) as doctors_count,
       (select count(*) from public.services v where v.specialty_id = s.id) as services_count
from public.specialties s
order by s.sort_order;
