import { describe, expect, it } from "vitest";
import { decideRoute, isProtectedPath } from "../route-policy";
import { bearerToken, requestContextFromHeaders } from "../request-context";

const base = { configured: true, demoAllowed: false, hasUser: true, stamp: "valid" as const };

describe("protected routes", () => {
  it("covers every admin section", () => {
    for (const p of [
      "/overview",
      "/live-activity",
      "/employees",
      "/attendance",
      "/late-arrivals",
      "/reports",
      "/devices",
      "/settings",
      "/employees/123",
    ]) {
      expect(isProtectedPath(p)).toBe(true);
    }
    for (const p of ["/login", "/", "/overviewx", "/api/v1/auth/me"])
      expect(isProtectedPath(p)).toBe(false);
  });

  it("redirects anonymous visitors to the login page", () => {
    expect(
      decideRoute({ ...base, pathname: "/employees", hasUser: false, stamp: "missing" }),
    ).toEqual({
      action: "redirect",
      to: "/login",
      clearSession: false,
    });
  });

  it("expires sessions older than the maximum age and clears them", () => {
    expect(decideRoute({ ...base, pathname: "/overview", stamp: "expired" })).toEqual({
      action: "redirect",
      to: "/login?reason=expired",
      clearSession: true,
    });
  });

  it("treats a missing or forged stamp as an expired session", () => {
    for (const stamp of ["missing", "invalid", "user_mismatch"] as const) {
      const d = decideRoute({ ...base, pathname: "/settings", stamp });
      expect(d.action).toBe("redirect");
    }
  });

  it("lets a valid session through", () => {
    expect(decideRoute({ ...base, pathname: "/overview" })).toEqual({ action: "next" });
  });

  it("sends signed-in admins from /login to the dashboard", () => {
    expect(decideRoute({ ...base, pathname: "/login" })).toMatchObject({
      action: "redirect",
      to: "/overview",
    });
  });

  it("blocks the dashboard when the backend is not configured, unless the dev demo is enabled", () => {
    expect(
      decideRoute({ ...base, configured: false, hasUser: false, pathname: "/overview" }),
    ).toMatchObject({
      action: "redirect",
      to: "/login?reason=not_configured",
    });
    expect(
      decideRoute({
        ...base,
        configured: false,
        demoAllowed: true,
        hasUser: false,
        pathname: "/overview",
      }),
    ).toEqual({ action: "next" });
  });

  it("only redirects to fixed internal paths", () => {
    const d = decideRoute({ ...base, pathname: "/overview", hasUser: false, stamp: "missing" });
    expect(d.action === "redirect" && d.to.startsWith("/login")).toBe(true);
  });
});

describe("request context", () => {
  const h = (init: Record<string, string>) => new Headers(init);

  it("ignores X-Forwarded-For unless the proxy is trusted", () => {
    expect(
      requestContextFromHeaders(h({ "x-forwarded-for": "203.0.113.5" }), false).ipAddress,
    ).toBeNull();
    expect(
      requestContextFromHeaders(h({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }), true).ipAddress,
    ).toBe("203.0.113.5");
  });

  it("rejects values that are not IP addresses", () => {
    expect(
      requestContextFromHeaders(h({ "x-forwarded-for": "<script>" }), true).ipAddress,
    ).toBeNull();
  });

  it("parses bearer tokens strictly", () => {
    expect(bearerToken(h({ authorization: "Bearer abc.def-ghi_jkl" }))).toBe("abc.def-ghi_jkl");
    expect(bearerToken(h({ authorization: "Basic abc" }))).toBeNull();
    expect(bearerToken(h({ authorization: "Bearer abc def" }))).toBeNull();
    expect(bearerToken(h({}))).toBeNull();
  });
});
