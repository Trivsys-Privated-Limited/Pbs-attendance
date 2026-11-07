import { ADMIN_PORTAL_ROLES, PERMISSIONS, ROLE_PERMISSIONS } from "@pbs-attend/shared";
import { describe, expect, it } from "vitest";
import { authorize } from "../authorization";
import { PASSWORD, ctx, setup } from "./fakes";

const principal = (
  role: "super_admin" | "admin" | "manager" | "employee",
  status: "active" | "suspended" = "active",
) => ({
  profile: { id: `id-${role}`, role, status, displayName: role },
});

describe("permission matrix", () => {
  it("only staff roles can use the admin portal", () => {
    expect([...ADMIN_PORTAL_ROLES].sort()).toEqual(["admin", "manager", "super_admin"]);
  });

  it("employees hold no administrative permissions", () => {
    expect(ROLE_PERMISSIONS.employee).toEqual([]);
  });

  it("only super admins can manage admin-level roles", () => {
    const holders = Object.entries(ROLE_PERMISSIONS)
      .filter(([, perms]) => perms.includes("roles.manage_admins"))
      .map(([role]) => role);
    expect(holders).toEqual(["super_admin"]);
  });

  it("every role only references known permissions", () => {
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      for (const p of perms) expect(PERMISSIONS).toContain(p);
    }
  });
});

describe("authorize()", () => {
  it("rejects anonymous callers", () => {
    expect(authorize(null, "employees.read")).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("rejects suspended staff", () => {
    expect(authorize(principal("admin", "suspended"), "employees.read")).toEqual({
      ok: false,
      error: "UNAUTHENTICATED",
    });
  });

  it("forbids employees from admin actions", () => {
    expect(authorize(principal("employee"), "admin_portal.access")).toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
    expect(authorize(principal("employee"), "employees.read")).toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
  });

  it("lets managers read but not manage", () => {
    expect(authorize(principal("manager"), "employees.read").ok).toBe(true);
    expect(authorize(principal("manager"), "employees.manage")).toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
    expect(authorize(principal("manager"), "settings.manage")).toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
  });

  it("lets admins manage employees and settings", () => {
    expect(authorize(principal("admin"), "employees.manage").ok).toBe(true);
    expect(authorize(principal("admin"), "settings.manage").ok).toBe(true);
    expect(authorize(principal("admin"), "roles.manage_admins")).toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
  });
});

const newEmployee = {
  employeeCode: "PBS-0100",
  fullName: "Demo New Hire",
  password: "Initial-Pass-2026",
};

describe("employee creation (admin-controlled)", () => {
  it("refuses unauthenticated callers", async () => {
    const t = setup();
    expect(await t.service.createEmployee(null, newEmployee, ctx)).toEqual({
      ok: false,
      error: "UNAUTHENTICATED",
    });
  });

  it("refuses employees and managers", async () => {
    const t = setup();
    expect((await t.service.createEmployee(principal("employee"), newEmployee, ctx)).ok).toBe(
      false,
    );
    const res = await t.service.createEmployee(principal("manager"), newEmployee, ctx);
    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("lets an admin create an employee who can then sign in", async () => {
    const t = setup();
    const res = await t.service.createEmployee(principal("admin"), newEmployee, ctx);
    expect(res.ok).toBe(true);
    const login = await t.service.loginEmployee(
      { employeeCode: "PBS-0100", password: newEmployee.password },
      ctx,
    );
    expect(login.ok).toBe(true);
    expect(t.audit.actions()).toContain("employee.created");
  });

  it("generates the identity server-side and rejects client-supplied ids", async () => {
    const t = setup();
    const res = await t.service.createEmployee(
      principal("admin"),
      { ...newEmployee, profileId: "attacker-chosen" },
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toBe("VALIDATION_FAILED");
  });

  it("prevents an admin from creating admin-level accounts (privilege escalation)", async () => {
    const t = setup();
    for (const role of ["admin", "super_admin", "manager"] as const) {
      const res = await t.service.createEmployee(principal("admin"), { ...newEmployee, role }, ctx);
      expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    }
    expect(t.audit.actions()).toContain("employee.create.denied");
  });

  it("lets a super admin create a manager", async () => {
    const t = setup();
    const res = await t.service.createEmployee(
      principal("super_admin"),
      { ...newEmployee, role: "manager" },
      ctx,
    );
    expect(res.ok).toBe(true);
  });

  it("rejects duplicate Employee IDs", async () => {
    const t = setup();
    t.addEmployee("PBS-0100");
    const res = await t.service.createEmployee(principal("admin"), newEmployee, ctx);
    expect(!res.ok && res.error).toBe("CONFLICT");
  });

  it("enforces the new-password policy", async () => {
    const t = setup();
    for (const password of ["short1", "alllettersnodigits", "123456789012"]) {
      const res = await t.service.createEmployee(
        principal("admin"),
        { ...newEmployee, password },
        ctx,
      );
      expect(!res.ok && res.error).toBe("VALIDATION_FAILED");
    }
  });

  it("rolls back the Auth identity if the database insert fails", async () => {
    const t = setup();
    t.directory.failNextCreate = true;
    const res = await t.service.createEmployee(principal("admin"), newEmployee, ctx);
    expect(!res.ok && res.error).toBe("INTERNAL");
    expect(t.identity.users.size).toBe(0);
  });

  it("an employee created with a password can never use the admin portal", async () => {
    const t = setup();
    await t.service.createEmployee(principal("admin"), newEmployee, ctx);
    const [user] = [...t.identity.users.values()];
    if (!user) throw new Error("employee identity was not created");
    const res = await t.service.loginAdmin(
      { email: user.email, password: newEmployee.password },
      ctx,
    );
    expect(res.ok).toBe(false);
    expect(PASSWORD).not.toBe(newEmployee.password);
  });
});

describe("employee directory", () => {
  it("allows staff with employees.read and refuses other callers", async () => {
    const t = setup();
    t.addEmployee("PBS-0100");
    expect((await t.service.listEmployees(principal("manager"))).ok).toBe(true);
    expect(await t.service.listEmployees(principal("employee"))).toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
    expect(await t.service.listEmployees(null)).toEqual({
      ok: false,
      error: "UNAUTHENTICATED",
    });
  });
});
