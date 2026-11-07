import type { IsoTimestamp, Uuid } from "./roles";

/**
 * Attendance status for one shift. Always derived on the server from trusted
 * server timestamps, never from client clocks.
 */
export type AttendanceStatus = "on_time" | "late" | "absent" | "on_leave" | "pending";

export interface AttendanceRecord {
  id: Uuid;
  employeeId: Uuid;
  /** Shift date in the office timezone (YYYY-MM-DD). Night shifts are keyed by their start date. */
  shiftDate: string;
  checkInAt: IsoTimestamp | null;
  checkOutAt: IsoTimestamp | null;
  status: AttendanceStatus;
  /** Minutes after the late threshold the employee checked in (0 when on time). */
  lateByMinutes: number;
  activeSeconds: number;
  idleSeconds: number;
}
