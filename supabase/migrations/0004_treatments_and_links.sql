-- ====================================================================
-- MediQ — 0004: 21 professional treatments + doctor↔service links
-- Run after 0003 (mock doctors must exist). Idempotent.
-- ====================================================================

-- 1) Insert the new treatments (only if not already present, matched by name).
insert into public.services (name, description, duration_minutes, price_cents)
select v.name, v.description, v.duration_minutes, v.price_cents
from (values
  -- Family medicine
  ('בדיקה תקופתית',          'בדיקה כללית שנתית הכוללת אנמנזה, מדדים ובדיקה גופנית', 30, null),
  ('מעקב מחלה כרונית',       'מעקב למטופלים עם סוכרת, יתר לחץ דם, או מחלות כרוניות אחרות', 20, null),
  ('ייעוץ תזונה ראשוני',     'הערכה תזונתית מקיפה ובניית תכנית טיפול אישית',           45, null),

  -- Pediatrics
  ('בדיקה התפתחותית',        'הערכת התפתחות גופנית, קוגניטיבית ורגשית של ילדים',       30, null),
  ('ייעוץ הורי',             'ליווי הורים בהתמודדות עם אתגרי גידול ילדים',             30, null),
  ('בדיקת ילדים שגרתית',     'בדיקה רפואית כללית עבור ילדים',                          20, null),

  -- Dermatology
  ('מיפוי שומות',            'בדיקה דרמטוסקופית של נקודות חן ושומות',                  45, 45000),
  ('בדיקת נגעים',            'הערכת נגעים חשודים ובדיקת ממאירות',                      20, null),
  ('טיפול באקנה',            'הערכה ובניית תכנית טיפול לאקנה',                         30, null),

  -- ENT
  ('בדיקת שמיעה',            'בדיקה מקיפה של מערכת השמיעה',                            30, null),
  ('בדיקת אא"ג',             'בדיקה כללית של אף, אוזניים וגרון',                       20, null),
  ('אנדוסקופיה אא"ג',         'בדיקה אנדוסקופית של דרכי הנשימה העליונות',               45, 60000),

  -- Gynecology
  ('מעקב היריון',            'בדיקת היריון תקופתית לאישה בהיריון',                     30, null),
  ('בדיקת PAP',              'בדיקת משטח צוואר רחם לאיתור מוקדם של סרטן',              20, null),
  ('ייעוץ בריאות האשה',      'ייעוץ בנושאי הורמונים, פוריות ומחזור',                  45, null),

  -- Cardiology
  ('אקו-לב',                 'אקוקרדיוגרפיה (אולטרסאונד לב)',                          45, 70000),
  ('בדיקת לחץ דם',           'מדידה ומעקב לחץ דם',                                     15, null),
  ('בדיקה קרדיולוגית כללית', 'הערכה קרדיולוגית הכוללת אנמנזה, אקג ובדיקה גופנית',     30, null),

  -- Orthopedics
  ('ייעוץ אורתופדי',         'ייעוץ ראשוני לבעיות שלד ושרירים',                       30, null),
  ('בדיקת עמוד שדרה',        'בדיקה ממוקדת לבעיות גב וצוואר',                          30, null),
  ('הזרקה תוך-מפרקית',       'הזרקת תרופה ישירות למפרק',                              20, 50000)
) as v(name, description, duration_minutes, price_cents)
where not exists (select 1 from public.services s where s.name = v.name);

-- 2) Link each mock doctor to the treatments they actually perform.
insert into public.doctor_services (doctor_id, service_id)
select d.profile_id, s.id
from (values
  -- Family doctor (covers a lot of general)
  ('family@mediq.test', 'בדיקה כללית'),
  ('family@mediq.test', 'ביקור מעקב'),
  ('family@mediq.test', 'בדיקת דם'),
  ('family@mediq.test', 'חיסון'),
  ('family@mediq.test', 'ייעוץ ראשוני'),
  ('family@mediq.test', 'בדיקה תקופתית'),
  ('family@mediq.test', 'מעקב מחלה כרונית'),
  ('family@mediq.test', 'ייעוץ תזונה ראשוני'),

  -- Pediatrics
  ('pediatrics@mediq.test', 'חיסון'),
  ('pediatrics@mediq.test', 'בדיקה התפתחותית'),
  ('pediatrics@mediq.test', 'ייעוץ הורי'),
  ('pediatrics@mediq.test', 'בדיקת ילדים שגרתית'),
  ('pediatrics@mediq.test', 'בדיקה כללית'),

  -- Dermatology
  ('derma@mediq.test', 'מיפוי שומות'),
  ('derma@mediq.test', 'בדיקת נגעים'),
  ('derma@mediq.test', 'טיפול באקנה'),
  ('derma@mediq.test', 'ייעוץ ראשוני'),

  -- ENT
  ('ent@mediq.test', 'בדיקת שמיעה'),
  ('ent@mediq.test', 'בדיקת אא"ג'),
  ('ent@mediq.test', 'אנדוסקופיה אא"ג'),
  ('ent@mediq.test', 'ייעוץ ראשוני'),

  -- Gynecology
  ('gyn@mediq.test', 'מעקב היריון'),
  ('gyn@mediq.test', 'בדיקת PAP'),
  ('gyn@mediq.test', 'ייעוץ בריאות האשה'),
  ('gyn@mediq.test', 'ייעוץ ראשוני'),

  -- Cardiology
  ('cardio@mediq.test', 'אקו-לב'),
  ('cardio@mediq.test', 'בדיקת לחץ דם'),
  ('cardio@mediq.test', 'בדיקה קרדיולוגית כללית'),
  ('cardio@mediq.test', 'ייעוץ ראשוני'),

  -- Orthopedics
  ('ortho@mediq.test', 'ייעוץ אורתופדי'),
  ('ortho@mediq.test', 'בדיקת עמוד שדרה'),
  ('ortho@mediq.test', 'הזרקה תוך-מפרקית'),
  ('ortho@mediq.test', 'ייעוץ ראשוני')
) as m(doctor_email, service_name)
join public.profiles p on p.email = m.doctor_email
join public.doctors  d on d.profile_id = p.id
join public.services s on s.name = m.service_name
on conflict do nothing;

-- Verify counts
select 'services' as kind, count(*) from public.services where active = true
union all
select 'doctor_services links', count(*) from public.doctor_services;
