import type { ActivityState, AttendanceStatus } from "@pbs-attend/types";
import type { ReactNode } from "react";

export function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-white p-5 shadow-[0_1px_2px_rgba(16,27,49,0.04)]">
      <h2 className="text-base font-semibold text-navy">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const ATTENDANCE: Record<AttendanceStatus, { label: string; className: string }> = {
  on_time: { label: "On time", className: "bg-success-soft text-[#067647]" },
  late: { label: "Late", className: "bg-warning-soft text-[#b54708]" },
  absent: { label: "Absent", className: "bg-[#fdecea] text-[#b42318]" },
  on_leave: { label: "On leave", className: "bg-[#eef2f9] text-muted-foreground" },
  pending: { label: "Pending", className: "bg-[#eef2f9] text-muted-foreground" },
};

export function AttendancePill({ status }: { status: AttendanceStatus }) {
  const s = ATTENDANCE[status];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

const ACTIVITY: Record<ActivityState, { label: string; dot: string }> = {
  active: { label: "Active", dot: "bg-success" },
  idle: { label: "Idle", dot: "bg-warning" },
  offline: { label: "Offline", dot: "bg-[#98a2b3]" },
};

export function ActivityDot({ state, large = false }: { state: ActivityState; large?: boolean }) {
  const a = ACTIVITY[state];
  return (
    <span
      className={`inline-flex items-center gap-2 ${large ? "text-lg font-semibold" : "text-sm"}`}
    >
      <span className={`${large ? "size-3" : "size-2"} rounded-full ${a.dot}`} aria-hidden="true" />
      {a.label}
    </span>
  );
}
