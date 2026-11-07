import {
  DEFAULT_OFFICE_CONFIG,
  MONITORING_SCOPE,
  formatDuration,
  formatShiftTime,
} from "@pbs-attend/shared";
import { Check, X } from "lucide-react";
import type { AppInfo } from "../../../preload/channels";
import { demoActivity, demoEmployee, demoTimeline, demoToday, demoWeek } from "./demo-data";
import { ActivityDot, AttendancePill, Card } from "./ui";

const c = DEFAULT_OFFICE_CONFIG;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-navy tabular-nums">{value}</p>
    </div>
  );
}

export function MyAttendanceScreen() {
  return (
    <div className="space-y-5">
      <Card
        title="Tonight's shift"
        description={`Shift starts at ${formatShiftTime(c.shiftStart)}. Check-ins up to ${formatShiftTime(c.lateThreshold)} are on time.`}
      >
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Checked in" value={demoToday.checkIn} />
          <div className="rounded-lg bg-background p-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-2">
              <AttendancePill status={demoToday.status} />
            </div>
          </div>
          <Stat label="Active time" value={formatDuration(demoToday.activeMinutes * 60)} />
          <Stat label="Idle time" value={formatDuration(demoToday.idleMinutes * 60)} />
        </div>
      </Card>

      <Card title="This week" description="Times are recorded by the server, not by this computer.">
        <table className="w-full text-sm">
          <caption className="sr-only">Attendance this week, fictional demo data</caption>
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 font-medium">
                Day
              </th>
              <th scope="col" className="py-2 font-medium">
                Check-in
              </th>
              <th scope="col" className="py-2 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {demoWeek.map((d) => (
              <tr key={d.date} className="border-b last:border-0">
                <td className="py-2.5">
                  <span className="font-medium text-navy">{d.day}</span>{" "}
                  <span className="text-muted-foreground">{d.date}</span>
                </td>
                <td className="py-2.5 tabular-nums">{d.checkIn ?? "—"}</td>
                <td className="py-2.5">
                  <AttendancePill status={d.status} />
                  {d.lateByMinutes > 0 ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      +{d.lateByMinutes} min
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function MyActivityScreen() {
  return (
    <div className="space-y-5">
      <Card
        title="Current status"
        description="This is everything PBS Attend knows about your activity."
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-background p-4">
            <p className="text-xs text-muted-foreground">You are</p>
            <div className="mt-1">
              <ActivityDot state={demoActivity.state} large />
            </div>
          </div>
          <Stat label="For" value={demoActivity.since} />
          <Stat label="Last heartbeat" value={demoActivity.lastHeartbeat} />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          You become <strong className="text-navy">Idle</strong> after {c.idleDetectionSeconds}{" "}
          seconds without keyboard or mouse input. Only the fact that input happened is used, never
          what you typed or clicked.
        </p>
      </Card>

      <Card
        title="Status changes tonight"
        description="Only Active / Idle transitions are recorded."
      >
        <ol className="space-y-2.5">
          {demoTimeline.map((t) => (
            <li key={t.time} className="flex items-center gap-4 text-sm">
              <span className="w-20 text-muted-foreground tabular-nums">{t.time}</span>
              <ActivityDot state={t.state} />
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

export function SettingsScreen({ appInfo }: { appInfo: AppInfo | null }) {
  const rows: [string, string][] = [
    ["Employee", `${demoEmployee.fullName} (${demoEmployee.employeeCode})`],
    ["This computer", demoEmployee.deviceLabel],
    ["App version", appInfo ? `v${appInfo.version}` : "Unknown"],
    ["Windows", appInfo ? appInfo.osRelease : "Unknown"],
    ["Office timezone", c.timezone],
    ["Heartbeat", `Every ${c.heartbeatIntervalSeconds} seconds`],
  ];

  return (
    <div className="space-y-5">
      <Card title="About this device">
        <dl className="divide-y text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium text-navy">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card
        title="Privacy"
        description="Fixed by PBS Digitals policy. It cannot be widened from this app."
      >
        <div className="grid grid-cols-2 gap-6 text-sm">
          <ul className="space-y-2">
            {MONITORING_SCOPE.collected.map((item) => (
              <li key={item} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <ul className="space-y-2 text-muted-foreground">
            {MONITORING_SCOPE.neverCollected.map((item) => (
              <li key={item} className="flex gap-2">
                <X className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
