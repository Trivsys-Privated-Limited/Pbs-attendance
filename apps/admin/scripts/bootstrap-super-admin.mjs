// Creates the FIRST super admin account (controlled process, no public registration).
//
// Usage (from apps/admin, with .env.local filled for the DEDICATED PBS Attend project):
//   $env:BOOTSTRAP_ADMIN_EMAIL="owner@example.com"
//   $env:BOOTSTRAP_ADMIN_NAME="Full Name"
//   $env:BOOTSTRAP_ADMIN_PASSWORD="<at least 12 chars, letters + digits>"
//   pnpm bootstrap:super-admin -- --confirm-project=<project-ref | local>
//
// Safety:
//   * --confirm-project must match the configured Supabase URL (project ref, or "local"
//     for a localhost stack). This prevents running against the wrong project.
//   * Refuses to run if any super admin already exists.
//   * Never prints keys, passwords or tokens.
import { createClient } from "@supabase/supabase-js";

function fail(message) {
  console.error(`\n[bootstrap] ${message}\n`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const confirmArg = process.argv.find((a) => a.startsWith("--confirm-project="))?.split("=")[1];

if (!url || !serviceKey)
  fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).");
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
  fail("BOOTSTRAP_ADMIN_EMAIL must be a valid email address.");
if (!name) fail("BOOTSTRAP_ADMIN_NAME is required.");
if (!password || password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  fail("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters with letters and digits.");
}

let host;
try {
  host = new URL(url).hostname;
} catch {
  fail("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
}
const isLocal = host === "localhost" || host === "127.0.0.1";
const projectRef = isLocal ? "local" : host.split(".")[0];
if (!confirmArg)
  fail(
    `Re-run with --confirm-project=${isLocal ? "local" : "<project-ref>"} to confirm the target project.`,
  );
if (confirmArg !== projectRef)
  fail("--confirm-project does not match the configured Supabase project. Nothing was changed.");

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const { count, error: countError } = await supabase
  .from("profiles")
  .select("id", { count: "exact", head: true })
  .eq("role", "super_admin");
if (countError)
  fail(
    `Could not query profiles (have the migrations been applied?): ${countError.code ?? countError.message}`,
  );
if ((count ?? 0) > 0)
  fail("A super admin already exists. Additional admins must be created by a super admin.");

const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { pbs_attend: true },
});
if (createError || !created.user)
  fail(`Could not create the Auth user: ${createError?.code ?? createError?.message ?? "unknown"}`);

const { error: profileError } = await supabase.from("profiles").insert({
  id: created.user.id,
  role: "super_admin",
  status: "active",
  display_name: name,
});
if (profileError) {
  await supabase.auth.admin.deleteUser(created.user.id);
  fail(
    `Could not create the profile (Auth user rolled back): ${profileError.code ?? profileError.message}`,
  );
}

await supabase.from("audit_logs").insert({
  action: "admin.bootstrap_super_admin",
  actor_profile_id: null,
  target_type: "profile",
  target_id: created.user.id,
  metadata: { email },
});

console.info(
  `\n[bootstrap] Super admin created for ${email} on project "${projectRef}". You can now sign in to the admin app.\n`,
);
