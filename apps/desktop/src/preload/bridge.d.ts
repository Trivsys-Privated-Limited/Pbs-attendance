import type {
  AppInfo,
  EmployeeSummary,
  LoginOutcome,
  LoginRequest,
  SessionEndReason,
} from "./channels";

declare global {
  interface Window {
    /** Bridge exposed by the preload script (see src/preload/index.ts). */
    pbsAttend?: {
      getAppInfo: () => Promise<AppInfo>;
      auth: {
        login: (request: LoginRequest) => Promise<LoginOutcome>;
        logout: () => Promise<void>;
        getSession: () => Promise<EmployeeSummary | null>;
        onSessionEnded: (callback: (reason: SessionEndReason) => void) => () => void;
      };
    };
  }
}

export {};
