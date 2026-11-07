import { describe, expect, it, vi } from "vitest";
import { createApiClient, resolveApiBase, type FetchLike } from "../api-client";
import { createSessionManager } from "../session";

const BASE = "https://attend.example.test";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const session = { accessToken: "at-1", refreshToken: "rt-1", expiresAt: 2_000_000_000 };
const employee = { employeeCode: "PBS-0012", fullName: "Demo Employee" };

describe("resolveApiBase", () => {
  it("accepts HTTPS and local HTTP only", () => {
    expect(resolveApiBase("https://attend.example.com/some/path")).toBe(
      "https://attend.example.com",
    );
    expect(resolveApiBase("http://localhost:3000")).toBe("http://localhost:3000");
    expect(resolveApiBase("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
    expect(resolveApiBase("http://attend.example.com")).toBeNull();
    expect(resolveApiBase("https://user:pass@attend.example.com")).toBeNull();
    expect(resolveApiBase("file:///etc/passwd")).toBeNull();
    expect(resolveApiBase("not a url")).toBeNull();
    expect(resolveApiBase(undefined)).toBeNull();
  });
});

describe("api client login", () => {
  it("validates input locally before any network call", async () => {
    const fetch = vi.fn<FetchLike>();
    const api = createApiClient(BASE, fetch);
    const res = await api.login({ employeeCode: "bad", password: "x" });
    expect(res.outcome).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports NOT_CONFIGURED when no server URL is set", async () => {
    const api = createApiClient(null, vi.fn<FetchLike>());
    expect(
      (await api.login({ employeeCode: "PBS-0012", password: "password123" })).outcome,
    ).toEqual({ ok: false, error: "NOT_CONFIGURED" });
  });

  it("returns the employee on success and keeps tokens out of the outcome", async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValue(jsonResponse(200, { ok: true, data: { employee, session } }));
    const api = createApiClient(BASE, fetch);
    const res = await api.login({ employeeCode: "pbs-0012", password: "password123" });
    expect(res.outcome).toEqual({ ok: true, employee });
    expect(JSON.stringify(res.outcome)).not.toContain("at-1");
    expect(res.tokens).toEqual(session);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`${BASE}/api/v1/auth/employee-login`);
    expect(JSON.parse(String(init?.body))).toEqual({
      employeeCode: "PBS-0012",
      password: "password123",
    });
    expect(init?.redirect).toBe("error");
  });

  it("maps 401 / 429 / 503 / network errors", async () => {
    const cases: [Response | Error, unknown][] = [
      [
        jsonResponse(401, { ok: false, error: { code: "INVALID_CREDENTIALS" } }),
        { ok: false, error: "INVALID_CREDENTIALS" },
      ],
      [
        jsonResponse(429, { ok: false, error: { code: "RATE_LIMITED", retryAfterSeconds: 300 } }),
        { ok: false, error: "RATE_LIMITED", retryAfterSeconds: 300 },
      ],
      [
        jsonResponse(503, { ok: false, error: { code: "NOT_CONFIGURED" } }),
        { ok: false, error: "NOT_CONFIGURED" },
      ],
      [
        jsonResponse(503, { ok: false, error: { code: "SERVICE_UNAVAILABLE" } }),
        { ok: false, error: "UNAVAILABLE" },
      ],
      [new Error("ECONNREFUSED"), { ok: false, error: "NETWORK" }],
      [jsonResponse(200, { ok: true, data: { employee } }), { ok: false, error: "UNEXPECTED" }],
    ];
    for (const [response, expected] of cases) {
      const fetch = vi.fn<FetchLike>(() =>
        response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
      );
      const res = await createApiClient(BASE, fetch).login({
        employeeCode: "PBS-0012",
        password: "password123",
      });
      expect(res.outcome).toEqual(expected);
    }
  });
});

describe("session manager", () => {
  function harness(refreshResult: "ok" | "fail") {
    const timers: { fn: () => void; ms: number }[] = [];
    const ended: string[] = [];
    const calls: string[] = [];
    const fetch = vi.fn<FetchLike>((url) => {
      calls.push(url.replace(BASE, ""));
      if (url.endsWith("/employee-login"))
        return Promise.resolve(jsonResponse(200, { ok: true, data: { employee, session } }));
      if (url.endsWith("/refresh")) {
        return Promise.resolve(
          refreshResult === "ok"
            ? jsonResponse(200, {
                ok: true,
                data: {
                  employee,
                  session: { ...session, accessToken: "at-2", refreshToken: "rt-2" },
                },
              })
            : jsonResponse(401, { ok: false, error: { code: "UNAUTHENTICATED" } }),
        );
      }
      return Promise.resolve(jsonResponse(200, { ok: true, data: null }));
    });
    const manager = createSessionManager({
      api: createApiClient(BASE, fetch),
      now: () => (session.expiresAt - 3600) * 1000,
      setTimer: (fn, ms) => timers.push({ fn, ms }),
      clearTimer: () => undefined,
      onEnded: (reason) => ended.push(reason),
    });
    return { manager, timers, ended, calls, fetch };
  }

  it("schedules a refresh one minute before the access token expires", async () => {
    const h = harness("ok");
    await h.manager.login({ employeeCode: "PBS-0012", password: "password123" });
    expect(h.manager.current()).toEqual(employee);
    expect(h.timers.at(-1)?.ms).toBe(3600_000 - 60_000);
  });

  it("keeps the session when refresh succeeds", async () => {
    const h = harness("ok");
    await h.manager.login({ employeeCode: "PBS-0012", password: "password123" });
    expect(await h.manager.refreshNow()).toBe(true);
    expect(h.manager.current()).toEqual(employee);
    expect(h.ended).toEqual([]);
  });

  it("ends the session when refresh is refused (expired, revoked or suspended)", async () => {
    const h = harness("fail");
    await h.manager.login({ employeeCode: "PBS-0012", password: "password123" });
    expect(await h.manager.refreshNow()).toBe(false);
    expect(h.manager.current()).toBeNull();
    expect(h.ended).toEqual(["expired"]);
  });

  it("logout clears local state and revokes the server session with the bearer token", async () => {
    const h = harness("ok");
    await h.manager.login({ employeeCode: "PBS-0012", password: "password123" });
    await h.manager.logout();
    expect(h.manager.current()).toBeNull();
    const logoutCall = h.fetch.mock.calls.find(([url]) => url.endsWith("/logout"));
    expect(new Headers(logoutCall?.[1]?.headers).get("authorization")).toBe("Bearer at-1");
  });

  it("does not create a session on failed login", async () => {
    const h = harness("ok");
    await h.manager.login({ employeeCode: "bad", password: "x" });
    expect(h.manager.current()).toBeNull();
    expect(h.timers).toHaveLength(0);
  });
});
