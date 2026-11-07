# PBS Attend

**Smart Attendance. Clear Insights.**

Workforce attendance and activity management for **PBS Digitals** (25–35 employees, Windows 10/11).

> **Status: Phase 2 (Supabase integration & secure authentication), local preparation
> complete.** Admin email/password login, employee Employee-ID login (desktop), protected
> routes, sessions, RBAC, audit logging and brute-force protection are implemented and tested
> offline. **No Supabase project is connected yet.** See
> [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md). Dashboard figures are still **fictional
> demo data** (attendance processing is a later phase).

## Monorepo

| Path                  | What it is                                                               |
| --------------------- | ------------------------------------------------------------------------ |
| `apps/admin`          | Admin web app: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Recharts |
| `apps/desktop`        | Employee desktop app: Electron 45, React 19, electron-vite, tray support |
| `packages/types`      | Shared domain types (employee, attendance, activity, device, office)     |
| `packages/validation` | Shared zod schemas (login, office config, heartbeat)                     |
| `packages/shared`     | Brand constants, office config, API contracts, display helpers           |
| `supabase/`           | LOCAL-only config, migrations (schema, auth, RLS), seed, offline test    |
| `supabase/functions`  | Supabase Edge Functions (empty until the API phase)                      |
| `docs`                | Architecture, development and security documentation                     |

## Requirements

- Windows 10 or 11 (the desktop app targets Windows; the admin app runs anywhere)
- Node.js **20.19+** (developed on Node 24)
- pnpm **10+** (`corepack enable` or `npm i -g pnpm`)

## Quick start

```powershell
pnpm install

# Admin web app → http://localhost:3000 (opens the login page)
# Without apps/admin/.env.local the dashboard is locked (backend not configured).
# To browse the fictional UI preview locally: set ALLOW_DEMO_PREVIEW=true in .env.local.
pnpm dev:admin

# Employee desktop app (opens an Electron window + tray icon)
pnpm dev:desktop
```

In development, the desktop login screen has a **"Development only: preview signed-in
screens"** button that opens My Attendance, My Activity Status, Settings and Logout with
fictional data. That preview is excluded from production builds.

If the Electron binary was not downloaded during install (pnpm blocks some install
scripts), run once: `node apps/desktop/node_modules/electron/install.js`.

## Quality checks

```powershell
pnpm lint          # ESLint, every workspace
pnpm typecheck     # TypeScript strict mode, every workspace
pnpm format:check  # Prettier
pnpm test          # Unit tests (auth service, API, sessions, desktop auth client)
pnpm db:verify     # Offline schema + RLS test (in-memory Postgres, no network)
pnpm build         # Production builds (admin + desktop)
pnpm check         # format:check + lint + typecheck + test + db:verify
```

## Supabase (not connected yet)

`supabase/` contains a **local** configuration and the migrations. It is not linked to any
remote project. A brand-new dedicated project is required. Follow
[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md); remote integration happens only after
explicit authorization.

## Office configuration (initial)

| Setting        | Value                        |
| -------------- | ---------------------------- |
| Shift start    | 09:00 PM                     |
| Late threshold | 09:15 PM (inclusive)         |
| Timezone       | Asia/Karachi                 |
| Idle detection | 60 seconds                   |
| Heartbeat      | 30 seconds                   |
| Offline after  | 90 seconds without heartbeat |

Defined in `packages/shared/src/office.ts`. All attendance status calculations will run on
the server using trusted server timestamps.

## Privacy

PBS Attend records **only** check-in/check-out times and transparent Active/Idle status
transitions. It never records keystrokes, screenshots, screen contents, window titles,
browsing history or passwords. The desktop app shows this disclosure on its login screen
and stays visible in the system tray while running.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Authentication & authorization](docs/AUTHENTICATION.md)
- [Creating the Supabase project](docs/SUPABASE_SETUP.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Security model](docs/SECURITY.md)
