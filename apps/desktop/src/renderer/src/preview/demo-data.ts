/**
 * FICTIONAL DEMO DATA for the development-only preview of the signed-in screens.
 * Not a real employee. Never included in production builds (loaded only when
 * import.meta.env.DEV is true).
 */
import type { ActivityState, AttendanceStatus } from "@pbs-attend/types";

export const demoEmployee = {
  fullName: "Demo Ayesha Khan",
  employeeCode: "PBS-9001",
  department: "Design",
  deviceLabel: "DESIGN-PC-01",
} as const;

export const demoToday = {
  checkIn: "08:52 PM",
  status: "on_time" as AttendanceStatus,
  activeMinutes: 142,
  idleMinutes: 9,
};

export const demoActivity = {
  state: "active" as ActivityState,
  since: "38 min",
  lastHeartbeat: "12 s ago",
};

export interface DemoDay {
  day: string;
  date: string;
  checkIn: string | null;
  status: AttendanceStatus;
  lateByMinutes: number;
}

export const demoWeek: DemoDay[] = [
  { day: "Mon", date: "02 Nov", checkIn: "08:55 PM", status: "on_time", lateByMinutes: 0 },
  { day: "Tue", date: "03 Nov", checkIn: "09:12 PM", status: "on_time", lateByMinutes: 0 },
  { day: "Wed", date: "04 Nov", checkIn: "09:22 PM", status: "late", lateByMinutes: 7 },
  { day: "Thu", date: "05 Nov", checkIn: "08:58 PM", status: "on_time", lateByMinutes: 0 },
  { day: "Fri", date: "06 Nov", checkIn: null, status: "on_leave", lateByMinutes: 0 },
  { day: "Sat", date: "07 Nov", checkIn: "08:52 PM", status: "on_time", lateByMinutes: 0 },
];

export const demoTimeline: { time: string; state: ActivityState }[] = [
  { time: "08:52 PM", state: "active" },
  { time: "09:47 PM", state: "idle" },
  { time: "09:53 PM", state: "active" },
  { time: "10:31 PM", state: "idle" },
  { time: "10:34 PM", state: "active" },
];
