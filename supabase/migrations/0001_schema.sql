-- =====================================================================================
-- FitOS — Schema v1
-- Matches src/lib/types.ts and the TABLES mapping in src/lib/store.ts.
-- Run with:  supabase db push   (or paste into the SQL editor)
-- Requires Postgres 15+ (security_invoker views).
-- =====================================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------- helper functions --
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------- profiles ----
-- One row per auth user. id = auth.uid(). No user_id column (the app uses id).
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text not null default '',
  birth_date   date,
  age          int  not null default 0 check (age between 0 and 120),
  height_cm    numeric(5,1) not null default 0 check (height_cm between 0 and 260),
  sex          text not null default 'male' check (sex in ('male','female')),
  doctor       text not null default '',
  goals        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- -------------------------------------------------------------------- measurements ---
create table if not exists public.measurements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date            date not null,
  source          text not null default 'manual' check (source in ('manual','inbody')),
  weight_kg       numeric(5,1) check (weight_kg is null or weight_kg between 20 and 400),
  waist_cm        numeric(5,1) check (waist_cm is null or waist_cm between 30 and 250),
  chest_cm        numeric(5,1) check (chest_cm is null or chest_cm between 30 and 250),
  arm_cm          numeric(5,1) check (arm_cm is null or arm_cm between 10 and 100),
  thigh_cm        numeric(5,1) check (thigh_cm is null or thigh_cm between 20 and 150),
  body_fat_pct    numeric(4,1) check (body_fat_pct is null or body_fat_pct between 1 and 70),
  muscle_mass_kg  numeric(5,1) check (muscle_mass_kg is null or muscle_mass_kg between 5 and 150),  -- SMM
  fat_mass_kg     numeric(5,1) check (fat_mass_kg is null or fat_mass_kg between 0 and 250),
  bmi             numeric(4,1),
  bmr             numeric(6,0),
  visceral_fat    numeric(3,0) check (visceral_fat is null or visceral_fat between 1 and 30),
  body_water_l    numeric(4,1),
  inbody_score    numeric(4,0) check (inbody_score is null or inbody_score between 0 and 100),
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists measurements_user_date_idx on public.measurements (user_id, date desc);

-- -------------------------------------------------------------------- medications ----
create table if not exists public.medications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null,
  kind          text not null default 'medication' check (kind in ('medication','supplement')),
  dose          text not null default '',
  instructions  text not null default '',
  slots         jsonb not null default '[]'::jsonb,       -- [{id,label,time:'HH:mm'}]
  active        boolean not null default true,
  color         text not null default '#2f7bff',
  notes         text not null default '',
  sort          int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint medications_slots_is_array check (jsonb_typeof(slots) = 'array')
);
create index if not exists medications_user_idx on public.medications (user_id, sort);

create table if not exists public.med_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date           date not null,
  medication_id  uuid not null references public.medications (id) on delete cascade,
  slot_id        text not null,
  status         text not null default 'taken' check (status in ('taken','missed','skipped')),
  taken_at       timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint med_logs_unique_slot unique (user_id, date, medication_id, slot_id)
);
create index if not exists med_logs_user_date_idx on public.med_logs (user_id, date desc);

-- ---------------------------------------------------------------------- nutrition ----
create table if not exists public.meal_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  meal        text not null check (meal in ('breakfast','lunch','dinner','snack')),
  "group"     text not null check ("group" in ('starch','meat','veg','fruit','dairy','fat','legumes','extra')),
  servings    numeric(5,2) not null default 0 check (servings >= 0 and servings <= 50),
  kcal        numeric(7,1) not null default 0 check (kcal >= 0),
  protein_g   numeric(6,1) not null default 0 check (protein_g >= 0),
  carbs_g     numeric(6,1) not null default 0 check (carbs_g >= 0),
  fat_g       numeric(6,1) not null default 0 check (fat_g >= 0),
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists meal_logs_user_date_idx on public.meal_logs (user_id, date desc);
-- one row per (day, meal, food group) — "extra" (off-plan) rows may repeat
create unique index if not exists meal_logs_unique_group
  on public.meal_logs (user_id, date, meal, "group") where "group" <> 'extra';

