-- Enables Supabase-admin access to the Daily Practice editor.
-- Run this once in the Supabase SQL Editor.

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "Admins manage daily packages" on public.daily_packages;
create policy "Admins manage daily packages"
on public.daily_packages for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Run this after you have signed in with your own Google account.
-- Replace the email before executing it:
-- update public.profiles set role = 'admin' where email = 'you@example.com';
