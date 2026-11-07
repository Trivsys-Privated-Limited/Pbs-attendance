import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
  AccountDirectory,
  AuditEvent,
  AuditLogger,
  EmployeeRecord,
  EmployeeAuthEvent,
  IdentityProvider,
  ManagedEmployeeRecord,
  ProfileRecord,
  RateLimitDecision,
  RateLimitRule,
  RateLimiter,
  SignInResult,
} from "../auth/ports";

/**
 * Supabase implementations of the auth ports. Errors from Supabase are logged by
 * category only (never with tokens, passwords or keys) and mapped to safe results.
 */

function logError(scope: string, error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : "unknown error";
  console.error(`[auth] ${scope}: ${message.slice(0, 200)}`);
}

export function createSupabaseIdentity(
  stateless: () => SupabaseClient,
  serviceRole: () => SupabaseClient,
): IdentityProvider {
  const toResult = (data: {
    user: { id: string } | null;
    session: { access_token: string; refresh_token: string; expires_at?: number } | null;
  }): SignInResult =>
    data.user && data.session
      ? {
          ok: true,
          userId: data.user.id,
          session: {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at ?? 0,
          },
        }
      : { ok: false };

  return {
    async signInWithPassword(email, password) {
      const { data, error } = await stateless().auth.signInWithPassword({ email, password });
      if (error) return { ok: false };
      return toResult(data);
    },
    async refresh(refreshToken) {
      const { data, error } = await stateless().auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (error) return { ok: false };
      return toResult(data);
    },
    async getUserId(accessToken) {
      const { data, error } = await stateless().auth.getUser(accessToken);
      if (error || !data.user) return null;
      return data.user.id;
    },
    async revoke(accessToken) {
      const { error } = await serviceRole().auth.admin.signOut(accessToken, "local");
      if (error) logError("revoke", error);
    },
    async createUser({ id, email, password }) {
      const { error } = await serviceRole().auth.admin.createUser({
        id,
        email,
        password,
        email_confirm: true,
        // Informational only. Authorization never reads metadata; it reads profiles.role.
        app_metadata: { pbs_attend: true },
      });
      if (error) {
        logError("createUser", error);
        return { ok: false, reason: "auth_create_failed" };
      }
      return { ok: true };
    },
    async deleteUser(id) {
      const { error } = await serviceRole().auth.admin.deleteUser(id);
      if (error) logError("deleteUser", error);
    },
  };
}

const profileRow = z.object({
  id: z.string(),
  role: z.enum(["super_admin", "admin", "manager", "employee"]),
  status: z.enum(["active", "suspended", "archived"]),
  display_name: z.string(),
});
const employeeRow = z.object({
  id: z.string(),
  profile_id: z.string(),
  employee_code: z.string(),
  full_name: z.string(),
});
const managedEmployeeRow = z.object({
  employee_code: z.string(),
  full_name: z.string(),
  email: z.string().nullable(),
  department: z.string().nullable(),
  designation: z.string().nullable(),
  created_at: z.string(),
  profiles: z.object({
    role: z.enum(["super_admin", "admin", "manager", "employee"]),
    status: z.enum(["active", "suspended", "archived"]),
  }),
});

const toProfile = (r: z.infer<typeof profileRow>): ProfileRecord => ({
  id: r.id,
  role: r.role,
  status: r.status,
  displayName: r.display_name,
});
const toEmployee = (r: z.infer<typeof employeeRow>): EmployeeRecord => ({
  id: r.id,
  profileId: r.profile_id,
  employeeCode: r.employee_code,
  fullName: r.full_name,
});

/**
 * Directory lookups use the service role because they run BEFORE the caller is
 * authenticated (Employee ID -> identity mapping) or must see role/status regardless of
 * RLS. Callers perform their own authorization.
 */
export function createSupabaseDirectory(serviceRole: () => SupabaseClient): AccountDirectory {
  return {
    async getProfile(profileId) {
      const { data, error } = await serviceRole()
        .from("profiles")
        .select("id, role, status, display_name")
        .eq("id", profileId)
        .maybeSingle();
      if (error) {
        logError("getProfile", error);
        return null;
      }
      const parsed = profileRow.safeParse(data);
      return parsed.success ? toProfile(parsed.data) : null;
    },
    async findEmployeeByCode(employeeCode) {
      const { data, error } = await serviceRole()
        .from("employees")
        .select("id, profile_id, employee_code, full_name")
        .eq("employee_code", employeeCode.toUpperCase())
        .maybeSingle();
      if (error) {
        logError("findEmployeeByCode", error);
        return null;
      }
      const parsed = employeeRow.safeParse(data);
      return parsed.success ? toEmployee(parsed.data) : null;
    },
    async findEmployeeByProfile(profileId) {
      const { data, error } = await serviceRole()
        .from("employees")
        .select("id, profile_id, employee_code, full_name")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (error) {
        logError("findEmployeeByProfile", error);
        return null;
      }
      const parsed = employeeRow.safeParse(data);
      return parsed.success ? toEmployee(parsed.data) : null;
    },
    async listEmployees(): Promise<ManagedEmployeeRecord[]> {
      const { data, error } = await serviceRole()
        .from("employees")
        .select(
          "employee_code, full_name, email, department, designation, created_at, profiles!employees_profile_id_fkey(role, status)",
        )
        .order("created_at", { ascending: false });
      if (error) {
        logError("listEmployees", error);
        throw new Error("Could not load employee records");
      }
      const parsed = z.array(managedEmployeeRow).safeParse(data);
      if (!parsed.success) {
        logError("listEmployees", parsed.error);
        throw new Error("Employee records have an unexpected shape");
      }
      return parsed.data.map((r) => ({
        employeeCode: r.employee_code,
        fullName: r.full_name,
        email: r.email,
        department: r.department,
        designation: r.designation,
        role: r.profiles.role,
        status: r.profiles.status,
      }));
    },
    async markSignedIn(profileId) {
      const { error } = await serviceRole()
        .from("profiles")
        .update({ last_sign_in_at: new Date().toISOString() })
        .eq("id", profileId);
      if (error) logError("markSignedIn", error);
    },
    async createEmployeeAccount(input) {
      const client = serviceRole();
      const { error: profileError } = await client.from("profiles").insert({
        id: input.profileId,
        role: input.role,
        status: "active",
        display_name: input.fullName,
      });
      if (profileError) throw new Error(`profile insert failed: ${profileError.code ?? "unknown"}`);

      const { data, error } = await client
        .from("employees")
        .insert({
          profile_id: input.profileId,
          employee_code: input.employeeCode.toUpperCase(),
          full_name: input.fullName,
          email: input.email,
          department: input.department,
          designation: input.designation,
        })
        .select("id, profile_id, employee_code, full_name")
        .single();
      if (error) {
        await client.from("profiles").delete().eq("id", input.profileId);
        throw new Error(`employee insert failed: ${error.code ?? "unknown"}`);
      }
      return toEmployee(employeeRow.parse(data));
    },
  };
}

