import { FileDown, FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";
import { DemoBanner } from "@/components/common/demo-banner";
import { PageHeader } from "@/components/common/page-header";
import { PreviewAction } from "@/components/common/preview-action";
import { AttendanceTrendChart } from "@/components/dashboard/attendance-trend-chart";
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
import { demoDepartmentReport, demoWeeklyTrend } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Month-to-date attendance summaries. Exports will be generated server-side."
        actions={
          <>
            <PreviewAction icon={FileSpreadsheet} label="Export CSV" />
            <PreviewAction icon={FileDown} label="Export PDF" />
          </>
        }
      />
      <DemoBanner />

      <Card>
        <CardHeader>
          <CardTitle className="text-navy">Attendance by department</CardTitle>
          <CardDescription>Month to date (fictional)</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableCaption className="sr-only">
              Attendance by department, fictional demo data
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Department</TableHead>
                <TableHead className="text-right">Headcount</TableHead>
                <TableHead className="w-[30%]">On-time rate</TableHead>
                <TableHead className="text-right">Late</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Absences</TableHead>
                <TableHead className="hidden pr-5 text-right md:table-cell">
                  Avg. active / shift
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoDepartmentReport.map((d) => (
                <TableRow key={d.department}>
                  <TableCell className="pl-5 font-medium text-navy">{d.department}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.headcount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                        role="meter"
                        aria-label={`${d.department} on-time rate`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(d.onTimeRate * 100)}
                      >
                        <div
                          className={cn(
                            "h-full rounded-full",
                            d.onTimeRate >= 0.85 ? "bg-success" : "bg-warning",
                          )}
                          style={{ width: percent.format(d.onTimeRate) }}
                        />
                      </div>
                      <span className="w-10 text-right text-sm tabular-nums">
                        {percent.format(d.onTimeRate)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{d.lateCount}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {d.absences}
                  </TableCell>
                  <TableCell className="hidden pr-5 text-right tabular-nums md:table-cell">
                    {d.avgActiveHours.toFixed(1)} h
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-navy">Last seven shifts</CardTitle>
          <CardDescription>On time, late and absent (fictional)</CardDescription>
        </CardHeader>
        <CardContent>
          <AttendanceTrendChart data={demoWeeklyTrend} />
        </CardContent>
      </Card>
    </>
  );
}
