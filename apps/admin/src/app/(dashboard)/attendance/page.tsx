import { DEFAULT_OFFICE_CONFIG, formatDuration, formatShiftTime } from "@pbs-attend/shared";
import { CalendarDays, Download } from "lucide-react";
import type { Metadata } from "next";
import { DemoBanner } from "@/components/common/demo-banner";
import { EmployeeCell } from "@/components/common/employee-cell";
import { PageHeader } from "@/components/common/page-header";
import { PreviewAction } from "@/components/common/preview-action";
import { AttendanceBadge } from "@/components/common/status-badges";
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
import { demoRoster } from "@/lib/demo-data";

export const metadata: Metadata = { title: "Attendance" };

export default function AttendancePage() {
  const rows = demoRoster.filter((r) => r.status === "active");
  const shift = formatShiftTime(DEFAULT_OFFICE_CONFIG.shiftStart);

  return (
    <>
      <PageHeader
        title="Attendance"
        description="One record per employee per shift. Night shifts are keyed by the date they start."
        actions={
          <>
            <Badge variant="muted">
              <CalendarDays className="size-3" aria-hidden="true" />
              Tonight&apos;s shift · {shift}
            </Badge>
            <PreviewAction icon={Download} label="Export" />
          </>
        }
      />
      <DemoBanner />

      <Card>
        <CardHeader>
          <CardTitle className="text-navy">Shift attendance</CardTitle>
          <CardDescription>
            Check-in and check-out times will come from trusted server timestamps (Asia/Karachi).
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableCaption className="sr-only">Shift attendance, fictional demo data</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Employee</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead className="hidden sm:table-cell">Check-out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Active</TableHead>
                <TableHead className="hidden pr-5 md:table-cell">Idle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employeeCode}>
                  <TableCell className="pl-5">
                    <EmployeeCell
                      fullName={r.fullName}
                      employeeCode={r.employeeCode}
                      subtitle={r.department}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">{r.checkIn ?? "—"}</TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                    {r.checkOut ?? (r.checkIn ? "On shift" : "—")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AttendanceBadge status={r.attendance} />
                      {r.lateByMinutes > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          +{r.lateByMinutes} min
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">
                    {r.checkIn ? formatDuration(r.activeMinutes * 60) : "—"}
                  </TableCell>
                  <TableCell className="hidden pr-5 tabular-nums md:table-cell">
                    {r.checkIn ? formatDuration(r.idleMinutes * 60) : "—"}
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
