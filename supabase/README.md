# Supabase (LOCAL ONLY)

This folder is **not linked to any Supabase project**, and must stay that way until a
dedicated new development project is explicitly approved.

> **Never** run `supabase link`, `supabase db push`, `supabase db pull`, `supabase migration up --linked`
> or any command with `--project-ref` / `--db-url` from this repository. Existing Supabase
> projects owned by PBS Digitals must not be touched.

## Contents

| Path                                            | Purpose                                                    |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `config.toml`                                   | Local stack config (ports 54321–54324, public sign-up off) |
| `migrations/20261107000000_initial_schema.sql`  | Enums, core tables (Phase 1)                               |
| `migrations/20261107010000_auth_foundation.sql` | Profiles, RBAC, audit log, login throttle, guards, RLS     |
| `seed.sql`                                      | Initial office settings only (no users, no passwords)      |
| `tests/verify-schema.mjs`                       | Offline schema + RLS test (`pnpm db:verify`)               |
| `functions/`                                    | Edge Functions (later phase)                               |

## Schema summary

| Table                             | Holds                                      | Employee access | Admin / manager access            |
| --------------------------------- | ------------------------------------------ | --------------- | --------------------------------- |
| `office_settings`                 | Single row: shift, late threshold, timers  | Read            | Admin: read + update              |
| `profiles`                        | Auth identity: role + account status       | Own row         | Read all; admin writes (guarded)  |
| `employees`                       | HR record + Employee ID, linked to profile | Own row         | Read all; admin edits (no insert) |
| `permissions`, `role_permissions` | RBAC catalogue                             | Read            | Read (writes: migrations only)    |
| `audit_logs`                      | Append-only security log                   | None            | Admin: read                       |
| `auth_login_throttle`             | Hashed login-failure counters              | None            | None (service role only)          |
| `devices`                         | Registered Windows computers + trust state | Own devices     | Read all; admin writes            |
| `attendance_records`              | One row per employee per shift             | Own rows (read) | Read all                          |
| `activity_transitions`            | Active / Idle / Offline changes ONLY       | Own rows (read) | Read all                          |

- RLS is enabled on every table; the `anon` role has no access.
- Employees cannot write attendance or activity. Those rows will be written by trusted
  server-side code (later phase) using **server timestamps**.
- Suspended or archived employees lose all access automatically.
- There are no columns for keystrokes, screenshots, window titles, URLs, screen contents or
  passwords. Passwords are handled only by Supabase Auth (hashed).

## Verifying without Docker

```powershell
pnpm db:verify
```

Applies every migration and `seed.sql` to an in-memory Postgres (PGlite) with stand-ins
for Supabase roles and `auth.uid()`, then checks the RLS rules and constraints. No network
connection is made.

## Optional: full local stack (Docker)

Requires Docker Desktop and the Supabase CLI (not installed in Phase 1):

```powershell
supabase start      # local containers only
supabase db reset   # re-applies migrations + seed.sql to the LOCAL database
supabase stop
```

The local stack prints its own local URL and keys. These are development-only values. Do
not copy keys from any existing Supabase project into `.env` files.
