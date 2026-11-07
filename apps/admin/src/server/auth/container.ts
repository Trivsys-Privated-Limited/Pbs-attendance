import "server-only";
import { randomUUID } from "node:crypto";
import { requireServerEnv } from "../env";
import {
  createSupabaseAuditLogger,
  createSupabaseDirectory,
  createSupabaseIdentity,
  createSupabaseRateLimiter,
} from "../supabase/adapters";
import { createStatelessAuthClient, getServiceRoleClient } from "../supabase/clients";
import { createAuthService, type AuthService } from "./auth-service";

let service: AuthService | undefined;

/** Production wiring of the auth service. Throws BackendNotConfiguredError when unconfigured. */
export function getAuthService(): AuthService {
  if (service) return service;
  const env = requireServerEnv();
  service = createAuthService({
    identity: createSupabaseIdentity(createStatelessAuthClient, getServiceRoleClient),
    directory: createSupabaseDirectory(getServiceRoleClient),
    limiter: createSupabaseRateLimiter(getServiceRoleClient),
    audit: createSupabaseAuditLogger(getServiceRoleClient),
    clock: { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) },
    secret: env.SESSION_SECRET,
    employeeAuthEmail: (profileId) => `${profileId}@${env.EMPLOYEE_AUTH_EMAIL_DOMAIN}`,
    minLoginMs: 600,
    newId: randomUUID,
  });
  return service;
}
