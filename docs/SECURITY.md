# PBS Attend: Security & Privacy Model

## Principles

1. **Transparent monitoring only.** The only activity data is Active / Idle / Offline
   status transitions. Never keystrokes, screenshots, screen contents, window titles,
   browsing history, files or passwords.
2. **Disclosure.** The desktop app shows exactly what is and is not collected
   (`MONITORING_SCOPE` in `packages/shared`) and stays visible in the system tray.
   There is no hidden or silent mode.
3. **Server is the source of truth.** Identity is verified by Supabase Auth; role and
   status come from the database. Trusted timestamps come from the server (`now()`).
4. **Least privilege & default deny.** RBAC (`super_admin`, `admin`, `manager`, `employee`)
   enforced in server code **and** by Row Level Security.

See [AUTHENTICATION.md](AUTHENTICATION.md) for the full auth design.

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY` and `SESSION_SECRET` exist only in the admin server
  environment. Modules that read them import `server-only`, so a client import fails the build.
- Verified after `pnpm build`: neither name nor `service_role` appears in any browser chunk
  (`apps/admin/.next/static`) or any desktop bundle (main, preload, renderer).
- The desktop app contains **no Supabase keys at all**; it talks only to the PBS Attend API.
- Logs and errors report variable **names** and error codes only, never values, tokens or
  passwords. Audit metadata never contains credentials (asserted by tests).
- `.env*` files are git-ignored except `.env.example`.

## Authentication controls

| Control                | Implementation                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| No public registration | Supabase sign-up disabled; accounts only via bootstrap script / admin API                                                                   |
| No plaintext passwords | Hashing by Supabase Auth; PBS Attend never stores passwords                                                                                 |
| Generic login errors   | One `INVALID_CREDENTIALS` response for all failure reasons                                                                                  |
| Timing equalization    | Every login attempt takes ≥ 600 ms                                                                                                          |
| Brute-force protection | HMAC-keyed throttle per ID (5/15 min) and per IP (30/15 min), DB-backed, fail-closed                                                        |
| Suspended accounts     | Rejected at login, refresh and every request; RLS returns nothing                                                                           |
| Session expiry         | 1 h access tokens; rotating refresh tokens; 12 h absolute admin session (signed stamp)                                                      |
| Secure logout          | Server-side revocation, then cookie clearing; audited                                                                                       |
| CSRF                   | Server Actions (Next.js origin check); same-origin `Origin` required for cookie-auth API mutations                                          |
| Privilege escalation   | Server checks + `profiles_guard` trigger: no self role/status change; only super admins touch admin-level roles; identity mapping immutable |
| Desktop tokens         | Held in Electron main-process memory only; renderer gets name + ID                                                                          |
| Desktop IPC            | Handlers verify the sender frame is our renderer                                                                                            |

## Electron hardening

| Control                                                                        | Where                     |
| ------------------------------------------------------------------------------ | ------------------------- |
| `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`            | `src/main/index.ts`       |
| `webSecurity: true`, `allowRunningInsecureContent: false`, `webviewTag: false` | `src/main/index.ts`       |
| DevTools disabled in packaged builds                                           | `src/main/index.ts`       |
| Minimal typed preload API (no raw `ipcRenderer`, no tokens)                    | `src/preload/index.ts`    |
| All permission requests denied; screen capture blocked                         | `src/main/security.ts`    |
| Navigation locked; new windows denied; only `https:` links open externally     | `src/main/security.ts`    |
| Strict Content-Security-Policy                                                 | `src/renderer/index.html` |
| API base must be HTTPS (HTTP allowed only for localhost); redirects refused    | `src/main/api-client.ts`  |

## Admin web hardening

- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `poweredByHeader: false`, `noindex`.
- Dashboard pages are rendered per request (`force-dynamic`) with `private, no-store`.
- API responses: `no-store`, JSON-only, 4 KB body limit.

## Database

Migrations: `20261107000000_initial_schema.sql`, `20261107010000_auth_foundation.sql`.

- RLS enabled on all 10 tables; `anon` has no privileges; helper functions are
  `SECURITY DEFINER` with `search_path = ''`.
- Clients cannot insert profiles, employees, permissions, audit entries or throttle rows.
- `audit_logs` is append-only (update/delete/truncate blocked by triggers, even for the owner).
  Role, status and settings changes are audited automatically by triggers with the acting user.
- Verified offline by `pnpm db:verify` (82 checks), including a mutation test showing the
  checks fail when the guards are removed.

## Isolation from existing Supabase projects

The repository is not linked to any Supabase project (`supabase/.temp` does not exist),
contains no remote URLs or keys, and no migration has been run against a remote database.
Remote integration requires the steps and explicit authorization in
[SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Planned for later phases

- Nonce-based Content-Security-Policy for the admin app.
- Integration tests against a local Supabase stack (Docker) with real Auth sessions.
- Persisting the desktop session with Windows DPAPI (`safeStorage`).
- Banning Auth users on suspension (in addition to the profile status check).
- Device registration and approval; attendance and heartbeat endpoints.
- Signed Windows installer and auto-update over HTTPS.
