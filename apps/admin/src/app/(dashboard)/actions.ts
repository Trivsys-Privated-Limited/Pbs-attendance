"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthService } from "@/server/auth/container";
import { SESSION_STAMP_COOKIE } from "@/server/auth/session-stamp";
import { isBackendConfigured, requireServerEnv } from "@/server/env";
import { requestContextFromHeaders } from "@/server/http/request-context";
import { createSessionClient } from "@/server/supabase/clients";

/** Secure logout: revokes the Supabase session server-side, then clears all auth cookies. */
export async function signOutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  if (isBackendConfigured()) {
    const env = requireServerEnv();
    const supabase = await createSessionClient();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? null;
    if (accessToken) {
      await getAuthService().logout(
        accessToken,
        requestContextFromHeaders(await headers(), env.TRUST_PROXY_HEADERS),
      );
    }
    // Clears the sb-* cookies (the server-side session is already revoked above).
    await supabase.auth.signOut({ scope: "local" });
  }
  cookieStore.delete(SESSION_STAMP_COOKIE);
  redirect("/login?reason=signed_out");
}
