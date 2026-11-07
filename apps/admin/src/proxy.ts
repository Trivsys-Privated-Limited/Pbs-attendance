import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_STAMP_COOKIE, verifySessionStamp } from "./server/auth/session-stamp";
import { isDemoPreviewAllowed, readServerConfig } from "./server/config";
import { decideRoute, isProtectedPath } from "./server/http/route-policy";

/**
 * Runs before page requests (Node.js runtime). Responsibilities:
 *  1. Refresh the Supabase session cookies (rotating tokens) when needed.
 *  2. Early-redirect unauthenticated or expired sessions away from admin pages.
 *
 * It is NOT the authorization boundary: the dashboard layout and API handlers verify
 * identity, role and status on the server for every request.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const result = readServerConfig();

  if (!result.config) {
    const decision = decideRoute({
      pathname,
      configured: false,
      demoAllowed: isDemoPreviewAllowed(),
      hasUser: false,
      stamp: "missing",
    });
    return decision.action === "redirect"
      ? NextResponse.redirect(new URL(decision.to, request.url))
      : NextResponse.next();
  }
  const config = result.config;

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, headers) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {}))
            response.headers.set(key, value);
        },
      },
    },
  );

  // Validates the token with Supabase Auth and refreshes it if it has expired.
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? null;
  const stamp = verifySessionStamp(
    config.SESSION_SECRET,
    request.cookies.get(SESSION_STAMP_COOKIE)?.value,
    userId,
    Date.now(),
    config.ADMIN_SESSION_MAX_AGE_HOURS * 3_600_000,
  );

  const decision = decideRoute({
    pathname,
    configured: true,
    demoAllowed: false,
    hasUser: userId !== null,
    stamp,
  });

  if (decision.action === "next") {
    if (isProtectedPath(pathname)) response.headers.set("cache-control", "private, no-store");
    return response;
  }

  if (decision.clearSession) {
    // Revokes the refresh token server-side and clears the sb-* cookies via setAll.
    await supabase.auth.signOut({ scope: "local" });
  }
  const redirect = NextResponse.redirect(new URL(decision.to, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  if (decision.clearSession) redirect.cookies.delete(SESSION_STAMP_COOKIE);
  return redirect;
}

export const config = {
  // Pages only. API routes authenticate each request themselves (Bearer token or cookie).
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
