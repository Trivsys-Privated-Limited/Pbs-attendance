import { describe, expect, it } from "vitest";
import type { Principal } from "../../auth/authorization";
import { PASSWORD, setup } from "../../auth/__tests__/fakes";
import { createApiHandlers } from "../api-handlers";

const BASE = "https://admin.pbs-attend.test";

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function get(path: string, headers: Record<string, string> = {}) {
  return new Request(`${BASE}${path}`, { headers });
}

function harness(cookiePrincipal: Principal | null = null) {
  const t = setup();
  const api = createApiHandlers({
    getService: () => t.service,
    trustProxyHeaders: true,
    cookiePrincipal: () => Promise.resolve(cookiePrincipal),
  });
  return { t, api };
}

async function json(res: Response) {
  return (await res.json()) as {
    ok: boolean;
    data?: Record<string, unknown>;
    error?: { code: string; message: string };
  };
}

async function loginToken(api: ReturnType<typeof harness>["api"], code: string) {
  const res = await api.employeeLogin(
    post("/api/v1/auth/employee-login", { employeeCode: code, password: PASSWORD }),
  );
  const body = await json(res);
  return (body.data?.session as { accessToken: string; refreshToken: string }) ?? null;
}

describe("POST /api/v1/auth/employee-login", () => {
  it("returns 503 NOT_CONFIGURED when no backend is configured", async () => {
    const api = createApiHandlers({ getService: () => null, trustProxyHeaders: false });
    const res = await api.employeeLogin(
      post("/api/v1/auth/employee-login", { employeeCode: "PBS-0012", password: PASSWORD }),
    );
    expect(res.status).toBe(503);
    expect((await json(res)).error?.code).toBe("NOT_CONFIGURED");
  });

  it("returns the employee identity and session on success, uncached", async () => {
    const { t, api } = harness();
    t.addEmployee("PBS-0012");
    const res = await api.employeeLogin(
      post("/api/v1/auth/employee-login", { employeeCode: "PBS-0012", password: PASSWORD }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await json(res);
    expect(body.data?.employee).toEqual({ employeeCode: "PBS-0012", fullName: "Demo PBS-0012" });
    expect(body.data?.session).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
    // No internal identifiers or roles leak to the desktop client.
    expect(JSON.stringify(body)).not.toMatch(/"profileId"|"role"|"status"/);
  });

  it("answers wrong password and unknown Employee ID identically (401)", async () => {
    const { t, api } = harness();
    t.addEmployee("PBS-0012");
    const a = await api.employeeLogin(
      post(
        "/x",
        { employeeCode: "PBS-0012", password: "wrong-password-1" },
        { "x-forwarded-for": "198.51.100.1" },
      ),
    );
    const b = await api.employeeLogin(
      post(
        "/x",
        { employeeCode: "PBS-0777", password: PASSWORD },
        { "x-forwarded-for": "198.51.100.2" },
      ),
    );
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(await a.text()).toBe(await b.text());
  });

  it("returns 429 with Retry-After once throttled", async () => {
    const { t, api } = harness();
    t.addEmployee("PBS-0012");
    for (let i = 0; i < 5; i++) {
      await api.employeeLogin(
        post("/x", { employeeCode: "PBS-0012", password: `wrong-password-${i}` }),
      );
    }
    const res = await api.employeeLogin(
      post("/x", { employeeCode: "PBS-0012", password: PASSWORD }),
    );
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("rejects non-JSON bodies (415), oversized bodies (413) and malformed JSON (400)", async () => {
    const { api } = harness();
    const form = new Request(`${BASE}/x`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "employeeCode=PBS-0012",
    });
    expect((await api.employeeLogin(form)).status).toBe(415);
    expect(
      (await api.employeeLogin(post("/x", JSON.stringify({ pad: "x".repeat(5000) })))).status,
    ).toBe(413);
    expect((await api.employeeLogin(post("/x", "{not json"))).status).toBe(400);
  });
});

describe("session endpoints", () => {
  it("GET /me requires a valid token (401 without one)", async () => {
    const { api } = harness();
    expect((await api.me(get("/api/v1/auth/me"))).status).toBe(401);
    expect(
      (await api.me(get("/api/v1/auth/me", { authorization: "Bearer forged.token.value" }))).status,
    ).toBe(401);
  });

  it("GET /me ignores client-supplied role headers", async () => {
    const { t, api } = harness();
    t.addEmployee("PBS-0012");
    const session = await loginToken(api, "PBS-0012");
    const res = await api.me(
      get("/api/v1/auth/me", {
        authorization: `Bearer ${session.accessToken}`,
        "x-user-role": "super_admin",
        "x-employee-id": "PBS-0001",
      }),
    );
    expect((await json(res)).data?.user).toEqual({
      displayName: "Demo PBS-0012",
      role: "employee",
    });
  });

  it("logout revokes the token so it can no longer be used", async () => {
    const { t, api } = harness();
    t.addEmployee("PBS-0012");
    const session = await loginToken(api, "PBS-0012");
    const auth = { authorization: `Bearer ${session.accessToken}` };
    expect((await api.me(get("/me", auth))).status).toBe(200);
    expect((await api.logout(post("/api/v1/auth/logout", {}, auth))).status).toBe(200);
    expect((await api.me(get("/me", auth))).status).toBe(401);
  });

  it("refresh issues new tokens and refuses suspended accounts", async () => {
    const { t, api } = harness();
    const profileId = t.addEmployee("PBS-0012");
    const session = await loginToken(api, "PBS-0012");
    const refreshed = await api.refresh(
      post("/api/v1/auth/refresh", { refreshToken: session.refreshToken }),
    );
    expect(refreshed.status).toBe(200);
    const next = (await json(refreshed)).data?.session as { refreshToken: string };
    t.directory.setStatus(profileId, "suspended");
    expect(
      (await api.refresh(post("/api/v1/auth/refresh", { refreshToken: next.refreshToken }))).status,
    ).toBe(401);
  });

  it("an expired (unknown) refresh token is rejected", async () => {
    const { api } = harness();
    expect((await api.refresh(post("/x", { refreshToken: "rt-expired-session-1" }))).status).toBe(
      401,
    );
  });
});

describe("POST /api/v1/admin/employees", () => {
  const body = {
    employeeCode: "PBS-0200",
    fullName: "Demo New Hire",
    password: "Initial-Pass-2026",
  };
  const adminPrincipal: Principal = {
    profile: { id: "admin-1", role: "admin", status: "active", displayName: "Demo Admin" },
  };

  it("rejects anonymous requests (401)", async () => {
    const { api } = harness();
    expect((await api.createEmployee(post("/api/v1/admin/employees", body))).status).toBe(401);
  });

  it("rejects an employee's bearer token (403)", async () => {
    const { t, api } = harness();
    t.addEmployee("PBS-0012");
    const session = await loginToken(api, "PBS-0012");
    const res = await api.createEmployee(
      post("/api/v1/admin/employees", body, { authorization: `Bearer ${session.accessToken}` }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects cookie-authenticated requests from another origin (CSRF)", async () => {
    const { api } = harness(adminPrincipal);
    const res = await api.createEmployee(
      post("/api/v1/admin/employees", body, { origin: "https://evil.example" }),
    );
    expect(res.status).toBe(401);
    const noOrigin = await api.createEmployee(post("/api/v1/admin/employees", body));
    expect(noOrigin.status).toBe(401);
  });

  it("creates the employee for a same-origin admin (201)", async () => {
    const { api } = harness(adminPrincipal);
    const res = await api.createEmployee(post("/api/v1/admin/employees", body, { origin: BASE }));
    expect(res.status).toBe(201);
    expect((await json(res)).data?.employee).toMatchObject({ employeeCode: "PBS-0200" });
  });

  it("blocks an admin from creating a super admin via the request body (403)", async () => {
    const { api } = harness(adminPrincipal);
    const res = await api.createEmployee(
      post("/api/v1/admin/employees", { ...body, role: "super_admin" }, { origin: BASE }),
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /api/v1/admin/employees", () => {
  const adminPrincipal: Principal = {
    profile: { id: "admin-1", role: "admin", status: "active", displayName: "Demo Admin" },
  };
  const managerPrincipal: Principal = {
    profile: { id: "manager-1", role: "manager", status: "active", displayName: "Demo Manager" },
  };

  it("returns database directory fields for authorized staff", async () => {
    const { t, api } = harness(adminPrincipal);
    t.addEmployee("PBS-0012");
    const res = await api.employees(get("/api/v1/admin/employees"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await json(res)).data?.employees).toEqual([
      {
        employeeCode: "PBS-0012",
        fullName: "Demo PBS-0012",
        email: null,
        department: null,
        designation: null,
        role: "employee",
        status: "active",
      },
    ]);
  });

  it("allows managers to read employees but denies employees", async () => {
    const { t, api } = harness(managerPrincipal);
    expect((await api.employees(get("/employees"))).status).toBe(200);
    t.addEmployee("PBS-0012");
    const session = await loginToken(api, "PBS-0012");
    expect(
      (await api.employees(get("/employees", { authorization: `Bearer ${session?.accessToken}` })))
        .status,
    ).toBe(403);
  });

  it("rejects anonymous callers and an unconfigured backend", async () => {
    const { api } = harness();
    expect((await api.employees(get("/employees"))).status).toBe(401);
    const unconfigured = createApiHandlers({ getService: () => null, trustProxyHeaders: false });
    expect((await unconfigured.employees(get("/employees"))).status).toBe(503);
  });
});

describe("GET /api/v1/admin/auth-events", () => {
  const adminPrincipal: Principal = {
    profile: { id: "admin-1", role: "admin", status: "active", displayName: "Demo Admin" },
  };
  const managerPrincipal: Principal = {
    profile: { id: "manager-1", role: "manager", status: "active", displayName: "Demo Manager" },
  };

  it("returns recent employee sign-in and sign-out events for audit readers", async () => {
    const { t, api } = harness(adminPrincipal);
    t.audit.employeeAuthEvents = [
      {
        occurredAt: "2026-11-07T16:30:00.000Z",
        action: "logout",
        employeeCode: "PBS-0012",
        fullName: "Demo PBS-0012",
      },
    ];
    const res = await api.employeeAuthEvents(get("/api/v1/admin/auth-events"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await json(res)).data?.events).toEqual(t.audit.employeeAuthEvents);
  });

  it("denies callers without audit.read", async () => {
    const { api } = harness(managerPrincipal);
    expect((await api.employeeAuthEvents(get("/auth-events"))).status).toBe(403);
    const anonymous = harness();
    expect((await anonymous.api.employeeAuthEvents(get("/auth-events"))).status).toBe(401);
  });
});

describe("service unavailable", () => {
  it("maps an unreachable backend to 503 SERVICE_UNAVAILABLE", async () => {
    const { t, api } = harness();
    t.limiter.check = () =>
      Promise.resolve({ allowed: false, retryAfterSeconds: 0, unavailable: true });
    const res = await api.employeeLogin(
      post("/x", { employeeCode: "PBS-0012", password: PASSWORD }),
    );
    expect(res.status).toBe(503);
    expect((await json(res)).error?.code).toBe("SERVICE_UNAVAILABLE");
  });
});
