// Offline verification of the PBS Attend schema: applies every migration plus seed.sql
// to an in-memory Postgres (PGlite) and checks RLS behaviour, privilege-escalation
// guards, audit logging, login throttling and constraints.
// It never connects to any Supabase project or network database.
// Run: pnpm db:verify
//
// Supabase-specific pieces (roles, auth schema, auth.uid()) are stubbed below.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { ROLE_PERMISSIONS } from "../../packages/shared/src/permissions.ts";

const supabaseDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(supabaseDir, "migrations");
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const seedPath = join(supabaseDir, "seed.sql");

const db = new PGlite();
let failures = 0;
let total = 0;
let section = "";
const ok = (cond, msg) => {
  total++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};
const heading = (name) => {
  section = name;
  console.log(`\n# ${section}`);
};

// --- Supabase stand-ins -------------------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  -- Supabase default privileges: broad table grants, then restricted by RLS/revokes.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);

// --- Apply migrations + seed -----------------------------------------------------
heading("Migrations");
for (const file of migrations) {
  await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  ok(true, `applied ${file}`);
}
await db.exec(readFileSync(seedPath, "utf8"));
await db.exec(readFileSync(seedPath, "utf8")); // idempotent

heading("Seed & structure");
const settings = (await db.query("select * from public.office_settings")).rows;
ok(settings.length === 1, "seed creates exactly one office_settings row (idempotent)");
const s = settings[0];
ok(
  s.timezone === "Asia/Karachi" && s.shift_start === "21:00:00" && s.late_threshold === "21:15:00",
  "office settings: Asia/Karachi, 21:00 shift, 21:15 late threshold",
);
ok(
  s.idle_detection_seconds === 60 &&
    s.heartbeat_interval_seconds === 30 &&
    s.offline_threshold_seconds === 90,
  "office settings: idle 60s, heartbeat 30s, offline 90s",
);

const tables = (
  await db.query(
    "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname",
  )
).rows;
ok(
  tables.every((r) => r.relrowsecurity),
  `RLS enabled on all ${tables.length} tables (${tables.map((t) => t.relname).join(", ")})`,
);
for (const t of [
  "profiles",
  "employees",
  "office_settings",
  "permissions",
  "role_permissions",
  "audit_logs",
  "auth_login_throttle",
]) {
  ok(
    tables.some((r) => r.relname === t),
    `table exists: ${t}`,
  );
}

const dbPerms = (
  await db.query("select role::text as role, permission from public.role_permissions")
).rows;
const dbMap = {};
for (const r of dbPerms) (dbMap[r.role] ??= []).push(r.permission);
const same = Object.entries(ROLE_PERMISSIONS).every(
  ([role, perms]) => [...perms].sort().join(",") === [...(dbMap[role] ?? [])].sort().join(","),
);
ok(same, "role_permissions in SQL matches packages/shared ROLE_PERMISSIONS");

const sensitiveCols = (
  await db.query(
    "select table_name, column_name from information_schema.columns where table_schema = 'public' and column_name ~* '(keystroke|screenshot|window_title|url|password|screen|token|secret)'",
  )
).rows;
ok(
  sensitiveCols.length === 0,
  "no surveillance, password, token or secret columns in public schema",
);

// --- Fictional fixtures (as superuser, like trusted server code) -------------------
const ID = {
  superAdmin: "00000000-0000-0000-0000-0000000000a0",
  admin: "00000000-0000-0000-0000-0000000000a1",
  manager: "00000000-0000-0000-0000-0000000000a2",
  emp1: "00000000-0000-0000-0000-000000000001",
  emp2: "00000000-0000-0000-0000-000000000002",
  emp3: "00000000-0000-0000-0000-000000000003",
};
await db.exec(`
  insert into auth.users (id) values ${Object.values(ID)
    .map((id) => `('${id}')`)
    .join(", ")};
  insert into public.profiles (id, role, display_name) values
    ('${ID.superAdmin}', 'super_admin', 'Demo Super Admin'),
    ('${ID.admin}', 'admin', 'Demo Admin'),
    ('${ID.manager}', 'manager', 'Demo Manager'),
    ('${ID.emp1}', 'employee', 'Demo Employee One'),
    ('${ID.emp2}', 'employee', 'Demo Employee Two'),
    ('${ID.emp3}', 'employee', 'Demo Employee Three');
  insert into public.employees (profile_id, employee_code, full_name) values
    ('${ID.emp1}', 'PBS-9001', 'Demo Employee One'),
    ('${ID.emp2}', 'PBS-9002', 'Demo Employee Two'),
    ('${ID.emp3}', 'PBS-9003', 'Demo Employee Three');
  insert into public.devices (employee_id, label, os_version, app_version)
    select id, 'PC-' || employee_code, 'Windows 11', '0.1.0' from public.employees;
  insert into public.attendance_records (employee_id, shift_date, status)
    select id, '2026-11-06', 'on_time' from public.employees;
`);

