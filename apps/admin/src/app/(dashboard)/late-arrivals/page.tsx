import { DEFAULT_OFFICE_CONFIG, formatShiftTime } from "@pbs-attend/shared";
import { AlarmClock, CalendarX2, CheckCircle2, Timer } from "lucide-react";
import type { Metadata } from "next";
import { DemoBanner } from "@/components/common/demo-banner";
import { EmployeeCell } from "@/components/common/employee-cell";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
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
import { demoRoster, demoWeeklyTrend } from "@/lib/demo-data";

export const metadata: Metadata = { title: "Late Arrivals" };

export default function LateArrivalsPage() {
  const late = demoRoster
    .filter((r) => r.attendance === "late")
    .sort((a, b) => b.lateByMinutes - a.lateByMinutes);
  const shift = formatShiftTime(DEFAULT_OFFICE_CONFIG.shiftStart);
  const threshold = formatShiftTime(DEFAULT_OFFICE_CONFIG.lateThreshold);
  const weekLate = demoWeeklyTrend.reduce((sum, d) => sum + d.late, 0);
  const avgLate = late.length
    ? Math.round(late.reduce((sum, r) => sum + r.lateByMinutes, 0) / late.length)
    : 0;

  return (
    <>
      <PageHeader
        title="Late Arrivals"
        description={`Shift starts at ${shift}. A check-in at ${threshold} or earlier is on time; anything after is late.`}
      />
      <DemoBanner />

      <section aria-label="Late arrival summary" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Late tonight"
          value={late.length}
          hint="In this sample"
          icon={AlarmClock}
          tone="warning"
        />
        <StatCard
          label="Average delay"
          value={`${avgLate} min`}
          hint="After the threshold"
          icon={Timer}
        />
        <StatCard
          label="Late this week"
          value={weekLate}
          hint="All employees (fictional)"
          icon={CalendarX2}
          tone="danger"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-navy">Tonight&apos;s late check-ins</CardTitle>
          <CardDescription>
            Minutes are counted from the {threshold} threshold, not from the shift start.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {late.length === 0 ? (
            <EmptyState
              className="mx-5 mb-3 border-0"
              icon={CheckCircle2}
              title="No late arrivals"
              description="Everyone who checked in tonight was on time."
            />
          ) : (
            <Table>
              <TableCaption className="sr-only">Late check-ins, fictional demo data</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Employee</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead className="pr-5 text-right">Late by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {late.map((r) => (
                  <TableRow key={r.employeeCode}>
                    <TableCell className="pl-5">
                      <EmployeeCell fullName={r.fullName} employeeCode={r.employeeCode} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{r.department}</TableCell>
                    <TableCell className="tabular-nums">{r.checkIn}</TableCell>
                    <TableCell className="pr-5 text-right">
                      <Badge variant={r.lateByMinutes >= 15 ? "danger" : "warning"}>
                        {r.lateByMinutes} min
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
