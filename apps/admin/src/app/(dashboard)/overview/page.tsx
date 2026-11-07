import { DEFAULT_OFFICE_CONFIG, formatShiftTime, roleHasPermission } from "@pbs-attend/shared";
import { AlarmClock, CalendarCheck, UserX, Users } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { ActivityIndicator, AttendanceBadge } from "@/components/common/status-badges";
import { ActivityDonut } from "@/components/dashboard/activity-donut";
import { AttendanceTrendChart } from "@/components/dashboard/attendance-trend-chart";
import { EmployeeAuthEvents } from "@/components/dashboard/employee-auth-events";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { demoOverviewStats, demoRecentCheckIns, demoWeeklyTrend } from "@/lib/demo-data";
import { requireAdmin } from "@/server/auth/admin-session";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const session = await requireAdmin();
  const canReadAudit =
    session.status === "ok" && roleHasPermission(session.principal.profile.role, "audit.read");
  const s = demoOverviewStats;
  const shift = formatShiftTime(DEFAULT_OFFICE_CONFIG.shiftStart);
  const lateAfter = formatShiftTime(DEFAULT_OFFICE_CONFIG.lateThreshold);

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Today's shift starts at ${shift}. Check-ins after ${lateAfter} are marked late.`}
        actions={<Badge variant="muted">Attendance preview</Badge>}
      />

      {canReadAudit ? <EmployeeAuthEvents /> : null}

      <div
        role="note"
        className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-[#7a2e0e]"
      >
        Attendance and activity figures below are fictional preview data. Employee login activity
        above is read from the database.
      </div>

      <section aria-label="Today's summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total employees"
          value={s.totalEmployees}
          hint="Fictional headcount"
          icon={Users}
        />
        <StatCard
          label="Checked in"
          value={s.checkedIn}
          hint={`${s.onTime} on time`}
          icon={CalendarCheck}
          tone="success"
        />
        <StatCard
          label="Late arrivals"
          value={s.late}
          hint={`After ${lateAfter}`}
          icon={AlarmClock}
          tone="warning"
        />
        <StatCard
          label="Absent"
          value={s.absent}
          hint={`${s.onLeave} on approved leave`}
          icon={UserX}
          tone="danger"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-navy">Attendance this week</CardTitle>
            <CardDescription>On time, late and absent per shift (fictional)</CardDescription>
          </CardHeader>
          <CardContent>
            <AttendanceTrendChart data={demoWeeklyTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-navy">Activity right now</CardTitle>
            <CardDescription>Active / Idle / Offline status only</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityDonut active={s.activeNow} idle={s.idleNow} offline={s.offlineNow} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-navy">Recent check-ins</CardTitle>
          <CardDescription>Times shown in Asia/Karachi (fictional records)</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableCaption className="sr-only">Recent check-ins, fictional demo data</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Employee</TableHead>
                <TableHead className="hidden md:table-cell">Department</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoRecentCheckIns.map((row) => (
                <TableRow key={row.employeeCode}>
                  <TableCell className="pl-5">
                    <p className="font-medium text-navy">{row.fullName}</p>
                    <p className="text-xs text-muted-foreground">{row.employeeCode}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{row.department}</TableCell>
                  <TableCell className="tabular-nums">{row.checkIn}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AttendanceBadge status={row.status} />
                      {row.lateByMinutes > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          +{row.lateByMinutes} min
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <ActivityIndicator state={row.activity} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