/** Runs SQL as a role with an optional JWT subject; returns rows or the error message. */
async function as(role, sub, sql) {
  await db.exec(
    `set role ${role}; select set_config('request.jwt.claim.sub', '${sub ?? ""}', false);`,
  );
  try {
    return { rows: (await db.query(sql)).rows };
  } catch (e) {
    return { error: e.message, rows: [] };
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  }
}
const denied = (r) => r.error !== undefined || r.rows.length === 0;

// --- Anonymous ---------------------------------------------------------------------------
heading("Anonymous access (deny by default)");
for (const t of [
  "profiles",
  "employees",
  "office_settings",
  "audit_logs",
  "auth_login_throttle",
  "attendance_records",
  "role_permissions",
]) {
  ok(denied(await as("anon", null, `select * from public.${t}`)), `anon cannot read ${t}`);
}
ok(
  (await as("anon", null, "select public.has_permission('employees.read') as p")).error !==
    undefined,
  "anon cannot call authorization helpers",
);

// --- Employee data isolation -----------------------------------------------------------
heading("Employee data isolation");
let r = await as("authenticated", ID.emp1, "select employee_code from public.employees");
ok(
  r.rows.length === 1 && r.rows[0].employee_code === "PBS-9001",
  "employee sees only own employee record",
);
r = await as("authenticated", ID.emp1, "select id from public.profiles");
ok(r.rows.length === 1 && r.rows[0].id === ID.emp1, "employee sees only own profile");
r = await as("authenticated", ID.emp1, "select * from public.attendance_records");
ok(r.rows.length === 1, "employee sees only own attendance");
r = await as("authenticated", ID.emp1, "select * from public.devices");
ok(r.rows.length === 1, "employee sees only own device");
r = await as(
  "authenticated",
  ID.emp1,
  `select * from public.employees where profile_id = '${ID.emp2}'`,
);
ok(r.rows.length === 0, "employee cannot read another employee by id");
r = await as("authenticated", ID.emp1, "select * from public.office_settings");
ok(r.rows.length === 1, "employee can read office settings");
ok(
  denied(await as("authenticated", ID.emp1, "select * from public.audit_logs")),
  "employee cannot read audit log",
);
ok(
  denied(await as("authenticated", ID.emp1, "select * from public.auth_login_throttle")),
  "employee cannot read login throttle state",
);

