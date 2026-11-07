# PBS Attend: Authentication & Authorization (Phase 2)

## Principles

- **Server-controlled.** Browsers and the Electron renderer never talk to Supabase Auth
  directly and never hold a service key. All sign-ins go through server code in the admin
  app (`apps/admin/src/server/auth`).
- **Database is the source of truth for roles.** Role and account status are read from
  `public.profiles` on every request. Token metadata, request bodies and headers are never
  used to decide authorization.
- **Defense in depth.** The proxy redirects early. The dashboard layout and every API handler
  re-check identity and permission, and RLS enforces the same rules again in Postgres.
- **Generic failures.** Unknown Employee ID, wrong password, suspended account and wrong role
  all return the same `INVALID_CREDENTIALS` error, with a minimum response time of 600 ms.

## Identities

| Who      | Signs in with          | Supabase Auth identity                                       |
| -------- | ---------------------- | ------------------------------------------------------------ |
| Admin    | Email + password       | Their real email                                             |
| Manager  | Email + password       | Their real email                                             |
| Employee | Employee ID + password | Internal email `<profile-uuid>@<EMPLOYEE_AUTH_EMAIL_DOMAIN>` |

**Employee ID mapping:** `employees.employee_code` → `employees.profile_id` → `profiles.id`
(= `auth.users.id`). The server resolves the code with the service role, derives the internal
email from the profile id, and asks Supabase Auth to verify the password. Employees never see
the internal email, and it cannot be guessed from the Employee ID. Passwords are hashed by
Supabase Auth only.

## Flows

### Employee login (desktop)

```
Renderer ──IPC(auth:login)──▶ Electron MAIN ──HTTPS POST /api/v1/auth/employee-login──▶ Admin server
                                                                     │ 1. zod validation
                                                                     │ 2. throttle check (per ID + per IP)
                                                                     │ 3. Employee ID → profile (service role)
                                                                     │ 4. Supabase Auth password check
                                                                     │ 5. profile active? else revoke + generic error
                                                                     │ 6. audit, reset ID throttle
Renderer ◀── {employeeCode, fullName} ── MAIN keeps tokens in memory ◀── {employee, session}
```

- Tokens stay in the **main process** memory. The renderer only receives name and Employee ID.
- MAIN refreshes the session 60 s before the access token expires
  (`POST /api/v1/auth/refresh`). The server re-checks that the account is active and is
  an employee; otherwise the session ends and the renderer returns to the login screen.
- Logout: `POST /api/v1/auth/logout` with the bearer token revokes the session server-side.
  The app also revokes on quit.

### Admin login (web)

1. Server Action `signInAdmin` → `AuthService.loginAdmin` (same throttling, generic errors).
2. Requires an active profile with `admin_portal.access` (super_admin, admin, manager).
   Employee identities are rejected and their new session revoked.
3. Session stored in HTTP-only cookies via `@supabase/ssr`, plus `pbs_admin_session`: an
   HMAC-signed stamp of the sign-in time.
4. `src/proxy.ts` refreshes cookies and redirects when there is no user, or when the stamp is
   missing, forged or older than `ADMIN_SESSION_MAX_AGE_HOURS` (default 12).
5. `(dashboard)/layout.tsx` → `requireAdmin()` re-verifies the user with Supabase Auth, checks
   the stamp and loads the profile. Pages are always rendered dynamically.
6. Sign out (Server Action) revokes the session, clears Supabase cookies and the stamp, and is
   audited.

## Throttling

| Key (HMAC-SHA256 with `SESSION_SECRET`)          | Limit                              |
| ------------------------------------------------ | ---------------------------------- |
| Employee ID / admin email                        | 5 failures / 15 min → 15 min lock  |
| Client IP (only with `TRUST_PROXY_HEADERS=true`) | 30 failures / 15 min → 15 min lock |

State lives in `public.auth_login_throttle` (service role only), so limits hold across server
instances. If the limiter cannot be reached, login fails closed with `SERVICE_UNAVAILABLE`.
Supabase Auth's own rate limits apply in addition.

## Permissions

| Permission          | super_admin | admin | manager | employee |
| ------------------- | :---------: | :---: | :-----: | :------: |
| admin_portal.access |      ✔      |   ✔   |    ✔    |          |
| employees.read      |      ✔      |   ✔   |    ✔    |          |
| employees.manage    |      ✔      |   ✔   |         |          |
| attendance.read_all |      ✔      |   ✔   |    ✔    |          |
| devices.read_all    |      ✔      |   ✔   |    ✔    |          |
| devices.manage      |      ✔      |   ✔   |         |          |
| settings.manage     |      ✔      |   ✔   |         |          |
| audit.read          |      ✔      |   ✔   |         |          |
| roles.manage_admins |      ✔      |       |         |          |

Employees can always read **their own** profile, employee record, devices, attendance and
activity. Defined in `packages/shared/src/permissions.ts` and mirrored in SQL. `pnpm db:verify`
fails if they differ.

## API (Phase 2)

| Method & path                      | Auth                                                    | Purpose                              |
| ---------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| POST `/api/v1/auth/employee-login` | none                                                    | Employee ID + password → session     |
| POST `/api/v1/auth/refresh`        | refresh token in body                                   | Rotate session (re-checks status)    |
| POST `/api/v1/auth/logout`         | Bearer                                                  | Revoke session                       |
| GET `/api/v1/auth/me`              | Bearer or admin cookie                                  | Current user (name, role)            |
| POST `/api/v1/admin/employees`     | Bearer or same-origin admin cookie + `employees.manage` | Create employee identity (no UI yet) |

All responses are `Cache-Control: no-store` and JSON-only (415 otherwise), with a 4 KB body
limit. Cookie-authenticated mutations require a same-origin `Origin` header.

## Creating accounts

Successful employee sign-ins and explicit desktop sign-outs are written to the append-only
`public.audit_logs` table. Admins with `audit.read` can view the latest 50 events on Overview
through `GET /api/v1/admin/auth-events`.

- **First super admin:** `pnpm --filter @pbs-attend/admin bootstrap:super-admin -- --confirm-project=<ref>`
  (see [SUPABASE_SETUP.md](SUPABASE_SETUP.md)). It refuses if a super admin already exists.
- **Employees:** `POST /api/v1/admin/employees` by an admin. The server generates the identity
  id, so client-supplied ids are rejected. Only super admins can create manager/admin accounts.
  Passwords must be at least 12 characters with letters and digits.
  The Employees page creates active accounts using this endpoint; employees can then sign in to
  the desktop app with the entered Employee ID and initial password. Supabase Auth manages
  password hashes; the application database does not store passwords.
