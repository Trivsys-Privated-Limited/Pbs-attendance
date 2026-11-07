"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthService } from "@/server/auth/container";
import { SESSION_STAMP_COOKIE, createSessionStamp } from "@/server/auth/session-stamp";
import { isBackendConfigured, requireServerEnv } from "@/server/env";
import { requestContextFromHeaders } from "@/server/http/request-context";
import { createSessionClient } from "@/server/supabase/clients";

export type AdminLoginState =
  | { status: "idle" }
  | { status: "invalid" }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | { status: "not_configured" }
  | { status: "unavailable" }
  | { status: "error" };

/**
 * Admin sign-in (Server Action). Next.js verifies the Origin of Server Action requests.
 * The browser never talks to Supabase directly and never sees any server key.
 */
export async function signInAdmin(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  if (!isBackendConfigured()) return { status: "not_configured" };
  const env = requireServerEnv();
  const ctx = requestContextFromHeaders(await headers(), env.TRUST_PROXY_HEADERS);

  const result = await getAuthService().loginAdmin(
    { email: formData.get("email"), password: formData.get("password") },
    ctx,
  );
  if (!result.ok) {
    if (result.error === "RATE_LIMITED") {
      return { status: "rate_limited", retryAfterSeconds: result.retryAfterSeconds };
    }
    return result.error === "UNAVAILABLE" ? { status: "unavailable" } : { status: "invalid" };
  }

  // Store the Supabase session in HTTP-only cookies managed by @supabase/ssr.
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.setSession({
    access_token: result.session.accessToken,
    refresh_token: result.session.refreshToken,
  });
  if (error) return { status: "error" };

  (await cookies()).set(
    SESSION_STAMP_COOKIE,
    createSessionStamp(env.SESSION_SECRET, result.profile.id, Date.now()),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: env.ADMIN_SESSION_MAX_AGE_HOURS * 3600,
    },
  );

  redirect("/overview");
}