create table if not exists public.water_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  amount_ml  int not null check (amount_ml between 1 and 5000),
  logged_at  timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists water_logs_user_date_idx on public.water_logs (user_id, date desc);

-- -------------------------------------------------------------------------- sleep ----
create table if not exists public.sleep_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,                                   -- wake-up date
  bedtime     text not null check (bedtime ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  wake_time   text not null check (wake_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration_h  numeric(4,1) not null check (duration_h between 0 and 24),
  quality     int not null default 3 check (quality between 1 and 5),
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint sleep_logs_unique_day unique (user_id, date)
);
create index if not exists sleep_logs_user_date_idx on public.sleep_logs (user_id, date desc);

create table if not exists public.daily_checkins (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date            date not null,
  screen_minutes  int check (screen_minutes is null or screen_minutes between 0 and 1440),
  energy          int check (energy is null or energy between 1 and 5),
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint daily_checkins_unique_day unique (user_id, date)
);

-- ------------------------------------------------------------------------ training ---
create table if not exists public.exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  split        text not null check (split in ('anterior_a','posterior_a','anterior_b','posterior_b')),
  sort         int not null default 0,
  name         text not null,
  muscle       text not null check (muscle in ('chest','back','shoulders','biceps','triceps','forearms','quads','hamstrings','calves','adductors','abs','traps')),
  warmup_sets  text not null default '0',
  work_sets    int not null default 1 check (work_sets between 0 and 20),
  rep_min      int not null default 6 check (rep_min between 1 and 100),
  rep_max      int not null default 10 check (rep_max between 1 and 100),
  rest_min     numeric(3,1),
  rest_max     numeric(3,1),
  alt1         text not null default '',
  alt2         text not null default '',
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint exercises_rep_range check (rep_max >= rep_min)
);
create index if not exists exercises_user_split_idx on public.exercises (user_id, split, sort);

create table if not exists public.workout_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date          date not null,
  kind          text not null check (kind in ('anterior_a','posterior_a','anterior_b','posterior_b','cardio','custom')),
  status        text not null default 'in_progress' check (status in ('in_progress','completed')),
  started_at    timestamptz not null default now(),
  duration_min  int check (duration_min is null or duration_min between 0 and 600),
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists workout_sessions_user_date_idx on public.workout_sessions (user_id, date desc);

create table if not exists public.workout_sets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id     uuid not null references public.workout_sessions (id) on delete cascade,
  date           date not null,
  exercise_id    uuid references public.exercises (id) on delete set null,
  exercise_name  text not null,
  muscle         text not null check (muscle in ('chest','back','shoulders','biceps','triceps','forearms','quads','hamstrings','calves','adductors','abs','traps')),
  set_no         int not null default 1 check (set_no between 1 and 50),
  weight_kg      numeric(6,2) not null default 0 check (weight_kg between 0 and 1000),
  reps           int not null default 0 check (reps between 0 and 200),
  rir            numeric(3,1) check (rir is null or rir between 0 and 10),
  rpe            numeric(3,1) check (rpe is null or rpe between 1 and 10),
  is_warmup      boolean not null default false,
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists workout_sets_user_date_idx on public.workout_sets (user_id, date desc);
create index if not exists workout_sets_session_idx on public.workout_sets (session_id);
create index if not exists workout_sets_exercise_idx on public.workout_sets (user_id, exercise_name, date desc);

-- -------------------------------------------------------------------------- photos ---
create table if not exists public.photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  angle       text not null check (angle in ('front','side','back')),
  path        text not null,            -- Storage path: <user_id>/<uuid>.jpg (bucket progress-photos)
  weight_kg   numeric(5,1),
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists photos_user_date_idx on public.photos (user_id, date desc);

-- ------------------------------------------------------ server-side outputs (Edge) ---
create table if not exists public.insights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  kind        text not null check (kind in ('insight','recommendation','warning','achievement')),
  title       text not null,
  body        text not null default '',
  severity    int not null default 1 check (severity between 1 and 3),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists insights_user_date_idx on public.insights (user_id, date desc);

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  period      text not null check (period in ('weekly','monthly')),
  start_date  date not null,
  end_date    date not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint reports_unique_period unique (user_id, period, start_date)
);
create index if not exists reports_user_idx on public.reports (user_id, start_date desc);

