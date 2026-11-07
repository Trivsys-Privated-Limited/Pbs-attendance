import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  type AppInfo,
  type EmployeeSummary,
  type LoginOutcome,
  type LoginRequest,
  type SessionEndReason,
} from "./channels";

/**
 * The ONLY surface the renderer can reach. Keep it small and explicit:
 * never expose ipcRenderer, Node APIs, tokens or generic "invoke anything" helpers.
 */
const api = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC_CHANNELS.getAppInfo),
  auth: {
    login: (request: LoginRequest): Promise<LoginOutcome> =>
      ipcRenderer.invoke(IPC_CHANNELS.authLogin, {
        employeeCode: String(request.employeeCode),
        password: String(request.password),
      }),
    logout: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.authLogout),
    getSession: (): Promise<EmployeeSummary | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.authGetSession),
    /** Subscribes to session end (expired or revoked). Returns an unsubscribe function. */
    onSessionEnded: (callback: (reason: SessionEndReason) => void): (() => void) => {
      const listener = (_event: unknown, reason: SessionEndReason) => callback(reason);
      ipcRenderer.on(IPC_CHANNELS.authSessionEnded, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.authSessionEnded, listener);
    },
  },
} as const;

export type PbsAttendApi = typeof api;

contextBridge.exposeInMainWorld("pbsAttend", api);
