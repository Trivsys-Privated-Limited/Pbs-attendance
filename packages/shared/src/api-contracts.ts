/**
 * API contract definitions shared by the admin app, the desktop app and the server.
 * Auth endpoints are implemented in Phase 2; the others are still shapes only.
 */
import type {
  ActivityState,
  AccountStatus,
  AttendanceRecord,
  LiveEmployeeStatus,
  OfficeConfig,
  UserRole,
} from "@pbs-attend/types";
import type {
  CreateEmployeeInput,
  EmployeeLoginInput,
  HeartbeatPayload,
} from "@pbs-attend/validation";

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | "SERVICE_UNAVAILABLE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "NOT_IMPLEMENTED"
  | "INTERNAL";

/** Standard envelope for every server response. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string; retryAfterSeconds?: number } };

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

/** A typed endpoint description. `Req`/`Res` are carried at the type level only. */
export interface ApiContract<Req, Res> {
  readonly method: HttpMethod;
  readonly path: string;
  readonly __types?: { req: Req; res: Res };
}

export type ContractRequest<C> = C extends ApiContract<infer Req, unknown> ? Req : never;
export type ContractResponse<C> = C extends ApiContract<unknown, infer Res> ? Res : never;

function contract<Req, Res>(method: HttpMethod, path: string): ApiContract<Req, Res> {
  return { method, path };
}

/** Tokens issued to the desktop app. Held by the Electron MAIN process only. */
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
}

export interface EmployeeIdentity {
  employeeCode: string;
  fullName: string;
}

export interface CurrentUser {
  displayName: string;
  role: UserRole;
}

export interface ManagedEmployee {
  employeeCode: string;
  fullName: string;
  email: string | null;
  department: string | null;
  designation: string | null;
  role: UserRole;
  status: AccountStatus;
}

export interface EmployeeAuthEvent {
  occurredAt: string;
  action: "login" | "logout";
  employeeCode: string;
  fullName: string;
}

export const API = {
  employeeLogin: contract<
    EmployeeLoginInput,
    { employee: EmployeeIdentity; session: SessionTokens }
  >("POST", "/api/v1/auth/employee-login"),
  refreshSession: contract<
    { refreshToken: string },
    { employee: EmployeeIdentity; session: SessionTokens }
  >("POST", "/api/v1/auth/refresh"),
  logout: contract<undefined, null>("POST", "/api/v1/auth/logout"),
  me: contract<undefined, { user: CurrentUser }>("GET", "/api/v1/auth/me"),
  employees: contract<undefined, { employees: ManagedEmployee[] }>(
    "GET",
    "/api/v1/admin/employees",
  ),
  createEmployee: contract<CreateEmployeeInput, { employee: EmployeeIdentity & { id: string } }>(
    "POST",
    "/api/v1/admin/employees",
  ),
  employeeAuthEvents: contract<undefined, { events: EmployeeAuthEvent[] }>(
    "GET",
    "/api/v1/admin/auth-events",
  ),
  // ---- Later phases (not implemented) ----
  heartbeat: contract<HeartbeatPayload, { serverTime: string; state: ActivityState }>(
    "POST",
    "/api/v1/activity/heartbeat",
  ),
  myAttendanceToday: contract<undefined, { record: AttendanceRecord | null }>(
    "GET",
    "/api/v1/attendance/me/today",
  ),
  liveStatus: contract<undefined, { employees: LiveEmployeeStatus[] }>(
    "GET",
    "/api/v1/activity/live",
  ),
  officeConfig: contract<undefined, OfficeConfig>("GET", "/api/v1/settings/office"),
} as const;
