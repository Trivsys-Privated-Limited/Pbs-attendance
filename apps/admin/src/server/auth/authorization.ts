import { roleHasPermission, type Permission } from "@pbs-attend/shared";
import type { ProfileRecord } from "./ports";

/** A verified caller: identity confirmed by Supabase Auth, profile loaded from the database. */
export interface Principal {
  profile: ProfileRecord;
}

export type AuthzFailure = "UNAUTHENTICATED" | "FORBIDDEN";

/**
 * Server-side authorization. Inputs are ONLY the server-loaded profile; nothing from the
 * request body, headers or token metadata is ever used to decide a role.
 */
export function authorize(
  principal: Principal | null,
  permission: Permission,
): { ok: true; principal: Principal } | { ok: false; error: AuthzFailure } {
  if (!principal) return { ok: false, error: "UNAUTHENTICATED" };
  if (principal.profile.status !== "active") return { ok: false, error: "UNAUTHENTICATED" };
  if (!roleHasPermission(principal.profile.role, permission))
    return { ok: false, error: "FORBIDDEN" };
  return { ok: true, principal };
}
