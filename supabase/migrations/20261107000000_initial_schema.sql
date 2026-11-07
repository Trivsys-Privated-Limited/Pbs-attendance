-- PBS Attend — initial schema (LOCAL development only).
--
-- Tables, enums, helpers and Row Level Security for the core domain.
-- Privacy: activity data is limited to Active / Idle / Offline transitions.
-- There are deliberately NO columns for keystrokes, screenshots, window titles,
-- URLs, screen contents or passwords. Passwords are handled only by Supabase Auth.
--
-- Write access for employees is intentionally absent: check-ins, heartbeats and
-- attendance status will be written by trusted server-side code (later phase)
-- using server timestamps.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('super_admin', 'admin', 'manager', 'employee');
create type public.employee_status as enum ('active', 'suspended', 'archived');
create type public.attendance_status as enum ('on_time', 'late', 'absent', 'on_leave', 'pending');
create type public.activity_state as enum ('active', 'idle', 'offline');
create type public.device_trust as enum ('pending', 'approved', 'revoked');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Office settings (single row)
-- ---------------------------------------------------------------------------
create table public.office_settings (
  id boolean primary key default true check (id),
  company_name text not null,
  timezone text not null,
  shift_start time not null,
  late_threshold time not null,
  idle_detection_seconds integer not null check (idle_detection_seconds between 15 and 3600),
  heartbeat_interval_seconds integer not null check (heartbeat_interval_seconds between 5 and 300),
  offline_threshold_seconds integer not null check (offline_threshold_seconds between 10 and 3600),
  updated_at timestamptz not null default now(),
  constraint offline_after_heartbeat check (offline_threshold_seconds > heartbeat_interval_seconds)
);

comment on table public.office_settings is
  'Single-row office configuration. late_threshold is inclusive (a check-in at exactly the threshold is on time).';

create trigger office_settings_updated_at
  before update on public.office_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Employees (profile linked 1:1 to a Supabase Auth user)
-- ---------------------------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  employee_code text not null unique check (employee_code ~ '^PBS-[0-9]{3,5}$'),
  full_name text not null check (length(trim(full_name)) > 0),
  email text,
  department text,
  designation text,
  role public.user_role not null default 'employee',
  status public.employee_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger employees_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Devices (registered Windows computers)
-- ---------------------------------------------------------------------------
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  label text not null,
  platform text not null default 'windows' check (platform = 'windows'),
  os_version text not null,
  app_version text not null,
  trust public.device_trust not null default 'pending',
  last_seen_at timestamptz,
  registered_at timestamptz not null default now()
);

create index devices_employee_id_idx on public.devices (employee_id);

-- ---------------------------------------------------------------------------
-- Attendance records (one per employee per shift)
-- shift_date = office-local date on which the shift STARTS (night shifts cross midnight).
-- ---------------------------------------------------------------------------
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  shift_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  status public.attendance_status not null default 'pending',
  late_by_minutes integer not null default 0 check (late_by_minutes >= 0),
  active_seconds integer not null default 0 check (active_seconds >= 0),
  idle_seconds integer not null default 0 check (idle_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, shift_date),
  constraint check_out_after_check_in check (check_out_at is null or check_in_at is null or check_out_at >= check_in_at)
);

create index attendance_records_shift_date_idx on public.attendance_records (shift_date);

create trigger attendance_records_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Activity transitions (Active / Idle / Offline ONLY)
-- ---------------------------------------------------------------------------
create table public.activity_transitions (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.employees (id) on delete cascade,
  device_id uuid not null references public.devices (id) on delete cascade,
  from_state public.activity_state not null,
  to_state public.activity_state not null,
  -- Server-assigned time. Clients cannot set this (no client insert policy).
  occurred_at timestamptz not null default now(),
  constraint state_changes check (from_state <> to_state)
);

create index activity_transitions_employee_time_idx
  on public.activity_transitions (employee_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- SECURITY DEFINER so policies can read employees without recursive RLS checks.
-- ---------------------------------------------------------------------------
create function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.employees e
  where e.auth_user_id = auth.uid() and e.status = 'active'
$$;

create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select e.role
  from public.employees e
  where e.auth_user_id = auth.uid() and e.status = 'active'
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('super_admin', 'admin'), false)
$$;

create function public.is_staff_viewer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('super_admin', 'admin', 'manager'), false)
$$;

revoke all on function public.current_employee_id() from public, anon;
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_staff_viewer() from public, anon;
grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff_viewer() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Every table has RLS enabled. Anonymous users get nothing.
-- ---------------------------------------------------------------------------
alter table public.office_settings enable row level security;
alter table public.employees enable row level security;
alter table public.devices enable row level security;
alter table public.attendance_records enable row level security;
alter table public.activity_transitions enable row level security;

revoke all on public.office_settings, public.employees, public.devices,
  public.attendance_records, public.activity_transitions from anon;

-- office_settings: any signed-in active employee may read; only admins may change.
create policy office_settings_select on public.office_settings
  for select to authenticated
  using (public.current_employee_id() is not null);

create policy office_settings_update on public.office_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- employees: read own profile; managers/admins read all; admins manage.
create policy employees_select on public.employees
  for select to authenticated
  using (id = public.current_employee_id() or public.is_staff_viewer());

create policy employees_admin_insert on public.employees
  for insert to authenticated
  with check (public.is_admin());

create policy employees_admin_update on public.employees
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- devices: read own; managers/admins read all; admins change trust.
create policy devices_select on public.devices
  for select to authenticated
  using (employee_id = public.current_employee_id() or public.is_staff_viewer());

create policy devices_admin_update on public.devices
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- attendance_records: read own; managers/admins read all. Writes are server-side only.
create policy attendance_select on public.attendance_records
  for select to authenticated
  using (employee_id = public.current_employee_id() or public.is_staff_viewer());

-- activity_transitions: read own; managers/admins read all. Writes are server-side only.
create policy activity_select on public.activity_transitions
  for select to authenticated
  using (employee_id = public.current_employee_id() or public.is_staff_viewer());
