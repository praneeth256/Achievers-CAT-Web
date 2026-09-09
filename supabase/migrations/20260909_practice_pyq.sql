-- Practice and PYQ libraries, grouped RC/DILR sets, and private answers.

create table if not exists public.practice_questions (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('Quant', 'VARC-VA')),
  chapter text not null,
  difficulty text not null check (difficulty in ('Easy', 'Moderate', 'Hard', 'Difficult')),
  question text not null,
  question_type text not null default 'MCQ' check (question_type in ('MCQ', 'TITA')),
  options jsonb not null default '[]'::jsonb,
  correct_option text,
  correct_answer text,
  explanation text not null default '',
  published boolean not null default true,
  position bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.practice_groups (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('VARC-RC', 'DILR')),
  chapter text not null,
  title text not null,
  content text not null,
  difficulty text not null check (difficulty in ('Easy', 'Moderate', 'Hard', 'Difficult')),
  questions jsonb not null default '[]'::jsonb,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pyq_questions (like public.practice_questions including all);
create table if not exists public.pyq_groups (like public.practice_groups including all);

create table if not exists public.practice_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  section text not null,
  chapter text not null,
  selected_option text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table if not exists public.pyq_attempts (like public.practice_attempts including all);

alter table public.practice_questions enable row level security;
alter table public.practice_groups enable row level security;
alter table public.pyq_questions enable row level security;
alter table public.pyq_groups enable row level security;
alter table public.practice_attempts enable row level security;
alter table public.pyq_attempts enable row level security;

create policy "Published practice questions are readable" on public.practice_questions for select to authenticated using (published or public.is_admin());
create policy "Admins manage practice questions" on public.practice_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Published practice groups are readable" on public.practice_groups for select to authenticated using (published or public.is_admin());
create policy "Admins manage practice groups" on public.practice_groups for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Published PYQ questions are readable" on public.pyq_questions for select to authenticated using (published or public.is_admin());
create policy "Admins manage PYQ questions" on public.pyq_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Published PYQ groups are readable" on public.pyq_groups for select to authenticated using (published or public.is_admin());
create policy "Admins manage PYQ groups" on public.pyq_groups for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users manage own practice answers" on public.practice_attempts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own PYQ answers" on public.pyq_attempts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
