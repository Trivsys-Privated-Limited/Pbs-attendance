// OFFLINE environment preflight for PBS Attend. Never connects to any network service.
// Prints only PASS / WARN / FAIL lines, never variable values or secrets.
//
// Usage: pnpm preflight:env -- --expect-ref=<project-ref>
//   optional: --admin-env=<path> --desktop-env=<path>   (defaults: apps/*/.env.local)
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
const expectRef = arg("expect-ref");
const adminPath = arg("admin-env") ?? join(root, "apps/admin/.env.local");
const desktopPath = arg("desktop-env") ?? join(root, "apps/desktop/.env.local");

let fails = 0;
let warns = 0;
const pass = (m) => console.info(`PASS  ${m}`);
const warn = (m) => {
  warns++;
  console.info(`WARN  ${m}`);
};
const fail = (m) => {
  fails++;
  console.info(`FAIL  ${m}`);
};

if (!expectRef || !/^[a-z0-9]{20}$/.test(expectRef)) {
  console.error("Usage: pnpm preflight:env -- --expect-ref=<20-character project ref>");
  process.exit(2);
}

function parseEnv(path) {
  const out = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}

/** Classifies a Supabase API key WITHOUT revealing it. JWT payloads expose only role/ref. */
function classifyKey(value) {
  if (!value) return { kind: "missing" };
  if (value.startsWith("sb_publishable_")) return { kind: "publishable" };
  if (value.startsWith("sb_secret_")) return { kind: "secret" };
  const parts = value.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      return { kind: "jwt", role: payload.role, ref: payload.ref };
    } catch {
      return { kind: "unknown" };
    }
  }
  return { kind: "unknown" };
}

const looksSecret = (v) => {
  const c = classifyKey(v);
  return c.kind === "secret" || (c.kind === "jwt" && c.role === "service_role");
};

console.info(`\nPBS Attend environment preflight (offline). Expected project ref: ${expectRef}\n`);