// --- Privilege escalation attempts --------------------------------------------------------
heading("Privilege escalation attempts");
r = await as(
  "authenticated",
  ID.emp1,
  `update public.profiles set role = 'super_admin' where id = '${ID.emp1}' returning id`,
);
ok(denied(r), "employee cannot promote themselves");
r = await as(
  "authenticated",
  ID.emp1,
  `update public.profiles set status = 'active' where id = '${ID.emp2}' returning id`,
);
ok(denied(r), "employee cannot change another account");
r = await as(
  "authenticated",
  ID.emp1,
  `insert into public.profiles (id, role, display_name) values ('${ID.emp1}', 'admin', 'x') returning id`,
);
ok(denied(r), "employee cannot insert profiles");
r = await as(
  "authenticated",
  ID.emp1,
  "insert into public.role_permissions (role, permission) values ('employee', 'settings.manage') returning role",
);
ok(denied(r), "employee cannot grant permissions to their role");
r = await as(
  "authenticated",
  ID.emp1,
  `update public.employees set profile_id = '${ID.superAdmin}' returning id`,
);
ok(denied(r), "employee cannot remap employee identity");
r = await as(
  "authenticated",
  ID.emp1,
  "insert into public.audit_logs (action) values ('fake.event') returning id",
);
ok(denied(r), "employee cannot write audit log");
r = await as(
  "authenticated",
  ID.emp1,
  "update public.attendance_records set status = 'on_time' returning id",
);
ok(denied(r), "employee cannot edit attendance");
r = await as(
  "authenticated",
  ID.emp1,
  "update public.office_settings set late_threshold = '23:00' returning id",
);
ok(denied(r), "employee cannot change office settings");
r = await as("authenticated", ID.emp1, "select public.auth_throttle_reset(repeat('a', 64))");
ok(r.error !== undefined, "employee cannot call throttle functions");
r = await as(
  "authenticated",
  ID.manager,
  `update public.profiles set role = 'admin' where id = '${ID.manager}' returning id`,
);
ok(denied(r), "manager cannot promote themselves");
r = await as(
  "authenticated",
  ID.manager,
  `update public.profiles set status = 'suspended' where id = '${ID.emp1}' returning id`,
);
ok(denied(r), "manager cannot suspend employees (no employees.manage)");
r = await as(
  "authenticated",
  ID.admin,
  `update public.profiles set role = 'admin' where id = '${ID.emp1}' returning id`,
);
ok(denied(r), "admin cannot grant admin role (super admin only)");
r = await as(
  "authenticated",
  ID.admin,
  `update public.profiles set role = 'employee' where id = '${ID.superAdmin}' returning id`,
);
ok(denied(r), "admin cannot demote a super admin");
r = await as(
  "authenticated",
  ID.admin,
  `update public.profiles set status = 'suspended' where id = '${ID.admin}' returning id`,
);
ok(denied(r), "admin cannot change their own status");
r = await as(
  "authenticated",
  ID.admin,
  `update public.employees set profile_id = '${ID.emp2}' where profile_id = '${ID.emp1}' returning id`,
);
ok(denied(r), "admin cannot remap employee identity");
r = await as(
  "authenticated",
  ID.admin,
  "insert into public.employees (profile_id, employee_code, full_name) values ('00000000-0000-0000-0000-0000000000a2', 'PBS-9999', 'X') returning id",
);
ok(denied(r), "admin cannot insert employee rows directly (server-only)");

// --- Admin & manager permissions ------------------------------------------------------------
heading("Admin and manager permissions");
r = await as("authenticated", ID.manager, "select * from public.employees");
ok(r.rows.length === 3, "manager can read all employees");
r = await as("authenticated", ID.manager, "select * from public.attendance_records");
ok(r.rows.length === 3, "manager can read all attendance");
ok(
  denied(await as("authenticated", ID.manager, "select * from public.audit_logs")),
  "manager cannot read audit log",
);
r = await as(
  "authenticated",
  ID.manager,
  "update public.office_settings set idle_detection_seconds = 60 returning id",
);
ok(denied(r), "manager cannot change office settings");
r = await as(
  "authenticated",
  ID.admin,
  "update public.office_settings set idle_detection_seconds = 75 returning id",
);
ok(r.rows.length === 1, "admin can update office settings");
r = await as(
  "authenticated",
  ID.admin,
  `update public.profiles set status = 'suspended' where id = '${ID.emp3}' returning id`,
);
ok(r.rows.length === 1, "admin can suspend an employee");
r = await as(
  "authenticated",
  ID.admin,
  "update public.employees set designation = 'QA Engineer' where employee_code = 'PBS-9002' returning id",
);
ok(r.rows.length === 1, "admin can edit employee HR details");
r = await as(
  "authenticated",
  ID.superAdmin,
  `update public.profiles set role = 'manager' where id = '${ID.emp2}' returning id`,
);
ok(r.rows.length === 1, "super admin can grant the manager role");
await db.exec(`update public.profiles set role = 'employee' where id = '${ID.emp2}'`);

// --- Suspended accounts --------------------------------------------------------------------------
heading("Suspended accounts");
r = await as("authenticated", ID.emp3, "select * from public.employees");
ok(r.rows.length === 0, "suspended employee cannot read own employee record");
r = await as("authenticated", ID.emp3, "select * from public.attendance_records");
ok(r.rows.length === 0, "suspended employee cannot read attendance");
r = await as("authenticated", ID.emp3, "select * from public.office_settings");
ok(r.rows.length === 0, "suspended employee cannot read settings");
await db.exec(
  `update public.profiles set role = 'admin', status = 'suspended' where id = '${ID.emp2}'`,
);
r = await as("authenticated", ID.emp2, "select * from public.employees");
ok(r.rows.length === 0, "suspended admin loses all admin access");
await db.exec(
  `update public.profiles set role = 'employee', status = 'active' where id = '${ID.emp2}'`,
);

