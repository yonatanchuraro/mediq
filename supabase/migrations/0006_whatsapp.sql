-- ====================================================================
-- MediQ — 0006: WhatsApp notifications (confirmation / cancellation / 24h reminder)
-- Run after Edge Function `appointment-whatsapp` is deployed AND after the
-- secrets/settings at the bottom of this file are populated. Otherwise
-- the cron will fire but the Edge Function will fail authorization.
-- ====================================================================

-- 1) Audit column — what we've already sent per appointment, so we don't
--    spam the patient with the same notification twice.
alter table public.appointments
  add column if not exists whatsapp_sent jsonb not null default '{}'::jsonb;

-- 2) Required extensions (Supabase free tier supports both)
create extension if not exists pg_net    with schema extensions;
create extension if not exists pg_cron   with schema extensions;

-- 3) DB settings the cron + future triggers will read.
-- IMPORTANT: replace these placeholders by running the two commands below
-- in the SQL Editor *after* you have your CRON_SECRET picked.
--
--    alter database postgres set app.functions_url = 'https://YOUR-PROJECT.supabase.co/functions/v1';
--    alter database postgres set app.cron_secret  = 'paste-the-random-secret-here';
--
-- The Edge Function must have CRON_SECRET set to the SAME value
-- (Supabase → Edge Functions → Secrets).

-- 4) Scheduled job: every hour at minute 5, fire the batch reminder.
-- Unschedule first so the migration is idempotent.
do $$
declare
  job_id int;
begin
  select jobid into job_id from cron.job where jobname = 'mediq-whatsapp-reminder-24h';
  if found then
    perform cron.unschedule(job_id);
  end if;
end $$;

select cron.schedule(
  'mediq-whatsapp-reminder-24h',
  '5 * * * *',          -- every hour at :05
  $cron$
    select net.http_post(
      url := current_setting('app.functions_url', true) || '/appointment-whatsapp',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
      ),
      body := jsonb_build_object('type', 'batch_reminder_24h')
    );
  $cron$
);

-- 5) Verify
select jobname, schedule, active from cron.job where jobname = 'mediq-whatsapp-reminder-24h';
