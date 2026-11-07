# PBS Attend — Architecture

## Overview

```
┌──────────────────────┐        ┌──────────────────────────┐
│ Employee desktop app │        │ Admin web app (Next.js)  │
│ Electron + React     │        │ React Server Components  │
│ (Windows 10/11)      │        │ + server route handlers  │
└──────────┬───────────┘        └────────────┬─────────────┘
           │ HTTPS (employee session)        │ HTTPS (admin session)
           ▼                                 ▼
┌────────────────────────────────────────────────────────────┐
│ Server-side API  (Next.js route handlers / Edge Functions) │
│ • validates input with @pbs-attend/validation              │
│ • stamps trusted server time on every event                │
│ • computes attendance status (on time / late / absent)     │
└──────────────────────────┬─────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────┐
│ Supabase: PostgreSQL + Auth + Realtime + Row Level Security│
└────────────────────────────────────────────────────────────┘
```

Phase 1 built the two client UIs, the shared packages and a local-only schema. **Phase 2**
adds the server-side auth layer in the admin app (`apps/admin/src/server`), the auth/RBAC
migration, the desktop sign-in through the Electron main process, and tests. The code is
ready for Supabase but **no project is connected yet** (see [SUPABASE_SETUP.md](SUPABASE_SETUP.md)).

### Admin server layout (Phase 2)

```
apps/admin/src/
  proxy.ts                     early redirects + Supabase cookie refresh (not the authz boundary)
  app/login/actions.ts         signInAdmin (Server Action)
  app/(dashboard)/layout.tsx   requireAdmin(): authoritative page guard (force-dynamic)
  app/(dashboard)/actions.ts   signOutAdmin (Server Action)
  app/api/v1/auth/*            employee-login, refresh, logout, me
  app/api/v1/admin/employees   create employee identity (employees.manage)
  server/
    config.ts, env.ts          env schema (server-only secrets)
    auth/                      AuthService + ports, rate limit, session stamp, authorization
    supabase/                  clients (session, stateless, service-role) + port adapters
    http/                      framework-free API handlers, request context, route policy
```

The auth service depends only on interfaces (`server/auth/ports.ts`). Supabase adapters
implement them in production, and in-memory fakes implement them in tests. Details:
[AUTHENTICATION.md](AUTHENTICATION.md).

## Workspaces

### `packages/types`

Pure TypeScript types: `Employee`, `AttendanceRecord`, `ActivityTransition`,
`LiveEmployeeStatus`, `Device`, `OfficeConfig`, `UserRole`. No runtime code.

### `packages/validation`

zod 4 schemas used on both sides of the wire: `employeeLoginSchema` (Employee ID
`PBS-0000` + password), `adminLoginSchema`, `officeConfigSchema`,
`heartbeatPayloadSchema`. Client-side validation is for UX only; the server must re-validate.

### `packages/shared`

Runtime constants and helpers: `BRAND`, `MONITORING_DISCLOSURE`/`MONITORING_SCOPE`,
`DEFAULT_OFFICE_CONFIG`, typed `API` contracts (method + path + request/response types),
and display-only time formatting.

Workspace packages ship TypeScript source (`exports: ./src/index.ts`); each app's bundler
compiles them (`transpilePackages` in Next.js, Vite in Electron).

### `apps/admin`

- Next.js App Router, React 19, Tailwind CSS 4 with shadcn/ui-style primitives in
  `src/components/ui`, Lucide icons, Recharts.
- Routes: `/login`, and inside the `(dashboard)` route group: `/overview`,
  `/live-activity`, `/employees`, `/attendance`, `/late-arrivals`, `/reports`,
  `/devices`, `/settings`.
- Every section is a read-only preview built from `src/lib/demo-data.ts` (fictional,
  labeled with `DemoBanner`):

  | Route            | Preview                                                                  |
  | ---------------- | ------------------------------------------------------------------------ |
  | `/overview`      | Stat cards, weekly stacked bar chart, activity donut, recent check-ins   |
  | `/live-activity` | Active/Idle/Offline counts and per-employee status cards                 |
  | `/employees`     | Searchable table (client-side search), role and status badges            |
  | `/attendance`    | Shift attendance with check-in/out, status, active and idle time         |
  | `/late-arrivals` | Late summary cards and late check-ins sorted by delay                    |
  | `/reports`       | Department on-time rates and seven-shift trend chart                     |
  | `/devices`       | Device trust summary and registered device table                         |
  | `/settings`      | The **real** initial office config, read-only, plus the monitoring scope |

- Actions that need a backend (Add employee, Export, Save changes) are rendered visibly
  disabled (`PreviewAction`) instead of pretending to work.
- Shared loading (`loading.tsx`), error (`error.tsx`, `global-error.tsx`), empty-search and
  404 states.
- Baseline security headers in `next.config.ts`.

### `apps/desktop`

- electron-vite with three builds: `src/main` (main process), `src/preload` (sandboxed
  bridge), `src/renderer` (React UI).
- Main process: single-instance lock, tray icon with Open/Quit, close-to-tray, hardened
  session and windows (see [SECURITY.md](SECURITY.md)).
- Preload exposes a single typed API, `window.pbsAttend.getAppInfo()`.
- Renderer: employee login screen with the monitoring disclosure.
- Signed-in screens (My Attendance, My Activity Status, Settings, Logout) live in
  `src/renderer/src/preview/` and are reachable only in development builds through a
  clearly labeled preview with fictional data. They are lazy-loaded behind
  `import.meta.env.DEV`, so production bundles contain none of that code.
- `electron-builder.yml` is prepared for an NSIS installer (not built in Phase 1).

## Attendance rules (to be implemented server-side)

- Shift date = the office-local date the shift **starts** (night shifts cross midnight).
- Check-in at or before **21:15 Asia/Karachi** ⇒ `on_time`; after ⇒ `late`, with
  `lateByMinutes` measured from the threshold.
- Heartbeat every 30 s carries only `active` / `idle`. No heartbeat for 90 s ⇒ `offline`.
- Idle = no user input for 60 s (detected locally from the OS idle timer, which reports a
  number of seconds and never the input itself).
- All timestamps that matter are assigned by the server; client times are informational.

## Data model (local migrations)

| Migration                            | Contents                                                                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261107000000_initial_schema.sql`  | enums, `office_settings`, `employees`, `devices`, `attendance_records`, `activity_transitions`                                                                       |
| `20261107010000_auth_foundation.sql` | `profiles`, `permissions`, `role_permissions`, `audit_logs`, `auth_login_throttle`; employees → profiles mapping; guards, audit triggers; RLS rebuilt on permissions |

```
auth.users 1──1 profiles (role, status) 1──0..1 employees (employee_code) 1──* devices
                    │                                   └──* attendance_records, activity_transitions
                    └── role ──* role_permissions *── permissions
audit_logs (append-only, actor → profiles)      auth_login_throttle (service role only)
```

Verified offline by `pnpm db:verify`. Never applied to any remote database.
See [supabase/README.md](../supabase/README.md) and [SECURITY.md](SECURITY.md).