// --- Audit log --------------------------------------------------------------------------------------
heading("Audit log");
const auditReadGrant = (
  await db.query(
    "select has_table_privilege('service_role', 'public.audit_logs', 'SELECT') as allowed",
  )
).rows[0]?.allowed;
ok(auditReadGrant, "service_role can read audit logs for the authorized admin activity feed");
const audit = (
  await db.query("select action, actor_profile_id, target_id from public.audit_logs order by id")
).rows;
ok(
  audit.some(
    (a) =>
      a.action === "profile.status_changed" &&
      a.actor_profile_id === ID.admin &&
      a.target_id === ID.emp3,
  ),
  "suspension is audited with the acting admin",
);
ok(
  audit.some((a) => a.action === "profile.role_changed" && a.actor_profile_id === ID.superAdmin),
  "role change is audited with the acting super admin",
);
ok(
  audit.some((a) => a.action === "settings.updated" && a.actor_profile_id === ID.admin),
  "settings change is audited",
);
ok(
  (await db.query("select updated_by from public.office_settings")).rows[0].updated_by === ID.admin,
  "office_settings.updated_by stamped server-side",
);
r = await as("authenticated", ID.admin, "select * from public.audit_logs");
ok(r.rows.length >= 3, "admin can read audit log");
let blocked = false;
try {
  await db.exec("update public.audit_logs set action = 'tampered.event'");
} catch {
  blocked = true;
}
ok(blocked, "audit log rows cannot be updated (even by the database owner)");
blocked = false;
try {
  await db.exec("delete from public.audit_logs");
} catch {
  blocked = true;
}
ok(blocked, "audit log rows cannot be deleted");

// --- Login throttling (service role only) ---------------------------------------------------------
heading("Login throttling");
const key = "a".repeat(64);
const svc = (sql) => as("service_role", null, sql);
let lockedAt = null;
for (let i = 1; i <= 5; i++) {
  const res = await svc(`select public.auth_throttle_fail('${key}', 5, 900, 900) as locked`);
  if (i < 5) ok(res.rows[0]?.locked === null, `failure ${i}/5 does not lock`);
  else lockedAt = res.rows[0]?.locked;
}
ok(lockedAt !== null, "5th failure locks the key");
r = await svc(`select public.auth_throttle_status('${key}') as locked`);
ok(r.rows[0]?.locked !== null, "status reports the lock");
await svc(`select public.auth_throttle_reset('${key}')`);
r = await svc(`select public.auth_throttle_status('${key}') as locked`);
ok(r.rows[0]?.locked === null, "reset clears the lock");
ok(
  (await svc("select public.auth_throttle_status('not-a-hash')")).rows.length === 1,
  "status with unknown key returns no lock",
);
r = await svc("select public.auth_throttle_fail('NOT-A-HASH', 5, 900, 900)");
ok(r.error !== undefined, "throttle keys must be SHA-256 hex (raw identifiers rejected)");

// --- Constraints --------------------------------------------------------------------------------------------
heading("Constraints");
const rejects = async (sql) => {
  try {
    await db.exec(sql);
    return false;
  } catch {
    return true;
  }
};
ok(
  await rejects(
    `insert into public.employees (profile_id, employee_code, full_name) values ('${ID.manager}', 'BAD-1', 'X')`,
  ),
  "invalid employee code rejected",
);
ok(
  await rejects(
    `insert into public.employees (profile_id, employee_code, full_name) values ('${ID.manager}', 'pbs-0001', 'X')`,
  ),
  "lower-case employee code rejected",
);
ok(
  await rejects(
    `insert into public.employees (profile_id, employee_code, full_name) values ('${ID.emp1}', 'PBS-0077', 'X')`,
  ),
  "one employee record per identity",
);
ok(
  await rejects(`insert into public.employees (employee_code, full_name) values ('PBS-0078', 'X')`),
  "employee without identity rejected",
);
ok(
  await rejects(
    `insert into public.office_settings (id, company_name, timezone, shift_start, late_threshold, idle_detection_seconds, heartbeat_interval_seconds, offline_threshold_seconds) values (false,'x','UTC','21:00','21:15',60,30,90)`,
  ),
  "second office_settings row rejected",
);
ok(
  await rejects(`update public.office_settings set offline_threshold_seconds = 20`),
  "offline threshold must exceed heartbeat interval",
);
ok(
  await rejects(`insert into public.audit_logs (action) values ('Not An Action')`),
  "malformed audit action rejected",
);

console.log(
  failures === 0 ? `\nALL ${total} CHECKS PASSED` : `\n${failures} OF ${total} CHECK(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
