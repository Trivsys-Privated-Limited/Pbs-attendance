-- PBS Attend — Phase 2: authentication & authorization foundation.
--
-- Evolves the initial schema:
--   * profiles: one row per Supabase Auth identity (admins AND employees). Holds the
--     authoritative role and account status. Never derived from client-editable metadata.
--   * employees: HR record linked 1:1 to a profile (secure Employee ID -> identity mapping).
--     role/status move to profiles; auth_user_id becomes profile_id.
--   * permissions + role_permissions: role-based access control used by RLS and the server.
--   * audit_logs: append-only security log.
--   * auth_login_throttle: server-only brute-force protection state.
--
-- Default deny: RLS on every table, no anon access, and no client write paths for
-- identity, roles, audit or throttle data.

-- ---------------------------------------------------------------------------
-- 1. Account status type (renamed: it now applies to every account, not only employees)
-- ---------------------------------------------------------------------------
alter type public.employee_status rename to account_status;

-- ---------------------------------------------------------------------------
-- 2. Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'employee',
  status public.account_status not null default 'active',
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per Supabase Auth identity. role and status are authoritative for authorization and are only changed by privileged server code or admins (guarded by trigger).';

create index profiles_role_idx on public.profiles (role);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Carry over any existing employee identities (none exist outside local test data).
insert into public.profiles (id, role, status, display_name)
select e.auth_user_id, e.role, e.status, e.full_name
from public.employees e
where e.auth_user_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Drop Phase 1 policies and helpers (rebuilt below on top of profiles + permissions)
-- ---------------------------------------------------------------------------
drop policy office_settings_select on public.office_settings;
drop policy office_settings_update on public.office_settings;
drop policy employees_select on public.employees;
drop policy employees_admin_insert on public.employees;
drop policy employees_admin_update on public.employees;
drop policy devices_select on public.devices;
drop policy devices_admin_update on public.devices;
drop policy attendance_select on public.attendance_records;
drop policy activity_select on public.activity_transitions;

drop function public.is_admin();
drop function public.is_staff_viewer();
drop function public.current_employee_id();
drop function public.current_user_role();

-- ---------------------------------------------------------------------------
-- 4. Employees: secure identity mapping
-- ---------------------------------------------------------------------------
alter table public.employees add column profile_id uuid;
update public.employees set profile_id = auth_user_id;

-- Every employee must have exactly one login identity.
delete from public.employees where profile_id is null;

alter table public.employees
  alter column profile_id set not null,
  add constraint employees_profile_id_key unique (profile_id),
  add constraint employees_profile_id_fkey
    foreign key (profile_id) references public.profiles (id) on delete restrict,
  drop column auth_user_id,
  drop column role,
  drop column status;

-- Employee IDs are stored upper-case so lookups are exact and unambiguous.
alter table public.employees
  add constraint employees_code_uppercase check (employee_code = upper(employee_code));

comment on column public.employees.employee_code is
  'Login identifier (PBS-0000). Resolved to the Auth identity ONLY by server-side code using the service role.';

alter table public.office_settings
  add column updated_by uuid references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 5. Roles & permissions
-- ---------------------------------------------------------------------------
create table public.permissions (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  description text not null
);

create table public.role_permissions (
  role public.user_role not null,
  permission text not null references public.permissions (key) on delete cascade,
  primary key (role, permission)
);

-- Keep in sync with packages/shared/src/permissions.ts (verified by pnpm db:verify).
insert into public.permissions (key, description) values
  ('admin_portal.access', 'Sign in to the admin web application'),
  ('employees.read', 'View all employee profiles'),
  ('employees.manage', 'Create, edit and suspend employee accounts'),
  ('attendance.read_all', 'View attendance and activity of all employees'),
  ('devices.read_all', 'View all registered devices'),
  ('devices.manage', 'Approve or revoke devices'),
  ('settings.manage', 'Change office settings'),
  ('audit.read', 'Read the security audit log'),
  ('roles.manage_admins', 'Grant or revoke admin and manager roles');

insert into public.role_permissions (role, permission) values
  ('super_admin', 'admin_portal.access'),
  ('super_admin', 'employees.read'),
  ('super_admin', 'employees.manage'),
  ('super_admin', 'attendance.read_all'),
  ('super_admin', 'devices.read_all'),
  ('super_admin', 'devices.manage'),
  ('super_admin', 'settings.manage'),
  ('super_admin', 'audit.read'),
  ('super_admin', 'roles.manage_admins'),
  ('admin', 'admin_portal.access'),
  ('admin', 'employees.read'),
  ('admin', 'employees.manage'),
  ('admin', 'attendance.read_all'),
  ('admin', 'devices.read_all'),
  ('admin', 'devices.manage'),
  ('admin', 'settings.manage'),
  ('admin', 'audit.read'),
  ('manager', 'admin_portal.access'),
  ('manager', 'employees.read'),
  ('manager', 'attendance.read_all'),
  ('manager', 'devices.read_all');

