/**
 * ⚠️ FICTIONAL DEMO DATA — Phase 1 UI preview only.
 *
 * Every name, ID and number below is made up to show the dashboard layout.
 * None of it comes from a database or represents a real PBS Digitals employee.
 * Phase 2 will replace this module with server-side queries.
 */
import type {
  ActivityState,
  AttendanceStatus,
  DeviceTrust,
  EmployeeStatus,
  UserRole,
} from "@pbs-attend/types";

export const IS_DEMO_DATA = true as const;

export interface DemoOverviewStats {
  totalEmployees: number;
  checkedIn: number;
  onTime: number;
  late: number;
  absent: number;
  onLeave: number;
  activeNow: number;
  idleNow: number;
  offlineNow: number;
}

export const demoOverviewStats: DemoOverviewStats = {
  totalEmployees: 30,
  checkedIn: 24,
  onTime: 20,
  late: 4,
  absent: 4,
  onLeave: 2,
  activeNow: 19,
  idleNow: 3,
  offlineNow: 2,
};

export interface DemoTrendPoint {
  day: string;
  onTime: number;
  late: number;
  absent: number;
}

export const demoWeeklyTrend: DemoTrendPoint[] = [
  { day: "Mon", onTime: 24, late: 3, absent: 3 },
  { day: "Tue", onTime: 26, late: 2, absent: 2 },
  { day: "Wed", onTime: 22, late: 5, absent: 3 },
  { day: "Thu", onTime: 25, late: 3, absent: 2 },
  { day: "Fri", onTime: 21, late: 6, absent: 3 },
  { day: "Sat", onTime: 23, late: 4, absent: 3 },
  { day: "Today", onTime: 20, late: 4, absent: 6 },
];

export interface DemoCheckIn {
  employeeCode: string;
  fullName: string;
  department: string;
  /** Pre-formatted Asia/Karachi time — demo only. */
  checkIn: string;
  status: AttendanceStatus;
  lateByMinutes: number;
  activity: ActivityState;
}

export const demoRecentCheckIns: DemoCheckIn[] = [
  {
    employeeCode: "PBS-9001",
    fullName: "Demo Ayesha Khan",
    department: "Design",
    checkIn: "08:52 PM",
    status: "on_time",
    lateByMinutes: 0,
    activity: "active",
  },
  {
    employeeCode: "PBS-9002",
    fullName: "Demo Bilal Ahmed",
    department: "Engineering",
    checkIn: "08:57 PM",
    status: "on_time",
    lateByMinutes: 0,
    activity: "active",
  },
  {
    employeeCode: "PBS-9003",
    fullName: "Demo Sana Iqbal",
    department: "Marketing",
    checkIn: "09:04 PM",
    status: "on_time",
    lateByMinutes: 0,
    activity: "idle",
  },
  {
    employeeCode: "PBS-9004",
    fullName: "Demo Usman Tariq",
    department: "Engineering",
    checkIn: "09:15 PM",
    status: "on_time",
    lateByMinutes: 0,
    activity: "active",
  },
  {
    employeeCode: "PBS-9005",
    fullName: "Demo Hira Malik",
    department: "Support",
    checkIn: "09:18 PM",
    status: "late",
    lateByMinutes: 3,
    activity: "active",
  },
  {
    employeeCode: "PBS-9006",
    fullName: "Demo Faisal Raza",
    department: "Sales",
    checkIn: "09:26 PM",
    status: "late",
    lateByMinutes: 11,
    activity: "offline",
  },
  {
    employeeCode: "PBS-9007",
    fullName: "Demo Zainab Noor",
    department: "Design",
    checkIn: "09:41 PM",
    status: "late",
    lateByMinutes: 26,
    activity: "active",
  },
  {
    employeeCode: "PBS-9008",
    fullName: "Demo Hamza Shah",
    department: "Support",
    checkIn: "—",
    status: "absent",
    lateByMinutes: 0,
    activity: "offline",
  },
];

