import { roleHasPermission } from "@pbs-attend/shared";
import type { UserRole } from "@pbs-attend/types";
import {
  adminLoginSchema,
  createEmployeeSchema,
  employeeLoginSchema,
  type CreateEmployeeInput,
} from "@pbs-attend/validation";
import { authorize, type Principal } from "./authorization";
import type {
  AccountDirectory,
  AuditLogger,
  AuthSession,
  Clock,
  EmployeeRecord,
  IdentityProvider,
  EmployeeAuthEvent,
  ManagedEmployeeRecord,
  ProfileRecord,
  RateLimiter,
  RequestContext,
} from "./ports";
import { loginRules } from "./rate-limit";

export interface AuthServiceDeps {
  identity: IdentityProvider;
  directory: AccountDirectory;
  limiter: RateLimiter;
  audit: AuditLogger;
  clock: Clock;
  /** Server secret used to pseudonymize rate-limit keys. */
  secret: string;
  /** Maps a profile id to the internal Supabase Auth email of an employee identity. */
  employeeAuthEmail: (profileId: string) => string;
  /** Every login attempt takes at least this long, so timing does not reveal which check failed. */
  minLoginMs: number;
  newId: () => string;
}

/**
 * Login failures are deliberately generic. Unknown Employee ID, wrong password,
 * suspended account and wrong role all return INVALID_CREDENTIALS.
 */
export type LoginFailure =
  | { ok: false; error: "INVALID_CREDENTIALS" }
  | { ok: false; error: "RATE_LIMITED"; retryAfterSeconds: number }
  /** Backend dependency unreachable. Fails closed; never treated as a successful login. */
  | { ok: false; error: "UNAVAILABLE" };

export type EmployeeLoginResult =
  | { ok: true; profile: ProfileRecord; employee: EmployeeRecord; session: AuthSession }
  | LoginFailure;

export type AdminLoginResult =
  { ok: true; profile: ProfileRecord; session: AuthSession } | LoginFailure;

export type CreateEmployeeResult =
  | { ok: true; employee: EmployeeRecord }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION_FAILED" | "CONFLICT" | "INTERNAL";
      message?: string;
    };

export type ListEmployeesResult =
  | { ok: true; employees: ManagedEmployeeRecord[] }
  | { ok: false; error: "UNAUTHENTICATED" | "FORBIDDEN" | "INTERNAL" };

export type ListEmployeeAuthEventsResult =
  | { ok: true; events: EmployeeAuthEvent[] }
  | { ok: false; error: "UNAUTHENTICATED" | "FORBIDDEN" | "INTERNAL" };

const INVALID: LoginFailure = { ok: false, error: "INVALID_CREDENTIALS" };

