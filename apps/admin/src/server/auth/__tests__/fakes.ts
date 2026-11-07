/**
 * In-memory fakes of the auth ports. Passwords are kept only inside this fake to emulate
 * Supabase Auth; production code never stores or sees password hashes.
 */
import type { UserRole } from "@pbs-attend/types";
import { createAuthService } from "../auth-service";
import type {
  AccountDirectory,
  AuditEvent,
  AuditLogger,
  Clock,
  EmployeeRecord,
  EmployeeAuthEvent,
  IdentityProvider,
  ProfileRecord,
  SignInResult,
} from "../ports";
import { MemoryRateLimiter } from "../rate-limit";

export const EMAIL_DOMAIN = "employees.pbs-attend.test";
export const employeeEmail = (profileId: string) => `${profileId}@${EMAIL_DOMAIN}`;

export class FakeClock implements Clock {
  t = Date.UTC(2026, 10, 7, 16, 0, 0);
  slept = 0;
  now() {
    return this.t;
  }
  sleep(ms: number) {
    this.slept += ms;
    this.t += ms;
    return Promise.resolve();
  }
  advance(ms: number) {
    this.t += ms;
  }
}

interface FakeUser {
  id: string;
  email: string;
  password: string;
}

export class FakeIdentity implements IdentityProvider {
  users = new Map<string, FakeUser>();
  /** access token -> user id for live (non-revoked) sessions */
  live = new Map<string, string>();
  refreshTokens = new Map<string, string>();
  revoked: string[] = [];
  signInCalls = 0;
  private seq = 0;

  addUser(id: string, email: string, password: string) {
    this.users.set(id, { id, email, password });
  }

  private issue(userId: string): SignInResult {
    this.seq++;
    const accessToken = `at-${userId}-${this.seq}`;
    const refreshToken = `rt-${userId}-${this.seq}`;
    this.live.set(accessToken, userId);
    this.refreshTokens.set(refreshToken, userId);
    return { ok: true, userId, session: { accessToken, refreshToken, expiresAt: 1_900_000_000 } };
  }

  signInWithPassword(email: string, password: string): Promise<SignInResult> {
    this.signInCalls++;
    const user = [...this.users.values()].find((u) => u.email === email);
    return Promise.resolve(
      user && user.password === password ? this.issue(user.id) : { ok: false },
    );
  }
  refresh(refreshToken: string): Promise<SignInResult> {
    const userId = this.refreshTokens.get(refreshToken);
    if (!userId) return Promise.resolve({ ok: false });
    this.refreshTokens.delete(refreshToken); // rotation
    return Promise.resolve(this.issue(userId));
  }
  getUserId(accessToken: string) {
    return Promise.resolve(this.live.get(accessToken) ?? null);
  }
  revoke(accessToken: string) {
    this.revoked.push(accessToken);
    this.live.delete(accessToken);
    return Promise.resolve();
  }
  createUser(input: { id: string; email: string; password: string }) {
    this.addUser(input.id, input.email, input.password);
    return Promise.resolve({ ok: true as const });
  }
  deleteUser(id: string) {
    this.users.delete(id);
    return Promise.resolve();
  }
}

export class FakeDirectory implements AccountDirectory {
  profiles = new Map<string, ProfileRecord>();
  employees: EmployeeRecord[] = [];
  signedIn: string[] = [];
  failNextCreate = false;

  getProfile(id: string) {
    return Promise.resolve(this.profiles.get(id) ?? null);
  }
  findEmployeeByCode(code: string) {
    return Promise.resolve(this.employees.find((e) => e.employeeCode === code) ?? null);
  }
  findEmployeeByProfile(profileId: string) {
    return Promise.resolve(this.employees.find((e) => e.profileId === profileId) ?? null);
  }
  setStatus(id: string, status: ProfileRecord["status"]) {
    const profile = this.profiles.get(id);
    if (!profile) throw new Error(`no profile ${id}`);
    this.profiles.set(id, { ...profile, status });
  }
  markSignedIn(id: string) {
    this.signedIn.push(id);
    return Promise.resolve();
  }
  listEmployees() {
    return Promise.resolve(
      this.employees.map((employee) => {
        const profile = this.profiles.get(employee.profileId);
        if (!profile) throw new Error(`no profile ${employee.profileId}`);
        return {
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          email: null,
          department: null,
          designation: null,
          role: profile.role,
          status: profile.status,
        };
      }),
    );
  }
  createEmployeeAccount(input: Parameters<AccountDirectory["createEmployeeAccount"]>[0]) {
    if (this.failNextCreate) return Promise.reject(new Error("db down"));
    this.profiles.set(input.profileId, {
      id: input.profileId,
      role: input.role,
      status: "active",
      displayName: input.fullName,
    });
    const record: EmployeeRecord = {
      id: `emp-${input.profileId}`,
      profileId: input.profileId,
      employeeCode: input.employeeCode,
      fullName: input.fullName,
    };
    this.employees.push(record);
    return Promise.resolve(record);
  }
}

export class FakeAudit implements AuditLogger {
  events: AuditEvent[] = [];
  employeeAuthEvents: EmployeeAuthEvent[] = [];
  record(event: AuditEvent) {
    this.events.push(event);
    return Promise.resolve();
  }
  actions() {
    return this.events.map((e) => e.action);
  }
  listEmployeeAuthEvents(limit: number) {
    return Promise.resolve(this.employeeAuthEvents.slice(0, limit));
  }
}

export const PASSWORD = "Correct-Horse-42";

export function setup() {
  const clock = new FakeClock();
  const identity = new FakeIdentity();
  const directory = new FakeDirectory();
  const audit = new FakeAudit();
  const limiter = new MemoryRateLimiter(clock);
  let idSeq = 0;
  const service = createAuthService({
    identity,
    directory,
    limiter,
    audit,
    clock,
    secret: "test-secret-0123456789abcdef0123456789",
    employeeAuthEmail: employeeEmail,
    minLoginMs: 400,
    newId: () => `00000000-0000-4000-8000-${String(++idSeq).padStart(12, "0")}`,
  });

  function addEmployee(
    code: string,
    opts: { status?: ProfileRecord["status"]; role?: UserRole } = {},
  ) {
    const profileId = `p-${code}`;
    directory.profiles.set(profileId, {
      id: profileId,
      role: opts.role ?? "employee",
      status: opts.status ?? "active",
      displayName: `Demo ${code}`,
    });
    directory.employees.push({
      id: `e-${code}`,
      profileId,
      employeeCode: code,
      fullName: `Demo ${code}`,
    });
    identity.addUser(profileId, employeeEmail(profileId), PASSWORD);
    return profileId;
  }

  function addStaff(email: string, role: UserRole, status: ProfileRecord["status"] = "active") {
    const id = `staff-${email}`;
    directory.profiles.set(id, { id, role, status, displayName: email });
    identity.addUser(id, email, PASSWORD);
    return id;
  }

  return { clock, identity, directory, audit, limiter, service, addEmployee, addStaff };
}

export const ctx = { ipAddress: "203.0.113.7", userAgent: "vitest" };