-- ---------------------------------------------------------------------------
-- 6. Authorization helpers (SECURITY DEFINER, empty search_path, not callable by anon)
-- ---------------------------------------------------------------------------

-- The caller's profile id, only if the account is active.
create function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p
  where p.id = auth.uid() and p.status = 'active'
$$;

create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = auth.uid() and p.status = 'active'
$$;

-- The caller's employee record id, only if their account is active.
create function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.employees e
  join public.profiles p on p.id = e.profile_id
  where p.id = auth.uid() and p.status = 'active'
$$;

create function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role = p.role
    where p.id = auth.uid()
      and p.status = 'active'
      and rp.permission = p_permission
  )
$$;

revoke all on function public.current_profile_id() from public, anon;
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.current_employee_id() from public, anon;
revoke all on function public.has_permission(text) from public, anon;
grant execute on function public.current_profile_id() to authenticated, service_role;
grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.current_employee_id() to authenticated, service_role;
grant execute on function public.has_permission(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Audit log (append-only)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_profile_id uuid references public.profiles (id) on delete set null,
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  target_type text,
  target_id text,
  ip_address inet,
  user_agent text check (user_agent is null or length(user_agent) <= 512),
  metadata jsonb not null default '{}'::jsonb check (pg_column_size(metadata) <= 8192)
);

comment on table public.audit_logs is
  'Append-only security audit log. Never store passwords, tokens or other secrets in metadata.';

create index audit_logs_occurred_at_idx on public.audit_logs (occurred_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_profile_id, occurred_at desc);
create index audit_logs_action_idx on public.audit_logs (action, occurred_at desc);

create function public.audit_logs_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

create trigger audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.audit_logs_immutable();

-- ---------------------------------------------------------------------------
-- 8. Privilege-escalation guard + automatic auditing on profiles
-- ---------------------------------------------------------------------------
-- Requests from signed-in users (auth.uid() not null) may only change role/status when:
--   * they are not changing their own account,
--   * they hold employees.manage, and
--   * any change involving admin-level roles (super_admin/admin/manager) is made by a
--     holder of roles.manage_admins (super_admin).
-- Trusted server code using the service role (auth.uid() is null) is not restricted here;
-- it performs its own authorization checks before acting.
create function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_privileged constant public.user_role[] := array['super_admin', 'admin', 'manager']::public.user_role[];
begin
  if v_actor is null then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'profile id cannot change' using errcode = '42501';
  end if;

  if new.role is distinct from old.role or new.status is distinct from old.status then
    if v_actor = old.id then
      raise exception 'cannot change your own role or status' using errcode = '42501';
    end if;
    if not public.has_permission('employees.manage') then
      raise exception 'not allowed to change role or status' using errcode = '42501';
    end if;
    if (old.role = any (v_privileged) or new.role = any (v_privileged))
       and not public.has_permission('roles.manage_admins') then
      raise exception 'only a super admin can change admin-level accounts' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

