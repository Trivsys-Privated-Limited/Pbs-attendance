import { DEFAULT_OFFICE_CONFIG } from "@pbs-attend/shared";
import type { ActivityState } from "@pbs-attend/types";
import { Radio } from "lucide-react";
import type { Metadata } from "next";
import { DemoBanner } from "@/components/common/demo-banner";
import { EmployeeCell } from "@/components/common/employee-cell";
import { PageHeader } from "@/components/common/page-header";
import { ActivityIndicator } from "@/components/common/status-badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { demoRoster } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Live Activity" };

const STATE_ORDER: Record<ActivityState, number> = { active: 0, idle: 1, offline: 2 };

const STATE_RING: Record<ActivityState, string> = {
  active: "border-l-success",
  idle: "border-l-warning",
  offline: "border-l-idle",
};

export default function LiveActivityPage() {
  const people = demoRoster
    .filter((p) => p.status === "active")
    .sort((a, b) => STATE_ORDER[a.activity] - STATE_ORDER[b.activity]);

  const counts = {
    active: people.filter((p) => p.activity === "active").length,
    idle: people.filter((p) => p.activity === "idle").length,
    offline: people.filter((p) => p.activity === "offline").length,
  };

  const { heartbeatIntervalSeconds, idleDetectionSeconds, offlineThresholdSeconds } =
    DEFAULT_OFFICE_CONFIG;

  return (
    <>
      <PageHeader
        title="Live Activity"
        description={`Active / Idle / Offline status only. Idle after ${idleDetectionSeconds} s without input; offline after ${offlineThresholdSeconds} s without a heartbeat (sent every ${heartbeatIntervalSeconds} s).`}
        actions={
          <Badge variant="muted">
            <Radio className="size-3" aria-hidden="true" />
            Static snapshot · realtime not connected
          </Badge>
        }
      />

      <DemoBanner />

      <section aria-label="Status summary" className="grid gap-4 sm:grid-cols-3">
        {(["active", "idle", "offline"] as const).map((state) => (
          <Card key={state}>
            <CardContent className="flex items-center justify-between pt-5">
              <ActivityIndicator state={state} />
              <span className="text-2xl font-semibold text-navy tabular-nums">{counts[state]}</span>
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-label="Employees" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => (
          <Card key={p.employeeCode} className={cn("border-l-4", STATE_RING[p.activity])}>
            <CardContent className="space-y-4 pt-5">
              <EmployeeCell
                fullName={p.fullName}
                employeeCode={p.employeeCode}
                subtitle={p.department}
              />
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="mt-1">
                    <ActivityIndicator state={p.activity} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">For</dt>
                  <dd className="mt-1 text-sm font-medium tabular-nums">{p.activitySince}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Heartbeat</dt>
                  <dd className="mt-1 text-sm font-medium tabular-nums">
                    {p.lastHeartbeat ?? "None today"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}
