import "server-only";
import { roleHasPermission, type Permission } from "@pbs-attend/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isBackendConfigured, isDemoPreviewAllowed, requireServerEnv } from "../env";
import { createSupabaseDirectory } from "../supabase/adapters";
import { createSessionClient, getServiceRoleClient } from "../supabase/clients";
import type { Principal } from "./authorization";
import { SESSION_STAMP_COOKIE, verifySessionStamp } from "./session-stamp";

export type AdminSessionState =
  | { status: "ok"; principal: Principal; demo: false }
  | { status: "demo"; demo: true }
  | { status: "not_configured" | "anonymous" | "expired" | "forbidden" };

/**
 * Resolves the signed-in admin for this request. The identity is verified with Supabase
 * Auth (getUser contacts the Auth server; it does not just decode the cookie), the
 * session age is checked against the signed stamp, and role/status are loaded from the
 * database. Memoized per request.
 */
export const getAdminSession = cache(async (): Promise<AdminSessionState> => {
  if (!isBackendConfigured())
    return isDemoPreviewAllowed() ? { status: "demo", demo: true } : { status: "not_configured" };
  const env = requireServerEnv();

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { status: "anonymous" };

  const stamp = (await cookies()).get(SESSION_STAMP_COOKIE)?.value;
  const verdict = verifySessionStamp(
    env.SESSION_SECRET,
    stamp,
    data.user.id,
    Date.now(),
    env.ADMIN_SESSION_MAX_AGE_HOURS * 3_600_000,
  );
  if (verdict !== "valid") return { status: "expired" };

  const profile = await createSupabaseDirectory(getServiceRoleClient).getProfile(data.user.id);
  if (!profile || profile.status !== "active") return { status: "anonymous" };
  if (!roleHasPermission(profile.role, "admin_portal.access")) return { status: "forbidden" };
  return { status: "ok", principal: { profile }, demo: false };
});

/** Principal for cookie-authenticated API routes, or null. */
export async function getCookiePrincipal(): Promise<Principal | null> {
  const state = await getAdminSession();
  return state.status === "ok" ? state.principal : null;
}

/**
 * Guard for admin pages. Redirects to the login page unless the caller is an active
 * admin-portal user holding `permission`.
 */
export async function requireAdmin(
  permission: Permission = "admin_portal.access",
): Promise<AdminSessionState & { status: "ok" | "demo" }> {
  const state = await getAdminSession();
  if (state.status === "demo") return state;
  if (state.status !== "ok") redirect(`/login?reason=${state.status}`);
  if (!roleHasPermission(state.principal.profile.role, permission))
    redirect("/login?reason=forbidden");
  return state;
}