/* ------------------------------------------------------------------------- */
/* Fictional roster used by the Phase 1 section previews.                     */
/* ------------------------------------------------------------------------- */

export interface DemoDevice {
  label: string;
  osVersion: string;
  appVersion: string;
  trust: DeviceTrust;
  lastSeen: string;
}

export interface DemoRosterEntry {
  employeeCode: string;
  fullName: string;
  department: string;
  designation: string;
  role: UserRole;
  status: EmployeeStatus;
  /** Pre-formatted Asia/Karachi times — demo only. */
  checkIn: string | null;
  checkOut: string | null;
  attendance: AttendanceStatus;
  lateByMinutes: number;
  activeMinutes: number;
  idleMinutes: number;
  activity: ActivityState;
  /** How long the employee has been in the current state — demo only. */
  activitySince: string;
  lastHeartbeat: string | null;
  device: DemoDevice;
}

/** The roster below is a 12-person sample of the fictional headcount. */
export const DEMO_HEADCOUNT = demoOverviewStats.totalEmployees;

type Row = [
  code: string,
  name: string,
  department: string,
  designation: string,
  role: UserRole,
  status: EmployeeStatus,
  checkIn: string | null,
  attendance: AttendanceStatus,
  lateBy: number,
  activeMin: number,
  idleMin: number,
  activity: ActivityState,
  since: string,
  heartbeat: string | null,
  device: DemoDevice,
];

const win11 = "Windows 11 23H2";
const win11b = "Windows 11 24H2";
const win10 = "Windows 10 22H2";
const dev = (
  label: string,
  osVersion: string,
  trust: DeviceTrust,
  lastSeen: string,
): DemoDevice => ({
  label,
  osVersion,
  appVersion: "0.1.0",
  trust,
  lastSeen,
});

const ROWS: Row[] = [
  [
    "PBS-9001",
    "Demo Ayesha Khan",
    "Design",
    "UI Designer",
    "employee",
    "active",
    "08:52 PM",
    "on_time",
    0,
    142,
    9,
    "active",
    "38 min",
    "12 s ago",
    dev("DESIGN-PC-01", win11, "approved", "12 s ago"),
  ],
  [
    "PBS-9002",
    "Demo Bilal Ahmed",
    "Engineering",
    "Software Engineer",
    "employee",
    "active",
    "08:57 PM",
    "on_time",
    0,
    131,
    15,
    "active",
    "1 h 05 min",
    "4 s ago",
    dev("ENG-PC-04", win11b, "approved", "4 s ago"),
  ],
  [
    "PBS-9003",
    "Demo Sana Iqbal",
    "Marketing",
    "Content Lead",
    "manager",
    "active",
    "09:04 PM",
    "on_time",
    0,
    118,
    22,
    "idle",
    "6 min",
    "21 s ago",
    dev("MKT-LAPTOP-02", win10, "approved", "21 s ago"),
  ],
  [
    "PBS-9004",
    "Demo Usman Tariq",
    "Engineering",
    "QA Engineer",
    "employee",
    "active",
    "09:15 PM",
    "on_time",
    0,
    120,
    6,
    "active",
    "52 min",
    "9 s ago",
    dev("ENG-PC-07", win11, "approved", "9 s ago"),
  ],
  [
    "PBS-9005",
    "Demo Hira Malik",
    "Support",
    "Support Specialist",
    "employee",
    "active",
    "09:18 PM",
    "late",
    3,
    109,
    12,
    "active",
    "17 min",
    "2 s ago",
    dev("SUP-PC-03", win11b, "approved", "2 s ago"),
  ],
  [
    "PBS-9006",
    "Demo Faisal Raza",
    "Sales",
    "Account Executive",
    "employee",
    "active",
    "09:26 PM",
    "late",
    11,
    74,
    31,
    "offline",
    "4 min",
    "4 min ago",
    dev("SALES-LAPTOP-01", win10, "approved", "4 min ago"),
  ],
  [
    "PBS-9007",
    "Demo Zainab Noor",
    "Design",
    "Graphic Designer",
    "employee",
    "active",
    "09:41 PM",
    "late",
    26,
    88,
    4,
    "active",
    "29 min",
    "15 s ago",
    dev("DESIGN-PC-03", win11, "approved", "15 s ago"),
  ],
  [
    "PBS-9008",
    "Demo Hamza Shah",
    "Support",
    "Support Specialist",
    "employee",
    "active",
    null,
    "absent",
    0,
    0,
    0,
    "offline",
    "—",
    null,
    dev("SUP-PC-05", win11, "approved", "2 days ago"),
  ],
  [
    "PBS-9009",
    "Demo Maryam Aslam",
    "HR",
    "HR Coordinator",
    "admin",
    "active",
    "08:49 PM",
    "on_time",
    0,
    150,
    3,
    "active",
    "1 h 12 min",
    "7 s ago",
    dev("HR-PC-01", win11b, "approved", "7 s ago"),
  ],
  [
    "PBS-9010",
    "Demo Ali Haider",
    "Engineering",
    "DevOps Engineer",
    "employee",
    "active",
    "09:31 PM",
    "late",
    16,
    97,
    18,
    "idle",
    "3 min",
    "26 s ago",
    dev("ENG-PC-09", win11, "pending", "26 s ago"),
  ],
  [
    "PBS-9011",
    "Demo Nida Farooq",
    "Marketing",
    "Social Media Executive",
    "employee",
    "active",
    null,
    "on_leave",
    0,
    0,
    0,
    "offline",
    "—",
    null,
    dev("MKT-PC-04", win10, "approved", "1 day ago"),
  ],
  [
    "PBS-9012",
    "Demo Kamran Javed",
    "Sales",
    "Sales Associate",
    "employee",
    "suspended",
    null,
    "absent",
    0,
    0,
    0,
    "offline",
    "—",
    null,
    dev("SALES-PC-02", win10, "revoked", "3 weeks ago"),
  ],
];