// ---------------------------------------------------------------- admin
console.info("# apps/admin/.env.local");
if (!existsSync(adminPath)) {
  fail("file not found. Copy .env.example to apps/admin/.env.local and fill it in");
} else {
  const env = parseEnv(adminPath);

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL is missing");
  else if (url.replace(/\/+$/, "") === `https://${expectRef}.supabase.co`)
    pass("NEXT_PUBLIC_SUPABASE_URL matches the expected project");
  else
    fail(
      "NEXT_PUBLIC_SUPABASE_URL does NOT match the expected project. Check you did not copy another project's URL",
    );

  const anon = classifyKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (anon.kind === "missing") fail("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
  else if (anon.kind === "publishable")
    pass(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is a publishable key (project cannot be verified offline for this key format)",
    );
  else if (anon.kind === "jwt" && anon.role === "anon" && anon.ref === expectRef)
    pass("NEXT_PUBLIC_SUPABASE_ANON_KEY is the anon key of the expected project");
  else if (anon.kind === "jwt" && anon.role === "anon")
    fail("NEXT_PUBLIC_SUPABASE_ANON_KEY belongs to a DIFFERENT project");
  else if (looksSecret(env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
    fail(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY contains a SECRET / service-role key. It would be exposed to browsers. Replace it with the anon/publishable key",
    );
  else fail("NEXT_PUBLIC_SUPABASE_ANON_KEY is not a recognised Supabase anon/publishable key");

  const svc = classifyKey(env.SUPABASE_SERVICE_ROLE_KEY);
  if (svc.kind === "missing") fail("SUPABASE_SERVICE_ROLE_KEY is missing");
  else if (svc.kind === "secret")
    pass(
      "SUPABASE_SERVICE_ROLE_KEY is a secret key (project cannot be verified offline for this key format)",
    );
  else if (svc.kind === "jwt" && svc.role === "service_role" && svc.ref === expectRef)
    pass("SUPABASE_SERVICE_ROLE_KEY is the service-role key of the expected project");
  else if (svc.kind === "jwt" && svc.role === "service_role")
    fail("SUPABASE_SERVICE_ROLE_KEY belongs to a DIFFERENT project");
  else if (svc.kind === "publishable" || (svc.kind === "jwt" && svc.role === "anon"))
    fail("SUPABASE_SERVICE_ROLE_KEY contains the public anon/publishable key, not the secret key");
  else fail("SUPABASE_SERVICE_ROLE_KEY is not a recognised Supabase secret/service-role key");

  if (
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY === env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    fail("the anon and service-role variables contain the same value");
  }

  const secret = env.SESSION_SECRET ?? "";
  if (!secret) fail("SESSION_SECRET is missing");
  else if (secret.length < 32) fail("SESSION_SECRET is shorter than 32 characters");
  else if (/^(.)\1+$/.test(secret) || /change|example|secret|password/i.test(secret))
    fail("SESSION_SECRET looks like a placeholder. Generate a random one");
  else pass("SESSION_SECRET is set and long enough");

  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith("NEXT_PUBLIC_") && looksSecret(value))
      fail(`${name} exposes a secret key to the browser`);
  }

  const domain = env.EMPLOYEE_AUTH_EMAIL_DOMAIN;
  if (!domain)
    pass("EMPLOYEE_AUTH_EMAIL_DOMAIN not set (default employees.pbs-attend.internal will be used)");
  else if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) pass("EMPLOYEE_AUTH_EMAIL_DOMAIN is valid");
  else fail("EMPLOYEE_AUTH_EMAIL_DOMAIN is not a valid domain");

  if (env.ALLOW_DEMO_PREVIEW === "true")
    warn("ALLOW_DEMO_PREVIEW=true has no effect once the backend is configured. Set it to false");
  if (env.TRUST_PROXY_HEADERS === "true")
    warn("TRUST_PROXY_HEADERS=true: only correct behind a trusted reverse proxy");
  for (const name of ["BOOTSTRAP_ADMIN_PASSWORD"]) {
    if (env[name])
      warn(
        `${name} is saved in the file. Prefer setting it only in the terminal session and remove it after bootstrap`,
      );
  }
  for (const name of ["SUPABASE_DB_PASSWORD", "DATABASE_URL", "SUPABASE_ACCESS_TOKEN"]) {
    if (env[name])
      fail(`${name} must not be stored in apps/admin/.env.local. The apps never need it`);
  }
}

// ---------------------------------------------------------------- desktop
console.info("\n# apps/desktop/.env.local");
if (!existsSync(desktopPath)) {
  warn("file not found. Development builds default to http://localhost:3000");
} else {
  const env = parseEnv(desktopPath);
  const api = env.MAIN_VITE_PBS_ATTEND_API_URL;
  if (!api)
    warn(
      "MAIN_VITE_PBS_ATTEND_API_URL not set. Development builds default to http://localhost:3000",
    );
  else if (/^https:\/\//.test(api) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(api))
    pass("MAIN_VITE_PBS_ATTEND_API_URL is HTTPS or local");
  else fail("MAIN_VITE_PBS_ATTEND_API_URL must be HTTPS (or http://localhost for development)");
  if (api && /supabase\.co/.test(api))
    fail("MAIN_VITE_PBS_ATTEND_API_URL must point to the PBS Attend server, not to Supabase");
  for (const [name, value] of Object.entries(env)) {
    if (
      /SUPABASE|SERVICE_ROLE|SESSION_SECRET/i.test(name) ||
      classifyKey(value).kind !== "unknown"
    ) {
      fail(`${name}: the desktop app must not contain Supabase keys or server secrets`);
    }
  }
}

console.info(
  `\n${fails === 0 ? "PREFLIGHT PASSED" : "PREFLIGHT FAILED"} (${fails} fail, ${warns} warn). No network connection was made.\n`,
);
process.exit(fails === 0 ? 0 : 1);
