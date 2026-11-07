import { z } from "zod";

/**
 * Server configuration schema. Shared by env.ts (server-only) and proxy.ts.
 *
 * SUPABASE_SERVICE_ROLE_KEY and SESSION_SECRET are server-only secrets: never prefix them
 * with NEXT_PUBLIC_ and never import this module from client components.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  EMPLOYEE_AUTH_EMAIL_DOMAIN: z
    .string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i)
    .default("employees.pbs-attend.internal"),
  ADMIN_SESSION_MAX_AGE_HOURS: z.coerce.number().int().min(1).max(24).default(12),
  TRUST_PROXY_HEADERS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type ServerConfig = z.output<typeof schema>;
export type ConfigResult = { config: ServerConfig } | { config: null; problem: string };

let cached: ConfigResult | undefined;

export function readServerConfig(): ConfigResult {
  if (cached) return cached;
  const pick = (name: string) => process.env[name] || undefined;
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: pick("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: pick("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: pick("SUPABASE_SERVICE_ROLE_KEY"),
    SESSION_SECRET: pick("SESSION_SECRET"),
    EMPLOYEE_AUTH_EMAIL_DOMAIN: pick("EMPLOYEE_AUTH_EMAIL_DOMAIN"),
    ADMIN_SESSION_MAX_AGE_HOURS: pick("ADMIN_SESSION_MAX_AGE_HOURS"),
    TRUST_PROXY_HEADERS: pick("TRUST_PROXY_HEADERS"),
  });
  cached = parsed.success
    ? { config: parsed.data }
    : {
        config: null,
        // Only variable NAMES are reported, never values.
        problem: `Missing or invalid: ${[...new Set(parsed.error.issues.map((i) => String(i.path[0])))].join(", ")}`,
      };
  return cached;
}

/**
 * Development-only escape hatch to view the UI previews without a backend.
 * Always false in production builds.
 */
export function isDemoPreviewAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEMO_PREVIEW === "true";
}
