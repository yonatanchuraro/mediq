-- ====================================================================
-- MediQ — 0007: Test accounts (one per role) for grading / demos.
-- ====================================================================
-- All three accounts share the password:  Password123
--
--   admin@mediq.test       → admin
--   doctor@mediq.test      → doctor (רפואת משפחה)
--   client@mediq.test      → client
--
-- The 7 mock doctors from 0003 still exist alongside these. This file
-- just adds a single, well-named account per role so a reviewer can
-- log in to each side of the app without scanning a list.
-- ====================================================================
-- Idempotent — safe to re-run. Existing emails are skipped.

do $$
declare
  hashed_pw  text;
  uid        uuid;
  family_id  uuid;
begin
  hashed_pw := crypt('Password123', gen_salt('bf'));

  -- Lookup the family-medicine specialty for the test doctor.
  select id into family_id from public.specialties where slug = 'family' limit 1;

  -- ── 1. admin@mediq.test ─────────────────────────────────────────
  if not exists (select 1 from auth.users where email = 'admin@mediq.test') then
    uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'admin@mediq.test', hashed_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'מנהל המערכת', 'phone', '050-0000001', 'role', 'admin'),
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      uid::text, uid,
      jsonb_build_object('sub', uid::text, 'email', 'admin@mediq.test', 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );

    -- The handle_new_user trigger creates the profile with role='admin'
    -- from raw_user_meta_data. Just make sure name+phone are set.
    update public.profiles
       set role = 'admin', full_name = 'מנהל המערכת', phone = '050-0000001'
     where id = uid;

    raise notice 'Created admin@mediq.test';
  else
    raise notice 'Skipping admin@mediq.test (already exists)';
  end if;

  -- ── 2. doctor@mediq.test ────────────────────────────────────────
  if not exists (select 1 from auth.users where email = 'doctor@mediq.test') then
    uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'doctor@mediq.test', hashed_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'דר׳ דמו רופא', 'phone', '050-0000002', 'role', 'doctor'),
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      uid::text, uid,
      jsonb_build_object('sub', uid::text, 'email', 'doctor@mediq.test', 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );

    update public.profiles
       set role = 'doctor', full_name = 'דר׳ דמו רופא', phone = '050-0000002'
     where id = uid;

    -- Doctor row + standard Israeli clinic working hours.
    insert into public.doctors (profile_id, specialty_id, bio, active) values
      (uid, family_id, 'חשבון דמו לבדיקת ממשק הרופא. רופא משפחה לדוגמה.', true)
    on conflict (profile_id) do nothing;

    insert into public.working_hours (doctor_id, weekday, start_time, end_time, is_open) values
      (uid, 0, '09:00'::time, '17:00'::time, true),
      (uid, 1, '09:00'::time, '17:00'::time, true),
      (uid, 2, '09:00'::time, '17:00'::time, true),
      (uid, 3, '09:00'::time, '17:00'::time, true),
      (uid, 4, '09:00'::time, '17:00'::time, true),
      (uid, 5, '09:00'::time, '13:00'::time, true),
      (uid, 6, null, null, false)
    on conflict (doctor_id, weekday) do nothing;

    raise notice 'Created doctor@mediq.test';
  else
    raise notice 'Skipping doctor@mediq.test (already exists)';
  end if;

  -- ── 3. client@mediq.test ────────────────────────────────────────
  if not exists (select 1 from auth.users where email = 'client@mediq.test') then
    uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'client@mediq.test', hashed_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'מטופל דמו', 'phone', '050-0000003', 'role', 'client'),
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      uid::text, uid,
      jsonb_build_object('sub', uid::text, 'email', 'client@mediq.test', 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );

    update public.profiles
       set role = 'client', full_name = 'מטופל דמו', phone = '050-0000003'
     where id = uid;

    raise notice 'Created client@mediq.test';
  else
    raise notice 'Skipping client@mediq.test (already exists)';
  end if;
end $$;

-- Verify
select email, role, full_name, phone
  from public.profiles
 where email in ('admin@mediq.test', 'doctor@mediq.test', 'client@mediq.test')
 order by case role when 'admin' then 1 when 'doctor' then 2 else 3 end;
