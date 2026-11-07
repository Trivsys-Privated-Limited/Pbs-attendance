/** IPC channel names shared by the main process and the preload bridge. */
export const IPC_CHANNELS = {
  getAppInfo: "app:get-info",
  authLogin: "auth:login",
  authLogout: "auth:logout",
  authGetSession: "auth:get-session",
  authSessionEnded: "auth:session-ended",
} as const;

/** Non-sensitive app metadata shown in the UI. */
export interface AppInfo {
  version: string;
  platform: string;
  osRelease: string;
}

/** What the renderer is allowed to know about the signed-in employee. No tokens. */
export interface EmployeeSummary {
  employeeCode: string;
  fullName: string;
}

export interface LoginRequest {
  employeeCode: string;
  password: string;
}

export type LoginErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | "UNAVAILABLE"
  | "NETWORK"
  | "UNEXPECTED";

export type LoginOutcome =
  | { ok: true; employee: EmployeeSummary }
  | { ok: false; error: LoginErrorCode; retryAfterSeconds?: number };

export type SessionEndReason = "expired" | "revoked";
