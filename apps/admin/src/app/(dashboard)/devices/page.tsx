import { Laptop, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import type { Metadata } from "next";
import { DemoBanner } from "@/components/common/demo-banner";
import { EmployeeCell } from "@/components/common/employee-cell";
import { PageHeader } from "@/components/common/page-header";
import { DeviceTrustBadge } from "@/components/common/status-badges";
import { StatCard } from "@/components/dashboard/stat-card";
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

export const metadata: Metadata = { title: "Devices" };

export default function DevicesPage() {
  const devices = demoRoster.map((r) => ({ ...r.device, owner: r }));
  const count = (trust: string) => devices.filter((d) => d.trust === trust).length;

  return (
    <>
      <PageHeader
        title="Devices"
        description="Windows 10/11 computers registered to PBS Attend. Only approved devices will be able to record attendance."
      />
      <DemoBanner />

      <section aria-label="Device summary" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Approved" value={count("approved")} icon={ShieldCheck} tone="success" />
        <StatCard
          label="Pending approval"
          value={count("pending")}
          icon={ShieldAlert}
          tone="warning"
        />
        <StatCard label="Revoked" value={count("revoked")} icon={ShieldX} tone="danger" />
      </section>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableCaption className="sr-only">Registered devices, fictional demo data</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Device</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead className="hidden lg:table-cell">Windows</TableHead>
              <TableHead className="hidden md:table-cell">App</TableHead>
              <TableHead>Trust</TableHead>
              <TableHead className="hidden pr-5 sm:table-cell">Last seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((d) => (
              <TableRow key={d.label}>
                <TableCell className="pl-5">
                  <span className="inline-flex items-center gap-2 font-medium text-navy">
                    <Laptop className="size-4 text-muted-foreground" aria-hidden="true" />
                    {d.label}
                  </span>
                </TableCell>
                <TableCell>
                  <EmployeeCell fullName={d.owner.fullName} employeeCode={d.owner.employeeCode} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">{d.osVersion}</TableCell>
                <TableCell className="hidden tabular-nums md:table-cell">v{d.appVersion}</TableCell>
                <TableCell>
                  <DeviceTrustBadge trust={d.trust} />
                </TableCell>
                <TableCell className="hidden pr-5 text-muted-foreground sm:table-cell">
                  {d.lastSeen}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
