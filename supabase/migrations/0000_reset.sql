-- Run this ONLY if a previous migration attempt partially failed and you need a clean slate.
-- Safe on a fresh project with no real data yet.

drop table if exists public.photo_reports cascade;
drop table if exists public.driver_positions cascade;
drop table if exists public.locations cascade;
drop table if exists public.projects cascade;
drop table if exists public.profiles cascade;

drop function if exists public.set_updated_at cascade;
drop function if exists public.is_admin cascade;
drop function if exists public.handle_new_user cascade;
drop trigger if exists on_auth_user_created on auth.users;

drop type if exists public.location_status cascade;
drop type if exists public.project_status cascade;
drop type if exists public.user_role cascade;
