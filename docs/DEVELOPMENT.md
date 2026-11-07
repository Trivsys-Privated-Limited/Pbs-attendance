# PBS Attend — Development Guide

## Setup

```powershell
node --version   # 20.19+ required
pnpm --version   # 10+ required
pnpm install
```

pnpm 10 blocks dependency install scripts unless they are listed in
`pnpm-workspace.yaml → onlyBuiltDependencies`. Electron is allowed, but if
`apps/desktop/node_modules/electron/dist` is missing, run:

```powershell
node apps/desktop/node_modules/electron/install.js
```

`electron-winstaller` (Squirrel) is intentionally left blocked; PBS Attend uses NSIS.

## Running locally

| Command                                     | Result                                                       |
| ------------------------------------------- | ------------------------------------------------------------ |
| `pnpm dev:admin`                            | Admin app at <http://localhost:3000> (redirects to `/login`) |
| `pnpm dev:desktop`                          | Electron window with hot reload + tray icon                  |
| `pnpm build:admin`                          | Production build of the admin app (`apps/admin/.next`)       |
| `pnpm build:desktop`                        | Production bundle of the desktop app (`apps/desktop/out`)    |
| `pnpm --filter @pbs-attend/admin start`     | Serve the admin production build                             |
| `pnpm --filter @pbs-attend/desktop preview` | Run the desktop production bundle                            |

Closing the desktop window hides it to the tray. Quit from the tray menu
(**Quit PBS Attend**).

### Desktop signed-in preview (development only)

Real sign-in works once a backend is configured; the signed-in screens then show honest
"not active yet" placeholders. To review the fictional versions of My Attendance, My Activity Status, Settings
and Logout, run `pnpm dev:desktop` and click **"Development only: preview signed-in screens
with fictional data"** on the login screen. The preview lives in
`apps/desktop/src/renderer/src/preview/` and is stripped from production builds. To confirm,
search `apps/desktop/out/renderer/assets/*.js` for "Development preview" after
`pnpm build:desktop`; it should not be found.

## Backend configuration (Phase 2)

Without `apps/admin/.env.local`, the admin dashboard is locked and the auth API answers
`503 NOT_CONFIGURED`. To browse the fictional UI locally, set `ALLOW_DEMO_PREVIEW=true`
in `apps/admin/.env.local` (development only, ignored in production builds).

To connect a backend, follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Only the **new
dedicated** project, and only after explicit authorization.

The desktop app reads `MAIN_VITE_PBS_ATTEND_API_URL` from `apps/desktop/.env.local`
(defaults to `http://localhost:3000` in development builds).

## Checks

```powershell
pnpm lint
pnpm typecheck
pnpm format:check   # pnpm format to fix
pnpm test           # unit tests (admin auth + desktop auth client)
pnpm db:verify      # offline schema + RLS test (no Docker, no network)
pnpm build
pnpm check          # all of the above except build
```

## Database (local only)

Read [supabase/README.md](../supabase/README.md) first. Summary:

- Add schema changes as new files in `supabase/migrations/` (timestamped). Never edit an
  applied migration.
- Run `pnpm db:verify` after every change; extend `supabase/tests/verify-schema.mjs` with a
  check for each new policy.
- Do not link this repository to any Supabase project, and never use credentials from
  existing projects.

## Conventions

- TypeScript strict mode everywhere, plus `noUncheckedIndexedAccess`,
  `noUnusedLocals/Parameters`, `verbatimModuleSyntax`.
- Use `import type` for types (enforced by ESLint).
- Shared types go in `packages/types`, runtime schemas in `packages/validation`,
  constants/contracts in `packages/shared`. Apps never duplicate them.
- Prettier: 100 columns, double quotes, trailing commas, Tailwind class sorting.
- UI: brand tokens live in `apps/admin/src/app/globals.css` and
  `apps/desktop/src/renderer/src/styles.css` (Navy `#101B31`, Blue `#1677FF`,
  Background `#F5F7FB`).
- Demo data must stay in `apps/admin/src/lib/demo-data.ts`, use obviously fictional
  names (prefixed "Demo"), and be shown under the `DemoBanner`.

## Adding a shadcn/ui component

`apps/admin/components.json` is configured. From `apps/admin`:

```powershell
pnpm dlx shadcn@latest add dialog
```

Review the generated file: it must use the existing tokens and pass lint/typecheck.

## Environment variables

See `.env.example`. Phase 1 reads no environment variables. Use only a local or a
dedicated development Supabase project, never production.

## Packaging (later phase)

`pnpm --filter @pbs-attend/desktop package:win` builds an NSIS installer using
`apps/desktop/electron-builder.yml`. Before distributing, add a code-signing
certificate and a multi-resolution `.ico` in `apps/desktop/build/`.
