-- ====================================================================
-- MediQ — Mock data: 7 doctors with diverse specialties + working hours.
-- Run this in Supabase SQL Editor to populate the clinic with test data.
-- ====================================================================
-- All mock accounts share the password:  Password123
-- Doctors created by this migration can log in normally via /login.
-- The script is idempotent — running it twice is safe (skips existing emails).
-- ====================================================================

do $$
declare
  d           record;
  uid         uuid;
  hashed_pw   text;
  created_n   int := 0;
begin
  hashed_pw := crypt('Password123', gen_salt('bf'));

  for d in
    select * from (values
      ('family@mediq.test',     'דר׳ שרה לוי',     '050-1234567', 'רופאת משפחה',    'מומחית ברפואת משפחה עם 15 שנות ניסיון. מטפלת בכל הגילים, מתמחה במחלות כרוניות.', '08:00'::time, '16:00'::time),
      ('pediatrics@mediq.test', 'דר׳ אבי כהן',     '050-2345678', 'רופא ילדים',     'מתמחה ברפואת ילדים, גיל 0-18. מומחה בהתפתחות, חיסונים ומחלות זיהומיות.',         '09:00'::time, '17:00'::time),
      ('derma@mediq.test',      'דר׳ מיכל זילבר',  '050-3456789', 'רופאת עור',      'מומחית במחלות עור, נגעים, אקנה ומחלות אוטואימוניות של העור.',                   '10:00'::time, '18:00'::time),
      ('ent@mediq.test',        'דר׳ יוסי בן-דוד', '050-4567890', 'אף-אוזן-גרון',    'מנתח אא״ג, מומחיות באלרגיה, בעיות שינה ובעיות שיווי משקל.',                     '08:00'::time, '15:00'::time),
      ('gyn@mediq.test',        'דר׳ רחל אברהם',   '050-5678901', 'גינקולוגית',     'מומחית בבריאות האשה, מעקב היריון, פוריות והפרעות הורמונליות.',                  '09:00'::time, '17:00'::time),
      ('cardio@mediq.test',     'דר׳ דוד שטרן',    '050-6789012', 'קרדיולוג',       'מומחה לקרדיולוגיה ואקוקרדיוגרפיה. טיפול ביתר לחץ דם ואי-ספיקת לב.',              '08:00'::time, '16:00'::time),
      ('ortho@mediq.test',      'דר׳ נועה גולדמן', '050-7890123', 'אורתופדית',      'מנתחת אורתופדית, התמחות בעמוד שדרה ופציעות ספורט.',                              '09:00'::time, '15:00'::time)
    ) as t(email, full_name, phone, specialty, bio, work_start, work_end)
  loop
    if exists (select 1 from auth.users where email = d.email) then
      raise notice 'Skipping %, already exists', d.email;
      continue;
    end if;

    uid := gen_random_uuid();

    -- Create auth user. handle_new_user trigger will auto-create the profile.
    insert into auth.users (
      instance_id, id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      d.email, hashed_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', d.full_name, 'phone', d.phone, 'role', 'doctor'),
      now(), now(),
      '', '', '', ''
    );

    -- Identities row is required so email+password login works.
    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      uid::text, uid,
      jsonb_build_object('sub', uid::text, 'email', d.email, 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );

    -- Ensure profile reflects role+name+phone (trigger may use defaults).
    update public.profiles
       set role = 'doctor', full_name = d.full_name, phone = d.phone
     where id = uid;

    -- Doctor row
    insert into public.doctors (profile_id, specialty, bio, active)
    values (uid, d.specialty, d.bio, true)
    on conflict (profile_id) do nothing;

    -- Working hours: weekdays at the doctor's typical times, Friday short,
    -- Saturday closed (Israeli clinic schedule).
    insert into public.working_hours (doctor_id, weekday, start_time, end_time, is_open) values
      (uid, 0, d.work_start, d.work_end, true),
      (uid, 1, d.work_start, d.work_end, true),
      (uid, 2, d.work_start, d.work_end, true),
      (uid, 3, d.work_start, d.work_end, true),
      (uid, 4, d.work_start, d.work_end, true),
      (uid, 5, '09:00'::time, '13:00'::time, true),
      (uid, 6, null, null, false)
    on conflict (doctor_id, weekday) do nothing;

    created_n := created_n + 1;
  end loop;

  raise notice 'Created % new mock doctors', created_n;
end $$;

-- Verify what we have
select p.full_name, p.email, p.role, d.specialty, d.active
from public.profiles p
join public.doctors  d on d.profile_id = p.id
order by p.created_at desc;

-- ====================================================================
-- Cleanup (optional) — remove all mock @mediq.test accounts later:
--   delete from auth.users where email like '%@mediq.test';
-- (cascade FKs remove profiles / doctors / working_hours automatically)
-- ====================================================================
