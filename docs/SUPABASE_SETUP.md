# Creating the dedicated PBS Attend Supabase project (manual)

PBS Attend must use a **brand-new Supabase project used for nothing else**. Your three
existing Supabase projects must not be touched, and none of their URLs or keys may be reused.

Nothing in this repository connects to a remote project until you complete these steps
**and** explicitly authorize the remote integration.

## 1. Create the project (you do this in the browser)

1. Sign in at <https://supabase.com/dashboard>.
2. **Recommended:** create a separate organization (for example "PBS Digitals – Attend") so
   billing, members and access are isolated from your existing projects.
3. Click **New project** and fill in:
   - **Name:** `pbs-attend`
   - **Database password:** generate a strong one and store it in your password manager.
     PBS Attend's apps never need it. It is only used for CLI migrations.
   - **Region:** the region closest to Pakistan that your plan offers (for example
     South Asia / Mumbai).
4. Wait until the project shows as healthy.

## 2. Configure Authentication (Dashboard → Authentication)

| Setting                              | Value                                             |
| ------------------------------------ | ------------------------------------------------- |
| Allow new users to sign up           | **Off** (no public registration)                  |
| Email provider                       | **On** (needed for password sign-in)              |
| Confirm email                        | Off (admins create confirmed accounts)            |
| Anonymous sign-ins                   | **Off**                                           |
| All OAuth / social / phone providers | **Off**                                           |
| Minimum password length              | **12**                                            |
| Password requirements                | Letters and digits                                |
| JWT expiry                           | 3600 seconds (default)                            |
| Refresh token rotation               | On (default)                                      |
| Site URL                             | The admin app URL (http://localhost:3000 for now) |

Optional (paid plans): **Sessions → Time-box** 12 hours and **Inactivity timeout** 8 hours,
in addition to PBS Attend's own 12-hour admin session limit.

## 3. Collect the configuration (keep secrets on your machine)

From **Project Settings → API** (names can differ slightly between dashboard versions):

| Value                      | Goes into                       | Secret?                |
| -------------------------- | ------------------------------- | ---------------------- |
| Project URL                | `NEXT_PUBLIC_SUPABASE_URL`      | No                     |
| Project ref (from the URL) | (tell Claude)                   | No                     |
| anon / publishable key     | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No (RLS protects data) |
| service_role / secret key  | `SUPABASE_SERVICE_ROLE_KEY`     | **Yes, server-only**   |

1. Copy `.env.example` to `apps/admin/.env.local` and fill in the values **yourself**.
   Do not paste the service-role key into chat, tickets, screenshots or commits.
2. Generate `SESSION_SECRET`:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
3. Create `apps/desktop/.env.local` with `MAIN_VITE_PBS_ATTEND_API_URL=http://localhost:3000`.

## 4. Authorize the integration

Reply with the **project ref** and an explicit statement such as:

> "I authorize remote integration with the new dedicated PBS Attend project `<ref>`."

Only then will the following be performed, one step at a time with your confirmation:

1. Install the Supabase CLI and run `supabase login` (interactive: you run it).
2. `supabase link --project-ref <ref>`. The CLI asks for the database password; you type it.
3. `supabase db push --dry-run` to show exactly which migrations would run, then
   `supabase db push` after your approval.
4. Verify RLS and the schema on the new project.
5. Create the first super admin:
   ```powershell
   cd apps/admin
   $env:BOOTSTRAP_ADMIN_EMAIL="you@example.com"
   $env:BOOTSTRAP_ADMIN_NAME="Your Name"
   $env:BOOTSTRAP_ADMIN_PASSWORD="<12+ chars, letters and digits>"
   pnpm bootstrap:super-admin -- --confirm-project=<ref>
   ```
6. Sign in to the admin app and create a test employee through the API.

Safety nets already in place: the bootstrap script refuses to run unless
`--confirm-project` matches the configured URL. The repository is not linked (`supabase/.temp`
does not exist), and no remote URL or key is stored in the codebase.
