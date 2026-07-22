-- Fixes infinite recursion in the "profiles: admins read all" policy.
-- public.is_admin() already exists from 0001_init.sql and is SECURITY DEFINER,
-- so routing through it avoids the policy querying its own protected table.

drop policy if exists "profiles: admins read all" on public.profiles;

create policy "profiles: admins read all" on public.profiles
  for select using (public.is_admin());