-- ------------------------------------------------------------ updated_at triggers ----
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','measurements','medications','med_logs','meal_logs','water_logs','sleep_logs','daily_checkins',
    'exercises','workout_sessions','workout_sets','photos','insights','reports'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------------------- RLS -------
do $$
declare t text; cmd text;
begin
  foreach t in array array[
    'measurements','medications','med_logs','meal_logs','water_logs','sleep_logs','daily_checkins',
    'exercises','workout_sessions','workout_sets','photos','insights','reports'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    foreach cmd in array array['select','insert','update','delete'] loop
      execute format('drop policy if exists "own rows %s" on public.%I', cmd, t);
    end loop;
    execute format('create policy "own rows select" on public.%I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy "own rows insert" on public.%I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy "own rows update" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "own rows delete" on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "own profile select" on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "own profile delete" on public.profiles;
create policy "own profile select" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own profile delete" on public.profiles for delete to authenticated using (id = auth.uid());

-- ---------------------------------------------------------------------- storage -----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "progress photos select" on storage.objects;
drop policy if exists "progress photos insert" on storage.objects;
drop policy if exists "progress photos update" on storage.objects;
drop policy if exists "progress photos delete" on storage.objects;
create policy "progress photos select" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress photos update" on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------------------ views ------
-- All views run with the caller's privileges so RLS on the base tables applies.
create or replace view public.v_daily_nutrition with (security_invoker = true) as
select user_id, date,
       sum(kcal)::numeric(8,1)       as kcal,
       sum(protein_g)::numeric(7,1)  as protein_g,
       sum(carbs_g)::numeric(7,1)    as carbs_g,
       sum(fat_g)::numeric(7,1)      as fat_g,
       count(*)                      as rows_logged
from public.meal_logs
group by user_id, date;

create or replace view public.v_daily_water with (security_invoker = true) as
select user_id, date, sum(amount_ml)::int as total_ml, count(*) as drinks
from public.water_logs
group by user_id, date;

-- Week starts on Saturday (matches WEEK_STARTS_ON = 6 in the app).
create or replace view public.v_weekly_volume with (security_invoker = true) as
select user_id,
       (date - (((extract(dow from date)::int) + 1) % 7))::date as week_start,
       muscle,
       count(*)                                  as hard_sets,
       sum(weight_kg * reps)::numeric(12,1)      as volume_load_kg
from public.workout_sets
where not is_warmup and reps > 0
group by user_id, (date - (((extract(dow from date)::int) + 1) % 7))::date, muscle;

create or replace view public.v_med_adherence_daily with (security_invoker = true) as
select l.user_id, l.date,
       count(*) filter (where l.status = 'taken')                    as taken,
       count(*) filter (where l.status in ('missed','skipped'))      as missed_logged,
       coalesce((select sum(jsonb_array_length(m.slots)) from public.medications m
                  where m.user_id = l.user_id and m.active), 0)::int as expected,
       case when coalesce((select sum(jsonb_array_length(m.slots)) from public.medications m
                            where m.user_id = l.user_id and m.active), 0) = 0 then null
            else round(100.0 * count(*) filter (where l.status = 'taken')
                 / (select sum(jsonb_array_length(m.slots)) from public.medications m
                     where m.user_id = l.user_id and m.active), 1) end as adherence_pct
from public.med_logs l
group by l.user_id, l.date;

-- Estimated 1RM (Epley, reps-in-reserve adjusted, effective reps capped at 15).
create or replace view public.v_best_lifts with (security_invoker = true) as
select user_id, exercise_name, muscle,
       max(weight_kg * (1 + least(reps + coalesce(rir, 0), 15) / 30.0))::numeric(7,1) as best_e1rm,
       max(weight_kg) as max_weight_kg,
       max(date)      as last_done
from public.workout_sets
where not is_warmup and reps > 0 and weight_kg > 0
group by user_id, exercise_name, muscle;

grant select on public.v_daily_nutrition, public.v_daily_water, public.v_weekly_volume,
                public.v_med_adherence_daily, public.v_best_lifts to authenticated;
