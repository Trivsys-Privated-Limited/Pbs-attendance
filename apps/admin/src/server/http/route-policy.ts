import type { StampVerdict } from "../auth/session-stamp";

/** Admin pages that require a signed-in admin-portal user. */
export const PROTECTED_PREFIXES = [
  "/overview",
  "/live-activity",
  "/employees",
  "/attendance",
  "/late-arrivals",
  "/reports",
  "/devices",
  "/settings",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export type RouteDecision =
  { action: "next" } | { action: "redirect"; to: string; clearSession: boolean };

/**
 * Optimistic routing decision made in the proxy. It only decides early redirects;
 * the dashboard layout and every API handler re-check authorization on the server.
 * Redirect targets are fixed paths (no user-controlled "next" URL, so no open redirect).
 */
export function decideRoute(input: {
  pathname: string;
  configured: boolean;
  demoAllowed: boolean;
  hasUser: boolean;
  stamp: StampVerdict;
}): RouteDecision {
  const { pathname, configured, demoAllowed, hasUser, stamp } = input;

  if (pathname === "/login") {
    if (configured && hasUser && stamp === "valid")
      return { action: "redirect", to: "/overview", clearSession: false };
    return { action: "next" };
  }

  if (!isProtectedPath(pathname)) return { action: "next" };

  if (!configured) {
    return demoAllowed
      ? { action: "next" }
      : { action: "redirect", to: "/login?reason=not_configured", clearSession: false };
  }
  if (!hasUser) return { action: "redirect", to: "/login", clearSession: stamp !== "missing" };
  if (stamp !== "valid")
    return { action: "redirect", to: "/login?reason=expired", clearSession: true };
  return { action: "next" };
}