/** Database-backed limiter: limits hold across server instances and restarts. */
export function createSupabaseRateLimiter(serviceRole: () => SupabaseClient): RateLimiter {
  return {
    async check(rules: readonly RateLimitRule[]): Promise<RateLimitDecision> {
      let retryAfterMs = 0;
      for (const rule of rules) {
        const { data, error } = await serviceRole().rpc("auth_throttle_status", {
          p_key_hash: rule.key,
        });
        if (error) {
          // Fail closed: if the limiter cannot be consulted, do not allow the attempt.
          logError("throttle.check", error);
          return { allowed: false, retryAfterSeconds: 0, unavailable: true };
        }
        if (typeof data === "string")
          retryAfterMs = Math.max(retryAfterMs, Date.parse(data) - Date.now());
      }
      return {
        allowed: retryAfterMs <= 0,
        retryAfterSeconds: Math.max(0, Math.ceil(retryAfterMs / 1000)),
      };
    },
    async recordFailure(rules) {
      for (const rule of rules) {
        const { error } = await serviceRole().rpc("auth_throttle_fail", {
          p_key_hash: rule.key,
          p_max_failures: rule.maxFailures,
          p_window_seconds: rule.windowSeconds,
          p_lock_seconds: rule.lockSeconds,
        });
        if (error) logError("throttle.fail", error);
      }
    },
    async reset(rule) {
      const { error } = await serviceRole().rpc("auth_throttle_reset", { p_key_hash: rule.key });
      if (error) logError("throttle.reset", error);
    },
  };
}

export function createSupabaseAuditLogger(serviceRole: () => SupabaseClient): AuditLogger {
  return {
    async record(event: AuditEvent) {
      const { error } = await serviceRole()
        .from("audit_logs")
        .insert({
          action: event.action,
          actor_profile_id: event.actorProfileId ?? null,
          target_type: event.targetType ?? null,
          target_id: event.targetId ?? null,
          ip_address: event.ipAddress ?? null,
          user_agent: event.userAgent ?? null,
          metadata: event.metadata ?? {},
        });
      if (error) logError("audit", error);
    },
    async listEmployeeAuthEvents(limit: number): Promise<EmployeeAuthEvent[]> {
      const client = serviceRole();
      const { data: auditRows, error: auditError } = await client
        .from("audit_logs")
        .select("occurred_at, action, target_id")
        .in("action", ["auth.employee_login.succeeded", "auth.employee_logout.succeeded"])
        .eq("target_type", "employee")
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (auditError) {
        logError("listEmployeeAuthEvents", auditError);
        throw new Error("Could not load employee authentication events");
      }

      const rows = z
        .array(
          z.object({
            occurred_at: z.string(),
            action: z.enum(["auth.employee_login.succeeded", "auth.employee_logout.succeeded"]),
            target_id: z.string().nullable(),
          }),
        )
        .safeParse(auditRows);
      if (!rows.success) {
        logError("listEmployeeAuthEvents", rows.error);
        throw new Error("Authentication events have an unexpected shape");
      }

      const employeeIds = [
        ...new Set(rows.data.flatMap((row) => (row.target_id ? [row.target_id] : []))),
      ];
      if (employeeIds.length === 0) return [];

      const { data: employeeRows, error: employeeError } = await client
        .from("employees")
        .select("id, employee_code, full_name")
        .in("id", employeeIds);
      if (employeeError) {
        logError("listEmployeeAuthEvents.employees", employeeError);
        throw new Error("Could not load employee details for authentication events");
      }

      const employees = z
        .array(
          z.object({
            id: z.string(),
            employee_code: z.string(),
            full_name: z.string(),
          }),
        )
        .safeParse(employeeRows);
      if (!employees.success) {
        logError("listEmployeeAuthEvents.employees", employees.error);
        throw new Error("Employee details have an unexpected shape");
      }

      const employeesById = new Map(employees.data.map((employee) => [employee.id, employee]));
      return rows.data.flatMap((row) => {
        const employee = row.target_id ? employeesById.get(row.target_id) : undefined;
        if (!employee) return [];
        return [
          {
            occurredAt: row.occurred_at,
            action: row.action === "auth.employee_login.succeeded" ? "login" : "logout",
            employeeCode: employee.employee_code,
            fullName: employee.full_name,
          },
        ];
      });
    },
  };
}