export function createAuthService(deps: AuthServiceDeps) {
  const { identity, directory, limiter, audit, clock } = deps;

  async function withMinimumDuration<T>(startedAt: number, result: T): Promise<T> {
    const elapsed = clock.now() - startedAt;
    if (elapsed < deps.minLoginMs) await clock.sleep(deps.minLoginMs - elapsed);
    return result;
  }

  async function loginEmployee(input: unknown, ctx: RequestContext): Promise<EmployeeLoginResult> {
    const startedAt = clock.now();
    const parsed = employeeLoginSchema.safeParse(input);
    const identifier = parsed.success
      ? parsed.data.employeeCode
      : typeof input === "object" && input !== null && "employeeCode" in input
        ? String((input as { employeeCode: unknown }).employeeCode).slice(0, 32)
        : "";
    const rules = loginRules(deps.secret, "employee", identifier, ctx.ipAddress);

    const gate = await limiter.check(rules.all);
    if (gate.unavailable)
      return withMinimumDuration(startedAt, { ok: false, error: "UNAVAILABLE" });
    if (!gate.allowed) {
      await audit.record({
        action: "auth.employee_login.throttled",
        ...auditCtx(ctx),
        metadata: { identifierKey: rules.identifier.key },
      });
      return withMinimumDuration(startedAt, {
        ok: false,
        error: "RATE_LIMITED",
        retryAfterSeconds: gate.retryAfterSeconds,
      });
    }

    const fail = async (
      reason: string,
      actor: string | null = null,
    ): Promise<EmployeeLoginResult> => {
      await limiter.recordFailure(rules.all);
      await audit.record({
        action: "auth.employee_login.failed",
        actorProfileId: actor,
        ...auditCtx(ctx),
        metadata: { reason, identifierKey: rules.identifier.key },
      });
      return withMinimumDuration(startedAt, INVALID);
    };

    if (!parsed.success) return fail("malformed_input");

    const employee = await directory.findEmployeeByCode(parsed.data.employeeCode);
    if (!employee) return fail("unknown_employee_id");

    const signIn = await identity.signInWithPassword(
      deps.employeeAuthEmail(employee.profileId),
      parsed.data.password,
    );
    if (!signIn.ok) return fail("bad_password", employee.profileId);

    const profile = await directory.getProfile(signIn.userId);
    if (!profile || profile.id !== employee.profileId || profile.status !== "active") {
      // Credentials were correct but the account may not sign in: revoke the new session.
      await identity.revoke(signIn.session.accessToken);
      return fail(profile ? `account_${profile.status}` : "profile_missing", signIn.userId);
    }

    await limiter.reset(rules.identifier);
    await directory.markSignedIn(profile.id);
    await audit.record({
      action: "auth.employee_login.succeeded",
      actorProfileId: profile.id,
      targetType: "employee",
      targetId: employee.id,
      ...auditCtx(ctx),
    });
    return withMinimumDuration(startedAt, { ok: true, profile, employee, session: signIn.session });
  }

  async function loginAdmin(input: unknown, ctx: RequestContext): Promise<AdminLoginResult> {
    const startedAt = clock.now();
    const parsed = adminLoginSchema.safeParse(input);
    const identifier = parsed.success
      ? parsed.data.email
      : typeof input === "object" && input !== null && "email" in input
        ? String((input as { email: unknown }).email).slice(0, 254)
        : "";
    const rules = loginRules(deps.secret, "admin", identifier, ctx.ipAddress);

    const gate = await limiter.check(rules.all);
    if (gate.unavailable)
      return withMinimumDuration(startedAt, { ok: false, error: "UNAVAILABLE" });
    if (!gate.allowed) {
      await audit.record({
        action: "auth.admin_login.throttled",
        ...auditCtx(ctx),
        metadata: { identifierKey: rules.identifier.key },
      });
      return withMinimumDuration(startedAt, {
        ok: false,
        error: "RATE_LIMITED",
        retryAfterSeconds: gate.retryAfterSeconds,
      });
    }

    const fail = async (reason: string, actor: string | null = null): Promise<AdminLoginResult> => {
      await limiter.recordFailure(rules.all);
      await audit.record({
        action: "auth.admin_login.failed",
        actorProfileId: actor,
        ...auditCtx(ctx),
        metadata: { reason, identifierKey: rules.identifier.key },
      });
      return withMinimumDuration(startedAt, INVALID);
    };

    if (!parsed.success) return fail("malformed_input");

    const signIn = await identity.signInWithPassword(parsed.data.email, parsed.data.password);
    if (!signIn.ok) return fail("bad_credentials");

    const profile = await directory.getProfile(signIn.userId);
    if (
      !profile ||
      profile.status !== "active" ||
      !roleHasPermission(profile.role, "admin_portal.access")
    ) {
      await identity.revoke(signIn.session.accessToken);
      const reason = !profile
        ? "profile_missing"
        : profile.status !== "active"
          ? `account_${profile.status}`
          : "role_not_permitted";
      return fail(reason, signIn.userId);
    }

    await limiter.reset(rules.identifier);
    await directory.markSignedIn(profile.id);
    await audit.record({
      action: "auth.admin_login.succeeded",
      actorProfileId: profile.id,
      ...auditCtx(ctx),
    });
    return withMinimumDuration(startedAt, { ok: true, profile, session: signIn.session });
  }

  /**
   * Resolves a bearer access token to a principal. The token is validated by Supabase
   * Auth; role and status always come from the database.
   */
  async function authenticateAccessToken(accessToken: string | null): Promise<Principal | null> {
    if (!accessToken) return null;
    const userId = await identity.getUserId(accessToken);
    if (!userId) return null;
    const profile = await directory.getProfile(userId);
    if (!profile || profile.status !== "active") return null;
    return { profile };
  }

  /** Refreshes an employee's desktop session, re-checking that the account may still sign in. */
  async function refreshEmployeeSession(
    refreshToken: unknown,
    ctx: RequestContext,
  ): Promise<
    | { ok: true; session: AuthSession; employee: EmployeeRecord }
    | { ok: false; error: "UNAUTHENTICATED" }
  > {
    if (typeof refreshToken !== "string" || refreshToken.length < 8 || refreshToken.length > 2048) {
      return { ok: false, error: "UNAUTHENTICATED" };
    }
    const refreshed = await identity.refresh(refreshToken);
    if (!refreshed.ok) return { ok: false, error: "UNAUTHENTICATED" };

    const profile = await directory.getProfile(refreshed.userId);
    const employee = profile ? await directory.findEmployeeByProfile(profile.id) : null;
    if (!profile || profile.status !== "active" || !employee) {
      await identity.revoke(refreshed.session.accessToken);
      await audit.record({
        action: "auth.session.refresh_blocked",
        actorProfileId: refreshed.userId,
        ...auditCtx(ctx),
        metadata: { reason: profile ? `account_${profile.status}` : "profile_missing" },
      });
      return { ok: false, error: "UNAUTHENTICATED" };
    }
    return { ok: true, session: refreshed.session, employee };
  }

  async function logout(accessToken: string | null, ctx: RequestContext): Promise<void> {
    if (!accessToken) return;
    const userId = await identity.getUserId(accessToken);
    await identity.revoke(accessToken);
    if (userId) {
      const employee = await directory.findEmployeeByProfile(userId);
      await audit.record({
        action: employee ? "auth.employee_logout.succeeded" : "auth.logout",
        actorProfileId: userId,
        ...(employee ? { targetType: "employee", targetId: employee.id } : {}),
        ...auditCtx(ctx),
      });
    }
  }

  async function listEmployeeAuthEvents(
    principal: Principal | null,
  ): Promise<ListEmployeeAuthEventsResult> {
    const authz = authorize(principal, "audit.read");
    if (!authz.ok) return { ok: false, error: authz.error };
    try {
      return { ok: true, events: await audit.listEmployeeAuthEvents(50) };
    } catch {
      return { ok: false, error: "INTERNAL" };
    }
  }

  async function listEmployees(principal: Principal | null): Promise<ListEmployeesResult> {
    const authz = authorize(principal, "employees.read");
    if (!authz.ok) return { ok: false, error: authz.error };
    try {
      return { ok: true, employees: await directory.listEmployees() };
    } catch {
      return { ok: false, error: "INTERNAL" };
    }
  }

  /**
   * Creates an employee: Auth identity (internal email + hashed password by Supabase),
   * profile and employee record. Only callers with employees.manage may do this, and only
   * super admins may create admin-level accounts.
   */
  async function createEmployee(
    principal: Principal | null,
    input: unknown,
    ctx: RequestContext,
  ): Promise<CreateEmployeeResult> {
    const authz = authorize(principal, "employees.manage");
    if (!authz.ok) return { ok: false, error: authz.error };
    const actor = authz.principal.profile;

    const parsed = createEmployeeSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: "VALIDATION_FAILED",
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    const data: CreateEmployeeInput = parsed.data;

    const role: UserRole = data.role;
    if (role !== "employee" && !roleHasPermission(actor.role, "roles.manage_admins")) {
      await audit.record({
        action: "employee.create.denied",
        actorProfileId: actor.id,
        ...auditCtx(ctx),
        metadata: { requestedRole: role },
      });
      return { ok: false, error: "FORBIDDEN" };
    }

    if (await directory.findEmployeeByCode(data.employeeCode)) {
      return { ok: false, error: "CONFLICT", message: "That Employee ID is already in use" };
    }

    const profileId = deps.newId();
    const created = await identity.createUser({
      id: profileId,
      email: deps.employeeAuthEmail(profileId),
      password: data.password,
    });
    if (!created.ok)
      return { ok: false, error: "INTERNAL", message: "Could not create the sign-in identity" };

    try {
      const employee = await directory.createEmployeeAccount({
        profileId,
        role,
        employeeCode: data.employeeCode,
        fullName: data.fullName,
        email: data.email ?? null,
        department: data.department ?? null,
        designation: data.designation ?? null,
      });
      await audit.record({
        action: "employee.created",
        actorProfileId: actor.id,
        targetType: "employee",
        targetId: employee.id,
        ...auditCtx(ctx),
        metadata: { employeeCode: employee.employeeCode, role },
      });
      return { ok: true, employee };
    } catch {
      // Compensate: never leave an Auth identity without a profile/employee record.
      await identity.deleteUser(profileId);
      return { ok: false, error: "INTERNAL", message: "Could not create the employee record" };
    }
  }

  return {
    loginEmployee,
    loginAdmin,
    authenticateAccessToken,
    refreshEmployeeSession,
    logout,
    listEmployeeAuthEvents,
    listEmployees,
    createEmployee,
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

function auditCtx(ctx: RequestContext) {
  return { ipAddress: ctx.ipAddress, userAgent: ctx.userAgent?.slice(0, 512) ?? null };
}
