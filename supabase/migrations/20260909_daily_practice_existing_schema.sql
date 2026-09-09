-- Run this AFTER the schema already present in your Supabase SQL Editor.
-- It adds the pieces required by the migrated Daily Question page.

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
on public.profiles for insert to authenticated
with check (id = auth.uid() and role = 'student');

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create or replace function public.submit_daily_attempt(
  p_date date, p_section text, p_score integer, p_correct integer,
  p_wrong integer, p_total integer, p_answers jsonb, p_time_taken_seconds integer,
  p_timed_out boolean
)
returns public.daily_attempts
language plpgsql security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  package_record public.daily_packages;
  prior public.user_streaks;
  saved public.daily_attempts;
  current_name text := coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() -> 'user_metadata' ->> 'name', split_part(coalesce(auth.jwt() ->> 'email', 'Student'), '@', 1), 'Student');
  current_email text := coalesce(auth.jwt() ->> 'email', '');
  new_streak integer;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if p_section not in ('quant', 'varc', 'dilr') or p_total < 1 or p_correct < 0 or p_wrong < 0 or p_correct + p_wrong > p_total or p_time_taken_seconds < 0 then
    raise exception 'Invalid attempt';
  end if;

  select * into package_record from public.daily_packages where date = p_date and published = true;
  if not found then raise exception 'Daily package is unavailable'; end if;

  insert into public.daily_attempts (user_id, package_id, date, section, score, correct, wrong, total, answers, time_taken_seconds, timed_out)
  values (current_user_id, package_record.id, p_date, p_section, p_score, p_correct, p_wrong, p_total, p_answers, p_time_taken_seconds, p_timed_out)
  on conflict (user_id, date, section) do update set score = excluded.score, correct = excluded.correct, wrong = excluded.wrong, total = excluded.total, answers = excluded.answers, time_taken_seconds = excluded.time_taken_seconds, timed_out = excluded.timed_out, submitted_at = now()
  returning * into saved;

  if p_date = (now() at time zone 'Asia/Kolkata')::date then
    insert into public.daily_leaderboard_entries (user_id, date, section, score, correct, wrong, total, display_name)
    values (current_user_id, p_date, p_section, p_score, p_correct, p_wrong, p_total, current_name)
    on conflict (user_id, date, section) do update set score = excluded.score, correct = excluded.correct, wrong = excluded.wrong, total = excluded.total, display_name = excluded.display_name, updated_at = now();

    select * into prior from public.user_streaks where user_id = current_user_id for update;
    if not found or prior.last_activity_date is distinct from p_date then
      new_streak := case when prior.last_activity_date = p_date - 1 then prior.current_streak + 1 else 1 end;
      insert into public.user_streaks (user_id, display_name, email, current_streak, longest_streak, last_activity_date)
      values (current_user_id, current_name, current_email, new_streak, greatest(coalesce(prior.longest_streak, 0), new_streak), p_date)
      on conflict (user_id) do update set display_name = excluded.display_name, email = excluded.email, current_streak = excluded.current_streak, longest_streak = excluded.longest_streak, last_activity_date = excluded.last_activity_date, updated_at = now();
    end if;
  end if;
  return saved;
end;
$$;

grant execute on function public.submit_daily_attempt(date, text, integer, integer, integer, integer, jsonb, integer, boolean) to authenticated;
