-- =====================================================================================
-- FitOS — Scheduled Edge Functions (pg_cron + pg_net)
-- RUN THIS MANUALLY after: (1) deploying the functions, (2) filling in the two Vault secrets.
--
-- This is the ONLY place that needs values from you:
--   <PROJECT_REF>        → Supabase dashboard → Project Settings → General → "Reference ID"
--   <SERVICE_ROLE_KEY>   → Project Settings → API → service_role key (keep secret!)
-- Alternatively set a CRON_SECRET (supabase secrets set CRON_SECRET=...) and send it as
-- the `x-cron-secret` header instead of the service key.
-- Times are UTC. 19:00 UTC = 22:00 Riyadh / 21:00 Cairo (winter).
-- =====================================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net  with schema extensions;

-- 1) Store secrets in Vault (run once; replace the placeholders):
-- select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'fitos_project_url');
-- select vault.create_secret('<SERVICE_ROLE_KEY>',               'fitos_service_key');

-- 2) Daily insights — every day 19:00 UTC
select cron.unschedule('fitos-compute-insights') where exists (select 1 from cron.job where jobname = 'fitos-compute-insights');
select cron.schedule(
  'fitos-compute-insights',
  '0 19 * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'fitos_project_url') || '/functions/v1/compute-insights',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fitos_service_key')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- 3) Weekly report — every Saturday 01:00 UTC (the week Sat→Fri that just ended)
select cron.unschedule('fitos-weekly-report') where exists (select 1 from cron.job where jobname = 'fitos-weekly-report');
select cron.schedule(
  'fitos-weekly-report',
  '0 1 * * 6',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'fitos_project_url') || '/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fitos_service_key')
    ),
    body    := '{"period":"weekly"}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- 4) Monthly report — 1st of each month 01:30 UTC (previous calendar month)
select cron.unschedule('fitos-monthly-report') where exists (select 1 from cron.job where jobname = 'fitos-monthly-report');
select cron.schedule(
  'fitos-monthly-report',
  '30 1 1 * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'fitos_project_url') || '/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fitos_service_key')
    ),
    body    := '{"period":"monthly"}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- Inspect:  select * from cron.job;   select * from cron.job_run_details order by start_time desc limit 10;