create function public.profiles_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    insert into public.audit_logs (actor_profile_id, action, target_type, target_id, metadata)
    values (auth.uid(), 'profile.role_changed', 'profile', new.id::text,
            jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  if new.status is distinct from old.status then
    insert into public.audit_logs (actor_profile_id, action, target_type, target_id, metadata)
    values (auth.uid(), 'profile.status_changed', 'profile', new.id::text,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;

create trigger profiles_audit
  after update on public.profiles
  for each row execute function public.profiles_audit();

-- employees.profile_id is the identity mapping: only trusted server code may change it.
create function public.employees_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and new.profile_id is distinct from old.profile_id then
    raise exception 'employee identity mapping cannot be changed' using errcode = '42501';
  end if;
  new.employee_code := upper(new.employee_code);
  return new;
end;
$$;

create trigger employees_guard
  before update on public.employees
  for each row execute function public.employees_guard();

create function public.office_settings_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'settings.updated', 'office_settings', 'singleton',
          jsonb_build_object('before', to_jsonb(old) - 'updated_at', 'after', to_jsonb(new) - 'updated_at'));
  return new;
end;
$$;

create trigger office_settings_audit
  after update on public.office_settings
  for each row execute function public.office_settings_audit();

create function public.office_settings_stamp_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger office_settings_stamp_actor
  before update on public.office_settings
  for each row execute function public.office_settings_stamp_actor();

-- ---------------------------------------------------------------------------
-- 9. Login throttling (server-only)
-- Keys are SHA-256 hashes computed by the server (never raw Employee IDs or IPs).
-- ---------------------------------------------------------------------------
create table public.auth_login_throttle (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  failures integer not null default 0 check (failures >= 0),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);

create function public.auth_throttle_status(p_key_hash text)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select t.locked_until
  from public.auth_login_throttle t
  where t.key_hash = p_key_hash and t.locked_until > now()
$$;

create function public.auth_throttle_fail(
  p_key_hash text,
  p_max_failures integer,
  p_window_seconds integer,
  p_lock_seconds integer
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.auth_login_throttle;
begin
  insert into public.auth_login_throttle as t (key_hash, failures, window_started_at)
  values (p_key_hash, 1, now())
  on conflict (key_hash) do update
    set failures = case
          when t.window_started_at < now() - make_interval(secs => p_window_seconds) then 1
          else t.failures + 1
        end,
        window_started_at = case
          when t.window_started_at < now() - make_interval(secs => p_window_seconds) then now()
          else t.window_started_at
        end
  returning * into v_row;

  if v_row.failures >= p_max_failures then
    update public.auth_login_throttle
      set locked_until = now() + make_interval(secs => p_lock_seconds),
          failures = 0,
          window_started_at = now()
      where key_hash = p_key_hash
      returning * into v_row;
  end if;

  return case when v_row.locked_until > now() then v_row.locked_until end;
end;
$$;

create function public.auth_throttle_reset(p_key_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.auth_login_throttle where key_hash = p_key_hash
$$;

revoke all on function public.auth_throttle_status(text) from public, anon, authenticated;
revoke all on function public.auth_throttle_fail(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.auth_throttle_reset(text) from public, anon, authenticated;
grant execute on function public.auth_throttle_status(text) to service_role;
grant execute on function public.auth_throttle_fail(text, integer, integer, integer) to service_role;
grant execute on function public.auth_throttle_reset(text) to service_role;

-- ---------------------------------------------------------------------------
-- 10. Row Level Security (default deny)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.auth_login_throttle enable row level security;

revoke all on public.profiles, public.permissions, public.role_permissions,
  public.audit_logs, public.auth_login_throttle from anon;
-- Clients never write these directly.
revoke insert, update, delete, truncate on public.permissions, public.role_permissions,
  public.audit_logs from authenticated;
revoke all on public.auth_login_throttle from authenticated;
revoke insert, delete, truncate on public.profiles from authenticated;
-- Only role/status/display_name are ever updatable by clients (and still guarded).
revoke update on public.profiles from authenticated;
grant update (role, status, display_name) on public.profiles to authenticated;

-- profiles
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = public.current_profile_id() or public.has_permission('employees.read'));

create policy profiles_update on public.profiles
  for update to authenticated
  using (public.has_permission('employees.manage'))
  with check (public.has_permission('employees.manage'));

-- permissions catalogue: readable by signed-in users, writable by nobody.
create policy permissions_select on public.permissions
  for select to authenticated using (public.current_profile_id() is not null);

create policy role_permissions_select on public.role_permissions
  for select to authenticated using (public.current_profile_id() is not null);

-- audit log: readable with audit.read only.
create policy audit_logs_select on public.audit_logs
  for select to authenticated using (public.has_permission('audit.read'));

-- auth_login_throttle: no policies at all (service role only).

-- office_settings
create policy office_settings_select on public.office_settings
  for select to authenticated
  using (public.current_profile_id() is not null);

create policy office_settings_update on public.office_settings
  for update to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

-- employees
create policy employees_select on public.employees
  for select to authenticated
  using (profile_id = public.current_profile_id() or public.has_permission('employees.read'));

-- New employees (and their identity mapping) are created only by trusted server code
-- that also creates the Auth identity; clients cannot insert or delete employee rows.
revoke insert, delete, truncate on public.employees from authenticated;

create policy employees_update on public.employees
  for update to authenticated
  using (public.has_permission('employees.manage'))
  with check (public.has_permission('employees.manage'));

-- devices
create policy devices_select on public.devices
  for select to authenticated
  using (employee_id = public.current_employee_id() or public.has_permission('devices.read_all'));

create policy devices_update on public.devices
  for update to authenticated
  using (public.has_permission('devices.manage'))
  with check (public.has_permission('devices.manage'));

-- attendance & activity: read-only for clients; written by trusted server code later.
create policy attendance_select on public.attendance_records
  for select to authenticated
  using (employee_id = public.current_employee_id() or public.has_permission('attendance.read_all'));

create policy activity_select on public.activity_transitions
  for select to authenticated
  using (employee_id = public.current_employee_id() or public.has_permission('attendance.read_all'));
