import type {
  ActivityState,
  AttendanceStatus,
  DeviceTrust,
  EmployeeStatus,
  UserRole,
} from "@pbs-attend/types";
import { Badge, type BadgeProps } from "@/components/ui/badge";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;
import { cn } from "@/lib/utils";

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  on_time: "On time",
  late: "Late",
  absent: "Absent",
  on_leave: "On leave",
  pending: "Pending",
};

const ATTENDANCE_VARIANT = {
  on_time: "success",
  late: "warning",
  absent: "danger",
  on_leave: "muted",
  pending: "muted",
} as const satisfies Record<AttendanceStatus, "success" | "warning" | "danger" | "muted">;

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  return <Badge variant={ATTENDANCE_VARIANT[status]}>{ATTENDANCE_LABEL[status]}</Badge>;
}

const ACTIVITY_LABEL: Record<ActivityState, string> = {
  active: "Active",
  idle: "Idle",
  offline: "Offline",
};

const ACTIVITY_DOT: Record<ActivityState, string> = {
  active: "bg-success",
  idle: "bg-warning",
  offline: "bg-idle",
};

export function ActivityIndicator({ state }: { state: ActivityState }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={cn("size-2 rounded-full", ACTIVITY_DOT[state])} aria-hidden="true" />
      {ACTIVITY_LABEL[state]}
    </span>
  );
}

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

export function RoleBadge({ role }: { role: UserRole }) {
  return <Badge variant={role === "employee" ? "outline" : "default"}>{ROLE_LABEL[role]}</Badge>;
}

const EMPLOYEE_STATUS = {
  active: { label: "Active", variant: "success" },
  suspended: { label: "Suspended", variant: "danger" },
  archived: { label: "Archived", variant: "muted" },
} as const satisfies Record<EmployeeStatus, { label: string; variant: BadgeVariant }>;

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const s = EMPLOYEE_STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const DEVICE_TRUST = {
  approved: { label: "Approved", variant: "success" },
  pending: { label: "Pending approval", variant: "warning" },
  revoked: { label: "Revoked", variant: "danger" },
} as const satisfies Record<DeviceTrust, { label: string; variant: BadgeVariant }>;

export function DeviceTrustBadge({ trust }: { trust: DeviceTrust }) {
  const t = DEVICE_TRUST[trust];
  return <Badge variant={t.variant}>{t.label}</Badge>;
}
