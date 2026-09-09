-- Run this in the Supabase SQL Editor before deploying the application code.
-- Existing Firebase daily packages must be copied into daily_packages.package as JSON.

create type public.app_role as enum ('admin', 'student');
create type public.daily_section as enum ('quant', 'varc', 'dilr');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text not null default '',
  avatar_url text not null default '',
  role public.app_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_packages (
  date date primary key,
  published boolean not null default false,
  package jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null references public.daily_packages(date) on delete cascade,
  section public.daily_section not null,
  score integer not null,
  correct integer not null,
  wrong integer not null,
  total integer not null,
  answers jsonb not null default '{}'::jsonb,
  time_taken_seconds integer not null,
  timed_out boolean not null default false,
  submitted_at timestamptz not null default now(),
  unique (user_id, date, section)
);

create table public.user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text not null default '',
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_activity_date date,
  updated_at timestamptz not null default now()
);

create table public.daily_leaderboard_entries (
  date date not null,
  section public.daily_section not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text not null default '',
  score integer not null,
  correct integer not null,
  wrong integer not null,
  total integer not null,
  updated_at timestamptz not null default now(),
  primary key (date, section, user_id)
);

create table public.user_activities (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  type text not null check (type in ('signin', 'mock', 'practice', 'pyq', 'daily')),
  detail text not null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id bigint generated always as identity primary key,
  text text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

alter table public.profiles enable row level security;
alter table public.daily_packages enable row level security;
alter table public.daily_attempts enable row level security;
alter table public.user_streaks enable row level security;
alter table public.daily_leaderboard_entries enable row level security;
alter table public.user_activities enable row level security;
alter table public.notifications enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "users create own student profile" on public.profiles for insert to authenticated with check (id = auth.uid() and role = 'student');
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy "admins manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "signed in users read published daily packages" on public.daily_packages for select to authenticated using (published or public.is_admin());
create policy "admins manage daily packages" on public.daily_packages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users read own daily attempts" on public.daily_attempts for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "public streak leaderboard" on public.user_streaks for select using (true);
create policy "public daily leaderboard" on public.daily_leaderboard_entries for select using (true);
create policy "admins read activities" on public.user_activities for select to authenticated using (public.is_admin());
create policy "signed in users read notifications" on public.notifications for select to authenticated using (true);
create policy "admins manage notifications" on public.notifications for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.submit_daily_attempt(
  p_date date, p_section public.daily_section, p_score integer, p_correct integer,
  p_wrong integer, p_total integer, p_answers jsonb, p_time_taken_seconds integer,
  p_timed_out boolean
)
returns public.daily_attempts
language plpgsql security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_name text := coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() -> 'user_metadata' ->> 'name', split_part(coalesce(auth.jwt() ->> 'email', 'Student'), '@', 1), 'Student');
  current_email text := coalesce(auth.jwt() ->> 'email', '');
  prior public.user_streaks;
  saved public.daily_attempts;
  new_streak integer;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.daily_packages where date = p_date and published) then raise exception 'Daily package is unavailable'; end if;
  if p_total < 1 or p_correct < 0 or p_wrong < 0 or p_correct + p_wrong > p_total or p_time_taken_seconds < 0 then raise exception 'Invalid attempt'; end if;

  insert into public.daily_attempts (user_id, date, section, score, correct, wrong, total, answers, time_taken_seconds, timed_out)
  values (current_user_id, p_date, p_section, p_score, p_correct, p_wrong, p_total, p_answers, p_time_taken_seconds, p_timed_out)
  on conflict (user_id, date, section) do update set score = excluded.score, correct = excluded.correct, wrong = excluded.wrong, total = excluded.total, answers = excluded.answers, time_taken_seconds = excluded.time_taken_seconds, timed_out = excluded.timed_out, submitted_at = now()
  returning * into saved;

  if p_date = (now() at time zone 'Asia/Kolkata')::date then
    insert into public.daily_leaderboard_entries (date, section, user_id, display_name, email, score, correct, wrong, total)
    values (p_date, p_section, current_user_id, current_name, current_email, p_score, p_correct, p_wrong, p_total)
    on conflict (date, section, user_id) do update set display_name = excluded.display_name, email = excluded.email, score = excluded.score, correct = excluded.correct, wrong = excluded.wrong, total = excluded.total, updated_at = now();

    select * into prior from public.user_streaks where user_id = current_user_id for update;
    if not found or prior.last_activity_date is distinct from p_date then
      new_streak := case when prior.last_activity_date = p_date - 1 then prior.current_streak + 1 else 1 end;
      insert into public.user_streaks (user_id, display_name, email, current_streak, longest_streak, last_activity_date)
      values (current_user_id, current_name, current_email, new_streak, greatest(coalesce(prior.longest_streak, 0), new_streak), p_date)
      on conflict (user_id) do update set display_name = excluded.display_name, email = excluded.email, current_streak = excluded.current_streak, longest_streak = excluded.longest_streak, last_activity_date = excluded.last_activity_date, updated_at = now();
    end if;
  end if;

  insert into public.user_activities (user_id, user_name, type, detail) values (current_user_id, current_name, 'daily', p_section || ' target for ' || p_date::text);
  return saved;
end;
$$;

grant execute on function public.submit_daily_attempt(date, public.daily_section, integer, integer, integer, integer, jsonb, integer, boolean) to authenticated;

-- After your first Supabase Google login, promote your account once:
-- update public.profiles set role = 'admin' where email = 'you@example.com';
