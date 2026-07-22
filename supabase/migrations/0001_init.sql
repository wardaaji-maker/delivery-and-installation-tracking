-- Delivery & Installation Tracking — initial schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query) on a fresh project.

-- ============================================================
-- 1. PROFILES (extends auth.users with role + contact info)
-- ============================================================
create type user_role as enum ('admin', 'driver');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'driver',
  full_name text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper used throughout RLS policies below. SECURITY DEFINER makes this query
-- run as the function owner (bypassing RLS), which avoids infinite recursion
-- when a profiles policy itself needs to check "is this user an admin?".
create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: admins read all" on public.profiles
  for select using (public.is_admin());

create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
-- Role and full name come from the signup form via `options.data`.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'driver'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. PROJECTS
-- ============================================================
create type project_status as enum ('planning', 'active', 'completed', 'cancelled');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  due_date date,
  status project_status not null default 'planning',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "projects: admin all" on public.projects
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 3. LOCATIONS (delivery / installation points within a project)
-- ============================================================
create type location_status as enum ('unassigned', 'assigned', 'in_progress', 'completed', 'failed');

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  address text not null,
  lat double precision,
  lng double precision,
  receiver_name text,
  receiver_phone text,
  notes text,
  status location_status not null default 'unassigned',
  assigned_driver_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index locations_project_idx on public.locations(project_id);
create index locations_driver_idx on public.locations(assigned_driver_id);

alter table public.locations enable row level security;

create policy "locations: admin all" on public.locations
  for all using (public.is_admin()) with check (public.is_admin());

create policy "locations: driver read own" on public.locations
  for select using (assigned_driver_id = auth.uid());

create policy "locations: driver update own status" on public.locations
  for update using (assigned_driver_id = auth.uid())
  with check (assigned_driver_id = auth.uid());

-- Now that public.locations exists, drivers can read projects that have a location assigned to them.
create policy "projects: drivers read assigned" on public.projects
  for select using (
    exists (
      select 1 from public.locations l
      where l.project_id = projects.id and l.assigned_driver_id = auth.uid()
    )
  );

-- ============================================================
-- 4. DRIVER LIVE POSITIONS (for route/live tracking map)
-- ============================================================
create table public.driver_positions (
  id bigint generated always as identity primary key,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  recorded_at timestamptz not null default now()
);

create index driver_positions_driver_idx on public.driver_positions(driver_id, recorded_at desc);

alter table public.driver_positions enable row level security;

create policy "positions: driver insert own" on public.driver_positions
  for insert with check (driver_id = auth.uid());

create policy "positions: driver read own" on public.driver_positions
  for select using (driver_id = auth.uid());

create policy "positions: admin read all" on public.driver_positions
  for select using (public.is_admin());

-- ============================================================
-- 5. PHOTO REPORTS (installation/delivery proof submitted by drivers)
-- ============================================================
create table public.photo_reports (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  driver_id uuid not null references public.profiles(id),
  notes text,
  photo_urls text[] not null default '{}',
  submitted_at timestamptz not null default now()
);

create index photo_reports_location_idx on public.photo_reports(location_id);
create index photo_reports_driver_idx on public.photo_reports(driver_id);

alter table public.photo_reports enable row level security;

create policy "reports: admin read all" on public.photo_reports
  for select using (public.is_admin());

create policy "reports: driver read own" on public.photo_reports
  for select using (driver_id = auth.uid());

create policy "reports: driver insert own" on public.photo_reports
  for insert with check (driver_id = auth.uid());

-- ============================================================
-- 6. Keep locations.updated_at fresh
-- ============================================================
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger locations_set_updated_at
  before update on public.locations
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- 7. Realtime (for live driver tracking + dashboard updates)
-- ============================================================
alter publication supabase_realtime add table public.driver_positions;
alter publication supabase_realtime add table public.locations;