export const demoRoster: DemoRosterEntry[] = ROWS.map(
  ([
    employeeCode,
    fullName,
    department,
    designation,
    role,
    status,
    checkIn,
    attendance,
    lateByMinutes,
    activeMinutes,
    idleMinutes,
    activity,
    activitySince,
    lastHeartbeat,
    device,
  ]) => ({
    employeeCode,
    fullName,
    department,
    designation,
    role,
    status,
    checkIn,
    checkOut: null,
    attendance,
    lateByMinutes,
    activeMinutes,
    idleMinutes,
    activity,
    activitySince,
    lastHeartbeat,
    device,
  }),
);

export interface DemoDepartmentReport {
  department: string;
  headcount: number;
  /** 0..1 */
  onTimeRate: number;
  lateCount: number;
  absences: number;
  avgActiveHours: number;
}

/** Fictional month-to-date summary per department (headcounts sum to 30). */
export const demoDepartmentReport: DemoDepartmentReport[] = [
  {
    department: "Engineering",
    headcount: 9,
    onTimeRate: 0.88,
    lateCount: 14,
    absences: 5,
    avgActiveHours: 6.9,
  },
  {
    department: "Design",
    headcount: 5,
    onTimeRate: 0.84,
    lateCount: 11,
    absences: 3,
    avgActiveHours: 6.6,
  },
  {
    department: "Marketing",
    headcount: 5,
    onTimeRate: 0.91,
    lateCount: 6,
    absences: 4,
    avgActiveHours: 6.4,
  },
  {
    department: "Sales",
    headcount: 5,
    onTimeRate: 0.79,
    lateCount: 16,
    absences: 6,
    avgActiveHours: 6.1,
  },
  {
    department: "Support",
    headcount: 4,
    onTimeRate: 0.86,
    lateCount: 9,
    absences: 4,
    avgActiveHours: 7.0,
  },
  {
    department: "HR",
    headcount: 2,
    onTimeRate: 0.97,
    lateCount: 1,
    absences: 0,
    avgActiveHours: 6.8,
  },
];
