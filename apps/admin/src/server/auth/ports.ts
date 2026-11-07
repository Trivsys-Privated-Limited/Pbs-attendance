/**
 * Ports (interfaces) used by the authentication service. Production adapters live in
 * src/server/supabase/adapters.ts; tests use in-memory fakes. Keeping the service
 * independent of Supabase makes every security rule unit-testable.
 */
import type { AccountStatus, UserRole } from "@pbs-attend/types";
import type { ManagedEmployee } from "@pbs-attend/shared";

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds (from Supabase Auth). */
  expiresAt: number;
}

export type SignInResult = { ok: true; userId: string; session: AuthSession } | { ok: false };

export interface IdentityProvider {
  signInWithPassword(email: string, password: string): Promise<SignInResult>;
  refresh(refreshToken: string): Promise<SignInResult>;
  /** Validates an access token with Supabase Auth and returns its user id. */
  getUserId(accessToken: string): Promise<string | null>;
  /** Revokes the session that owns this access token. Never throws. */
  revoke(accessToken: string): Promise<void>;
  createUser(input: {
    id: string;
    email: string;
    password: string;
  }): Promise<{ ok: true } | { ok: false; reason: string }>;
  deleteUser(id: string): Promise<void>;
}

export interface ProfileRecord {
  id: string;
  role: UserRole;
  status: AccountStatus;
  displayName: string;
}

export interface EmployeeRecord {
  id: string;
  profileId: string;
  employeeCode: string;
  fullName: string;
}

export type ManagedEmployeeRecord = ManagedEmployee;

export interface AccountDirectory {
  getProfile(profileId: string): Promise<ProfileRecord | null>;
  findEmployeeByCode(employeeCode: string): Promise<EmployeeRecord | null>;
  findEmployeeByProfile(profileId: string): Promise<EmployeeRecord | null>;
  markSignedIn(profileId: string): Promise<void>;
  listEmployees(): Promise<ManagedEmployeeRecord[]>;
  createEmployeeAccount(input: {
    profileId: string;
    role: UserRole;
    employeeCode: string;
    fullName: string;
    email: string | null;
    department: string | null;
    designation: string | null;
  }): Promise<EmployeeRecord>;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  /** True when the limiter could not be consulted (fail closed, but not a lockout). */
  unavailable?: boolean;
}

export interface RateLimitRule {
  /** HMAC of the identifier (never the raw value). */
  key: string;
  maxFailures: number;
  windowSeconds: number;
  lockSeconds: number;
}

export interface RateLimiter {
  check(rules: readonly RateLimitRule[]): Promise<RateLimitDecision>;
  recordFailure(rules: readonly RateLimitRule[]): Promise<void>;
  reset(rule: RateLimitRule): Promise<void>;
}

export interface AuditEvent {
  action: string;
  actorProfileId?: string | null;
  targetType?: string;
  targetId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Never put passwords, tokens or other secrets here. */
  metadata?: Record<string, unknown>;
}

export interface EmployeeAuthEvent {
  occurredAt: string;
  action: "login" | "logout";
  employeeCode: string;
  fullName: string;
}

export interface AuditLogger {
  record(event: AuditEvent): Promise<void>;
  listEmployeeAuthEvents(limit: number): Promise<EmployeeAuthEvent[]>;
}

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}
