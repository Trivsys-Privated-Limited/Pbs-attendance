import type { IsoTimestamp, Uuid } from "./roles";

/**
 * Transparent presence status. PBS Attend records ONLY these transitions.
 * No keystrokes, screenshots, screen contents, window titles or passwords
 * are ever collected.
 */
export type ActivityState = "active" | "idle" | "offline";

export interface ActivityTransition {
  id: Uuid;
  employeeId: Uuid;
  deviceId: Uuid;
  from: ActivityState;
  to: ActivityState;
  /** Server-assigned timestamp of the transition. */
  occurredAt: IsoTimestamp;
}

export interface LiveEmployeeStatus {
  employeeId: Uuid;
  employeeCode: string;
  fullName: string;
  department: string | null;
  state: ActivityState;
  since: IsoTimestamp;
  lastHeartbeatAt: IsoTimestamp | null;
}
