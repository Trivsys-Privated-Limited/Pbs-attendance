import { describe, expect, it } from "vitest";
import { PASSWORD, ctx, setup } from "./fakes";

describe("employee login", () => {
  it("accepts a valid Employee ID and password", async () => {
    const t = setup();
    const profileId = t.addEmployee("PBS-0012");
    const res = await t.service.loginEmployee(
      { employeeCode: "PBS-0012", password: PASSWORD },
      ctx,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.profile.id).toBe(profileId);
    expect(res.employee.employeeCode).toBe("PBS-0012");
    expect(res.session.accessToken).toBeTruthy();
    expect(t.directory.signedIn).toEqual([profileId]);
    expect(t.audit.actions()).toContain("auth.employee_login.succeeded");
  });

  it("normalises the Employee ID to upper case", async () => {
    const t = setup();
    t.addEmployee("PBS-0012");
    const res = await t.service.loginEmployee(
      { employeeCode: " pbs-0012 ", password: PASSWORD },
      ctx,
    );
    expect(res.ok).toBe(true);
  });

  it("rejects a wrong password with a generic error", async () => {
    const t = setup();
    t.addEmployee("PBS-0012");
    const res = await t.service.loginEmployee(
      { employeeCode: "PBS-0012", password: "wrong-password-1" },
      ctx,
    );
    expect(res).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
  });

  it("returns the identical error for an unknown Employee ID (no enumeration)", async () => {
    const t = setup();
    t.addEmployee("PBS-0012");
    const unknown = await t.service.loginEmployee(
      { employeeCode: "PBS-0999", password: PASSWORD },
      ctx,
    );
    const wrongPw = await t.service.loginEmployee(
      { employeeCode: "PBS-0012", password: "wrong-password-1" },
      ctx,
    );
    expect(unknown).toEqual(wrongPw);
    // An unknown ID never reaches Supabase Auth.
    expect(t.identity.signInCalls).toBe(1);
  });

  it("takes at least the minimum duration on every outcome", async () => {
    const t = setup();
    t.addEmployee("PBS-0012");
    for (const input of [
      { employeeCode: "PBS-0999", password: PASSWORD },
      { employeeCode: "PBS-0012", password: "wrong-password-1" },
      { employeeCode: "PBS-0012", password: PASSWORD },
      { employeeCode: "not-an-id", password: "x" },
    ]) {
      const start = t.clock.now();
      await t.service.loginEmployee(input, ctx);
      expect(t.clock.now() - start).toBeGreaterThanOrEqual(400);
    }
  });

  it("treats malformed input as invalid credentials", async () => {
    const t = setup();
    for (const input of [
      null,
      "x",
      {},
      { employeeCode: 42, password: [] },
      { employeeCode: "PBS-0012" },
    ]) {
      expect(await t.service.loginEmployee(input, ctx)).toEqual({
        ok: false,
        error: "INVALID_CREDENTIALS",
      });
    }
  });

  it("blocks a suspended employee even with the correct password and revokes the session", async () => {
    const t = setup();
    t.addEmployee("PBS-0013", { status: "suspended" });
    const res = await t.service.loginEmployee(
      { employeeCode: "PBS-0013", password: PASSWORD },
      ctx,
    );
    expect(res).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
    expect(t.identity.revoked).toHaveLength(1);
    expect(t.identity.live.size).toBe(0);
    const failed = t.audit.events.find((e) => e.action === "auth.employee_login.failed");
    expect(failed?.metadata?.reason).toBe("account_suspended");
  });

  it("blocks an archived employee", async () => {
    const t = setup();
    t.addEmployee("PBS-0014", { status: "archived" });
    const res = await t.service.loginEmployee(
      { employeeCode: "PBS-0014", password: PASSWORD },
      ctx,
    );
    expect(res.ok).toBe(false);
  });

  it("locks an Employee ID after 5 failures and reports retry-after", async () => {
    const t = setup();
    t.addEmployee("PBS-0012");
    for (let i = 0; i < 5; i++) {
      await t.service.loginEmployee(
        { employeeCode: "PBS-0012", password: `wrong-password-${i}` },
        ctx,
      );
    }
    const locked = await t.service.loginEmployee(
      { employeeCode: "PBS-0012", password: PASSWORD },
      ctx,
    );
    expect(locked.ok).toBe(false);
    if (locked.ok || locked.error !== "RATE_LIMITED") throw new Error("expected RATE_LIMITED");
    expect(locked.retryAfterSeconds).toBeGreaterThan(0);
    expect(locked.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
    // While locked, Supabase Auth is not even called.
    expect(t.identity.signInCalls).toBe(5);
    expect(t.audit.actions()).toContain("auth.employee_login.throttled");
  });

  it("unlocks after the lock period", async () => {
    const t = setup();
    t.addEmployee("PBS-0012");
    for (let i = 0; i < 5; i++) {
      await t.service.loginEmployee(
        { employeeCode: "PBS-0012", password: `wrong-password-${i}` },
        ctx,
      );
    }
    t.clock.advance(15 * 60 * 1000 + 1);
    const res = await t.service.loginEmployee(
      { employeeCode: "PBS-0012", password: PASSWORD },
      ctx,
    );
    expect(res.ok).toBe(true);
  });

  it("throttles unknown Employee IDs too", async () => {
    const t = setup();
    for (let i = 0; i < 5; i++) {
      await t.service.loginEmployee(
        { employeeCode: "PBS-0999", password: `wrong-password-${i}` },
        ctx,
      );
    }
    const res = await t.service.loginEmployee(
      { employeeCode: "PBS-0999", password: PASSWORD },
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toBe("RATE_LIMITED");
  });

  it("resets the failure counter after a successful login", async () => {
    const t = setup();
    t.addEmployee("PBS-0012");
    for (let i = 0; i < 4; i++) {
      await t.service.loginEmployee(
        { employeeCode: "PBS-0012", password: `wrong-password-${i}` },
        ctx,
      );
    }
    expect(
      (await t.service.loginEmployee({ employeeCode: "PBS-0012", password: PASSWORD }, ctx)).ok,
    ).toBe(true);
    for (let i = 0; i < 4; i++) {
      await t.service.loginEmployee(
        { employeeCode: "PBS-0012", password: `wrong-password-${i}` },
        ctx,
      );
    }
    expect(
      (await t.service.loginEmployee({ employeeCode: "PBS-0012", password: PASSWORD }, ctx)).ok,
    ).toBe(true);
  });

  it("never writes the password or tokens to the audit log", async () => {
    const t = setup();
    t.addEmployee("PBS-0012");
    await t.service.loginEmployee({ employeeCode: "PBS-0012", password: PASSWORD }, ctx);
    await t.service.loginEmployee({ employeeCode: "PBS-0012", password: "wrong-password-1" }, ctx);
    const serialized = JSON.stringify(t.audit.events);
    expect(serialized).not.toContain(PASSWORD);
    expect(serialized).not.toContain("wrong-password-1");
    expect(serialized).not.toMatch(/at-|rt-/);
  });
});

describe("admin login", () => {
  it("accepts an active admin", async () => {
    const t = setup();
    t.addStaff("admin@example.com", "admin");
    const res = await t.service.loginAdmin({ email: "admin@example.com", password: PASSWORD }, ctx);
    expect(res.ok).toBe(true);
  });

  it("accepts a manager (read-only admin portal access)", async () => {
    const t = setup();
    t.addStaff("manager@example.com", "manager");
    expect(
      (await t.service.loginAdmin({ email: "manager@example.com", password: PASSWORD }, ctx)).ok,
    ).toBe(true);
  });

  it("rejects an employee identity at the admin portal and revokes its session", async () => {
    const t = setup();
    const profileId = t.addEmployee("PBS-0012");
    const res = await t.service.loginAdmin(
      { email: `${profileId}@employees.pbs-attend.test`, password: PASSWORD },
      ctx,
    );
    expect(res).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
    expect(t.identity.live.size).toBe(0);
  });

  it("rejects a suspended admin", async () => {
    const t = setup();
    t.addStaff("old-admin@example.com", "admin", "suspended");
    const res = await t.service.loginAdmin(
      { email: "old-admin@example.com", password: PASSWORD },
      ctx,
    );
    expect(res).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
  });

  it("rejects wrong credentials generically", async () => {
    const t = setup();
    t.addStaff("admin@example.com", "admin");
    const wrong = await t.service.loginAdmin(
      { email: "admin@example.com", password: "wrong-password-1" },
      ctx,
    );
    const unknown = await t.service.loginAdmin(
      { email: "nobody@example.com", password: PASSWORD },
      ctx,
    );
    expect(wrong).toEqual(unknown);
  });

  it("locks an admin email after 5 failures", async () => {
    const t = setup();
    t.addStaff("admin@example.com", "admin");
    for (let i = 0; i < 5; i++) {
      await t.service.loginAdmin(
        { email: "admin@example.com", password: `wrong-password-${i}` },
        ctx,
      );
    }
    const res = await t.service.loginAdmin({ email: "admin@example.com", password: PASSWORD }, ctx);
    expect(!res.ok && res.error).toBe("RATE_LIMITED");
  });
});

describe("IP-based throttling", () => {
  it("locks an IP that sprays many Employee IDs", async () => {
    const t = setup();
    t.addEmployee("PBS-0012");
    for (let i = 0; i < 30; i++) {
      await t.service.loginEmployee(
        { employeeCode: `PBS-${1000 + i}`, password: "wrong-password-1" },
        ctx,
      );
    }
    const res = await t.service.loginEmployee(
      { employeeCode: "PBS-0012", password: PASSWORD },
      ctx,
    );
    expect(!res.ok && res.error).toBe("RATE_LIMITED");
    // A different IP is unaffected.
    const other = await t.service.loginEmployee(
      { employeeCode: "PBS-0012", password: PASSWORD },
      { ...ctx, ipAddress: "198.51.100.9" },
    );
    expect(other.ok).toBe(true);
  });
});

describe("sessions", () => {
  it("authenticates a live access token using the server-side profile", async () => {
    const t = setup();
    t.addEmployee("PBS-0012");
    const login = await t.service.loginEmployee(
      { employeeCode: "PBS-0012", password: PASSWORD },
      ctx,
    );
    if (!login.ok) throw new Error("login failed");
    const principal = await t.service.authenticateAccessToken(login.session.accessToken);
    expect(principal?.profile.role).toBe("employee");
  });

  it("rejects unknown, missing and revoked tokens", async () => {
    const t = setup();
    t.addEmployee("PBS-0012");
    expect(await t.service.authenticateAccessToken(null)).toBeNull();
    expect(await t.service.authenticateAccessToken("forged-token")).toBeNull();
    const login = await t.service.loginEmployee(
      { employeeCode: "PBS-0012", password: PASSWORD },
      ctx,
    );
    if (!login.ok) throw new Error("login failed");
    await t.service.logout(login.session.accessToken, ctx);
    expect(await t.service.authenticateAccessToken(login.session.accessToken)).toBeNull();
    expect(t.audit.actions()).toContain("auth.employee_logout.succeeded");
    expect(t.audit.events.at(-1)).toMatchObject({
      targetType: "employee",
      targetId: "e-PBS-0012",
    });
  });

  it("stops accepting a token as soon as the account is suspended", async () => {
    const t = setup();
    const profileId = t.addEmployee("PBS-0012");
    const login = await t.service.loginEmployee(
      { employeeCode: "PBS-0012", password: PASSWORD },
      ctx,
    );
    if (!login.ok) throw new Error("login failed");
    t.directory.setStatus(profileId, "suspended");
    expect(await t.service.authenticateAccessToken(login.session.accessToken)).toBeNull();
  });

  it("refreshes an active employee session and rotates the refresh token", async () => {
    const t = setup();
    t.addEmployee("PBS-0012");
    const login = await t.service.loginEmployee(
      { employeeCode: "PBS-0012", password: PASSWORD },
      ctx,
    );
    if (!login.ok) throw new Error("login failed");
    const refreshed = await t.service.refreshEmployeeSession(login.session.refreshToken, ctx);
    expect(refreshed.ok).toBe(true);
    const reused = await t.service.refreshEmployeeSession(login.session.refreshToken, ctx);
    expect(reused).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("refuses to refresh a suspended employee's session", async () => {
    const t = setup();
    const profileId = t.addEmployee("PBS-0012");
    const login = await t.service.loginEmployee(
      { employeeCode: "PBS-0012", password: PASSWORD },
      ctx,
    );
    if (!login.ok) throw new Error("login failed");
    t.directory.setStatus(profileId, "suspended");
    const res = await t.service.refreshEmployeeSession(login.session.refreshToken, ctx);
    expect(res).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(t.audit.actions()).toContain("auth.session.refresh_blocked");
  });

  it("refuses to refresh a non-employee (admin) identity on the employee endpoint", async () => {
    const t = setup();
    t.addStaff("admin@example.com", "admin");
    const login = await t.service.loginAdmin(
      { email: "admin@example.com", password: PASSWORD },
      ctx,
    );
    if (!login.ok) throw new Error("login failed");
    expect((await t.service.refreshEmployeeSession(login.session.refreshToken, ctx)).ok).toBe(
      false,
    );
  });

  it("rejects malformed refresh tokens without calling Supabase", async () => {
    const t = setup();
    for (const token of [undefined, 42, "", "x".repeat(5000)]) {
      expect((await t.service.refreshEmployeeSession(token, ctx)).ok).toBe(false);
    }
  });
});

describe("backend unavailable", () => {
  it("fails closed with UNAVAILABLE (not a lockout, never a login) when the limiter is unreachable", async () => {
    const t = setup();
    t.addEmployee("PBS-0012");
    t.limiter.check = () =>
      Promise.resolve({ allowed: false, retryAfterSeconds: 0, unavailable: true });
    const res = await t.service.loginEmployee(
      { employeeCode: "PBS-0012", password: PASSWORD },
      ctx,
    );
    expect(res).toEqual({ ok: false, error: "UNAVAILABLE" });
    expect(t.identity.signInCalls).toBe(0);
    const admin = await t.service.loginAdmin({ email: "a@example.com", password: PASSWORD }, ctx);
    expect(admin).toEqual({ ok: false, error: "UNAVAILABLE" });
  });
});
